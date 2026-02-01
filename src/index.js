import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { combineEpubs } from './epubCombiner.js';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

const app = express();

// Enable CORS for all origins (configure for production)
app.use(cors({
  origin: '*', // Allow all origins for development. In production, specify your domain.
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));

// Ensure temp directory exists (optional, not required for memory storage)
// Use /tmp for serverless environments (Vercel, etc.)
const tempDir = process.env.NODE_ENV === 'production' ? '/tmp' : config.tempDir;

try {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
} catch (err) {
  // Silently fail if temp directory creation fails (serverless environments)
  console.warn('Warning: Could not create temp directory:', tempDir);
}

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.maxFileSize,
    files: config.maxFiles
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an EPUB
    if (file.mimetype === 'application/epub+zip' || file.originalname.endsWith('.epub')) {
      cb(null, true);
    } else {
      cb(new Error('Only EPUB files are allowed'));
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint - API information
app.get('/', (req, res) => {
  res.json({
    name: 'EPUB Combiner API',
    version: '1.0.0',
    description: 'Combine multiple EPUB files into a single EPUB with automatic Table of Contents',
    endpoints: {
      'GET /': 'This endpoint - API information',
      'GET /health': 'Health check',
      'GET /config': 'API configuration',
      'POST /combine-epubs': 'Combine multiple EPUB files'
    },
    usage: 'POST /combine-epubs with multipart/form-data containing "epubs" files',
    documentation: 'https://github.com/pulkitv/epub-combiner-api',
    github: 'https://github.com/pulkitv/epub-combiner-api'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'EPUB Combiner API is running',
    config: {
      maxFiles: config.maxFiles,
      maxFileSize: `${config.maxFileSize / (1024 * 1024)}MB`
    }
  });
});

// Main API endpoint to combine EPUBs
app.post('/combine-epubs', upload.array('epubs', config.maxFiles), async (req, res) => {
  try {
    // Validate that files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        error: 'No files uploaded',
        message: 'Please upload at least one EPUB file' 
      });
    }

    // Validate minimum files
    if (req.files.length < 2) {
      return res.status(400).json({ 
        error: 'Insufficient files',
        message: 'Please upload at least 2 EPUB files to combine' 
      });
    }

    // Validate maximum files
    if (req.files.length > config.maxFiles) {
      return res.status(400).json({ 
        error: 'Too many files',
        message: `Maximum ${config.maxFiles} files allowed` 
      });
    }

    console.log(`Processing ${req.files.length} EPUB files...`);

    // Extract file buffers
    const epubBuffers = req.files.map(file => file.buffer);

    // Combine the EPUBs
    const combinedEpubBuffer = await combineEpubs(epubBuffers);

    // Set response headers
    res.setHeader('Content-Type', 'application/epub+zip');
    res.setHeader('Content-Disposition', `attachment; filename="${config.outputFilename}"`);
    res.setHeader('Content-Length', combinedEpubBuffer.length);

    // Send the combined EPUB file
    res.send(combinedEpubBuffer);

    console.log(`Successfully combined ${req.files.length} EPUB files`);
  } catch (error) {
    console.error('Error combining EPUBs:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to combine EPUB files',
      details: error.message 
    });
  }
});

// Get configuration
app.get('/config', (req, res) => {
  res.json({
    maxFiles: config.maxFiles,
    maxFileSize: config.maxFileSize,
    maxFileSizeMB: config.maxFileSize / (1024 * 1024),
    port: config.port
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large',
        message: `File size must be less than ${config.maxFileSize / (1024 * 1024)}MB` 
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        error: 'Too many files',
        message: `Maximum ${config.maxFiles} files allowed` 
      });
    }
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: 'The requested endpoint does not exist' 
  });
});

// Start server (skip on serverless platforms like Vercel)
if (!process.env.VERCEL) {
  const PORT = config.port;
  app.listen(PORT, () => {
    console.log(`EPUB Combiner API is running on http://localhost:${PORT}`);
    console.log(`Maximum files per request: ${config.maxFiles}`);
    console.log(`Maximum file size: ${config.maxFileSize / (1024 * 1024)}MB`);
  });
}

export default app;
