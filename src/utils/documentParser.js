import { createWorker } from 'tesseract.js';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Configure pdfjs worker
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs`;
  }
}

/**
 * Format file size into human-readable string (KB / MB)
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 KB';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Extract text from an image file using client-side Tesseract.js OCR.
 * 
 * @param {File|Blob|HTMLCanvasElement|string} imageSource - Image or Canvas element
 * @param {Function} onProgress - Callback receiving { stage, progress (0-100) }
 * @returns {Promise<string>} - Extracted plain text
 */
export async function extractTextFromImage(imageSource, onProgress = null) {
  let worker = null;
  try {
    if (onProgress) onProgress({ stage: 'Initializing Deep OCR Engine...', progress: 15 });
    
    worker = await createWorker('eng');

    if (onProgress) onProgress({ stage: 'Scanning image, charts, and text...', progress: 55 });

    const ret = await worker.recognize(imageSource);
    
    if (onProgress) onProgress({ stage: 'OCR Complete!', progress: 100 });

    const text = ret?.data?.text?.trim() || '';
    return text;
  } catch (err) {
    console.error('OCR Error:', err);
    throw new Error(err.message || 'Failed to extract text from the image.');
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

/**
 * Extract text from a PDF file across all pages, including digital text,
 * embedded charts, scanned graphics, and diagrams using hybrid OCR.
 */
async function extractTextFromPdf(file, onProgress = null) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true
  });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pageTexts = [];
  let ocrWorker = null;

  for (let i = 1; i <= numPages; i++) {
    if (onProgress) {
      onProgress({
        stage: `Reading PDF page ${i} of ${numPages}...`,
        progress: Math.round(((i - 1) / numPages) * 100)
      });
    }

    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Extract digital text layers in visual reading order
    let lastY = null;
    const lines = [];
    let currentLine = [];

    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const str = item.str;
      const y = item.transform ? Math.round(item.transform[5]) : null;

      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
        if (currentLine.length > 0) {
          lines.push(currentLine.join(' '));
          currentLine = [];
        }
      }

      if (str.trim().length > 0) {
        currentLine.push(str);
      }
      lastY = y;
    }

    if (currentLine.length > 0) {
      lines.push(currentLine.join(' '));
    }

    let pageResult = lines.join('\n').trim();
    const wordsFound = pageResult.split(/\s+/).filter(Boolean).length;

    // If digital text is low or page contains charts/scanned images, run Canvas OCR
    if (wordsFound < 25) {
      try {
        if (onProgress) {
          onProgress({
            stage: `Scanning charts & visual text on PDF page ${i} of ${numPages}...`,
            progress: Math.round(((i - 0.4) / numPages) * 100)
          });
        }

        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        if (!ocrWorker) {
          ocrWorker = await createWorker('eng');
        }

        const ocrRes = await ocrWorker.recognize(canvas);
        const ocrText = (ocrRes?.data?.text || '').trim();
        if (ocrText.length > pageResult.length) {
          pageResult = (pageResult ? pageResult + '\n\n' : '') + ocrText;
        }
      } catch (ocrErr) {
        console.warn(`OCR page ${i} warning:`, ocrErr);
      }
    }

    if (pageResult) {
      pageTexts.push(pageResult);
    }
  }

  if (ocrWorker) {
    try {
      await ocrWorker.terminate();
    } catch {}
  }

  const fullDocText = pageTexts.join('\n\n');
  if (!fullDocText.trim()) {
    throw new Error('Could not extract text or chart content from this PDF.');
  }
  return fullDocText;
}

/**
 * Extract complete text from Word .docx file (Mammoth + OpenXML XML + Embedded Media OCR)
 */
async function extractTextFromDocx(file, onProgress = null) {
  const arrayBuffer = await file.arrayBuffer();
  let baseText = '';

  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    if (result.value && result.value.trim().length > 0) {
      baseText = result.value.trim();
    }
  } catch (err) {
    console.warn('Mammoth extraction failed, falling back to direct XML parse:', err);
  }

  // Deep OpenXML parse for tables, text boxes, headers, footers, and embedded media
  try {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(file);
    const paragraphs = [];

    // 1. Document Body Text & Tables
    const docXml = loadedZip.file('word/document.xml');
    if (docXml) {
      const xmlText = await docXml.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
      
      xmlDoc.querySelectorAll('w\\:p, p').forEach((p) => {
        const runs = [];
        p.querySelectorAll('w\\:t, t').forEach((t) => {
          if (t.textContent) runs.push(t.textContent);
        });
        const paraText = runs.join('');
        if (paraText.trim()) paragraphs.push(paraText.trim());
      });
    }

    // 2. Check Footnotes and Endnotes
    const notesXml = loadedZip.file('word/footnotes.xml') || loadedZip.file('word/endnotes.xml');
    if (notesXml) {
      const xmlText = await notesXml.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
      xmlDoc.querySelectorAll('w\\:p, p').forEach((p) => {
        const t = p.textContent?.trim();
        if (t) paragraphs.push(t);
      });
    }

    const xmlFullText = paragraphs.join('\n\n');
    if (xmlFullText.length > baseText.length) {
      baseText = xmlFullText;
    }

    // 3. Scan Embedded Media / Charts for text if present
    const mediaFiles = Object.keys(loadedZip.files).filter(path => path.startsWith('word/media/'));
    if (mediaFiles.length > 0 && onProgress) {
      onProgress({ stage: `Inspecting ${mediaFiles.length} embedded chart(s)/image(s)...`, progress: 85 });
      let ocrWorker = null;
      try {
        for (const mediaPath of mediaFiles.slice(0, 4)) {
          const imgBlob = await loadedZip.file(mediaPath).async('blob');
          if (imgBlob.size > 8000) { // skip tiny icons
            if (!ocrWorker) ocrWorker = await createWorker('eng');
            const ret = await ocrWorker.recognize(imgBlob);
            const chartText = (ret?.data?.text || '').trim();
            if (chartText.length > 15) {
              baseText += '\n\n[Chart / Diagram Text]:\n' + chartText;
            }
          }
        }
      } catch (imgErr) {
        console.warn('Media OCR warning:', imgErr);
      } finally {
        if (ocrWorker) await ocrWorker.terminate();
      }
    }
  } catch (err) {
    console.error('XML extraction fallback failed:', err);
  }

  if (!baseText.trim()) {
    throw new Error('Could not extract text from Word (.docx) document.');
  }
  return baseText;
}

/**
 * Extract text from OpenDocument (.odt) file including tables and embedded pictures
 */
async function extractTextFromOdt(file, onProgress = null) {
  try {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(file);
    const contentXmlFile = loadedZip.file('content.xml');
    if (!contentXmlFile) {
      throw new Error('content.xml not found in ODT archive.');
    }
    const xmlText = await contentXmlFile.async('text');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    
    // Extract all paragraphs, headers, and table cells in document order
    const paragraphs = [];
    const elements = xmlDoc.querySelectorAll('text\\:p, text\\:h, table\\:table-cell, p, h');
    elements.forEach((el) => {
      const t = el.textContent?.trim();
      if (t) paragraphs.push(t);
    });

    let odtText = paragraphs.length > 0 ? paragraphs.join('\n\n') : (xmlDoc.documentElement.textContent || '').trim();

    // Check embedded pictures in ODT
    const pictureFiles = Object.keys(loadedZip.files).filter(path => path.startsWith('Pictures/'));
    if (pictureFiles.length > 0 && onProgress) {
      onProgress({ stage: `Inspecting ${pictureFiles.length} embedded chart(s) in ODT...`, progress: 85 });
      let ocrWorker = null;
      try {
        for (const picPath of pictureFiles.slice(0, 3)) {
          const imgBlob = await loadedZip.file(picPath).async('blob');
          if (imgBlob.size > 8000) {
            if (!ocrWorker) ocrWorker = await createWorker('eng');
            const ret = await ocrWorker.recognize(imgBlob);
            const chartText = (ret?.data?.text || '').trim();
            if (chartText.length > 15) {
              odtText += '\n\n[Chart / Diagram Text]:\n' + chartText;
            }
          }
        }
      } catch (e) {
        console.warn('ODT pictures OCR error:', e);
      } finally {
        if (ocrWorker) await ocrWorker.terminate();
      }
    }

    if (odtText.trim()) return odtText.trim();
  } catch (err) {
    console.error('ODT parse error:', err);
  }
  throw new Error('Unable to extract text from OpenDocument (.odt) file.');
}

/**
 * Extract text from legacy binary Word (.doc) file
 */
async function extractTextFromLegacyDoc(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  // 1. UTF-16LE stream text extraction
  const utf16Strings = [];
  let currentChars = [];
  for (let i = 0; i < bytes.length - 1; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9 || (code >= 160 && code <= 0x052F)) {
      currentChars.push(String.fromCharCode(code));
    } else {
      if (currentChars.length >= 4) {
        utf16Strings.push(currentChars.join(''));
      }
      currentChars = [];
    }
  }
  if (currentChars.length >= 4) {
    utf16Strings.push(currentChars.join(''));
  }

  const utf16Text = utf16Strings
    .map(s => s.trim())
    .filter(s => s.length > 2 && !/^[\x00-\x1F]+$/.test(s))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 2. ASCII / ANSI 8-bit stream extraction
  const asciiStrings = [];
  let currentAscii = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
      currentAscii.push(String.fromCharCode(b));
    } else {
      if (currentAscii.length >= 4) {
        asciiStrings.push(currentAscii.join(''));
      }
      currentAscii = [];
    }
  }
  if (currentAscii.length >= 4) {
    asciiStrings.push(currentAscii.join(''));
  }

  const asciiText = asciiStrings
    .map(s => s.trim())
    .filter(s => s.length > 3 && !/^(WordDocument|SummaryInformation|DocumentSummaryInformation|Table|CompObj|ObjectPool)$/i.test(s))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const chosen = (utf16Text.length > asciiText.length * 0.7 && utf16Text.length > 30) ? utf16Text : asciiText;
  if (chosen.length < 15) {
    throw new Error('Unable to extract readable text from this legacy .doc file. Please re-save as .docx or .pdf for full fidelity.');
  }
  return chosen;
}

/**
 * Extract clean text from RTF content
 */
function extractTextFromRtf(rtfText) {
  let text = rtfText.replace(/\{\\fonttbl[\s\S]*?\}/g, '');
  text = text.replace(/\{\\colortbl[\s\S]*?\}/g, '');
  text = text.replace(/\{\\stylesheet[\s\S]*?\}/g, '');
  text = text.replace(/\{\\\*[\s\S]*?\}/g, '');
  text = text.replace(/\\u([0-9]{2,5})[?]?/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  text = text.replace(/\\par[d]?\s*/g, '\n');
  text = text.replace(/\\line\s*/g, '\n');
  text = text.replace(/\\tab\s*/g, '\t');
  text = text.replace(/\\[a-zA-Z0-9\-]+ ?/g, '');
  text = text.replace(/[{}]/g, '');
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Extract text from HTML content preserving document structure
 */
function extractTextFromHtml(htmlContent) {
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    doc.querySelectorAll('script, style, noscript, svg, head').forEach((el) => el.remove());

    const blocks = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, table');
    const texts = [];
    blocks.forEach((b) => {
      const t = (b.textContent || '').trim();
      if (t) texts.push(t);
    });

    if (texts.length > 0) {
      return texts.join('\n\n');
    }
    return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
  }
  return htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extract complete text from any supported document file:
 * Supported formats: .doc, .docx, .odt, .rtf, .txt, .md, .html, .pdf, and images (OCR)
 * 
 * @param {File} file 
 * @param {Function} onProgress
 * @returns {Promise<{ text: string, dataUrl?: string, isImage?: boolean, fileName: string, fileType: string, fileSizeFormatted: string }>}
 */
export async function extractTextFromFile(file, onProgress = null) {
  if (!file) throw new Error('No file provided.');

  const fileName = file.name;
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const fileSizeFormatted = formatFileSize(file.size);

  // 1. Plain text & Markdown (.txt, .md, .json, .csv, .log)
  if (['txt', 'md', 'json', 'csv', 'log'].includes(extension) || file.type === 'text/plain') {
    const text = await file.text();
    return { text: text.trim(), fileName, fileType: extension, fileSizeFormatted };
  }

  // 2. HTML (.html, .htm)
  if (['html', 'htm'].includes(extension) || file.type === 'text/html') {
    const rawHtml = await file.text();
    const cleanText = extractTextFromHtml(rawHtml);
    return { text: cleanText, fileName, fileType: extension, fileSizeFormatted };
  }

  // 3. RTF (.rtf)
  if (extension === 'rtf' || file.type === 'application/rtf') {
    const rawRtf = await file.text();
    const text = extractTextFromRtf(rawRtf);
    return { text, fileName, fileType: extension, fileSizeFormatted };
  }

  // 4. Word (.docx)
  if (extension === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const text = await extractTextFromDocx(file, onProgress);
    return { text, fileName, fileType: extension, fileSizeFormatted };
  }

  // 5. OpenDocument (.odt)
  if (extension === 'odt' || file.type === 'application/vnd.oasis.opendocument.text') {
    const text = await extractTextFromOdt(file, onProgress);
    return { text, fileName, fileType: extension, fileSizeFormatted };
  }

  // 6. Legacy Word (.doc)
  if (extension === 'doc' || file.type === 'application/msword') {
    const text = await extractTextFromLegacyDoc(file);
    return { text, fileName, fileType: extension, fileSizeFormatted };
  }

  // 7. PDF (.pdf)
  if (extension === 'pdf' || file.type === 'application/pdf') {
    const text = await extractTextFromPdf(file, onProgress);
    return { text, fileName, fileType: extension, fileSizeFormatted };
  }

  // 8. Images (.png, .jpg, .jpeg, .webp, .bmp)
  if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff'].includes(extension)) {
    const ocrText = await extractTextFromImage(file, onProgress);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          text: ocrText,
          dataUrl: e.target.result,
          isImage: true,
          fileName,
          fileType: extension,
          fileSizeFormatted
        });
      };
      reader.readAsDataURL(file);
    });
  }

  throw new Error(`Unsupported file format: .${extension}. Supported file types: .doc, .docx, .odt, .rtf, .txt, .html, and .pdf`);
}
