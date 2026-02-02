/**
 * PreAuth Agent LLM Service
 * LLM-powered agent for generating pre-authorization packet drafts
 *
 * Uses OpenRouter API to generate:
 * - Copy-paste ready pre-auth packet draft
 * - Attachments checklist
 * - Risk/query warnings
 * - Next actions for staff
 *
 * GUARDRAILS:
 * - Agent NEVER submits anything externally
 * - Agent cannot hallucinate or provide medical advice
 * - Agent only uses data from the PreAuthQueue record
 */

const axios = require('axios');
const PreAuthQueue = require('../models/PreAuthQueue');
const preAuthQueueService = require('./preAuthQueue.service');
const logger = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const OPENROUTER_API_KEY = process.env.OPENROUTER_AGENTIC_INSURANCE_API;
const OPENROUTER_MODEL = process.env.OPENROUTER_AGENTIC_INSURANCE_MODEL || 'qwen/qwen3-next-80b-a3b-instruct:free';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ═══════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are a Pre-Authorization Packet Assistant for a hospital insurance desk.
Your job is to generate a COPY-PASTE READY pre-authorization packet draft for staff to manually submit to insurance portals.

CRITICAL GUARDRAILS:
1. You MUST NOT hallucinate or invent any clinical information
2. You MUST NOT provide medical advice or diagnosis
3. You MUST NOT claim the pre-auth is approved or submitted
4. You CAN ONLY use the data provided in the case context
5. If information is missing, flag it clearly — do not make it up

OUTPUT REQUIREMENTS:
1. **Packet Draft**: A structured, copy-paste ready document with:
   - Patient Identity (name, ID, DOB, gender)
   - Insurer Name / TPA Name
   - Policy Number (if available)
   - Primary Diagnosis
   - Planned Procedure/Treatment
   - Clinical Justification (use provided snippets)
   - Estimated Amount with basis (exact/estimated)
   - Treating Doctor & Department
   - Encounter Reference (Admission/Appointment number)

2. **Attachments Checklist**: Use the documentExistenceFlags from the case data to determine exists:true/false:
   - Doctor Note / Clinical Summary: use hasDoctorNotes flag
   - Lab Reports: use hasLabReports flag
   - Radiology Reports: use hasRadiologyReports flag
   - Cost Estimate / Proforma: use hasCostEstimate flag (true if estimatedAmount > 0)
   - ID Proof / Insurance Card: use hasIdProof flag

3. **Risk Warnings**: Flag any issues:
   - Missing mandatory documents
   - Unusually high/low estimates
   - Missing policy number
   - Missing diagnosis or procedure

4. **Next Actions**: Suggest what staff should do next:
   - "Upload estimate PDF to insurer portal"
   - "Request updated doctor notes"
   - "Verify policy number with patient"

