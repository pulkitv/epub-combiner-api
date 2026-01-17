export const config = {
  // Maximum number of EPUB files that can be combined in a single request
  maxFiles: 10,
  
  // Maximum file size per EPUB in bytes (50MB)
  maxFileSize: 50 * 1024 * 1024,
  
  // API server port
  port: 3000,
  
  // Temporary directory for processing files
  tempDir: './temp',
  
  // Output filename for combined EPUB
  outputFilename: 'combined.epub'
};
