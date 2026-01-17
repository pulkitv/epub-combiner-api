# EPUB Combiner API

A REST API that combines multiple EPUB files into a single EPUB file while preserving all text and image formatting.

## Features

- ✅ Combine up to 10 EPUB files (configurable)
- ✅ Preserves all text formatting
- ✅ Preserves all images and their formatting
- ✅ Preserves CSS styles
- ✅ Preserves fonts
- ✅ File size validation
- ✅ EPUB format validation
- ✅ Configurable limits

## Installation

1. Clone or download this project
2. Install dependencies:

```bash
npm install
```

## Configuration

Edit `config.js` to customize settings:

```javascript
export const config = {
  maxFiles: 10,                    // Maximum number of EPUB files per request
  maxFileSize: 50 * 1024 * 1024,   // Maximum file size per EPUB (50MB)
  port: 3000,                      // API server port
  tempDir: './temp',               // Temporary directory for processing
  outputFilename: 'combined.epub'  // Output filename
};
```

## Usage

### Start the server

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## API Endpoints

### 1. Health Check

**GET** `/health`

Check if the API is running and view current configuration.

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

### 2. Combine EPUBs

**POST** `/combine-epubs`

Combine multiple EPUB files into a single EPUB file.

**Request:**
- Content-Type: `multipart/form-data`
- Field name: `epubs` (multiple files)
- File type: `.epub` files
- Min files: 2
- Max files: 10 (configurable)

**Response:**
- Content-Type: `application/epub+zip`
- Returns the combined EPUB file as download

**Error Responses:**

```json
// No files uploaded
{
  "error": "No files uploaded",
  "message": "Please upload at least one EPUB file"
}

// Insufficient files
{
  "error": "Insufficient files",
  "message": "Please upload at least 2 EPUB files to combine"
}

// Too many files
{
  "error": "Too many files",
  "message": "Maximum 10 files allowed"
}

// File too large
{
  "error": "File too large",
  "message": "File size must be less than 50MB"
}

// Invalid file type
{
  "error": "Invalid file type",
  "message": "Only EPUB files are allowed"
}
```

### 3. Get Configuration

**GET** `/config`

Get current API configuration.

**Response:**
```json
{
  "maxFiles": 10,
  "maxFileSize": 52428800,
  "maxFileSizeMB": 50,
  "port": 3000
}
```

## Example Usage

### Using cURL

```bash
curl -X POST http://localhost:3000/combine-epubs \
  -F "epubs=@book1.epub" \
  -F "epubs=@book2.epub" \
  -F "epubs=@book3.epub" \
  -o combined.epub
```

### Using JavaScript (fetch)

```javascript
const formData = new FormData();
formData.append('epubs', file1); // File object
formData.append('epubs', file2);
formData.append('epubs', file3);

fetch('http://localhost:3000/combine-epubs', {
  method: 'POST',
  body: formData
})
  .then(response => response.blob())
  .then(blob => {
    // Download the combined EPUB
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'combined.epub';
    a.click();
  });
```

### Using Python (requests)

```python
import requests

files = [
    ('epubs', open('book1.epub', 'rb')),
    ('epubs', open('book2.epub', 'rb')),
    ('epubs', open('book3.epub', 'rb'))
]

response = requests.post('http://localhost:3000/combine-epubs', files=files)

if response.status_code == 200:
    with open('combined.epub', 'wb') as f:
        f.write(response.content)
    print('Combined EPUB saved successfully')
else:
    print('Error:', response.json())
```

### Using Postman

1. Open Postman
2. Create a new POST request to `http://localhost:3000/combine-epubs`
3. Go to the "Body" tab
4. Select "form-data"
5. Add multiple entries with:
   - Key: `epubs` (set type to "File")
   - Value: Select your EPUB files
6. Click "Send"
7. Click "Save Response" → "Save to a file" to download the combined EPUB

## How It Works

1. **Upload**: Multiple EPUB files are uploaded via multipart/form-data
2. **Validation**: Files are validated for type, size, and count
3. **Extraction**: Each EPUB is unzipped and parsed
4. **Combination**: 
   - All chapters are extracted in order
   - All images are collected and paths are updated
   - All CSS styles are preserved
   - All fonts are preserved
   - Content references are updated to point to new locations
5. **Generation**: A new valid EPUB file is created with:
   - Combined content from all EPUBs
   - Proper EPUB structure (mimetype, container.xml, content.opf, toc.ncx)
   - All assets properly referenced
6. **Response**: The combined EPUB is sent back as a downloadable file

## Technical Details

### EPUB Structure Preserved

- ✅ All XHTML content files
- ✅ Images (JPG, PNG, GIF, SVG, WebP)
- ✅ CSS stylesheets
- ✅ Fonts (TTF, OTF, WOFF, WOFF2)
- ✅ Metadata (title, author, language)
- ✅ Table of contents (NCX)
- ✅ Package document (OPF)

### Dependencies

- **express**: Web server framework
- **multer**: File upload handling
- **jszip**: EPUB file manipulation (EPUBs are ZIP archives)
- **xml2js**: XML parsing and building
- **uuid**: Generate unique identifiers

## Troubleshooting

### Port already in use

If port 3000 is already in use, change it in `config.js`:

```javascript
port: 3001  // or any other available port
```

### Memory issues with large files

If you're combining very large EPUB files, you may need to increase Node.js memory:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

### EPUB validation

The generated EPUB should be valid according to EPUB 2.0 specification. You can validate it using tools like:
- [EPUB Validator](https://www.pagina.gmbh/produkte/epub-checker/)
- [EPUBCheck](https://github.com/w3c/epubcheck)

## License

MIT

## Support

For issues or questions, please create an issue in the repository.
