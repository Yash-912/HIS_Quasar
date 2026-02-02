/**
 * LLM Client Service - Lab Report Summarization
 * Uses OpenRouter API with configurable model
 */

const axios = require('axios');

// OpenRouter Configuration - use primary key, or fall back to agentic inventory key
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_AGENTIC_INVENTORY_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Summarize a lab report using OpenRouter LLM
 * @param {string} extractedText - Raw text extracted from the PDF
 * @returns {Promise<Object>} - Structured summary JSON
 */
const summarizeLabReport = async (extractedText) => {
    if (!OPENROUTER_API_KEY) {
        console.warn('[LLM] OPENROUTER_API_KEY not configured, returning mock summary');
        return getMockSummary();
    }

    try {
        const prompt = `You are a clinical lab report analyzer helping physicians quickly understand lab results.

LAB DATA:
${extractedText}

Note: The data above may include manually entered lab values (with NORMAL/ABNORMAL/CRITICAL flags) and/or text extracted from a PDF report. Analyze all available information.

INSTRUCTIONS:
- Write a clear, concise summary in PARAGRAPH format
- Use bullet points only when listing multiple abnormal values
- Start with an overall assessment paragraph
- Highlight critical/abnormal findings with clinical significance
- Mention normal results briefly
- End with clinical recommendations if applicable

RESPOND IN THIS EXACT JSON FORMAT (no markdown, just raw JSON):
{
    "summary": "A 2-3 paragraph clinical summary of the lab report. First paragraph: Overall assessment and key findings. Second paragraph: Details on any abnormal values and their clinical significance. Third paragraph (if needed): Recommendations or observations.",
    "abnormalValues": [
        {"parameter": "Parameter Name", "value": "Measured Value", "significance": "Brief clinical significance"}
    ],
    "overallStatus": "normal|attention_needed|critical",
    "clinicalRecommendation": "Any suggested follow-up or clinical action",
    "disclaimer": "AI-generated summary. Not a diagnosis. Doctor must verify."
}`;

        const response = await axios.post(
            OPENROUTER_BASE_URL,
            {
                model: OPENROUTER_MODEL,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.3,
                max_tokens: 2000,
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:5001',
                    'X-Title': 'Hospital HIS Lab Report Summarizer',
                },
            }
        );

        const content = response.data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('Empty response from LLM');
        }

        // Parse JSON from response (handle potential markdown wrapping)
        let jsonStr = content.trim();
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.slice(7);
        }
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.slice(3);
        }
        if (jsonStr.endsWith('```')) {
            jsonStr = jsonStr.slice(0, -3);
        }
        jsonStr = jsonStr.trim();

        const summary = JSON.parse(jsonStr);
        summary.generatedAt = new Date().toISOString();
        summary.model = OPENROUTER_MODEL;

        console.log(`[LLM] Summary generated successfully using ${OPENROUTER_MODEL}`);
        return summary;

    } catch (error) {
        console.error('[LLM] OpenRouter API error:', error.response?.data || error.message);

        // Return error info for debugging
        throw new Error(`LLM API failed: ${error.response?.data?.error?.message || error.message}`);
    }
};

/**
 * Fallback mock summary when API is not configured
 */
const getMockSummary = () => ({
    keyFindings: [
        {
            parameter: "Hemoglobin",
            value: "14.2 g/dL",
            referenceRange: "12.0-17.5 g/dL",
            status: "normal",
        },
    ],
    abnormalValues: [],
    normalResults: ["All parameters within normal limits (mock data)"],
    clinicalNotes: "API key not configured. This is mock data.",
    disclaimer: "AI-generated summary. Not a diagnosis. Doctor must verify.",
    generatedAt: new Date().toISOString(),
    model: "mock",
});

module.exports = {
    summarizeLabReport,
};
