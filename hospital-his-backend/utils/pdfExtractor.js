/**
 * PDF Text Extraction Utility
 * Extracts text from PDF files with OCR fallback for scanned documents
 * 
 * Flow:
 * 1. Try normal text extraction using pdf-parse
 * 2. If empty/failed (scanned PDF), run OCR fallback using Tesseract
 * 3. Return final extracted text
 */

const fs = require('fs');
const path = require('path');

/**
 * Extract text from PDF file with OCR fallback
 * @param {string} filePath - Absolute path to the PDF file
 * @returns {Promise<{text: string, method: string}>} - Extracted text and method used
 */
const extractTextFromPdf = async (filePath) => {
    let extractedText = '';
    let extractionMethod = 'none';

    // Step 1: Try normal text extraction with pdf-parse
    try {
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);

        extractedText = pdfData.text?.trim() || '';

        if (extractedText.length > 50) {
            // Text extraction successful (more than 50 chars indicates real text)
            extractionMethod = 'pdf-parse';
            console.log(`[PDF] Text extraction successful via pdf-parse (${extractedText.length} chars)`);
            return { text: extractedText, method: extractionMethod };
        }

        console.log(`[PDF] pdf-parse returned minimal text (${extractedText.length} chars), trying OCR...`);
    } catch (parseError) {
        console.log(`[PDF] pdf-parse failed: ${parseError.message}, trying OCR...`);
    }

    // Step 2: OCR fallback for scanned PDFs using Tesseract.js
    try {
        extractedText = await runOcrOnPdf(filePath);

        if (extractedText && extractedText.length > 0) {
            extractionMethod = 'ocr-tesseract';
            console.log(`[PDF] OCR extraction successful (${extractedText.length} chars)`);
        } else {
            extractionMethod = 'failed';
            console.log('[PDF] OCR returned empty text');
        }
    } catch (ocrError) {
        console.error(`[PDF] OCR fallback failed: ${ocrError.message}`);
        extractionMethod = 'failed';
    }

    return { text: extractedText, method: extractionMethod };
};

/**
 * Run OCR on PDF using Tesseract.js
 * Converts PDF pages to images first, then runs OCR
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<string>} - OCR extracted text
 */
const runOcrOnPdf = async (filePath) => {
    try {
        // Check if tesseract.js is available
        const Tesseract = require('tesseract.js');
        const { fromPath } = require('pdf2pic');
        const { tmpdir } = require('os');

        // Convert PDF pages to images
        const outputDir = path.join(tmpdir(), `pdf-ocr-${Date.now()}`);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const options = {
            density: 200,
            saveFilename: 'page',
            savePath: outputDir,
            format: 'png',
            width: 1654,
            height: 2339
        };

        const converter = fromPath(filePath, options);

        // Get page count and convert all pages
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        const pageCount = pdfData.numpages || 1;

        let fullText = '';

        // Convert and OCR each page (limit to first 10 pages for performance)
        const pagesToProcess = Math.min(pageCount, 10);

        for (let i = 1; i <= pagesToProcess; i++) {
            try {
                const result = await converter(i);

                if (result && result.path) {
                    // Run OCR on the image
                    const ocrResult = await Tesseract.recognize(result.path, 'eng', {
                        logger: () => { } // Silent logger
                    });

                    if (ocrResult?.data?.text) {
                        fullText += ocrResult.data.text + '\n\n';
                    }

                    // Clean up image file
                    try {
                        fs.unlinkSync(result.path);
                    } catch (e) { }
                }
            } catch (pageError) {
                console.log(`[OCR] Failed to process page ${i}: ${pageError.message}`);
            }
        }

        // Clean up temp directory
        try {
            fs.rmdirSync(outputDir);
        } catch (e) { }

        return fullText.trim();

    } catch (error) {
        // If tesseract.js or pdf2pic is not installed, provide fallback message
        if (error.code === 'MODULE_NOT_FOUND') {
            console.log('[OCR] Tesseract.js or pdf2pic not installed. Install with: npm install tesseract.js pdf2pic');

            // Return placeholder message for now
            return '[OCR not available - install tesseract.js and pdf2pic for scanned PDF support]';
        }
        throw error;
    }
};

module.exports = {
    extractTextFromPdf,
    runOcrOnPdf
};
