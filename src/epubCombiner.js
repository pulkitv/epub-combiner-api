import JSZip from 'jszip';
import { parseString, Builder } from 'xml2js';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const parseXML = promisify(parseString);

/**
 * Combines multiple EPUB files into a single EPUB file
 * @param {Array<Buffer>} epubBuffers - Array of EPUB file buffers
 * @returns {Promise<Buffer>} - Combined EPUB file as buffer
 */
export async function combineEpubs(epubBuffers) {
  const outputZip = new JSZip();
  
  // Store all content files, metadata, and resources
  const allChapters = [];
  const allImages = [];
  const allStyles = [];
  const allFonts = [];
  const bookMetadata = []; // Track metadata for each book
  let combinedMetadata = {
    title: 'Combined EPUB',
    author: 'Multiple Authors',
    language: 'en',
    identifier: uuidv4()
  };
  
  // Process each EPUB file
  for (let i = 0; i < epubBuffers.length; i++) {
    const epubBuffer = epubBuffers[i];
    const zip = await JSZip.loadAsync(epubBuffer);
    
    // Find container.xml to get the content.opf location
    const containerXML = await zip.file('META-INF/container.xml').async('string');
    const containerData = await parseXML(containerXML);
    const contentOpfPath = containerData.container.rootfiles[0].rootfile[0].$['full-path'];
    
    // Get the base directory from content.opf path
    const baseDir = contentOpfPath.substring(0, contentOpfPath.lastIndexOf('/') + 1);
    
    // Parse content.opf
    const contentOpfXML = await zip.file(contentOpfPath).async('string');
    const opfData = await parseXML(contentOpfXML);
    
    // Extract metadata for this book
    const metadata = opfData.package.metadata[0];
    const bookTitle = metadata['dc:title'] ? metadata['dc:title'][0] : `Book ${i + 1}`;
    const bookAuthor = metadata['dc:creator'] ? metadata['dc:creator'][0] : 'Unknown Author';
    
    bookMetadata.push({
      title: bookTitle,
      author: bookAuthor,
      bookIndex: i
    });
    
    // Extract metadata from first EPUB for combined metadata
    if (i === 0) {
      if (metadata['dc:title']) combinedMetadata.title = metadata['dc:title'][0];
      if (metadata['dc:creator']) combinedMetadata.author = metadata['dc:creator'][0];
      if (metadata['dc:language']) combinedMetadata.language = metadata['dc:language'][0];
    }
    
    // Get manifest items
    const manifest = opfData.package.manifest[0].item;
    const spine = opfData.package.spine[0].itemref;
    
    // Create a map of manifest items
    const manifestMap = {};
    manifest.forEach(item => {
      manifestMap[item.$.id] = item.$;
    });
    
    // Extract chapters in spine order
    for (const itemref of spine) {
      const itemId = itemref.$.idref;
      const manifestItem = manifestMap[itemId];
      
      if (manifestItem && manifestItem['media-type'] === 'application/xhtml+xml') {
        const chapterPath = baseDir + manifestItem.href;
        const chapterFile = zip.file(chapterPath);
        
        if (chapterFile) {
          const chapterContent = await chapterFile.async('string');
          const newChapterId = `chapter_${i}_${itemId}`;
          const newChapterHref = `OEBPS/Text/${newChapterId}.xhtml`;
          
          allChapters.push({
            id: newChapterId,
            href: newChapterHref,
            content: chapterContent,
            originalHref: manifestItem.href,
            bookIndex: i  // Track which book this chapter belongs to
          });
        }
      }
    }
    
    // Extract images
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
    for (const item of manifest) {
      const href = item.$.href;
      const mediaType = item.$['media-type'];
      
      if (mediaType && mediaType.startsWith('image/')) {
        const imagePath = baseDir + href;
        const imageFile = zip.file(imagePath);
        
        if (imageFile) {
          const imageContent = await imageFile.async('nodebuffer');
          const imageName = href.substring(href.lastIndexOf('/') + 1);
          const newImageId = `img_${i}_${item.$.id}`;
          const newImageHref = `OEBPS/Images/${newImageId}_${imageName}`;
          
          allImages.push({
            id: newImageId,
            href: newImageHref,
            content: imageContent,
            mediaType: mediaType,
            originalHref: href,
            bookIndex: i
          });
        }
      }
    }
    
    // Extract CSS files
    for (const item of manifest) {
      if (item.$['media-type'] === 'text/css') {
        const cssPath = baseDir + item.$.href;
        const cssFile = zip.file(cssPath);
        
        if (cssFile) {
          const cssContent = await cssFile.async('string');
          const cssName = item.$.href.substring(item.$.href.lastIndexOf('/') + 1);
          const newCssId = `style_${i}_${item.$.id}`;
          const newCssHref = `OEBPS/Styles/${newCssId}_${cssName}`;
          
          allStyles.push({
            id: newCssId,
            href: newCssHref,
            content: cssContent,
            originalHref: item.$.href,
            bookIndex: i
          });
        }
      }
    }
    
    // Extract fonts
    const fontTypes = ['application/font-woff', 'application/vnd.ms-opentype', 'application/x-font-ttf', 'font/ttf', 'font/otf', 'font/woff', 'font/woff2'];
    for (const item of manifest) {
      if (fontTypes.includes(item.$['media-type'])) {
        const fontPath = baseDir + item.$.href;
        const fontFile = zip.file(fontPath);
        
        if (fontFile) {
          const fontContent = await fontFile.async('nodebuffer');
          const fontName = item.$.href.substring(item.$.href.lastIndexOf('/') + 1);
          const newFontId = `font_${i}_${item.$.id}`;
          const newFontHref = `OEBPS/Fonts/${newFontId}_${fontName}`;
          
          allFonts.push({
            id: newFontId,
            href: newFontHref,
            content: fontContent,
            mediaType: item.$['media-type'],
            originalHref: item.$.href,
            bookIndex: i
          });
        }
      }
    }
  }
  
  // Update chapter content to reference new image and CSS paths
  for (const chapter of allChapters) {
    let updatedContent = chapter.content;
    
    // Update image references - only for images from the same book
    for (const image of allImages) {
      if (image.bookIndex === chapter.bookIndex) {
        const relativePath = `../${image.href.replace('OEBPS/', '')}`;
        // Escape special regex characters in the original href
        const escapedHref = image.originalHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        updatedContent = updatedContent.replace(new RegExp(escapedHref, 'g'), relativePath);
      }
    }
    
    // Update CSS references - only for styles from the same book
    for (const style of allStyles) {
      if (style.bookIndex === chapter.bookIndex) {
        const relativePath = `../${style.href.replace('OEBPS/', '')}`;
        const escapedHref = style.originalHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        updatedContent = updatedContent.replace(new RegExp(escapedHref, 'g'), relativePath);
      }
    }
    
    chapter.content = updatedContent;
  }
  
  // Create the combined EPUB structure
  
  // 1. Add mimetype file
  outputZip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  
  // 2. Add META-INF/container.xml
  const containerXML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  outputZip.file('META-INF/container.xml', containerXML);
  
  // 3. Create Table of Contents HTML page
  let tocHTML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Table of Contents</title>
  <style type="text/css">
    body {
      font-family: Georgia, serif;
      margin: 2em;
      line-height: 1.6;
    }
    h1 {
      text-align: center;
      color: #333;
      border-bottom: 2px solid #333;
      padding-bottom: 0.5em;
      margin-bottom: 1.5em;
    }
    .toc-entry {
      margin: 1.5em 0;
      padding: 1em;
      background-color: #f9f9f9;
      border-left: 4px solid #333;
    }
    .toc-entry:hover {
      background-color: #f0f0f0;
    }
    .book-title {
      font-size: 1.2em;
      font-weight: bold;
      margin-bottom: 0.3em;
    }
    .book-title a {
      color: #0066cc;
      text-decoration: none;
    }
    .book-title a:hover {
      text-decoration: underline;
    }
    .book-author {
      font-size: 0.9em;
      color: #666;
      font-style: italic;
    }
    .book-number {
      color: #999;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <h1>Table of Contents</h1>
  <div class="toc-list">
`;

  // Find the first chapter of each book and create TOC entries
  const bookFirstChapters = {};
  for (const chapter of allChapters) {
    if (!bookFirstChapters[chapter.bookIndex]) {
      bookFirstChapters[chapter.bookIndex] = chapter;
    }
  }

  for (const book of bookMetadata) {
    const firstChapter = bookFirstChapters[book.bookIndex];
    if (firstChapter) {
      const relativeLink = firstChapter.href.replace('OEBPS/', '');
      tocHTML += `    <div class="toc-entry">
      <div class="book-number">Book ${book.bookIndex + 1}</div>
      <div class="book-title"><a href="${relativeLink}">${book.title}</a></div>
      <div class="book-author">by ${book.author}</div>
    </div>
`;
    }
  }

  tocHTML += `  </div>
</body>
</html>`;

  outputZip.file('OEBPS/Text/toc.xhtml', tocHTML);
  
  // 4. Add all content files
  for (const chapter of allChapters) {
    outputZip.file(chapter.href, chapter.content);
  }
  
  for (const image of allImages) {
    outputZip.file(image.href, image.content);
  }
  
  for (const style of allStyles) {
    outputZip.file(style.href, style.content);
  }
  
  for (const font of allFonts) {
    outputZip.file(font.href, font.content);
  }
  
  // 4. Create content.opf
  const manifestItems = [];
  const spineItems = [];
  
  // Add TOC page to manifest and spine first
  manifestItems.push({
    $: {
      id: 'toc-page',
      href: 'Text/toc.xhtml',
      'media-type': 'application/xhtml+xml'
    }
  });
  spineItems.push({
    $: { idref: 'toc-page' }
  });
  
  // Add chapters to manifest and spine
  for (const chapter of allChapters) {
    manifestItems.push({
      $: {
        id: chapter.id,
        href: chapter.href.replace('OEBPS/', ''),
        'media-type': 'application/xhtml+xml'
      }
    });
    spineItems.push({
      $: { idref: chapter.id }
    });
  }
  
  // Add images to manifest
  for (const image of allImages) {
    manifestItems.push({
      $: {
        id: image.id,
        href: image.href.replace('OEBPS/', ''),
        'media-type': image.mediaType
      }
    });
  }
  
  // Add styles to manifest
  for (const style of allStyles) {
    manifestItems.push({
      $: {
        id: style.id,
        href: style.href.replace('OEBPS/', ''),
        'media-type': 'text/css'
      }
    });
  }
  
  // Add fonts to manifest
  for (const font of allFonts) {
    manifestItems.push({
      $: {
        id: font.id,
        href: font.href.replace('OEBPS/', ''),
        'media-type': font.mediaType
      }
    });
  }
  
  // Add NCX file to manifest
  manifestItems.push({
    $: {
      id: 'ncx',
      href: 'toc.ncx',
      'media-type': 'application/x-dtbncx+xml'
    }
  });
  
  // Create the OPF structure
  const opfContent = {
    package: {
      $: {
        version: '2.0',
        xmlns: 'http://www.idpf.org/2007/opf',
        'unique-identifier': 'bookid'
      },
      metadata: [{
        $: {
          'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
          'xmlns:opf': 'http://www.idpf.org/2007/opf'
        },
        'dc:title': [combinedMetadata.title],
        'dc:creator': [combinedMetadata.author],
        'dc:language': [combinedMetadata.language],
        'dc:identifier': [{
          $: { id: 'bookid' },
          _: combinedMetadata.identifier
        }]
      }],
      manifest: [{ item: manifestItems }],
      spine: [{
        $: { toc: 'ncx' },
        itemref: spineItems
      }]
    }
  };
  
  const builder = new Builder({
    xmldec: { version: '1.0', encoding: 'UTF-8' }
  });
  const opfXML = builder.buildObject(opfContent);
  outputZip.file('OEBPS/content.opf', opfXML);
  
  // 5. Create toc.ncx
  const navPoints = allChapters.map((chapter, index) => ({
    $: {
      id: `navPoint-${index + 1}`,
      playOrder: `${index + 1}`
    },
    navLabel: [{
      text: [`Chapter ${index + 1}`]
    }],
    content: [{
      $: { src: chapter.href.replace('OEBPS/', '') }
    }]
  }));
  
  const ncxContent = {
    ncx: {
      $: {
        xmlns: 'http://www.daisy.org/z3986/2005/ncx/',
        version: '2005-1'
      },
      head: [{
        meta: [
          { $: { name: 'dtb:uid', content: combinedMetadata.identifier } },
          { $: { name: 'dtb:depth', content: '1' } },
          { $: { name: 'dtb:totalPageCount', content: '0' } },
          { $: { name: 'dtb:maxPageNumber', content: '0' } }
        ]
      }],
      docTitle: [{
        text: [combinedMetadata.title]
      }],
      navMap: [{
        navPoint: navPoints
      }]
    }
  };
  
  const ncxXML = builder.buildObject(ncxContent);
  outputZip.file('OEBPS/toc.ncx', ncxXML);
  
  // Generate the final EPUB file
  const epubBuffer = await outputZip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    mimeType: 'application/epub+zip'
  });
  
  return epubBuffer;
}
