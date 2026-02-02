# Agentic Workflow Changes Documentation

> **Hospital Information System (HIS) - Comprehensive Documentation of All Agentic Workflow Implementations**

This document provides a detailed breakdown of all agentic workflows implemented in the HIS system, including the Inventory Reorder Agent and Insurance Pre-Authorization Agent workflows.

---

## Table of Contents

1. [Overview](#overview)
2. [Agentic Workflow 1: Inventory Reorder Agent](#agentic-workflow-1-inventory-reorder-agent)
3. [Agentic Workflow 2: Insurance Pre-Authorization Agent](#agentic-workflow-2-insurance-pre-authorization-agent)
4. [AI/LLM Infrastructure](#aillm-infrastructure)
5. [Database Models Added](#database-models-added)
6. [Backend Changes Summary](#backend-changes-summary)
7. [Frontend Changes Summary](#frontend-changes-summary)
8. [Constants and Enums Added](#constants-and-enums-added)
9. [Seeded Data and Policy Defaults](#seeded-data-and-policy-defaults)
10. [Guardrails, Approvals, and Audit Logic](#guardrails-approvals-and-audit-logic)
11. [File Location Reference](#file-location-reference)

---

## Overview

Two primary agentic workflows were implemented in the HIS system:

| Workflow | Purpose | Key Technology |
|----------|---------|----------------|
| **Inventory Reorder Agent** | Automated low-stock detection and reorder recommendation for general stores | LLM orchestration via OpenRouter with function calling |
| **Insurance Pre-Auth Agent** | Automated pre-authorization packet generation for insurance claims | LLM-powered document generation with clinical context |

Both workflows use **OpenRouter API** for LLM orchestration and feature comprehensive audit trails, approval mechanisms, and fallback logic.

---

## Agentic Workflow 1: Inventory Reorder Agent

### Purpose
Automatically detects low-stock items in general stores, computes urgency-based reorder plans, creates draft purchase requests, routes them for approval, and logs all agent activities.

### Key Features

1. **LLM-Orchestrated Tool Calling**: The agent uses function calling to decide which tools to invoke
2. **Deterministic Math**: All calculations (urgency scores, quantities) are performed by deterministic functions, not the LLM
3. **Budget-Based Prioritization**: Items are prioritized by urgency score within a configurable budget cap (default: ₹25,000)
4. **Approval Routing**: Drafts are routed to the appropriate approver based on cost tiers
5. **Audit Logging**: Every agent run is recorded with full audit trail

### Workflow Steps

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. TRIGGER: Inventory Manager clicks "Run Reorder Agent"                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  2. getLowStockItems() → Fetches items where available < minLevel           │
├─────────────────────────────────────────────────────────────────────────────┤
│  3. computeReorderPlan() → Calculates urgency scores, prioritizes by budget │
├─────────────────────────────────────────────────────────────────────────────┤
│  4. createDraftPurchaseRequest() → Stores draft in DB with pending_approval │
├─────────────────────────────────────────────────────────────────────────────┤
│  5. routeForApproval() → Determines approver tier based on total cost       │
├─────────────────────────────────────────────────────────────────────────────┤
│  6. notifyApprover() → Sends in-app notification to inventory_manager       │
├─────────────────────────────────────────────────────────────────────────────┤
│  7. writeAuditLog() → Records complete audit trail                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Urgency Score Formula

```javascript
urgency_score = 100 * (0.55 * deficit_ratio + 0.25 * priority_norm + 0.15 * lead_norm + 0.05 * stockout)
```

Where:
- `deficit_ratio` = clamp((minLevel - available) / minLevel, 0, 1)
- `priority_norm` = priority / 5 (priority is 1-5 scale)
- `lead_norm` = clamp(leadDays / 14, 0, 1)
- `stockout` = 1 if available === 0, else 0

### Tool Functions Available to LLM

| Tool Name | Description |
|-----------|-------------|
| `getLowStockItems` | Fetches items from general_stores where stock < minLevel |
| `computeReorderPlan` | Calculates urgency, sorts by score, applies budget cap |
| `createDraftPurchaseRequest` | Persists draft to MongoDB with computed values |
| `routeForApproval` | Determines required approver role based on cost |
| `notifyApprover` | Sends in-app notifications to approvers |
| `writeAuditLog` | Records complete agent run audit |

### Approval Tiers

| Cost Range | Required Approver |
|------------|-------------------|
| All amounts | `inventory_manager` |

> Note: Original spec included finance_head/supervisor tiers, but implementation routes all to inventory_manager

### Backend Files

| File | Purpose |
|------|---------|
| `services/inventoryReorderAgent.service.js` | Core agent logic - helper functions, tool functions, tool definitions |
| `services/inventoryAgentLLM.service.js` | LLM orchestration - API calls, tool call processing, agent runner |
| `controllers/inventoryReorderAgent.controller.js` | API endpoints for agent operations |
| `routes/inventoryManager.routes.js` | Route definitions (lines 122-144) |
| `models/DraftPurchaseRequest.js` | MongoDB model for draft purchase requests |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/inventory-manager/reorder/agent/draft` | Trigger reorder agent to generate draft |
| `GET` | `/api/v1/inventory-manager/draft-purchase-requests` | List all draft purchase requests |
| `GET` | `/api/v1/inventory-manager/draft-purchase-requests/:id` | Get single draft details |
| `PUT` | `/api/v1/inventory-manager/draft-purchase-requests/:id/approve` | Approve a draft |
| `PUT` | `/api/v1/inventory-manager/draft-purchase-requests/:id/reject` | Reject a draft with reason |
| `POST` | `/api/v1/inventory-manager/draft-purchase-requests/:id/convert` | Convert draft to Purchase Requisition |
| `POST` | `/api/v1/inventory-manager/draft-purchase-requests/:id/fulfill` | Fulfill draft (directly update inventory) |

### Frontend Integration

| File | Purpose |
|------|---------|
| `services/inventoryManager.service.js` | API client with agentic reorder functions (lines 348-380) |
| `pages/inventory/InventoryDashboard.jsx` | Dashboard for inventory manager |
| `pages/inventory/ItemMaster.jsx` | Item management with stock controls |

### Frontend API Functions

```javascript
// Agentic Reorder Workflow
runReorderAgent(useDirect = true)           // Trigger the agent
getDraftPurchaseRequests(params)            // List drafts
getDraftPurchaseRequest(id)                 // Get single draft
approveDraftPurchaseRequest(id)             // Approve draft
rejectDraftPurchaseRequest(id, reason)      // Reject draft
fulfillDraftPurchaseRequest(id)             // Fulfill drafts
```

---

## Agentic Workflow 2: Insurance Pre-Authorization Agent

### Purpose
Automatically populates pre-authorization cases with clinical context from patient encounters, then uses AI to generate copy-paste ready pre-auth packet drafts with attachments checklists and risk warnings.

### Key Features

1. **Auto-Population**: Minimal input required - system automatically discovers patient encounters, documents, and clinical data
2. **AI Summaries**: Pulls existing AI-generated summaries from lab and radiology records
3. **Estimated Cost Computation**: Automatically calculates estimated costs from surgeries, procedures, bed charges, etc.
4. **LLM Packet Generation**: Generates structured pre-auth packets with clinical justification
5. **Attachments Checklist**: Identifies which documents exist/are missing
6. **Risk Warnings**: Highlights potential issues that could cause claim queries/denials

### Workflow Steps

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. TRIGGER: Insurance staff creates pre-auth case (patient + insurer)     │
├─────────────────────────────────────────────────────────────────────────────┤
│  2. findLatestEncounter() → Finds active admission/appointment/emergency   │
├─────────────────────────────────────────────────────────────────────────────┤
│  3. discoverDocuments() → Finds lab reports, radiology, prescriptions     │
├─────────────────────────────────────────────────────────────────────────────┤
│  4. pullAISummaries() → Retrieves existing AI summaries from records       │
├─────────────────────────────────────────────────────────────────────────────┤
│  5. computeEstimatedCost() → Calculates costs from all sources             │
├─────────────────────────────────────────────────────────────────────────────┤
│  6. Case stored with auto-populated fields                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  7. GENERATE PACKET: Staff triggers packet generation                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  8. LLM generates structured pre-auth packet with all clinical context      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Case Status Flow

```
DRAFT → READY → SUBMITTED → QUERY → APPROVED/DENIED
```

### Backend Files

| File | Purpose |
|------|---------|
| `services/preAuthQueue.service.js` | Auto-population logic, encounter discovery, cost computation |
| `services/preAuthAgentLLM.service.js` | LLM-powered packet generation |
| `controllers/preAuthQueue.controller.js` | API endpoints for pre-auth queue |
| `routes/insurance.routes.js` | Route definitions (lines 62-103) |
| `models/PreAuthQueue.js` | MongoDB model for pre-auth cases |

### Key Service Functions

**preAuthQueue.service.js:**
| Function | Purpose |
|----------|---------|
| `findLatestEncounter(patientId)` | Finds active admission > recent appointment > emergency |
| `discoverDocuments(patientId, encounterId, encounterModel)` | Finds all attached documents |
| `pullAISummaries(patientId, encounterId, encounterModel)` | Gets AI summaries from lab/radiology |
| `computeEstimatedCost(encounterId, encounterModel, encounterData)` | Calculates total estimated cost |
| `createCase(patientId, insurerName, tpaName, policyNumber, userId)` | Creates case with auto-population |
| `getAllCases(filters, page, limit)` | Lists cases with filters |
| `updateCaseStatus(caseId, status, userId)` | Updates case status |
| `addAuditEntry(caseId, action, userId, fieldsAccessed, details)` | Adds audit trail entry |

**preAuthAgentLLM.service.js:**
| Function | Purpose |
|----------|---------|
| `generatePreAuthPacket(caseId, userId)` | LLM-powered packet generation |
| `generatePreAuthPacketDirect(caseId, userId)` | Fallback direct generation (no LLM) |

### LLM Output Structure

The LLM generates a structured JSON response containing:

```javascript
{
  "packetDraft": {
    "patientIdentity": { name, patientId, dateOfBirth, gender },
    "insurerName": "string",
    "tpaName": "string or null",
    "policyNumber": "string",
    "diagnosisSummary": "string",
    "plannedProcedure": "string",
    "clinicalJustification": "string",
    "estimatedAmount": { amount, basis },
    "treatingDoctor": "string",
    "department": "string",
    "encounterReference": "string"
  },
  "attachmentsChecklist": [
    { documentType, exists, notes }
  ],
  "riskWarnings": [
    { issue, severity, recommendation }
  ],
  "nextActions": ["array of suggested next steps"]
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/insurance/preauth-queue` | Create new pre-auth case |
| `GET` | `/api/v1/insurance/preauth-queue` | List all cases (with filters) |
| `GET` | `/api/v1/insurance/preauth-queue/:caseId` | Get single case details |
| `POST` | `/api/v1/insurance/preauth-queue/:caseId/generate-packet` | Generate AI packet |
| `PUT` | `/api/v1/insurance/preauth-queue/:caseId/status` | Update case status |
| `PUT` | `/api/v1/insurance/preauth-queue/:caseId` | Update case details |

### Frontend Integration

| File | Purpose |
|------|---------|
| `services/insurance.service.js` | API client with pre-auth queue functions (lines 85-133) |
| `pages/dashboard/PreAuthQueueTab.jsx` | Pre-auth queue UI (782 lines) |
| `pages/dashboard/Insurance.jsx` | Insurance management dashboard |

### Frontend API Functions

```javascript
// Pre-Auth Queue (Agentic Workflow)
createPreAuthCase(patientId, insurerName, tpaName, policyNumber)
getPreAuthQueue(status)
getPreAuthCase(caseId)
generatePreAuthPacket(caseId, useDirect = false)
updatePreAuthCaseStatus(caseId, status)
updatePreAuthCase(caseId, updates)
```

### Frontend Components (PreAuthQueueTab.jsx)

- **CreateCaseModal**: Modal for creating new pre-auth cases with patient search
- **CaseDetailPanel**: Full case details with packet generation, status updates
- **QueueStatusBadge**: Visual status indicator component
- Patient search with typeahead
- Copy-to-clipboard for generated packet text
- Status flow management UI

---

## AI/LLM Infrastructure

### OpenRouter Integration

All agentic workflows use OpenRouter API for LLM capabilities:

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `OPENROUTER_API_KEY` | Primary API key for general LLM calls | - |
| `OPENROUTER_MODEL` | Model for lab report summarization | `google/gemma-3-27b-it:free` |
| `OPENROUTER_AGENTIC_INVENTORY_API_KEY` | API key for inventory agent | - |
| `OPENROUTER_AGENTIC_INVENTORY_MODEL` | Model for inventory agent | `qwen/qwen3-next-80b-a3b-instruct:free` |
| `OPENROUTER_AGENTIC_INSURANCE_API` | API key for insurance agent | - |
| `OPENROUTER_AGENTIC_INSURANCE_MODEL` | Model for insurance agent | `qwen/qwen3-next-80b-a3b-instruct:free` |

### LLM Client Service (services/llmClient.js)

Used for lab report summarization:

```javascript
// Functions exported
summarizeLabReport(extractedText) // Returns structured JSON summary
```

Features:
- Paragraph-format clinical summaries with bullet points for abnormal values
- Handles both manually entered lab values and PDF-extracted text
- Fallback mock summary when API key not configured

### Inventory Agent LLM Service (services/inventoryAgentLLM.service.js)

Used for inventory reorder orchestration:

```javascript
// Functions exported
runReorderAgent(userId, budgetCap)       // LLM-orchestrated agent run
runReorderAgentDirect(userId, budgetCap) // Fallback without LLM
```

Features:
- Function calling with tool definitions
- Multi-round tool execution (max 10 rounds)
- Automatic fallback to direct execution if LLM fails

### Pre-Auth Agent LLM Service (services/preAuthAgentLLM.service.js)

Used for insurance packet generation:

```javascript
// Functions exported
generatePreAuthPacket(caseId, userId)        // LLM-powered generation
generatePreAuthPacketDirect(caseId, userId)  // Fallback direct generation
```

Features:
- Structured JSON output parsing
- Clinical context injection from patient records
- Automatic fallback if LLM unavailable

---

## Database Models Added

### 1. DraftPurchaseRequest Model

**File:** `models/DraftPurchaseRequest.js`

**Purpose:** Stores AI-generated draft purchase requests for low-stock items

**Key Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `draftNumber` | String | Auto-generated unique identifier (DPR + date + sequence) |
| `status` | String | `pending_approval`, `approved`, `rejected`, `converted` |
| `policyCategory` | String | Policy category (e.g., `general_stores`) |
| `createdBy` | ObjectId (User) | User who triggered the agent |
| `budgetCap` | Number | Budget cap used for this draft |
| `totals` | Object | Aggregated totals for all items |
| `totals.totalCostAll` | Number | Total cost of all evaluated items |
| `totals.totalCostIncluded` | Number | Total cost of items within budget |
| `totals.itemsEvaluated` | Number | Number of items evaluated |
| `totals.itemsIncluded` | Number | Number of items included in draft |
| `totals.itemsDeferred` | Number | Number of items deferred |
| `withinBudgetItems` | Array | Items included in the draft |
| `deferredItems` | Array | Items deferred due to budget |
| `explanationText` | String | LLM-generated explanation |
| `requiredApproverRole` | String | Role required for approval |
| `approvedBy` | ObjectId (User) | User who approved |
| `approvedAt` | Date | Approval timestamp |
| `rejectedBy` | ObjectId (User) | User who rejected |
| `rejectedAt` | Date | Rejection timestamp |
| `rejectionReason` | String | Reason for rejection |
| `convertedToPR` | ObjectId (PurchaseRequisition) | Linked PR after conversion |
| `agentRunMetadata` | Object | LLM execution metadata |

**Draft Item Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `itemCode` | String | Item code |
| `itemName` | String | Item name |
| `uom` | String | Unit of measure |
| `availableStock` | Number | Current available stock |
| `minLevel` | Number | Minimum stock level |
| `targetLevel` | Number | Target stock level |
| `recommendedOrderQty` | Number | Computed order quantity |
| `unitCost` | Number | Cost per unit |
| `estimatedCost` | Number | Total estimated cost |
| `urgencyScore` | Number | Computed urgency (0-100) |
| `priority` | Number | Item priority (1-5) |
| `leadTimeDays` | Number | Lead time in days |
| `flags` | Array | Alert flags (`STOCKOUT`, `BELOW_MIN`, `HIGH_PRIORITY`, `LONG_LEAD_TIME`) |

**Indexes:**
- `draftNumber`
- `status`
- `policyCategory`
- `createdBy`
- `requiredApproverRole`
- `createdAt`

---

### 2. PreAuthQueue Model

**File:** `models/PreAuthQueue.js`

**Purpose:** Queue-gated access for insurance pre-authorization workflow with auto-populated clinical context

**Key Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `caseNumber` | String | Auto-generated unique identifier (PAQ + date + sequence) |
| `patient` | ObjectId (Patient) | Reference to patient |
| `insurerName` | String | Insurance company name |
| `tpaName` | String | Third Party Administrator name |
| `policyNumber` | String | Insurance policy number |
| `encounterId` | ObjectId | Reference to encounter |
| `encounterModel` | String | Model type (`Admission`, `Appointment`, `Emergency`) |
| `encounterData` | Object | Snapshot of encounter data |
| `documentExistenceFlags` | Object | Flags for document availability |
| `attachedDocuments` | Array | List of attached documents |
| `aiSummaries` | Object | AI summaries from lab/radiology |
| `estimatedCost` | Number | Total estimated cost |
| `estimationBreakdown` | Array | Cost breakdown by component |
| `status` | String | Case status |
| `agentOutput` | Object | LLM-generated packet data |
| `createdBy` | ObjectId (User) | User who created the case |
| `assignedTo` | ObjectId (User) | Assigned staff member |
| `auditTrail` | Array | Complete audit trail |

**Document Existence Flags:**

| Flag | Description |
|------|-------------|
| `hasLabReports` | Lab reports exist |
| `hasRadiologyReports` | Radiology reports exist |
| `hasPrescriptions` | Prescriptions exist |
| `hasSurgeryRecords` | Surgery records exist |
| `hasDoctorNotes` | Doctor notes exist |

**Agent Output Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `packetDraft` | Object | Structured pre-auth packet |
| `attachmentsChecklist` | Array | Document availability checklist |
| `riskWarnings` | Array | Potential risk/query warnings |
| `nextActions` | Array | Suggested next steps |
| `generatedAt` | Date | Generation timestamp |
| `modelUsed` | String | LLM model used |

**Indexes:**
- `caseNumber`
- `patient`
- `status`
- `createdBy`
- `createdAt`

---

## Backend Changes Summary

### New Controllers Added

| Controller | File | Purpose |
|------------|------|---------|
| Inventory Reorder Agent | `controllers/inventoryReorderAgent.controller.js` | Handles draft purchase request operations |
| Pre-Auth Queue | `controllers/preAuthQueue.controller.js` | Handles pre-auth case operations |

### New Services Added

| Service | File | Purpose |
|---------|------|---------|
| Inventory Reorder Agent | `services/inventoryReorderAgent.service.js` | Core agent logic with tool functions |
| Inventory Agent LLM | `services/inventoryAgentLLM.service.js` | LLM orchestration for inventory |
| Pre-Auth Queue | `services/preAuthQueue.service.js` | Auto-population and case management |
| Pre-Auth Agent LLM | `services/preAuthAgentLLM.service.js` | LLM-powered packet generation |
| LLM Client | `services/llmClient.js` | Lab report summarization |
| Inventory Policy Defaults | `services/inventoryPolicyDefaults.service.js` | Hardcoded policy defaults on startup |

### Route Changes

**inventoryManager.routes.js (lines 122-144):**
```javascript
// AGENTIC REORDER WORKFLOW
router.post('/reorder/agent/draft', reorderAgentController.generateReorderDraft);
router.get('/draft-purchase-requests', reorderAgentController.getDraftPurchaseRequests);
router.get('/draft-purchase-requests/:id', reorderAgentController.getDraftPurchaseRequest);
router.put('/draft-purchase-requests/:id/approve', reorderAgentController.approveDraftPurchaseRequest);
router.put('/draft-purchase-requests/:id/reject', reorderAgentController.rejectDraftPurchaseRequest);
router.post('/draft-purchase-requests/:id/convert', reorderAgentController.convertToPurchaseRequisition);
router.post('/draft-purchase-requests/:id/fulfill', reorderAgentController.fulfillDraftPurchaseRequest);
```

**insurance.routes.js (lines 62-103):**
```javascript
// PRE-AUTH QUEUE ROUTES (Agentic Workflow)
router.post('/preauth-queue', authorize(...), preAuthQueueController.createCase);
router.get('/preauth-queue', authorize(...), preAuthQueueController.getAllCases);
router.get('/preauth-queue/:caseId', authorize(...), preAuthQueueController.getCaseById);
router.post('/preauth-queue/:caseId/generate-packet', authorize(...), preAuthQueueController.generatePacket);
router.put('/preauth-queue/:caseId/status', authorize(...), preAuthQueueController.updateStatus);
router.put('/preauth-queue/:caseId', authorize(...), preAuthQueueController.updateCase);
```

---

## Frontend Changes Summary

### New Pages/Components

| Component | File | Purpose |
|-----------|------|---------|
| PreAuthQueueTab | `pages/dashboard/PreAuthQueueTab.jsx` | Pre-auth queue management UI (782 lines) |
| InventoryDashboard | `pages/inventory/InventoryDashboard.jsx` | Inventory manager dashboard |
| ItemMaster | `pages/inventory/ItemMaster.jsx` | Item management with stock controls |

### Service Updates

**inventoryManager.service.js (lines 348-380):**
- Added `runReorderAgent(useDirect)`
- Added `getDraftPurchaseRequests(params)`
- Added `getDraftPurchaseRequest(id)`
- Added `approveDraftPurchaseRequest(id)`
- Added `rejectDraftPurchaseRequest(id, reason)`
- Added `fulfillDraftPurchaseRequest(id)`

**insurance.service.js (lines 85-133):**
- Added `createPreAuthCase(patientId, insurerName, tpaName, policyNumber)`
- Added `getPreAuthQueue(status)`
- Added `getPreAuthCase(caseId)`
- Added `generatePreAuthPacket(caseId, useDirect)`
- Added `updatePreAuthCaseStatus(caseId, status)`
- Added `updatePreAuthCase(caseId, updates)`

---

## Constants and Enums Added

**File:** `config/constants.js`

### DRAFT_PURCHASE_REQUEST_STATUS

```javascript
const DRAFT_PURCHASE_REQUEST_STATUS = {
    PENDING_APPROVAL: 'pending_approval',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    CONVERTED: 'converted',
};
```

### PREAUTH_QUEUE_STATUS

```javascript
const PREAUTH_QUEUE_STATUS = {
    DRAFT: 'draft',
    READY: 'ready',
    SUBMITTED: 'submitted',
    QUERY: 'query',
    APPROVED: 'approved',
    DENIED: 'denied',
};
```

---

## Seeded Data and Policy Defaults

### Inventory Policy Defaults Service

**File:** `services/inventoryPolicyDefaults.service.js`

**Purpose:** Automatically applies hardcoded policy defaults to inventory items on server startup

**Items with Default Policies (11 items):**

| Item Name | Item Code | Min Level | Target Level | Priority | Lead Time | Unit Cost | Max Order Qty | Category |
|-----------|-----------|-----------|--------------|----------|-----------|-----------|---------------|----------|
| Disposable Syringe 5ml | NM-002 | 100 | 300 | 5 | 5 days | ₹8 | 500 | general_stores |
| Surgical Gloves (Latex) - Medium | NM-001 | 200 | 600 | 5 | 4 days | ₹15 | 1000 | general_stores |
| N95 Face Mask | NM-011 | 30 | 120 | 5 | 7 days | ₹60 | 300 | general_stores |
| IV Cannula | NM-012 | 80 | 250 | 5 | 6 days | ₹25 | 500 | general_stores |
| Cotton Roll | NM-013 | 50 | 150 | 3 | 3 days | ₹20 | 300 | general_stores |
| Gauze Pads | NM-014 | 150 | 400 | 4 | 5 days | ₹5 | 1000 | general_stores |
| Bandage Roll | NM-015 | 60 | 200 | 4 | 5 days | ₹30 | 400 | general_stores |
| Bedsheet (Hospital Linen) | NM-006 | 40 | 100 | 2 | 10 days | ₹350 | 80 | general_stores |
| Wheelchair (Standard) | NM-004 | 2 | 5 | 3 | 14 days | ₹6000 | 5 | equipment |
| Stethoscope | NM-016 | 3 | 8 | 2 | 5 days | ₹1200 | 10 | equipment |
| Thermometer (Digital) | NM-017 | 5 | 15 | 3 | 5 days | ₹250 | 30 | equipment |

**Behavior:**
- Runs automatically on server startup
- Idempotent - only sets values if not already present
- Creates items if they don't exist
- Updates policy fields if item exists but policy is empty

---

## Guardrails, Approvals, and Audit Logic

### Inventory Reorder Agent Guardrails

1. **Budget Cap**: Default ₹25,000 limit to prevent overspending
2. **Approval Routing**: All drafts require inventory_manager approval
3. **Audit Logging**: Every agent run is recorded with:
   - Timestamp
   - User who triggered
   - Items evaluated
   - Items included/deferred
   - Tool calls made
   - LLM model used
   - Execution time

4. **Fallback Logic**: Direct execution if LLM unavailable
5. **Max Tool Rounds**: Limit of 10 tool call rounds to prevent infinite loops

### Pre-Auth Queue Guardrails

1. **Status Flow Enforcement**: Cases must progress through defined states
2. **Role-Based Access**: Only authorized roles can access pre-auth queue:
   - `insurance_staff`
   - `insurance`
   - `billing`
   - `admin`

3. **Audit Trail**: Every action recorded with:
   - Action type
   - User ID
   - Timestamp
   - Fields accessed
   - Additional details

4. **Fallback Generation**: Direct generation if LLM unavailable

### Audit Entry Schema

```javascript
{
    action: String,          // e.g., 'case_created', 'packet_generated', 'status_updated'
    userId: ObjectId,        // User who performed action
    timestamp: Date,         // When action occurred
    fieldsAccessed: [String],// Which fields were accessed/modified
    details: Mixed           // Additional context
}
```

---

## File Location Reference

### Backend Files

```
hospital-his-backend/
├── config/
│   └── constants.js                           # Added DRAFT_PURCHASE_REQUEST_STATUS, PREAUTH_QUEUE_STATUS
├── controllers/
│   ├── inventoryReorderAgent.controller.js    # NEW - Reorder agent API endpoints
│   └── preAuthQueue.controller.js             # NEW - Pre-auth queue API endpoints
├── models/
│   ├── DraftPurchaseRequest.js                # NEW - Draft purchase request model
│   └── PreAuthQueue.js                        # NEW - Pre-auth queue case model
├── routes/
│   ├── inventoryManager.routes.js             # MODIFIED - Added agentic reorder routes (lines 122-144)
│   └── insurance.routes.js                    # MODIFIED - Added pre-auth queue routes (lines 62-103)
└── services/
    ├── inventoryReorderAgent.service.js       # NEW - Core reorder agent logic
    ├── inventoryAgentLLM.service.js           # NEW - LLM orchestration for inventory
    ├── inventoryPolicyDefaults.service.js     # NEW - Hardcoded policy defaults
    ├── preAuthQueue.service.js                # NEW - Pre-auth auto-population logic
    ├── preAuthAgentLLM.service.js             # NEW - LLM packet generation
    └── llmClient.js                           # NEW - Lab report summarization
```

### Frontend Files

```
hospital-his-frontend/src/
├── pages/
│   ├── dashboard/
│   │   ├── PreAuthQueueTab.jsx                # NEW - Pre-auth queue UI (782 lines)
│   │   └── Insurance.jsx                      # MODIFIED - Added pre-auth tab
│   └── inventory/
│       ├── InventoryDashboard.jsx             # Dashboard for inventory manager
│       └── ItemMaster.jsx                     # Item management
└── services/
    ├── inventoryManager.service.js            # MODIFIED - Added agentic reorder API functions
    └── insurance.service.js                   # MODIFIED - Added pre-auth queue API functions
```

---

## Environment Variables Required

```bash
# LLM Configuration (OpenRouter)
OPENROUTER_API_KEY=sk-or-...                   # Primary API key
OPENROUTER_MODEL=google/gemma-3-27b-it:free    # Model for lab reports

# Inventory Agent
OPENROUTER_AGENTIC_INVENTORY_API_KEY=sk-or-... # API key for inventory agent
OPENROUTER_AGENTIC_INVENTORY_MODEL=qwen/...    # Model for inventory agent

# Insurance Agent  
OPENROUTER_AGENTIC_INSURANCE_API=sk-or-...     # API key for insurance agent
OPENROUTER_AGENTIC_INSURANCE_MODEL=qwen/...    # Model for insurance agent
```

---

## Summary

This documentation covers the complete implementation of two major agentic workflows in the Hospital Information System:

1. **Inventory Reorder Agent**: An LLM-orchestrated workflow that automatically detects low-stock items, computes urgency-based reorder plans, creates draft purchase requests, and routes them for approval with full audit trails.

2. **Insurance Pre-Authorization Agent**: An AI-powered workflow that auto-populates pre-auth cases with clinical context from patient encounters and generates structured pre-auth packets ready for submission to insurers.

Both workflows leverage OpenRouter API for LLM capabilities, include comprehensive fallback mechanisms, and maintain detailed audit trails for compliance and traceability.
