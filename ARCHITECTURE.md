# EPUB Combiner API - Architecture & Technical Documentation

**Version**: 1.0.0  
**Last Updated**: February 2, 2026  
**Author**: Pulkit Vashishta  
**Status**: Production Deployed at https://epub-combiner-api.onrender.com

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Development Timeline](#development-timeline)
3. [Project Structure](#project-structure)
4. [Architecture](#architecture)
5. [Core Components](#core-components)
6. [Key Variables & Constants](#key-variables--constants)
7. [Data Flow](#data-flow)
8. [Important Algorithms](#important-algorithms)
9. [API Specification](#api-specification)
10. [Configuration](#configuration)
11. [Deployment Strategy](#deployment-strategy)
12. [Known Issues & Solutions](#known-issues--solutions)
13. [Future Enhancements](#future-enhancements)

---

## Project Overview

### Purpose
EPUB Combiner API is a RESTful web service that merges multiple EPUB files into a single valid EPUB file while preserving all formatting, images, styles, and fonts.

### Core Problem Solved
Users have multiple EPUB books they want to read as one continuous document. The API:
- Combines multiple EPUBs into a single file
- Automatically generates a Table of Contents with links to each book
- Ensures images and resources don't get mixed up between books
- Validates file integrity
- Maintains EPUB 2.0 specification compliance

### Use Cases
- Combining book series into one volume
- Merging chapters from different sources
- Creating study materials from multiple textbooks
- Combining technical documentation

---

## Development Timeline

### Phase 1: Core Development (January 2026)
- **Date**: January 2026
- **Deliverables**:
  - Express.js API server setup
  - Basic EPUB parsing and combining logic
  - File upload handling with multer
  - Configuration system
- **Commits**: Initial, TOC feature

### Phase 2: Feature Enhancement (Late January 2026)
- **Date**: Late January 2026
- **Deliverables**:
  - Automatic Table of Contents generation with styled HTML
  - Image isolation fix (preventing cross-contamination between books)
  - Improved resource management
- **Key Issue Fixed**: Images from book 2 appearing in book 3 - resolved by adding `bookIndex` tracking
- **Commits**: TOC implementation, image isolation fix

### Phase 3: Deployment & CORS (Early February 2026)
- **Date**: Early February 1-2, 2026
- **Deliverables**:
  - CORS middleware configuration with allowlist
  - Vercel deployment attempt (failed: 4.5MB limit)
  - Render deployment (successful: 100MB limit)
  - GitHub integration and documentation
- **Infrastructure**:
  - Frontend: Vercel (https://merge-epubs.vercel.app)
  - Backend API: Render (https://epub-combiner-api.onrender.com)
- **Commits**: CORS setup, Vercel config, Render config, cleanup

### Phase 4: Production Stabilization (February 2-2, 2026)
- **Date**: February 2, 2026
- **Deliverables**:
  - Deployment path resolution issues resolved
  - render.yaml configuration
  - Production health checks passing
  - Direct frontend-to-backend API calls enabled
- **Key Deployment Challenge**: Render auto-detecting `src/` as root directory
- **Solution**: Create render.yaml with explicit `rootDir: .`

---

## Project Structure

```
combine-epub/
├── src/
│   ├── index.js                 # Main Express app + route handlers
│   └── epubCombiner.js          # Core EPUB combining logic
├── config.js                    # Configuration constants
├── package.json                 # Dependencies and metadata
├── render.yaml                  # Render deployment configuration
├── render.json                  # Legacy Render config (deprecated)
├── README.md                    # User-facing documentation
├── INTEGRATION.md               # Developer integration guide
├── ARCHITECTURE.md              # This file (internal documentation)
├── .gitignore                   # Git ignore rules
├── .git/                        # Git repository
├── temp/                        # Temporary processing directory (local dev only)
└── node_modules/                # Dependencies (generated)
```

### Key Directory Purposes

| Directory | Purpose |
|-----------|---------|
| `src/` | Main application code |
| `temp/` | Local temp storage (production uses `/tmp`) |
| `node_modules/` | NPM dependencies |

---

## Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Vercel)                        │
│              https://merge-epubs.vercel.app                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTP/multipart-form-data
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   CORS Middleware                           │
│    (Validates origin: merge-epubs.vercel.app, localhost)    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                Express Route Handler                        │
│              POST /combine-epubs (src/index.js)             │
│                                                             │
│  1. Multer processes multipart form data                   │
│  2. Validates file type (EPUB), count (2-10), size (50MB) │
│  3. Passes buffers to combineEpubs()                       │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Core Combining Engine                          │
│            (epubCombiner.js - combineEpubs)                │
│                                                             │
│  1. Parse each EPUB (JSZip)                                │
│  2. Extract metadata, chapters, images, styles            │
│  3. Generate TOC page with links                           │
│  4. Create combined OPF and NCX files                      │
│  5. Assemble new EPUB with proper namespacing              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Response (application/epub+zip)                │
│           Download: combined.epub (binary buffer)           │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Architecture

```
GitHub Repository
(pulkitv/epub-combiner-api)
         │
         │ (via Render webhook)
         ▼
┌─────────────────────────────────────┐
│   Render Platform (Node.js)         │
│                                     │
│  Build: npm install                │
│  Start: npm start                   │
│  Environment: NODE_ENV=production   │
│  Memory: 256-512MB                  │
│  Upload Limit: 100MB                │
└─────────────────────────────────────┘
         │
         │ Exposes
         ▼
https://epub-combiner-api.onrender.com
```

---

## Core Components

### 1. **src/index.js** - Express Application Server

**Responsibility**: HTTP server setup, routing, middleware, request handling

**Key Exports**:
- `app` (Express application instance)

**Key Middleware**:
```javascript
// CORS Configuration
const allowlist = [
  'https://merge-epubs.vercel.app',  // Frontend URL
  'http://localhost:3000',            // Local development
  'http://localhost:5173',            // Vite dev server
  'http://localhost:8080'             // Alternative local
];

const corsOptions = {
  origin: (origin, callback) => {
    // Only allow requests from allowlist
    if (!origin || allowlist.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
```

**Routes**:

| Method | Path | Purpose | Response |
|--------|------|---------|----------|
| GET | `/` | Health check | `{"status":"ok"}` |
| GET | `/health` | Health endpoint | Full config + status |
| GET | `/config` | Get configuration | All settings |
| POST | `/combine-epubs` | Combine EPUBs | Binary EPUB file |

**Multer Configuration**:
```javascript
const storage = multer.memoryStorage();  // Keep files in memory, don't write to disk
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.maxFileSize,     // 50MB per file
    files: config.maxFiles             // 10 files max
  },
  fileFilter: (req, file, cb) => {
    // Only accept .epub files
    if (file.originalname.endsWith('.epub')) {
      cb(null, true);
    } else {
      cb(new Error('Only EPUB files allowed'));
    }
  }
});
```

**Error Handling**:
- Validates file count (min 2, max 10)
- Validates file size (max 50MB each)
- Validates file type (.epub extension)
- Returns appropriate HTTP status codes (400 for client errors, 500 for server errors)

**Serverless Considerations**:
```javascript
// Only start listening if not running on Vercel/serverless
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`EPUB Combiner API running on http://localhost:${config.port}`);
  });
}

// Export for serverless platforms
export default app;
```

---

### 2. **src/epubCombiner.js** - Core EPUB Merging Engine

**Responsibility**: EPUB file parsing, merging logic, TOC generation, resource management

**Key Export**:
```javascript
export async function combineEpubs(epubBuffers: Array<Buffer>): Promise<Buffer>
```

**Parameters**:
- `epubBuffers` - Array of EPUB file buffers (each EPUB is a ZIP archive)

**Returns**:
- Combined EPUB as Buffer (ready to send as HTTP response)

**Core Algorithm Steps**:

#### Step 1: Initialize Output ZIP
```javascript
const outputZip = new JSZip();

// Storage for resources across all books
const allChapters = [];          // XHTML content
const allImages = [];             // Image resources
const allStyles = [];             // CSS files
const allFonts = [];              // Font files
const bookMetadata = [];          // Per-book info
```

#### Step 2: Process Each Input EPUB (Loop)
For each EPUB buffer:

**2.1 Load and Parse**:
```javascript
const zip = await JSZip.loadAsync(epubBuffer);

// Get container.xml to locate content.opf
const containerXML = await zip.file('META-INF/container.xml').async('string');
const containerData = await parseXML(containerXML);
const contentOpfPath = containerData.container.rootfiles[0].rootfile[0].$['full-path'];
```

**2.2 Extract Metadata**:
```javascript
const contentOpfXML = await zip.file(contentOpfPath).async('string');
const opfData = await parseXML(contentOpfXML);

const metadata = opfData.package.metadata[0];
const bookTitle = metadata['dc:title'][0];
const bookAuthor = metadata['dc:creator'][0];

// Track with bookIndex to prevent resource cross-contamination
bookMetadata.push({
  title: bookTitle,
  author: bookAuthor,
  bookIndex: i  // CRITICAL: Per-book identifier
});
```

**2.3 Extract Content & Resources**:
```javascript
const manifest = opfData.package.manifest[0].item;
const spine = opfData.package.spine[0].itemref;  // Reading order

// For each chapter in spine order
for (const itemref of spine) {
  const itemId = itemref.$.idref;
  const manifestItem = manifestMap[itemId];
  
  if (manifestItem['media-type'] === 'application/xhtml+xml') {
    // Extract chapter with resource isolation
    const chapterPath = baseDir + manifestItem.href;
    const chapterContent = await zip.file(chapterPath).async('string');
    
    allChapters.push({
      content: chapterContent,
      bookIndex: i,            // CRITICAL: Prevents mixing
      originalPath: chapterPath
    });
  }
}

// Extract resources (images, fonts, styles)
// Each resource tagged with bookIndex
for (const item of manifest) {
  const resourcePath = baseDir + item.$.href;
  const resourceBuffer = await zip.file(resourcePath).async('arraybuffer');
  
  allImages.push({
    path: resourcePath,
    buffer: resourceBuffer,
    bookIndex: i,              // CRITICAL: Per-book tracking
    mediaType: item.$['media-type']
  });
}
```

#### Step 3: Generate Table of Contents Page
```javascript
// Create styled HTML TOC
const tocHtml = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html>
<head>
  <title>Table of Contents</title>
  <style>
    body { font-family: serif; }
    h1 { color: #333; }
    .toc-entry { margin: 10px 0; }
    a { text-decoration: none; color: #0066cc; }
  </style>
</head>
<body>
  <h1>Table of Contents</h1>
  ${bookMetadata.map((book, idx) => `
    <div class="toc-entry">
      <h3>${book.title}</h3>
      <p>By ${book.author}</p>
      <a href="${chapterLinkFromFirstBook[idx]}">Start reading</a>
    </div>
  `).join('')}
</body>
</html>
`;

allChapters.unshift({
  content: tocHtml,
  bookIndex: -1,  // Special marker for TOC
  path: 'OEBPS/toc.xhtml'
});
```

#### Step 4: Create Combined OPF (Package Document)
```javascript
// OPF structure: metadata, manifest, spine, guide
const opf = {
  package: {
    metadata: [{
      'dc:title': ['Combined EPUB'],
      'dc:creator': ['Multiple Authors'],
      'dc:language': ['en'],
      'dc:identifier': [uuid]
    }],
    manifest: [{
      item: [
        // TOC page
        { $: { id: 'toc', href: 'toc.xhtml', 'media-type': 'application/xhtml+xml' } },
        // All chapters
        ...allChapters.map((ch, idx) => ({
          $: { id: `chapter-${idx}`, href: `chapter-${idx}.xhtml`, ... }
        })),
        // All resources
        ...allImages.map((img, idx) => ({
          $: { id: `image-${idx}`, href: img.path, 'media-type': img.mediaType }
        }))
      ]
    }],
    spine: [{
      itemref: [
        // Reading order: TOC first, then all chapters
        { $: { idref: 'toc' } },
        ...allChapters.map((ch, idx) => ({ $: { idref: `chapter-${idx}` } }))
      ]
    }]
  }
};

// Convert to XML string
const opfXml = new Builder().buildObject(opf);
outputZip.file('OEBPS/content.opf', opfXml);
```

#### Step 5: Create NCX (Table of Contents Navigation)
```javascript
const ncx = {
  ncx: {
    head: [{ meta: [{ $: { name: 'dtb:uid', content: uuid } }] }],
    docTitle: [{ text: ['Combined EPUB'] }],
    navMap: [{
      navPoint: [
        { $: { id: 'nav-toc', playOrder: '1' },
          navLabel: [{ text: ['Table of Contents'] }],
          content: [{ $: { src: 'toc.xhtml' } }]
        },
        ...allChapters.map((ch, idx) => ({
          $: { id: `nav-ch-${idx}`, playOrder: `${idx + 2}` },
          navLabel: [{ text: [`Chapter ${idx + 1}`] }],
          content: [{ $: { src: `chapter-${idx}.xhtml` } }]
        }))
      ]
    }]
  }
};

const ncxXml = new Builder().buildObject(ncx);
outputZip.file('OEBPS/toc.ncx', ncxXml);
```

#### Step 6: Package Resources
```javascript
// Copy all images with book-specific paths
for (const image of allImages) {
  const newPath = `OEBPS/images/book-${image.bookIndex}-${uuid()}-${image.path.split('/').pop()}`;
  outputZip.file(newPath, image.buffer);
  
  // Update references in chapters
  for (const chapter of allChapters) {
    if (chapter.bookIndex === image.bookIndex) {
      chapter.content = chapter.content.replace(
        image.originalPath,
        newPath
      );
    }
  }
}

// Add required EPUB structure files
outputZip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
outputZip.file('META-INF/container.xml', containerXml);
```

#### Step 7: Generate and Return Combined EPUB
```javascript
const combinedBuffer = await outputZip.generateAsync({
  type: 'arraybuffer',
  compression: 'DEFLATE'
});

return Buffer.from(combinedBuffer);
```

**Critical Concept: Resource Isolation**

The `bookIndex` variable is crucial for preventing resource cross-contamination:
- Each chapter is tagged with which book it came from
- Each image is tagged with which book it came from
- When updating image paths in chapters, we only update paths in chapters from the same book
- This prevents images from appearing in the wrong book

---

### 3. **config.js** - Configuration Management

**Purpose**: Centralized settings for the API

**Exported Object**:
```javascript
export const config = {
  // Maximum number of EPUB files per request
  maxFiles: 10,
  
  // Maximum size per EPUB file in bytes (50MB)
  maxFileSize: 50 * 1024 * 1024,
  
  // Server port
  port: 3000,
  
  // Temporary directory for processing
  // Automatically switches to /tmp in production
  tempDir: './temp',
  
  // Output filename for combined EPUB
  outputFilename: 'combined.epub'
};
```

**Environment-Aware Behavior**:
- **Development**: Uses `./temp` for local processing
- **Production**: Uses `/tmp` (Render's ephemeral filesystem)
- **Serverless**: Not used (files kept in memory)

---

## Key Variables & Constants

### In src/index.js

| Variable | Type | Purpose | Example |
|----------|------|---------|---------|
| `app` | Express | Express application instance | Used for all routes |
| `allowlist` | Array<string> | CORS-allowed origins | `['https://merge-epubs.vercel.app', ...]` |
| `corsOptions` | Object | CORS middleware config | Validates origin, methods, headers |
| `tempDir` | string | Directory for temp files | `/tmp` or `./temp` |
| `upload` | multer.Middleware | File upload handler | Validates size, count, type |

### In src/epubCombiner.js

| Variable | Type | Purpose | Example |
|----------|------|---------|---------|
| `epubBuffers` | Array<Buffer> | Input EPUB files | Passed from route handler |
| `outputZip` | JSZip | Output EPUB being built | Added to with files |
| `allChapters` | Array<Object> | Combined chapters | `{content, bookIndex, path}` |
| `allImages` | Array<Object> | All images with metadata | `{path, buffer, bookIndex}` |
| `bookMetadata` | Array<Object> | Per-book info | `{title, author, bookIndex}` |
| `bookIndex` | number | Current book identifier | 0, 1, 2, ... |
| `manifestMap` | Object | EPUB manifest lookup | Maps item IDs to properties |
| `contentOpfPath` | string | Path to content.opf | `OEBPS/content.opf` |

### In config.js

| Constant | Value | Purpose |
|----------|-------|---------|
| `maxFiles` | 10 | Maximum EPUBs per request |
| `maxFileSize` | 52428800 | 50MB in bytes |
| `port` | 3000 | Default port |
| `tempDir` | './temp' | Local temp directory |
| `outputFilename` | 'combined.epub' | Output name |

---

## Data Flow

### Complete Request/Response Flow

```
1. USER UPLOADS FILES
   Frontend sends POST with 3 EPUB files
   ├─ Content-Type: multipart/form-data
   ├─ Field name: "epubs"
   └─ Files: book1.epub, book2.epub, book3.epub

2. CORS MIDDLEWARE
   ├─ Check origin (must be in allowlist)
   ├─ Handle OPTIONS preflight if needed
   └─ Allow or reject request

3. ROUTE HANDLER (POST /combine-epubs)
   ├─ Multer processes multipart form data
   ├─ Validates file count (2-10)
   ├─ Validates each file size (<50MB)
   ├─ Validates file extension (.epub)
   └─ Passes req.files.epubs to combineEpubs()

4. COMBINEEPUBS() - For each EPUB (loop):
   ├─ Load EPUB with JSZip
   ├─ Parse container.xml → find content.opf
   ├─ Parse content.opf → extract metadata, manifest, spine
   ├─ For each chapter in spine order:
   │  ├─ Extract XHTML content
   │  ├─ Tag with bookIndex
   │  └─ Add to allChapters[]
   ├─ For each resource (images, fonts):
   │  ├─ Extract buffer
   │  ├─ Tag with bookIndex
   │  └─ Add to allImages[]
   ├─ Store metadata (title, author)
   └─ Tag metadata with bookIndex

5. TABLE OF CONTENTS GENERATION
   ├─ Create styled HTML page
   ├─ Add links to first chapter of each book
   ├─ Insert as first chapter (playOrder=1)
   └─ Tag with bookIndex=-1 (special marker)

6. COMBINED OPF CREATION
   ├─ Create package.metadata (combined title/author)
   ├─ Create package.manifest (all items)
   │  ├─ TOC page
   │  ├─ All chapters with unique IDs
   │  └─ All resources with namespaced paths
   ├─ Create package.spine (reading order)
   │  ├─ TOC first
   │  └─ Chapters in order
   └─ Convert to XML

7. COMBINED NCX (NAVIGATION) CREATION
   ├─ Create navMap with all chapters
   ├─ Set reading order (playOrder)
   └─ Convert to XML

8. RESOURCE ASSEMBLY
   ├─ For each chapter:
   │  ├─ Update image paths to new namespaced paths
   │  ├─ Only update images with same bookIndex
   │  └─ Add updated chapter to output
   ├─ For each image/resource:
   │  ├─ Create namespaced path: OEBPS/images/book-{bookIndex}-{uuid}-filename
   │  ├─ Copy to output ZIP
   │  └─ Tag with bookIndex for isolation

9. EPUB STRUCTURE COMPLETION
   ├─ Add mimetype file (no compression)
   ├─ Add META-INF/container.xml
   ├─ Add OEBPS/content.opf
   ├─ Add OEBPS/toc.ncx
   └─ All chapters and resources already added

10. ZIP GENERATION
    ├─ Generate combined ZIP buffer
    ├─ Use DEFLATE compression
    └─ Return as Buffer

11. RESPONSE SENT
    ├─ Set Content-Type: application/epub+zip
    ├─ Set Content-Disposition: attachment; filename=combined.epub
    ├─ Send buffer as response body
    └─ Browser downloads as combined.epub
```

---

## Important Algorithms

### 1. Resource Isolation Algorithm

**Purpose**: Prevent images/resources from appearing in wrong chapters

**Logic**:
```
For each chapter in combined chapters:
  For each reference in chapter (e.g., img src, link href):
    If reference is a resource:
      Get the book that this chapter belongs to (from chapter.bookIndex)
      Get the book that this resource belongs to (from resource.bookIndex)
      
      If bookIndexes match:
        Update reference to new namespaced path
      Else:
        Leave reference unchanged (won't be resolved, correctly ignored)
      End If
    End If
  End For
End For
```

**Example**:
```
Book 1, Chapter 1 has image reference: ../Images/cover.jpg
  bookIndex = 0
  
Book 2, Chapter 1 has image reference: ../Images/cover.jpg
  bookIndex = 1

When combining:
  - Book 1's images get renamed to: images/book-0-uuid-cover.jpg
  - Book 2's images get renamed to: images/book-1-uuid-cover.jpg
  
  - In Book 1, Chapter 1: update ../Images/cover.jpg → images/book-0-uuid-cover.jpg
  - In Book 2, Chapter 1: update ../Images/cover.jpg → images/book-1-uuid-cover.jpg
  
Result: Each book's images only appear in that book's chapters
```

### 2. Chapter Ordering Algorithm

**Purpose**: Maintain correct reading order of chapters

**Logic**:
```
Parse EPUB's OPF spine element:
  spine.itemref = [
    {idref: "chapter1"},
    {idref: "chapter3"},
    {idref: "chapter2"},  // Note: not in sequential order
    ...
  ]

The spine defines the actual reading order, NOT filename order!

So we must:
1. For each itemref in spine (in order):
   - Get the itemref's idref attribute
   - Look up that ID in the manifest
   - Find the file path for that ID
   - Extract that file in THIS order
   - Don't extract other chapters

2. This preserves the author's intended chapter order
3. Different EPUBs may have different chapter orderings
```

### 3. Path Resolution Algorithm

**Purpose**: Find all resources relative to base directory

**Logic**:
```
Given: contentOpfPath = "OEBPS/content.opf"

Extract baseDir:
  baseDir = "OEBPS/" (everything up to and including last /)
  
When finding resources relative to OPF:
  If manifest item href = "Images/cover.jpg"
    Full path = baseDir + href = "OEBPS/Images/cover.jpg"
  
  If manifest item href = "../fonts/arial.ttf"
    This would resolve to: "fonts/arial.ttf" (outside OEBPS)
    Full path = baseDir + href = "OEBPS/../fonts/arial.ttf" = "fonts/arial.ttf"

This correctly handles relative paths!
```

---

## API Specification

### Endpoint: POST /combine-epubs

**Purpose**: Combine multiple EPUB files into one

**Request**:
```
POST https://epub-combiner-api.onrender.com/combine-epubs HTTP/1.1
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="epubs"; filename="book1.epub"
Content-Type: application/zip

[BINARY EPUB DATA]
------WebKitFormBoundary
Content-Disposition: form-data; name="epubs"; filename="book2.epub"
Content-Type: application/zip

[BINARY EPUB DATA]
------WebKitFormBoundary--
```

**Request Validation**:
- Minimum files: 2
- Maximum files: 10 (configurable)
- File size: Max 50MB per file
- File type: Must be .epub
- CORS: Origin must be in allowlist

**Response Success (200)**:
```
HTTP/1.1 200 OK
Content-Type: application/epub+zip
Content-Disposition: attachment; filename=combined.epub
Content-Length: 125432

[BINARY COMBINED EPUB DATA]
```

**Response Error (400 - Bad Request)**:
```json
{
  "error": "Too many files",
  "message": "Maximum 10 files allowed"
}
```

**Response Error (413 - Payload Too Large)**:
```json
{
  "error": "File too large",
  "message": "File size must be less than 50MB"
}
```

**Response Error (500 - Server Error)**:
```json
{
  "error": "Combination failed",
  "message": "Error combining EPUBs: [detailed error message]"
}
```

---

## Configuration

### config.js

```javascript
export const config = {
  maxFiles: 10,                           // Adjust for more/fewer files
  maxFileSize: 50 * 1024 * 1024,         // 50MB - adjust for larger files
  port: 3000,                             // Change for different port
  tempDir: './temp',                      // Not used in current setup (memory-based)
  outputFilename: 'combined.epub'         // Output filename
};
```

### Environment Variables (Render)

Managed in Render Dashboard:
- `NODE_ENV` = `production` (set in render.yaml)
- `PORT` = Auto-assigned by Render

### CORS Configuration (src/index.js)

```javascript
const allowlist = [
  'https://merge-epubs.vercel.app',  // Add your frontend URL here
  'http://localhost:3000',            // Local development
  'http://localhost:5173',            // Vite default port
  'http://localhost:8080'             // Common dev port
];
```

To add a new frontend URL:
1. Edit `src/index.js`
2. Add URL to `allowlist` array
3. Commit and push
4. Redeploy on Render

---

## Deployment Strategy

### Current Deployment

**Architecture**:
- **API Backend**: Render (Node.js platform)
  - URL: https://epub-combiner-api.onrender.com
  - Region: Auto-assigned by Render
  - Memory: 256-512MB
  - Upload Limit: 100MB
  - Build: `npm install`
  - Start: `npm start`

- **Frontend**: Vercel (Static/React platform)
  - URL: https://merge-epubs.vercel.app
  - Calls backend API at https://epub-combiner-api.onrender.com

### Deployment Configuration Files

**render.yaml**:
```yaml
services:
  - type: web
    name: epub-combiner
    runtime: node
    buildCommand: npm install
    startCommand: npm start
    rootDir: .                 # Critical: tells Render not to auto-detect src/
    envVars:
      - key: NODE_ENV
        value: production
```

### Why Render (not Vercel)?

| Aspect | Vercel | Render |
|--------|--------|--------|
| Upload Limit | 4.5MB | 100MB |
| Supported | Serverless only | Node.js servers |
| Memory | Limited | 256-512MB |
| Best For | Frontend | Backend API |

Vercel was initially tried but couldn't handle the upload size. Render was chosen for the 100MB limit and Node.js support.

### Deployment Checklist

- [ ] Code committed and pushed to GitHub
- [ ] render.yaml configured correctly
- [ ] CORS allowlist includes frontend URL
- [ ] Environment variables set in Render Dashboard
- [ ] Manual Deploy button clicked
- [ ] Health endpoint tested: `curl https://epub-combiner-api.onrender.com/health`
- [ ] Test with frontend application

---

## Known Issues & Solutions

### Issue 1: Render Auto-Detecting `src/` as Root

**Problem**: Render runs npm from `src/` directory instead of project root, causing "package.json not found" errors.

**Root Cause**: Render's auto-detection logic detects the `src/` folder and assumes it's the application directory.

**Solution Implemented**: Created `render.yaml` with explicit `rootDir: .` configuration.

**If Still Occurring**:
1. Delete and recreate the service on Render
2. During setup, explicitly set "Root Directory" to `.` (dot)
3. Let Render use the render.yaml from the start

### Issue 2: Images Appearing in Wrong Chapters

**Problem**: Images from book 2 appearing in book 1's chapters.

**Root Cause**: Initial version didn't track which book each resource belonged to.

**Solution Implemented**: Added `bookIndex` tracking to all resources and chapters, ensuring updates only affect same-book resources.

**Code Change**:
```javascript
// Before: No isolation
chapters.push({ content });
images.push({ path, buffer });

// After: With isolation
chapters.push({ content, bookIndex: i });  // i = book number
images.push({ path, buffer, bookIndex: i });

// During assembly: Only update same-book resources
if (chapter.bookIndex === image.bookIndex) {
  // Update image path in this chapter
}
```

### Issue 3: CORS Errors from Frontend

**Problem**: Frontend getting CORS errors when calling API.

**Root Cause**: CORS not properly configured in Express.

**Solution Implemented**: Added CORS middleware with allowlist:
```javascript
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowlist.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));  // Handle preflight
```

### Issue 4: 413 Payload Too Large

**Problem**: Frontend proxying through Vercel, hitting Vercel's 4.5MB limit.

**Root Cause**: Vercel's Hobby plan doesn't support higher request limits.

**Solution**: Frontend now calls Render API directly instead of proxying through Vercel.

**Frontend Code Update**:
```javascript
// Before: Proxying through Vercel
const response = await fetch('/api/combine-epubs', { method: 'POST', body: formData });

// After: Direct Render call
const response = await fetch('https://epub-combiner-api.onrender.com/combine-epubs', { 
  method: 'POST', 
  body: formData 
});
```

---

## Future Enhancements

### High Priority

1. **Database Integration**
   - Track combine requests and user history
   - Store metadata about combined EPUBs
   - User authentication and management

2. **Batch Processing**
   - Handle multiple combine requests asynchronously
   - Queue system for large files
   - Job status tracking

3. **Advanced TOC Generation**
   - Preserve original TOC from each book
   - Merge TOCs intelligently
   - Clickable inline TOC within chapters

4. **Format Conversion**
   - Export to PDF
   - Export to MOBI (Kindle)
   - Export to plain text

### Medium Priority

5. **File Metadata Editor**
   - Edit combined EPUB title/author after combining
   - Add custom cover image
   - Modify reading order

6. **Advanced Resource Management**
   - Remove duplicate images across books
   - Optimize image compression
   - Remove unused CSS/fonts

7. **Validation & Testing**
   - EPUB structure validation
   - Compatibility testing with readers
   - Automated regression tests

### Low Priority

8. **Performance Optimization**
   - Caching of common resources
   - Incremental combining
   - Streaming response for large files

9. **API Enhancements**
   - Webhooks for combine completion
   - WebSocket support for progress tracking
   - Rate limiting and API keys

10. **Documentation**
    - API documentation (OpenAPI/Swagger)
    - Video tutorials
    - Mobile app client

---

## Technical Debt & Maintenance

### Current Maintenance Tasks

- Monitor Render logs for errors
- Test with various EPUB formats
- Update dependencies regularly (`npm audit`, `npm update`)
- Monitor API response times
- Track error rates

### Testing Strategy

- **Manual Testing**: Test with real EPUB files
- **Unit Tests**: Test EPUB parsing logic separately
- **Integration Tests**: Test end-to-end combining
- **Load Testing**: Stress test with many files

### Documentation Updates

Update this ARCHITECTURE.md when:
- Adding new endpoints
- Changing core algorithm
- Modifying configuration
- Deploying to new platform
- Making significant bug fixes

---

## References & Dependencies

### NPM Dependencies

```json
{
  "express": "^4.18.2",           // Web server
  "multer": "^1.4.5-lts.1",       // File upload
  "jszip": "^3.10.1",             // ZIP/EPUB handling
  "xml2js": "^0.6.2",             // XML parsing/building
  "uuid": "^9.0.0",               // Unique identifiers
  "cors": "^2.8.5"                // CORS middleware
}
```

### External Resources

- EPUB Specification: https://idpf.github.io/epub-spec/
- JSZip Documentation: https://stuk.github.io/jszip/
- Express.js Guide: https://expressjs.com/
- Render Deployment: https://render.com/docs

---

## Contact & Support

**GitHub Repository**: https://github.com/pulkitv/epub-combiner-api  
**Deployed API**: https://epub-combiner-api.onrender.com  
**Frontend**: https://merge-epubs.vercel.app  
**Developer**: Pulkit Vashishta

---

**Last Updated**: February 2, 2026  
**Next Review**: February 16, 2026 (2 weeks)
