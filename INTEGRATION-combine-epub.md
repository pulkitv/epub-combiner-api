# EPUB Combiner API - Integration Guide

This guide explains how to integrate the EPUB Combiner API into your project.

## API Overview

**Base URL:** `http://localhost:3000` (or your deployed URL)

**Purpose:** Combine multiple EPUB files into a single EPUB file with automatic Table of Contents

**Rate Limits:** Configurable (default: 10 files max per request, 50MB per file)

## Quick Start

```bash
# Example: Combine 3 EPUB files
curl -X POST http://your-api-url.com/combine-epubs \
  -F "epubs=@book1.epub" \
  -F "epubs=@book2.epub" \
  -F "epubs=@book3.epub" \
  -o combined.epub
```

---

## API Endpoints

### 1. Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "message": "EPUB Combiner API is running",
  "config": {
    "maxFiles": 10,
    "maxFileSize": "50MB"
  }
}
```

**Use Case:** Check if API is available before making requests

---

### 2. Get Configuration

```http
GET /config
```

**Response:**
```json
{
  "maxFiles": 10,
  "maxFileSize": 52428800,
  "maxFileSizeMB": 50,
  "port": 3000
}
```

**Use Case:** Validate file sizes and count before uploading

---

### 3. Combine EPUBs (Main Endpoint)

```http
POST /combine-epubs
```

**Request:**
- **Content-Type:** `multipart/form-data`
- **Field Name:** `epubs` (multiple files)
- **File Type:** `.epub` files only
- **Min Files:** 2
- **Max Files:** 10 (configurable)
- **Max File Size:** 50MB per file (configurable)

**Response:**
- **Content-Type:** `application/epub+zip`
- **Content-Disposition:** `attachment; filename="combined.epub"`
- **Body:** Binary EPUB file data

**Success (200):** Returns the combined EPUB file as a binary stream

**Errors:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | No files uploaded | Request did not include any files |
| 400 | Insufficient files | Less than 2 EPUB files provided |
| 400 | Too many files | More than max allowed files (default: 10) |
| 400 | File too large | One or more files exceed size limit (default: 50MB) |
| 400 | Invalid file type | Non-EPUB file uploaded |
| 500 | Internal server error | Processing failed (check logs) |

**Error Response Format:**
```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": "Additional error details (optional)"
}
```

---

## Integration Examples

### JavaScript (Node.js)

```javascript
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function combineEpubs(epubPaths, outputPath) {
  const formData = new FormData();
  
  // Add each EPUB file to the form
  epubPaths.forEach(path => {
    formData.append('epubs', fs.createReadStream(path));
  });
  
  try {
    const response = await axios.post(
      'http://localhost:3000/combine-epubs',
      formData,
      {
        headers: formData.getHeaders(),
        responseType: 'arraybuffer'
      }
    );
    
    // Save the combined EPUB
    fs.writeFileSync(outputPath, response.data);
    console.log('Combined EPUB saved to:', outputPath);
    return outputPath;
    
  } catch (error) {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else {
      console.error('Request Error:', error.message);
    }
    throw error;
  }
}