RESPOND IN THIS EXACT JSON FORMAT (no markdown wrapping):
{
  "packetDraft": {
    "patientIdentity": {
      "name": "string",
      "patientId": "string",
      "dateOfBirth": "string",
      "gender": "string"
    },
    "insurerName": "string",
    "tpaName": "string or null",
    "policyNumber": "string or 'NOT PROVIDED'",
    "diagnosisSummary": "string",
    "plannedProcedure": "string",
    "clinicalJustification": "string (multi-line bullet points)",
    "estimatedAmount": number,
    "estimationBasis": "exact or estimated",
    "treatingDoctor": "string",
    "department": "string",
    "encounterReference": "string"
  },
  "attachmentsChecklist": [
    { "doc": "Doctor Note / Clinical Summary", "exists": true/false },
    { "doc": "Lab Reports", "exists": true/false },
    { "doc": "Radiology Reports", "exists": true/false },
    { "doc": "Cost Estimate / Proforma", "exists": true/false },
    { "doc": "ID Proof / Insurance Card", "exists": true/false }
  ],
  "riskWarnings": ["string"],
  "nextActions": ["string"]
}`;

// ═══════════════════════════════════════════════════════════════════
// LLM CLIENT
// ═══════════════════════════════════════════════════════════════════

const callOpenRouter = async (messages) => {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_AGENTIC_INSURANCE_API not configured in environment');
    }

    try {
        const response = await axios.post(
            OPENROUTER_BASE_URL,
            {
                model: OPENROUTER_MODEL,
                messages,
                temperature: 0.2, // Low temperature for consistent output
                max_tokens: 4000,
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:5001',
                    'X-Title': 'Hospital HIS PreAuth Agent',
                },
                timeout: 60000,
            }
        );

        return response.data;
    } catch (error) {
        const errorData = error.response?.data;
        logger.error(`[PreAuthAgent] OpenRouter API error: ${JSON.stringify(errorData || error.message)}`);
        const errorMessage = errorData?.error?.message || error.message;
        throw new Error(`LLM API failed: ${errorMessage}`);
    }
};

// ═══════════════════════════════════════════════════════════════════
// AGENT RUNNER
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate pre-auth packet for a case
 * @param {string} caseId - PreAuthQueue case ID
 * @param {string} userId - User running the agent
 * @returns {Promise<Object>} - Agent output
 */
const generatePreAuthPacket = async (caseId, userId) => {
    const startTime = Date.now();
    logger.info(`[PreAuthAgent] Starting packet generation for case ${caseId} by user ${userId}`);

    // Fetch the case with all populated data
    const caseData = await preAuthQueueService.getCaseById(caseId);
    if (!caseData) {
        throw new Error('Pre-auth case not found');
    }

    // Build context for the LLM
    const caseContext = {
        patient: caseData.patient ? {
            name: `${caseData.patient.firstName} ${caseData.patient.lastName}`,
            patientId: caseData.patient.patientId,
            dateOfBirth: caseData.patient.dateOfBirth ? new Date(caseData.patient.dateOfBirth).toISOString().split('T')[0] : 'Unknown',
            gender: caseData.patient.gender || 'Unknown',
        } : null,
        insurerName: caseData.insurerName,
        tpaName: caseData.tpaName || null,
        policyNumber: caseData.policyNumber || 'NOT PROVIDED',
        diagnosisSummary: caseData.diagnosisSummary || 'Diagnosis pending',
        plannedProcedure: caseData.plannedProcedure || 'Treatment plan pending',
        clinicalJustificationSnippet: caseData.clinicalJustificationSnippet || 'No clinical notes available',
        treatingDoctor: caseData.treatingDoctor
            ? `Dr. ${caseData.treatingDoctor.profile?.firstName || ''} ${caseData.treatingDoctor.profile?.lastName || ''}`.trim()
            : 'Not assigned',
        department: caseData.department?.name || 'General',
        encounterReference: `${caseData.encounterModel || 'Encounter'}: ${caseData.caseNumber}`,
        estimatedAmount: caseData.estimatedAmount || 0,
        estimationBreakdown: caseData.estimationBreakdown || [],
        estimationBasis: caseData.estimationBasis || 'estimated',
        attachedDocuments: caseData.attachedDocuments?.map(d => ({
            type: d.docType,
            description: d.description,
            exists: d.exists,
        })) || [],
        aiSummaries: caseData.aiSummaries || {},
        // Explicit document existence flags for checklist
        documentExistenceFlags: {
            hasDoctorNotes: !!caseData.clinicalJustificationSnippet,
            hasLabReports: (caseData.attachedDocuments?.filter(d => d.docType === 'lab_report')?.length || 0) > 0,
            hasRadiologyReports: (caseData.attachedDocuments?.filter(d => d.docType === 'radiology_report')?.length || 0) > 0,
            hasCostEstimate: (caseData.estimatedAmount || 0) > 0,
            hasIdProof: false, // Usually requires manual upload
        },
    };

    // Prepare messages
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'user',
            content: `Generate a pre-authorization packet draft for the following case:

CASE DATA:
${JSON.stringify(caseContext, null, 2)}

