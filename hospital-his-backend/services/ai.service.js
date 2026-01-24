/**
 * AI Service - Lab Report Summarization
 * Uses Google Gemini for single-pass clinical summarization
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

/**
 * Extract text from PDF file
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<string>} - Extracted text
 */
const extractTextFromPdf = async (filePath) => {
    try {
        // pdf-parse v1.1.1 - direct function call
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);

        // Check if meaningful text was extracted
        const extractedText = data?.text?.trim() || '';

        if (extractedText.length >= 50) {
            console.log(`[PDF] Text extracted successfully: ${extractedText.length} chars`);
            return extractedText;
        }

        // If pdf-parse returned minimal text, try OCR
        console.log(`[PDF] pdf-parse returned minimal text (${extractedText.length} chars), trying OCR...`);

        try {
            const { extractTextFromPdf: extractWithOcr } = require('../utils/pdfExtractor');
            const { text, method } = await extractWithOcr(filePath);

            if (text && text.length >= 20) {
                console.log(`[PDF] OCR extraction successful (${text.length} chars) via ${method}`);
                return text;
            }
        } catch (ocrError) {
            console.error('[PDF] OCR fallback failed:', ocrError.message);
        }

        throw new Error('This PDF appears to be a scanned image and OCR failed. Please upload a PDF with selectable text.');
    } catch (error) {
        console.error('PDF extraction error:', error.message);
        throw error;
    }
};

/**
 * Generate clinical summary using Gemini
 * @param {string} reportText - Extracted text from lab report
 * @returns {Promise<string>} - AI-generated summary
 */
const generateLabSummary = async (reportText) => {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `You are a clinical lab report summarizer. Analyze this lab test report and provide a structured summary for a physician.

REPORT TEXT:
${reportText}

INSTRUCTIONS:
- Highlight abnormal values with ⚠️
- Include reference ranges if present
- Use clear medical terminology
- Be concise and scannable
- Format with markdown headings and bullet points

OUTPUT FORMAT:
## Key Findings
- [List abnormal values with their readings and reference ranges]

## Normal Results
- [Brief summary of normal parameters]

## Clinical Notes
- [Any special observations or recommendations from the report]

---
⚠️ **Disclaimer**: For clinical review only. This is not a diagnosis.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini API error:', error.message);
        throw new Error('Failed to generate AI summary');
    }
};

module.exports = {
    extractTextFromPdf,
    generateLabSummary
};