// Usage
combineEpubs(
  ['book1.epub', 'book2.epub', 'book3.epub'],
  'combined-output.epub'
);
```

### JavaScript (Browser/Frontend)

```javascript
async function combineEpubsInBrowser(fileInputElement) {
  const formData = new FormData();
  const files = fileInputElement.files;
  
  // Validate file count
  if (files.length < 2) {
    alert('Please select at least 2 EPUB files');
    return;
  }
  
  if (files.length > 10) {
    alert('Maximum 10 files allowed');
    return;
  }
  
  // Add files to form data
  for (let file of files) {
    formData.append('epubs', file);
  }
  
  try {
    const response = await fetch('http://localhost:3000/combine-epubs', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    // Download the combined EPUB
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'combined.epub';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    console.log('Combined EPUB downloaded successfully');
    
  } catch (error) {
    console.error('Error combining EPUBs:', error);
    alert('Failed to combine EPUBs: ' + error.message);
  }
}

// HTML
// <input type="file" id="epubFiles" multiple accept=".epub">
// <button onclick="combineEpubsInBrowser(document.getElementById('epubFiles'))">
//   Combine EPUBs
// </button>
```

### Python

```python
import requests

def combine_epubs(epub_files, output_path):
    """
    Combine multiple EPUB files using the API
    
    Args:
        epub_files: List of file paths to EPUB files
        output_path: Path where combined EPUB will be saved
        
    Returns:
        Path to the combined EPUB file
    """
    url = 'http://localhost:3000/combine-epubs'
    
    # Prepare files for upload
    files = [('epubs', open(epub, 'rb')) for epub in epub_files]
    
    try:
        response = requests.post(url, files=files)
        
        # Check for errors
        if response.status_code != 200:
            error_data = response.json()
            raise Exception(f"API Error: {error_data.get('message', 'Unknown error')}")
        
        # Save the combined EPUB
        with open(output_path, 'wb') as f:
            f.write(response.content)
        
        print(f'Combined EPUB saved to: {output_path}')
        return output_path
        
    except requests.exceptions.RequestException as e:
        print(f'Request failed: {e}')
        raise
    finally:
        # Close all file handles
        for _, file_handle in files:
            file_handle.close()

# Usage
combine_epubs(
    ['book1.epub', 'book2.epub', 'book3.epub'],
    'combined-output.epub'
)
```

### Python with Error Handling

```python
import requests
import os

class EpubCombinerClient:
    def __init__(self, api_url='http://localhost:3000'):
        self.api_url = api_url
        self.config = None
        
    def get_config(self):
        """Fetch API configuration"""
        response = requests.get(f'{self.api_url}/config')
        self.config = response.json()
        return self.config
    
    def validate_files(self, epub_files):
        """Validate files before upload"""
        if not self.config:
            self.get_config()
        
        # Check file count
        if len(epub_files) < 2:
            raise ValueError('At least 2 EPUB files required')
        
        if len(epub_files) > self.config['maxFiles']:
            raise ValueError(f"Maximum {self.config['maxFiles']} files allowed")
        
        # Check file sizes
        max_size = self.config['maxFileSize']
        for epub in epub_files:
            if not os.path.exists(epub):
                raise FileNotFoundError(f'File not found: {epub}')
            
            size = os.path.getsize(epub)
            if size > max_size:
                raise ValueError(
                    f'File {epub} is too large: {size} bytes '
                    f'(max: {max_size} bytes)'
                )
    
    def combine(self, epub_files, output_path):
        """Combine EPUB files"""
        # Validate first
        self.validate_files(epub_files)
        
        # Prepare upload
        files = [('epubs', (os.path.basename(epub), open(epub, 'rb'), 'application/epub+zip')) 
                 for epub in epub_files]
        
        try:
            response = requests.post(
                f'{self.api_url}/combine-epubs',
                files=files,
                timeout=300  # 5 minute timeout for large files
            )
            
            if response.status_code == 200:
                with open(output_path, 'wb') as f:
                    f.write(response.content)
                return output_path
            else:
                error = response.json()
                raise Exception(f"{error.get('error')}: {error.get('message')}")
                
        finally:
            for _, (_, file_handle, _) in files:
                file_handle.close()

# Usage
client = EpubCombinerClient('http://localhost:3000')

try:
    result = client.combine(
        ['book1.epub', 'book2.epub', 'book3.epub'],
        'combined.epub'
    )
    print(f'Success! Combined EPUB: {result}')
except Exception as e:
    print(f'Error: {e}')
```

### PHP

```php
<?php

function combineEpubs($epubFiles, $outputPath, $apiUrl = 'http://localhost:3000') {
    $curl = curl_init();
    
    // Prepare multipart form data
    $postData = [];
    foreach ($epubFiles as $file) {
        if (!file_exists($file)) {
            throw new Exception("File not found: $file");
        }
        $postData[] = curl_file_create($file, 'application/epub+zip', basename($file));
    }
    
    curl_setopt_array($curl, [
        CURLOPT_URL => "$apiUrl/combine-epubs",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => ['epubs' => $postData],
        CURLOPT_HTTPHEADER => [
            'Accept: application/epub+zip'
        ]
    ]);
    
    $response = curl_exec($curl);
    $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    
    if ($httpCode !== 200) {
        $error = json_decode($response, true);
        throw new Exception("API Error: " . ($error['message'] ?? 'Unknown error'));
    }
    
    curl_close($curl);
    
    // Save the combined EPUB
    file_put_contents($outputPath, $response);
    
    return $outputPath;
}

// Usage
try {
    $result = combineEpubs(
        ['book1.epub', 'book2.epub', 'book3.epub'],
        'combined.epub'
    );
    echo "Combined EPUB saved to: $result\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
```

### Ruby

```ruby
require 'httparty'
require 'tempfile'

class EpubCombinerClient
  def initialize(api_url = 'http://localhost:3000')
    @api_url = api_url
  end
  
  def combine(epub_files, output_path)
    # Prepare multipart form data
    files = epub_files.map do |file_path|
      [:epubs, File.open(file_path)]
    end
    
    response = HTTParty.post(
      "#{@api_url}/combine-epubs",
      multipart: true,
      body: Hash[files]
    )
    
    if response.code == 200
      File.open(output_path, 'wb') { |f| f.write(response.body) }
      puts "Combined EPUB saved to: #{output_path}"
      output_path
    else
      error = JSON.parse(response.body)
      raise "API Error: #{error['message']}"
    end
  ensure
    # Close all file handles
    files.each { |_, file| file.close }
  end
end

# Usage
client = EpubCombinerClient.new('http://localhost:3000')
client.combine(['book1.epub', 'book2.epub', 'book3.epub'], 'combined.epub')
```

---

## Response Processing

### What You Receive

The API returns a **complete, valid EPUB file** with:

1. **Binary EPUB data** (ZIP archive containing structured XHTML, images, etc.)
2. **Content-Disposition header** with filename `combined.epub`
3. **Content-Type** set to `application/epub+zip`

### What You Can Do With The Response

#### 1. Save to File System
```javascript
fs.writeFileSync('combined.epub', responseData);
```

#### 2. Upload to Cloud Storage
```javascript
// AWS S3 example
const s3 = new AWS.S3();
await s3.putObject({
  Bucket: 'my-bucket',
  Key: 'books/combined.epub',
  Body: responseData,
  ContentType: 'application/epub+zip'
}).promise();
```

#### 3. Stream to User (Download)
```javascript
// Express.js
app.get('/download', async (req, res) => {
  const epubData = await combineEpubs(...);
  res.setHeader('Content-Type', 'application/epub+zip');
  res.setHeader('Content-Disposition', 'attachment; filename=combined.epub');
  res.send(epubData);
});
```

#### 4. Send via Email
```javascript
// Nodemailer example
const transporter = nodemailer.createTransport({...});

await transporter.sendMail({
  to: 'user@example.com',
  subject: 'Your Combined EPUB',
  text: 'Please find your combined EPUB attached.',
  attachments: [{
    filename: 'combined.epub',
    content: epubData
  }]
});
```

#### 5. Process Further
```javascript
// Extract info from the EPUB
const JSZip = require('jszip');
const zip = await JSZip.loadAsync(epubData);

// Read TOC
const tocContent = await zip.file('OEBPS/Text/toc.xhtml').async('string');

// Extract images
const images = [];
zip.folder('OEBPS/Images').forEach((relativePath, file) => {
  images.push(relativePath);
});
```

---

## EPUB Structure

The combined EPUB contains:

```
combined.epub/
├── mimetype
├── META-INF/
│   └── container.xml
└── OEBPS/
    ├── content.opf          # Package document (manifest, spine, metadata)
    ├── toc.ncx             # Navigation control file
    ├── Text/
    │   ├── toc.xhtml       # Table of Contents page (FIRST PAGE)
    │   ├── chapter_0_*.xhtml  # Chapters from book 1
    │   ├── chapter_1_*.xhtml  # Chapters from book 2
    │   └── chapter_n_*.xhtml  # Chapters from book n
    ├── Images/
    │   ├── img_0_*.*       # Images from book 1
    │   ├── img_1_*.*       # Images from book 2
    │   └── img_n_*.*       # Images from book n
    ├── Styles/
    │   └── style_*_*.css   # CSS files (isolated per book)
    └── Fonts/
        └── font_*_*.*      # Font files (isolated per book)
```

### Table of Contents (TOC) Page

The first page of the combined EPUB is an HTML TOC with:
- Book titles (clickable links)
- Author names
- Book numbers
- Styled, readable format

**Example HTML structure:**
```html
<div class="toc-entry">
  <div class="book-number">Book 1</div>
  <div class="book-title">
    <a href="Text/chapter_0_ch1.xhtml">The Great Gatsby</a>
  </div>
  <div class="book-author">by F. Scott Fitzgerald</div>
</div>
```

---

## Integration Workflows

### Workflow 1: Batch Processing

```javascript
// Process multiple book series
const bookSeries = [
  ['series1-book1.epub', 'series1-book2.epub', 'series1-book3.epub'],
  ['series2-book1.epub', 'series2-book2.epub'],
  ['series3-book1.epub', 'series3-book2.epub', 'series3-book3.epub', 'series3-book4.epub']
];

for (const [index, books] of bookSeries.entries()) {
  await combineEpubs(books, `series-${index + 1}-combined.epub`);
}
```

### Workflow 2: On-Demand User Upload

```javascript
// Express.js endpoint
app.post('/api/user/combine-books', upload.array('epubs'), async (req, res) => {
  try {
    // User uploaded files are in req.files
    const epubFiles = req.files.map(f => f.path);
    
    // Call combiner API
    const combinedData = await combineEpubs(epubFiles, 'temp-combined.epub');
    
    // Return to user
    res.download('temp-combined.epub', 'combined.epub');
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Workflow 3: Scheduled Automation

```javascript
// Cron job to combine new books daily
const cron = require('node-cron');

cron.schedule('0 2 * * *', async () => {  // Run at 2 AM daily
  const newBooks = await findNewBooks();
  
  if (newBooks.length >= 2) {
    await combineEpubs(newBooks, `daily-combined-${Date.now()}.epub`);
  }
});
```

---

## Best Practices

### 1. Validate Before Upload
```javascript
// Check config first
const config = await fetch('http://localhost:3000/config').then(r => r.json());

if (files.length > config.maxFiles) {
  throw new Error(`Too many files. Max: ${config.maxFiles}`);
}
```

### 2. Handle Large Files
```javascript
// Use streaming for large responses
const response = await axios.post(url, formData, {
  responseType: 'stream',
  timeout: 600000  // 10 minute timeout
});

response.data.pipe(fs.createWriteStream('output.epub'));
```

### 3. Error Recovery
```javascript
async function combineWithRetry(files, output, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await combineEpubs(files, output);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
}
```

### 4. Progress Tracking
```javascript
// For long-running requests
const progressBar = new ProgressBar();

axios.post(url, formData, {
  onUploadProgress: progressEvent => {
    const percent = (progressEvent.loaded / progressEvent.total) * 100;
    progressBar.update(percent);
  }
});
```

---

## CORS Configuration

If integrating from a browser-based application, you may need CORS headers. Update `src/index.js`:

```javascript
// Add CORS middleware
import cors from 'cors';

app.use(cors({
  origin: 'https://your-frontend-domain.com',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
```

---

## Webhooks (Future Enhancement)

For long-running operations, consider implementing webhooks:

```javascript
// Send webhook when processing complete
POST /combine-epubs
{
  "epubs": [...],
  "webhook_url": "https://your-app.com/webhook/epub-ready"
}

// Your webhook receives:
{
  "status": "completed",
  "download_url": "https://api.com/download/abc123",
  "expires_at": "2026-01-18T10:00:00Z"
}
```

---

## Support & Questions

- **GitHub Issues:** [Report bugs or request features](https://github.com/YOUR_USERNAME/epub-combiner-api/issues)
- **API Documentation:** See [README.md](README.md)
- **Health Check:** Always available at `/health`

---

## Summary

✅ **Endpoint:** `POST /combine-epubs`  
✅ **Input:** 2-10 EPUB files via multipart/form-data  
✅ **Output:** Single combined EPUB file with TOC  
✅ **Format:** Binary EPUB data (application/epub+zip)  
✅ **Features:** Automatic TOC, proper image isolation, preserved formatting  

Start integrating in minutes with the code examples above!