Remember:
- Do NOT invent any information
- Use EXACTLY the data provided
- Flag missing items as warnings
- Format the packet for easy copy-paste to insurer portal`,
        },
    ];

    // Call LLM
    const response = await callOpenRouter(messages);
    const content = response.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('Empty response from LLM');
    }

    // Parse JSON response
    let agentOutput;
    try {
        let jsonStr = content.trim();
        // Handle potential markdown wrapping
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

        agentOutput = JSON.parse(jsonStr);
    } catch (parseError) {
        logger.error(`[PreAuthAgent] Failed to parse LLM response: ${content}`);
        throw new Error('Failed to parse agent response');
    }

    // Add metadata
    agentOutput.generatedAt = new Date();
    agentOutput.modelUsed = OPENROUTER_MODEL;

    // Update the case with agent output
    await PreAuthQueue.findByIdAndUpdate(caseId, {
        agentOutput,
        status: 'ready',
        $push: {
            auditTrail: {
                action: 'agent_packet_generated',
                userId,
                timestamp: new Date(),
                fieldsAccessed: Object.keys(caseContext),
                details: {
                    modelUsed: OPENROUTER_MODEL,
                    executionTimeMs: Date.now() - startTime,
                },
            },
        },
    });

    logger.info(`[PreAuthAgent] Packet generated successfully in ${Date.now() - startTime}ms`);

    return {
        success: true,
        caseId,
        agentOutput,
        executionTimeMs: Date.now() - startTime,
        modelUsed: OPENROUTER_MODEL,
    };
};

/**
 * Fallback direct generation without LLM (for testing/offline mode)
 * @param {string} caseId - PreAuthQueue case ID
 * @param {string} userId - User running the agent
 * @returns {Promise<Object>} - Agent output
 */
const generatePreAuthPacketDirect = async (caseId, userId) => {
    const caseData = await preAuthQueueService.getCaseById(caseId);
    if (!caseData) {
        throw new Error('Pre-auth case not found');
    }

    // Build comprehensive clinical justification from all sources
    let clinicalJustification = '';

    // Doctor consultation notes
    if (caseData.clinicalJustificationSnippet) {
        clinicalJustification += `DOCTOR CONSULTATION NOTES:\n${caseData.clinicalJustificationSnippet}\n\n`;
    }

    // Lab report summaries
    if (caseData.aiSummaries?.labReports) {
        try {
            const labSummary = typeof caseData.aiSummaries.labReports === 'string'
                ? caseData.aiSummaries.labReports
                : JSON.stringify(caseData.aiSummaries.labReports);
            clinicalJustification += `LAB INVESTIGATION SUMMARY:\n${labSummary}\n\n`;
        } catch (e) {
            clinicalJustification += `LAB INVESTIGATION SUMMARY:\n${String(caseData.aiSummaries.labReports)}\n\n`;
        }
    }

    // Radiology report summaries
    if (caseData.aiSummaries?.radiologyReports) {
        try {
            const radSummary = typeof caseData.aiSummaries.radiologyReports === 'string'
                ? caseData.aiSummaries.radiologyReports
                : JSON.stringify(caseData.aiSummaries.radiologyReports);
            clinicalJustification += `RADIOLOGY FINDINGS:\n${radSummary}\n\n`;
        } catch (e) {
            clinicalJustification += `RADIOLOGY FINDINGS:\n${String(caseData.aiSummaries.radiologyReports)}\n\n`;
        }
    }

    if (!clinicalJustification) {
        clinicalJustification = 'Clinical notes pending - awaiting doctor consultation and diagnostic reports.';
    }

    // Generate packet directly from data
    const agentOutput = {
        packetDraft: {
            patientIdentity: caseData.patient ? {
                name: `${caseData.patient.firstName} ${caseData.patient.lastName}`,
                patientId: caseData.patient.patientId,
                dateOfBirth: caseData.patient.dateOfBirth ? new Date(caseData.patient.dateOfBirth).toISOString().split('T')[0] : 'Unknown',
                gender: caseData.patient.gender || 'Unknown',
            } : null,
            insurerName: caseData.insurerName,
            tpaName: caseData.tpaName || null,
            policyNumber: caseData.policyNumber || 'NOT PROVIDED',
            diagnosisSummary: caseData.diagnosisSummary || 'Diagnosis pending',
            plannedProcedure: caseData.plannedProcedure || 'Treatment plan pending',
            clinicalJustification: clinicalJustification.trim(),
            estimatedAmount: caseData.estimatedAmount || 0,
            estimationBasis: caseData.estimationBasis || 'estimated',
            treatingDoctor: caseData.treatingDoctor
                ? `Dr. ${caseData.treatingDoctor.profile?.firstName || ''} ${caseData.treatingDoctor.profile?.lastName || ''}`.trim()
                : 'Not assigned',
            department: caseData.department?.name || 'General',
            encounterReference: `${caseData.encounterModel || 'Encounter'}: ${caseData.caseNumber}`,
        },
        attachmentsChecklist: [
            { doc: 'Doctor Note / Clinical Summary', exists: !!caseData.clinicalJustificationSnippet },
            { doc: 'Lab Reports', exists: (caseData.attachedDocuments?.filter(d => d.docType === 'lab_report')?.length || 0) > 0 },
            { doc: 'Radiology Reports', exists: (caseData.attachedDocuments?.filter(d => d.docType === 'radiology_report')?.length || 0) > 0 },
            { doc: 'Cost Estimate / Proforma', exists: caseData.estimatedAmount > 0 },
            { doc: 'ID Proof / Insurance Card', exists: false }, // Usually needs manual upload
        ],
        riskWarnings: [],
        nextActions: [],
        generatedAt: new Date(),
        modelUsed: 'direct_generation',
    };

    // Add warnings based on missing data
    if (!caseData.policyNumber) {
        agentOutput.riskWarnings.push('Missing: Policy number not provided');
        agentOutput.nextActions.push('Verify and enter policy number from insurance card');
    }
    if (!caseData.diagnosisSummary) {
        agentOutput.riskWarnings.push('Missing: No diagnosis summary available');
        agentOutput.nextActions.push('Request treating doctor to update diagnosis');
    }
    if ((caseData.attachedDocuments?.filter(d => d.docType === 'lab_report')?.length || 0) === 0) {
        agentOutput.riskWarnings.push('Missing: No lab reports attached');
    }
    if (caseData.estimationBasis === 'estimated') {
        agentOutput.riskWarnings.push('Note: Cost is an estimate — actual charges may vary');
    }

    agentOutput.nextActions.push('Upload completed packet to insurer portal');
    agentOutput.nextActions.push('Attach all required documents from checklist');

    // Update the case
    await PreAuthQueue.findByIdAndUpdate(caseId, {
        agentOutput,
        status: 'ready',
        $push: {
            auditTrail: {
                action: 'agent_packet_generated_direct',
                userId,
                timestamp: new Date(),
                fieldsAccessed: ['all'],
            },
        },
    });

    return {
        success: true,
        caseId,
        agentOutput,
        executionTimeMs: 0,
        modelUsed: 'direct_generation',
    };
};

module.exports = {
    generatePreAuthPacket,
    generatePreAuthPacketDirect,
    OPENROUTER_MODEL,
};
