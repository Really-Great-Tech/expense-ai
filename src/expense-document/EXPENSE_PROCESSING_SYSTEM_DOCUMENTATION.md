# Expense Processing System - Complete Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Complete Workflow](#complete-workflow)
4. [Workers](#workers)
5. [AI Agents](#ai-agents)
6. [Integration Points](#integration-points)
7. [Data Models](#data-models)
8. [Configuration](#configuration)
9. [API Endpoints](#api-endpoints)
10. [Error Handling & Monitoring](#error-handling--monitoring)

---

## 1. System Overview

The Expense Processing System is a **NestJS-based microservices architecture** that processes expense documents through multiple AI-powered stages. It uses **BullMQ (Redis queues)** for asynchronous job processing and **AWS Bedrock LLMs** for intelligent document analysis.

### Key Features
- Multi-page document splitting with AI boundary detection
- Parallel AI agent processing for maximum throughput
- Country-specific compliance validation
- Duplicate detection
- OCR extraction with AWS Textract
- Image quality assessment
- Comprehensive status tracking
- Automatic retry mechanisms
- Rate limiting and concurrency control

### Technology Stack
- **Framework**: NestJS (TypeScript)
- **Queue System**: BullMQ (Redis-based)
- **Database**: MySQL/Aurora with TypeORM
- **AI/ML**: AWS Bedrock (Claude 3.5 Sonnet, Claude Sonnet 4, Amazon Nova Pro)
- **OCR**: AWS Textract
- **Storage**: AWS S3
- **Container**: Docker support

---

## 2. Architecture

### High-Level Architecture

```
┌──────────────┐
│   Client     │
│  (HTTP API)  │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│         Upload Controller                    │
│  (Multi-receipt upload endpoint)             │
└──────┬──────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│    DocumentSplitterService                   │
│  - Duplicate detection                       │
│  - Create ExpenseDocument entity             │
│  - Upload to S3                              │
│  - Enqueue to document-splitting queue       │
└──────┬──────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│      Redis Queue: document-splitting        │
└──────┬──────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│   DocumentSplitterProcessor (Worker)         │
│  - Extract markdown (Textract)               │
│  - Convert PDF to images                     │
│  - AI boundary detection                     │
│  - Filter Expensify/blank pages              │
│  - Create Receipt entities                   │
│  - Enqueue to expense-processing queue       │
└──────┬──────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│      Redis Queue: expense-processing        │
└──────┬──────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│      ExpenseProcessor (Worker)               │
│  - Load markdown                             │
│  - Parallel AI processing:                   │
│    • Image quality assessment                │
│    • File classification                     │
│    • Data extraction                         │
│  - Compliance validation                     │
│  - LLM-as-Judge validation                   │
│  - Save results                              │
└──────┬──────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│       Database (Results stored)              │
│    - ReceiptProcessingResult                 │
│    - Receipt (status updated)                │
└─────────────────────────────────────────────┘
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Controllers                         │
│  - UploadController: Document upload                     │
│  - ExpenseStatusController: Status queries               │
│  - ReceiptResultsController: Result queries              │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                       Services                           │
│  - DocumentSplitterService                               │
│  - ExpenseProcessingService                              │
│  - DocumentParsingService                                │
│  - DocumentPersistenceService                            │
│  - ValidationOrchestratorService                         │
│  - CountryPolicyService                                  │
│  - DuplicateDetectionService                             │
│  - PdfToImageService                                     │
│  - S3StorageService                                      │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                       Workers                            │
│  - DocumentSplitterProcessor (concurrency: 25)           │
│  - ExpenseProcessor (concurrency: 5)                     │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                      AI Agents                           │
│  - DocumentSplitterAgent (boundary detection)            │
│  - ImageQualityAssessmentAgent (quality scoring)         │
│  - FileClassificationAgent (type/language detection)     │
│  - DataExtractionAgent (structured data extraction)      │
│  - IssueDetectionAgent (compliance validation)           │
│  - CitationGeneratorAgent (field-to-source mapping)      │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                  External Services                       │
│  - AWS Textract (OCR)                                    │
│  - AWS Bedrock (LLM inference)                           │
│  - AWS S3 (file storage)                                 │
│  - Redis (queue management)                              │
│  - MySQL/Aurora (data persistence)                       │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Complete Workflow

### Phase 1: Document Upload & Initialization

**Entry Point**: `POST /expenses/multi-receipt/upload`

**Controller**: [upload.controller.ts](src/expense-document/controllers/upload.controller.ts)

**Steps**:

1. **HTTP Request Validation**
   - Accepts: `multipart/form-data`
   - File field: `file`
   - Body fields: `userProfile`, `policyId`, `expectedCountry`
   - Max file size: 50MB
   - Supported formats: PDF, PNG, JPG, JPEG, WEBP
   - PDF limit: 20 pages

2. **Duplicate Detection**
   - Service: [duplicate-detection.service.ts](src/expense-document/services/duplicate-detection.service.ts)
   - Computes SHA-256 hash of file
   - Checks against `file_hashes` table
   - If duplicate found: Returns existing `ExpenseDocument` ID
   - If new: Proceeds to next step

3. **Database Entity Creation**
   - Creates `ExpenseDocument` entity with status `QUEUED`
   - Stores metadata: `userProfile`, `policyId`, `expectedCountry`, `mimeType`, `fileHash`
   - Assigns unique `expenseDocumentId`

4. **S3 Upload**
   - Service: [s3-storage.service.ts](src/common/storage/s3-storage.service.ts)
   - Uploads original file to S3
   - Path format: `documents/{expenseDocumentId}/original.{ext}`
   - Updates `ExpenseDocument.originalFilePath`

5. **Queue Job Creation**
   - Enqueues job to `document-splitting` queue
   - Job type: `split-document`
   - Payload: `{ expenseDocumentId }`
   - Retry config: 2 attempts, 5s exponential backoff

6. **HTTP Response**
   ```json
   {
     "expenseDocumentId": "uuid-here",
     "status": "QUEUED",
     "message": "Document uploaded and queued for processing"
   }
   ```

**Status**: `QUEUED` → ready for worker processing

---

### Phase 2: Document Splitting (Worker Processing)

**Worker**: [document-splitter.processor.ts](src/workers/document-splitter.processor.ts)

**Queue**: `document-splitting` (concurrency: 25)

**Lock Duration**: 10 minutes

**Steps**:

#### Step 2.1: Status Update
- Update `ExpenseDocument.status` to `PENDING`

#### Step 2.2: Document Parsing
- Service: [document-parsing.service.ts](src/expense-document/services/document-parsing.service.ts)
- Downloads file from S3
- Extracts markdown using AWS Textract
  - Converts PDF/image to text
  - Preserves structure (tables, forms)
  - Returns array of page markdown strings

#### Step 2.3: Image Conversion (Parallel)
- Service: [pdf-to-image.service.ts](src/common/services/pdf-to-image.service.ts)
- Converts each PDF page to PNG image
- Required for vision-based analysis
- Stores images in memory for agent processing

#### Step 2.4: Status Update
- Update `ExpenseDocument.status` to `TEXTRACT_COMPLETE`

#### Step 2.5: AI Boundary Detection
- Agent: [document-splitter.agent.ts](src/agents/document-splitter.agent.ts)
- Model: Claude Sonnet 4 (vision) + Nova Pro (text)
- Concurrency: 15 (boundary detection), 8 (metadata extraction)

**Sub-steps**:

1. **Vision-Based Boundary Detection** (Parallel pairwise comparison)
   - Compares consecutive page pairs using vision LLM
   - Determines if pages belong to same invoice
   - Returns boundary markers between invoices

2. **Page Classification** (Parallel)
   - Classifies each page:
     - `ACTUAL_RECEIPT`: Valid expense document
     - `EXPENSE_COVER`: Expensify cover page (filtered out)
     - `ERROR_PAGE`: System error page
     - `BLANK_PAGE`: Empty page
     - `DUPLICATE_PAGE`: Duplicate content

3. **Metadata Extraction** (Parallel)
   - For each page, extracts:
     - Merchant name
     - Transaction amount
     - Document type
     - Confidence score

#### Step 2.6: Invoice Grouping
- Groups pages by boundaries
- Filters out:
  - Expensify cover pages (`EXPENSE_COVER`)
  - Blank pages (`BLANK_PAGE`)
  - Error pages (`ERROR_PAGE`)
  - Duplicate pages (`DUPLICATE_PAGE`)

#### Step 2.7: Status Update
- Update `ExpenseDocument.status` to `SPLITTING`

#### Step 2.8: Receipt Entity Creation
- Service: [document-persistence.service.ts](src/expense-document/services/document-persistence.service.ts)
- For each invoice group:
  - Creates `Receipt` entity
  - Stores extracted markdown text
  - Links to parent `ExpenseDocument` (via `expenseDocumentId`)
  - Sets page range (e.g., pages 1-3)
  - Status: `QUEUED`

**Note**: Original PDF is NOT split. Receipts reference pages in the original document.

#### Step 2.9: Queue Job Creation (Per Receipt)
- For each created `Receipt`:
  - Enqueues job to `expense-processing` queue
  - Job type: `process-document`
  - Payload: `{ receiptId, expenseDocumentId }`
  - Retry config: 3 attempts, 2s exponential backoff

#### Step 2.10: Status Update
- Update `ExpenseDocument.status` to `COMPLETED`
- Update `ExpenseDocument.totalReceipts` count

**Status Progression**: `QUEUED` → `PENDING` → `TEXTRACT_COMPLETE` → `BOUNDARY_DETECTION` → `SPLITTING` → `COMPLETED`

**Error Handling**: On failure, status set to `FAILED` with error message stored in `errorDetails`

---

### Phase 3: Receipt Processing (Worker Processing)

**Worker**: [expense.processor.ts](src/workers/expense.processor.ts)

**Queue**: `expense-processing` (concurrency: 5, configurable via `WORKER_CONCURRENCY`)

**Lock Duration**: 5 minutes

**Steps**:

#### Step 3.1: Status Update
- Update `Receipt.status` to `PROCESSING`

#### Step 3.2: Markdown Loading
- **Primary source**: Stored markdown from `Receipt.markdownText`
- **Fallback**: Re-extract from S3 using Textract
- Service: [expense-processing.service.ts](src/workers/services/expense-processing.service.ts)

#### Step 3.3: Parallel Processing Group 1 (Independent Phases)

These three agents run **in parallel** as they are independent:

##### 3.3.1: Image Quality Assessment
- Agent: [image-quality-assessment.agent.ts](src/agents/image-quality-assessment.agent.ts)
- Model: Vision-capable LLM (profile: `QUALITY_ASSESSMENT`)
- Status: `QUALITY_ASSESSMENT`

**Analysis**:
- Blur detection (motion blur, out-of-focus)
- Contrast assessment (too dark, too bright)
- Glare identification (reflections, bright spots)
- Physical damage (water stains, tears, folds)
- Cut-off detection (edges missing)
- Missing sections (incomplete scan)
- Obstructions (fingers, objects covering content)

**Output**:
```typescript
{
  qualityScore: number,        // 0-10
  isSuitable: boolean,          // true if score >= 7
  issues: string[],             // List of detected issues
  recommendations: string[]     // Improvement suggestions
}
```

##### 3.3.2: File Classification
- Agent: [file-classification.agent.ts](src/agents/file-classification.agent.ts)
- Model: Claude 3.5 Sonnet (profile: `CLASSIFICATION`)
- Status: `CLASSIFICATION`

**Analysis**:
- Is this an expense document? (true/false)
- Expense type: `RECEIPT`, `INVOICE`, `STATEMENT`, `TRAVEL_ITINERARY`, etc.
- Language detection (e.g., "English", "Spanish", "French")
- Document location vs expected country (mismatch detection)
- Schema field analysis (identifies present fields)

**Output**:
```typescript
{
  isExpense: boolean,
  expenseType: string,
  language: string,
  confidence: number,           // 0-1
  metadata: {
    countryMismatch: boolean,
    detectedCountry: string
  }
}
```

##### 3.3.3: Data Extraction
- Agent: [data-extraction.agent.ts](src/agents/data-extraction.agent.ts)
- Model: Amazon Nova Pro (profile: `EXTRACTION`)
- Status: `EXTRACTION`

**Extracted Fields**:
```typescript
{
  vendor: {
    name: string,
    address: string,
    phone: string,
    email: string,
    taxId: string               // VAT/GST/TIN
  },
  transaction: {
    amount: number,
    currency: string,           // ISO 4217 code
    date: string,               // ISO 8601 format
    time: string,
    invoiceNumber: string,
    receiptNumber: string
  },
  tax: {
    taxAmount: number,
    taxRate: number,
    taxType: string,            // VAT, GST, Sales Tax
    taxId: string
  },
  payment: {
    method: string,             // CASH, CARD, TRANSFER
    cardLastFour: string,
    approvalCode: string
  },
  lineItems: [
    {
      description: string,
      quantity: number,
      unitPrice: number,
      amount: number,
      taxAmount: number
    }
  ],
  consumer: {
    name: string,
    address: string,
    taxId: string
  },
  icpRequirements: {
    hasIcpDetails: boolean,
    icpAmount: number,
    icpDescription: string
  },
  totals: {
    subtotal: number,
    taxTotal: number,
    grandTotal: number
  }
}
```

**Wait Point**: All three agents must complete before proceeding.

#### Step 3.4: Parallel Processing Group 2 (Dependent on Extraction)

These agents run **in parallel** but depend on extraction results:

##### 3.4.1: Issue Detection (Compliance Validation)
- Agent: [issue-detection.agent.ts](src/agents/issue-detection.agent.ts)
- Model: Bedrock LLM (profile: `COMPLIANCE`)
- Status: `VALIDATION`

**Inputs**:
- Extracted data from Step 3.3.3
- Country-specific policies from `CountryPolicyService`
- Expected country from user profile

**Analysis**:
- Missing required fields (per country policy)
- Invalid data formats (dates, amounts, tax IDs)
- Tax compliance issues (incorrect rates, missing tax IDs)
- Country-specific requirements (ICP for Ireland, VAT for EU)
- Policy violations (unauthorized vendors, excessive amounts)

**Output**:
```typescript
{
  isCompliant: boolean,
  issues: [
    {
      type: string,             // MISSING_FIELD, INVALID_FORMAT, etc.
      severity: string,         // ERROR, WARNING, INFO
      field: string,
      message: string,
      recommendation: string
    }
  ],
  compliance: {
    requiredFieldsPresent: string[],
    missingFields: string[],
    countryCompliant: boolean
  }
}
```

##### 3.4.2: Citation Generation (DISABLED)
- Agent: [citation-generator.agent.ts](src/agents/citation-generator.agent.ts)
- Model: Bedrock LLM (profile: `CITATION`)
- **Note**: Currently disabled in code (line 83 in [expense.processor.ts](src/workers/expense.processor.ts:83))

**Purpose** (when enabled):
- Maps extracted fields to source document locations
- Provides traceability (field → text snippet)

**Output**:
```typescript
{
  citations: [
    {
      field: string,            // e.g., "vendor.name"
      value: string,            // Extracted value
      sourceText: string,       // Original text from document
      confidence: number        // 0-1
    }
  ]
}
```

**Wait Point**: Both agents must complete before proceeding.

#### Step 3.5: LLM-as-Judge Validation
- Service: [validation-orchestrator.service.ts](src/workers/services/validation-orchestrator.service.ts)
- Validators:
  - Parallel mode: [parallel-expense-compliance-uqlm.validator.ts](src/workers/validators/parallel-expense-compliance-uqlm.validator.ts)
  - Sequential mode: [expense-compliance-uqlm.validator.ts](src/workers/validators/expense-compliance-uqlm.validator.ts)

**Purpose**: Meta-validation using a separate LLM to verify compliance results

**Configuration**:
- `PARALLEL_VALIDATION_ENABLED`: Enable parallel mode (default: true)
- `VALIDATION_DIMENSION_CONCURRENCY`: Dimension concurrency (default: 6)
- `VALIDATION_JUDGE_CONCURRENCY`: Judge concurrency (default: 3)

**Validation Dimensions** (parallel):
1. **Factual Accuracy**: Are extracted facts correct?
2. **Completeness**: Are all required fields present?
3. **Consistency**: Do extracted fields align with each other?
4. **Compliance**: Does document meet policy requirements?
5. **Clarity**: Are detected issues clearly explained?
6. **Actionability**: Are recommendations actionable?

**Process**:
- For each dimension:
  - Separate LLM judges the compliance result
  - Returns score (0-10) and reasoning
- Aggregates scores across dimensions
- Generates final validation verdict

**Output**:
```typescript
{
  validationScore: number,      // 0-10
  validationPassed: boolean,    // true if score >= 7
  dimensionScores: {
    factualAccuracy: number,
    completeness: number,
    consistency: number,
    compliance: number,
    clarity: number,
    actionability: number
  },
  feedback: string,
  recommendations: string[]
}
```

#### Step 3.6: Save Results
- Service: [document-persistence.service.ts](src/expense-document/services/document-persistence.service.ts)

**Saved Data**:

1. **ReceiptProcessingResult** entity:
   - Quality assessment result
   - Classification result
   - Extraction result
   - Compliance validation result
   - Citation result (if enabled)
   - Validation result (LLM-as-Judge)
   - Overall processing status

2. **Receipt** entity updates:
   - Status: `COMPLETED`
   - `processedAt` timestamp

3. **S3 Storage**:
   - Markdown extraction: `documents/{expenseDocumentId}/receipts/{receiptId}/markdown.txt`

#### Step 3.7: Status Update
- Update `Receipt.status` to `COMPLETED`

**Status Progression**: `QUEUED` → `PROCESSING` → `CLASSIFICATION` → `EXTRACTION` → `VALIDATION` → `QUALITY_ASSESSMENT` → `COMPLETED`

**Error Handling**: On failure, status set to `FAILED` with error message stored in `processingError`

---

## 4. Workers

### Worker 1: DocumentSplitterProcessor

**File**: [document-splitter.processor.ts](src/workers/document-splitter.processor.ts)

**Queue Name**: `document-splitting`

**Configuration**:
- **Concurrency**: 25 (parallel job processing)
- **Lock Duration**: 600,000ms (10 minutes)
- **Lock Renew Time**: 30,000ms (30 seconds)
- **Retry Strategy**: 2 attempts, exponential backoff (5s base delay)

**Responsibilities**:
1. Extract markdown from multi-page documents using Textract
2. Convert PDF pages to PNG images for vision analysis
3. Use AI to detect invoice boundaries
4. Filter out Expensify cover pages, blank pages, error pages
5. Create individual Receipt entities for each detected invoice
6. Enqueue receipts to expense-processing queue

**Job Payload**:
```typescript
{
  expenseDocumentId: string
}
```

**Key Dependencies**:
- `DocumentSplitterAgent`: AI boundary detection
- `DocumentParsingService`: Textract integration
- `PdfToImageService`: PDF to PNG conversion
- `S3StorageService`: File storage
- `DocumentPersistenceService`: Database operations

**Error Handling**:
- On failure: Update `ExpenseDocument.status` to `FAILED`
- Store error details in `ExpenseDocument.errorDetails`
- Retry: 2 attempts with exponential backoff

**Monitoring**:
- Logs: `[DocumentSplitterProcessor]` prefix
- Metrics: Processing time, success rate, error rate
- Status transitions tracked in database

---

### Worker 2: ExpenseProcessor

**File**: [expense.processor.ts](src/workers/expense.processor.ts)

**Queue Name**: `expense-processing`

**Configuration**:
- **Concurrency**: 5 (default, configurable via `WORKER_CONCURRENCY` env var)
- **Lock Duration**: 300,000ms (5 minutes)
- **Lock Renew Time**: 30,000ms (30 seconds)
- **Retry Strategy**: 3 attempts, exponential backoff (2s base delay)

**Responsibilities**:
1. Load markdown text for receipt (stored or re-extract)
2. Run parallel AI agents: quality assessment, classification, extraction
3. Run dependent AI agents: issue detection, citations
4. Perform LLM-as-Judge validation of compliance results
5. Save all results to database and S3
6. Update receipt status to COMPLETED

**Job Payload**:
```typescript
{
  receiptId: string,
  expenseDocumentId: string
}
```

**Processing Phases**:
1. **Setup Phase**: Load markdown, prepare context
2. **Parallel Phase 1**: Quality + Classification + Extraction (concurrent)
3. **Parallel Phase 2**: Compliance + Citations (concurrent, depends on extraction)
4. **Validation Phase**: LLM-as-Judge meta-validation (sequential)
5. **Persistence Phase**: Save results to database and S3

**Key Dependencies**:
- `ExpenseProcessingService`: Orchestration logic
- `ImageQualityAssessmentAgent`: Quality scoring
- `FileClassificationAgent`: Document classification
- `DataExtractionAgent`: Structured data extraction
- `IssueDetectionAgent`: Compliance validation
- `CitationGeneratorAgent`: Field-to-source mapping
- `ValidationOrchestratorService`: LLM-as-Judge validation
- `CountryPolicyService`: Country-specific policies
- `DocumentPersistenceService`: Database operations
- `S3StorageService`: File storage

**Error Handling**:
- On failure: Update `Receipt.status` to `FAILED`
- Store error message in `Receipt.processingError`
- Retry: 3 attempts with exponential backoff
- Partial failures: Save partial results if any phase succeeds

**Monitoring**:
- Logs: `[ExpenseProcessor]` prefix
- Metrics: Processing time per phase, agent performance, error rate
- Status transitions tracked in database

**Rate Limiting**:
- Bedrock rate limit: 10 requests/second (configurable via `BEDROCK_RATE_LIMIT_PER_SECOND`)
- Concurrency controlled via `WORKER_CONCURRENCY` env var

---

## 5. AI Agents

All agents are created via the **AgentFactoryService** ([agent-factory.service.ts](src/workers/services/agent-factory.service.ts)) which provides centralized agent configuration and model selection.

### Agent 1: ImageQualityAssessmentAgent

**File**: [image-quality-assessment.agent.ts](src/agents/image-quality-assessment.agent.ts)

**Model**: Vision-capable LLM (profile: `QUALITY_ASSESSMENT`)

**Purpose**: Assess the physical and technical quality of document images

**Input**:
- Document image (PNG/JPG) OR PDF (auto-converted to PNG)
- Optional: Markdown text for context

**Analysis Criteria**:
1. **Blur Detection**
   - Motion blur
   - Out-of-focus blur
   - Severity assessment

2. **Contrast Assessment**
   - Too dark (underexposed)
   - Too bright (overexposed)
   - Washed out areas

3. **Glare Identification**
   - Reflections
   - Bright spots
   - Coverage percentage

4. **Physical Damage**
   - Water stains
   - Tears/rips
   - Folds/creases
   - Impact on readability

5. **Cut-off Detection**
   - Edges missing
   - Incomplete scan
   - Which sections affected

6. **Missing Sections**
   - Gaps in content
   - Incomplete information
   - Critical fields missing

7. **Obstructions**
   - Fingers/hands
   - Objects covering content
   - Stamps/watermarks

**Output Schema**:
```typescript
{
  qualityScore: number,        // 0-10 (10 = perfect quality)
  isSuitable: boolean,          // true if score >= 7
  issues: [
    {
      type: string,             // BLUR, CONTRAST, GLARE, etc.
      severity: string,         // LOW, MEDIUM, HIGH
      description: string,
      affectedAreas: string[]   // Parts of document affected
    }
  ],
  recommendations: [
    {
      issue: string,
      recommendation: string,   // How to fix
      priority: string          // LOW, MEDIUM, HIGH
    }
  ],
  metadata: {
    hasBlur: boolean,
    hasGlare: boolean,
    hasDamage: boolean,
    hasCutoff: boolean,
    hasObstructions: boolean
  }
}
```

**Prompt Strategy**:
- Vision-first analysis (image + text)
- Structured output via JSON schema
- Examples provided for consistent scoring

**Error Handling**:
- On invalid response: Returns default "low quality" result
- On API failure: Throws exception (caught by worker)

---

### Agent 2: FileClassificationAgent

**File**: [file-classification.agent.ts](src/agents/file-classification.agent.ts)

**Model**: Claude 3.5 Sonnet (profile: `CLASSIFICATION`)

**Purpose**: Classify the document type, language, and basic metadata

**Input**:
- Markdown text (from OCR)
- Expected country (from user profile)
- Policy ID (for context)

**Classification Tasks**:
1. **Expense Document Detection**
   - Is this a valid expense document? (true/false)
   - Confidence score (0-1)

2. **Expense Type Classification**
   - `RECEIPT`: Retail/restaurant receipt
   - `INVOICE`: B2B invoice
   - `STATEMENT`: Bank/credit card statement
   - `TRAVEL_ITINERARY`: Flight/hotel booking
   - `PARKING_RECEIPT`: Parking ticket
   - `TOLL_RECEIPT`: Toll payment
   - `TAXI_RECEIPT`: Taxi/rideshare receipt
   - `OTHER`: Unknown type

3. **Language Detection**
   - Primary language (e.g., "English", "Spanish", "French")
   - Confidence score

4. **Country Detection**
   - Detected document country (from vendor address, currency)
   - Comparison with expected country
   - Mismatch flag if different

5. **Schema Field Analysis**
   - Identifies present fields (vendor, amount, date, tax, etc.)
   - Used to guide extraction phase

**Output Schema**:
```typescript
{
  isExpense: boolean,
  expenseType: string,          // One of the types above
  language: string,
  confidence: number,           // 0-1
  metadata: {
    countryMismatch: boolean,
    detectedCountry: string,
    expectedCountry: string,
    presentFields: string[],    // Fields found in document
    documentCharacteristics: {
      hasVendorInfo: boolean,
      hasAmount: boolean,
      hasDate: boolean,
      hasTaxInfo: boolean,
      hasLineItems: boolean
    }
  },
  reasoning: string             // Explanation of classification
}
```

**Prompt Strategy**:
- Few-shot examples for each expense type
- Structured output via JSON schema
- Language detection via content analysis (not metadata)

**Error Handling**:
- On invalid response: Returns "not an expense" classification
- On API failure: Throws exception (caught by worker)

---

### Agent 3: DataExtractionAgent

**File**: [data-extraction.agent.ts](src/agents/data-extraction.agent.ts)

**Model**: Amazon Nova Pro (profile: `EXTRACTION`)

**Purpose**: Extract structured data from expense documents

**Input**:
- Markdown text (from OCR)
- Classification result (from FileClassificationAgent)
- Expected country (for context)

**Extraction Schema**:

```typescript
{
  vendor: {
    name: string,               // Business/merchant name
    address: {
      street: string,
      city: string,
      state: string,
      postalCode: string,
      country: string
    },
    contact: {
      phone: string,
      email: string,
      website: string
    },
    taxId: string,              // VAT/GST/TIN number
    registrationNumber: string  // Business registration
  },

  transaction: {
    amount: number,             // Total amount
    currency: string,           // ISO 4217 code (USD, EUR, GBP)
    date: string,               // ISO 8601 (YYYY-MM-DD)
    time: string,               // HH:MM:SS format
    invoiceNumber: string,      // Invoice/receipt number
    receiptNumber: string,
    orderNumber: string,
    referenceNumber: string
  },

  tax: {
    taxAmount: number,          // Total tax amount
    taxRate: number,            // Tax percentage
    taxType: string,            // VAT, GST, Sales Tax, etc.
    taxId: string,              // Tax registration number
    taxBreakdown: [
      {
        type: string,           // e.g., "VAT 20%"
        rate: number,
        amount: number
      }
    ]
  },

  payment: {
    method: string,             // CASH, CARD, BANK_TRANSFER, etc.
    cardType: string,           // VISA, MASTERCARD, AMEX
    cardLastFour: string,       // Last 4 digits
    approvalCode: string,       // Transaction approval code
    terminalId: string
  },

  lineItems: [
    {
      description: string,      // Item/service description
      quantity: number,
      unitPrice: number,
      amount: number,           // quantity * unitPrice
      taxAmount: number,
      taxRate: number,
      category: string,         // MEALS, TRAVEL, SUPPLIES, etc.
      sku: string               // Product SKU (if available)
    }
  ],

  consumer: {
    name: string,               // Customer name (if B2B)
    address: {
      street: string,
      city: string,
      state: string,
      postalCode: string,
      country: string
    },
    taxId: string,              // Customer tax ID (for B2B)
    email: string,
    phone: string
  },

  icpRequirements: {
    hasIcpDetails: boolean,     // Ireland ICP requirement
    icpAmount: number,
    icpDescription: string,
    icpVatNumber: string
  },

  totals: {
    subtotal: number,           // Before tax
    taxTotal: number,           // Total tax amount
    discountTotal: number,      // Total discounts
    tipAmount: number,          // Gratuity/tip
    grandTotal: number          // Final amount
  },

  metadata: {
    documentType: string,       // RECEIPT, INVOICE, etc.
    issuedBy: string,           // Company that issued document
    issuedTo: string,           // Recipient
    dueDate: string,            // Payment due date (for invoices)
    terms: string,              // Payment terms
    notes: string               // Additional notes
  }
}
```

**Extraction Rules**:
1. **Null Handling**: If field not found, return `null` (not empty string)
2. **Date Formats**: Convert to ISO 8601 (YYYY-MM-DD)
3. **Currency**: Extract ISO code (USD, EUR, GBP), fallback to symbol recognition
4. **Amounts**: Convert to decimal numbers (remove currency symbols, commas)
5. **Tax IDs**: Preserve original format (including country prefixes)
6. **Addresses**: Parse into structured components
7. **Line Items**: Extract all itemized entries
8. **Totals**: Validate that subtotal + tax = grandTotal

**Prompt Strategy**:
- Country-specific instructions (e.g., ICP for Ireland)
- Examples for different document types
- Structured output via JSON schema
- Emphasis on accuracy over speed

**Error Handling**:
- On invalid response: Attempts to parse partial data
- On API failure: Throws exception (caught by worker)
- On validation failure: Returns partial extraction with warnings

---

### Agent 4: IssueDetectionAgent

**File**: [issue-detection.agent.ts](src/agents/issue-detection.agent.ts)

**Model**: Bedrock LLM (profile: `COMPLIANCE`)

**Purpose**: Detect compliance issues and policy violations

**Input**:
- Extracted data (from DataExtractionAgent)
- Country-specific policies (from CountryPolicyService)
- Expected country (from user profile)
- Policy ID (for custom rules)

**Analysis Tasks**:
1. **Required Field Validation**
   - Per country policies (e.g., Ireland requires ICP details)
   - Missing critical fields (vendor, amount, date)

2. **Data Format Validation**
   - Date formats (valid ISO 8601)
   - Amount formats (positive numbers)
   - Tax ID formats (country-specific patterns)
   - Currency codes (valid ISO 4217)

3. **Tax Compliance**
   - Tax rate validation (matches country rates)
   - Tax calculation accuracy (subtotal * rate = taxAmount)
   - VAT/GST number validation (format checks)

4. **Country-Specific Requirements**
   - **Ireland**: ICP details for EU transactions
   - **EU**: VAT numbers for B2B
   - **US**: State-specific sales tax
   - **UK**: VAT registration threshold

5. **Policy Violations**
   - Unauthorized vendors (if policy has whitelist)
   - Excessive amounts (if policy has limits)
   - Restricted categories (if policy blocks certain expenses)

6. **Data Consistency**
   - Line items sum to subtotal
   - Subtotal + tax = grandTotal
   - Currency consistency across fields

**Output Schema**:
```typescript
{
  isCompliant: boolean,         // Overall compliance status
  complianceScore: number,      // 0-10 (10 = fully compliant)

  issues: [
    {
      id: string,               // Unique issue ID
      type: string,             // MISSING_FIELD, INVALID_FORMAT, etc.
      severity: string,         // ERROR, WARNING, INFO
      category: string,         // TAX, FIELD, POLICY, FORMAT
      field: string,            // Affected field (e.g., "vendor.taxId")
      message: string,          // Human-readable description
      recommendation: string,   // How to fix

      details: {
        expected: any,          // Expected value/format
        actual: any,            // Actual value found
        rule: string            // Policy rule violated
      }
    }
  ],

  compliance: {
    requiredFieldsPresent: string[],
    missingFields: string[],
    countryCompliant: boolean,
    taxCompliant: boolean,
    policyCompliant: boolean
  },

  summary: {
    totalIssues: number,
    errorCount: number,
    warningCount: number,
    infoCount: number
  },

  recommendations: [
    {
      priority: string,         // HIGH, MEDIUM, LOW
      action: string,           // What to do
      reason: string            // Why it's needed
    }
  ]
}
```

**Issue Types**:
- `MISSING_FIELD`: Required field not found
- `INVALID_FORMAT`: Field has incorrect format
- `INVALID_VALUE`: Field has invalid value
- `TAX_CALCULATION_ERROR`: Tax math doesn't add up
- `POLICY_VIOLATION`: Breaks company policy
- `CONSISTENCY_ERROR`: Fields contradict each other
- `COUNTRY_REQUIREMENT`: Country-specific requirement not met

**Prompt Strategy**:
- Country-specific policy injection
- Rule-based validation with LLM judgment
- Severity classification based on impact
- Actionable recommendations

**Error Handling**:
- On invalid response: Returns "non-compliant" with generic error
- On API failure: Throws exception (caught by worker)

---

### Agent 5: CitationGeneratorAgent

**File**: [citation-generator.agent.ts](src/agents/citation-generator.agent.ts)

**Model**: Bedrock LLM (profile: `CITATION`)

**Purpose**: Map extracted fields to source document locations

**Status**: Currently **DISABLED** in code (line 83 in [expense.processor.ts](src/workers/expense.processor.ts:83))

**Input**:
- Extracted data (from DataExtractionAgent)
- Original markdown text (from OCR)
- Page numbers (for multi-page receipts)

**Citation Tasks**:
1. **Field-to-Text Mapping**
   - For each extracted field, find source text in document
   - Provide context (surrounding text)
   - Calculate confidence score

2. **Source Localization**
   - Page number (for multi-page documents)
   - Approximate position (top, middle, bottom)
   - Line number (if available)

3. **Confidence Scoring**
   - Exact match: 1.0
   - Partial match: 0.5-0.9
   - Inferred/calculated: 0.3-0.5
   - No source: 0.0

**Output Schema**:
```typescript
{
  citations: [
    {
      field: string,            // e.g., "vendor.name"
      path: string,             // JSON path to field
      value: string,            // Extracted value

      source: {
        text: string,           // Original text from document
        context: string,        // Surrounding text (±50 chars)
        page: number,           // Page number (1-indexed)
        position: string,       // TOP, MIDDLE, BOTTOM
        lineNumber: number      // Line in markdown (if available)
      },

      confidence: number,       // 0-1
      matchType: string,        // EXACT, PARTIAL, INFERRED, NONE

      metadata: {
        isCalculated: boolean,  // Field calculated from other fields
        sourceFields: string[]  // If calculated, source fields
      }
    }
  ],

  summary: {
    totalFields: number,
    citedFields: number,
    uncitedFields: number,
    averageConfidence: number
  }
}
```

**Use Cases** (when enabled):
- Audit trail for extracted data
- Dispute resolution (verify extraction accuracy)
- Training data generation (field → text pairs)
- Human review support (show source evidence)

**Prompt Strategy**:
- Direct text matching first
- Fuzzy matching for variations
- Inference marking for calculated fields
- High confidence threshold for citations

**Error Handling**:
- On invalid response: Returns empty citations
- On API failure: Throws exception (caught by worker)

---

### Agent 6: DocumentSplitterAgent

**File**: [document-splitter.agent.ts](src/agents/document-splitter.agent.ts)

**Models**:
- **Text Analysis**: Amazon Nova Pro (profile: `DOCUMENT_SPLITTER`)
- **Vision Analysis**: Claude Sonnet 4 (profile: `SONNET_4`)

**Purpose**: Detect invoice boundaries in multi-page documents

**Input**:
- Multi-page markdown text (from OCR)
- Multi-page images (PNG format)
- Expected country (for context)

**Processing Pipeline**:

#### Phase 1: Vision-Based Boundary Detection (Parallel)
- **Concurrency**: 15 page pairs
- **Strategy**: Pairwise comparison of consecutive pages

**For each page pair** (page N and page N+1):
- Input: Two images (page N PNG, page N+1 PNG)
- Analysis:
  - Does page N+1 continue page N's invoice?
  - Is page N+1 a new invoice?
  - Visual indicators: Headers, footers, layout changes
- Output: `CONTINUES` or `NEW_INVOICE`

**Boundary Detection**:
- Marks boundaries where `NEW_INVOICE` detected
- Groups pages between boundaries

#### Phase 2: Page Classification (Parallel)
- **Concurrency**: 8 pages
- **Strategy**: Classify each page individually

**Classification Types**:
```typescript
enum PageType {
  ACTUAL_RECEIPT = 'ACTUAL_RECEIPT',        // Valid expense document
  EXPENSE_COVER = 'EXPENSE_COVER',          // Expensify cover page (filter out)
  ERROR_PAGE = 'ERROR_PAGE',                // System error page (filter out)
  BLANK_PAGE = 'BLANK_PAGE',                // Empty page (filter out)
  DUPLICATE_PAGE = 'DUPLICATE_PAGE'         // Duplicate content (filter out)
}
```

**Expensify Cover Page Detection**:
- Looks for "Expensify" branding
- "Merchant copy" text
- Specific layout patterns
- Marks for filtering

**Blank Page Detection**:
- Very little text content (<50 chars)
- No structured data (amounts, dates)
- Mostly whitespace

**Error Page Detection**:
- "Page not found", "Error", "404" text
- System error messages
- No expense-related content

#### Phase 3: Metadata Extraction (Parallel)
- **Concurrency**: 8 pages
- **Strategy**: Extract basic metadata from each page

**Extracted Metadata**:
```typescript
{
  merchant: string,             // Vendor name
  amount: number,               // Transaction amount
  currency: string,             // Currency code
  documentType: string,         // RECEIPT, INVOICE, etc.
  confidence: number            // 0-1
}
```

#### Phase 4: Invoice Grouping
- Groups pages by boundaries
- Filters out non-receipt pages:
  - `EXPENSE_COVER` pages
  - `BLANK_PAGE` pages
  - `ERROR_PAGE` pages
  - `DUPLICATE_PAGE` pages
- Creates invoice groups with page ranges

**Output**:
```typescript
{
  invoiceGroups: [
    {
      startPage: number,        // 1-indexed
      endPage: number,
      pageCount: number,
      pages: [
        {
          pageNumber: number,
          type: PageType,
          metadata: {
            merchant: string,
            amount: number,
            currency: string,
            documentType: string,
            confidence: number
          }
        }
      ],
      isFiltered: boolean       // True if group should be ignored
    }
  ],

  summary: {
    totalPages: number,
    totalInvoices: number,
    filteredPages: number,
    expensifyPagesDetected: number,
    blankPagesDetected: number,
    errorPagesDetected: number
  }
}
```

**Prompt Strategies**:

1. **Boundary Detection Prompt**:
   - Vision-focused (uses page images)
   - Looks for: Headers, logos, totals, layout breaks
   - Binary decision: continues or new invoice

2. **Page Classification Prompt**:
   - Pattern matching for Expensify covers
   - Content analysis for blank/error pages
   - Confidence scoring

3. **Metadata Extraction Prompt**:
   - Fast extraction (lightweight model)
   - High-confidence fields only
   - No validation (just extraction)

**Error Handling**:
- On boundary detection failure: Treats as single invoice (conservative)
- On classification failure: Treats as `ACTUAL_RECEIPT` (conservative)
- On metadata extraction failure: Creates invoice without metadata
- On API failure: Throws exception (caught by worker)

**Optimization**:
- Parallel processing for speed
- Vision model only for boundary detection (most accurate)
- Text model for classification (faster, cheaper)
- Metadata extraction optional (not critical for splitting)

---

## 6. Integration Points

### 6.1 AWS Textract

**Service**: [document-parsing.service.ts](src/expense-document/services/document-parsing.service.ts)

**Purpose**: OCR extraction from PDF and image files

**API Operations Used**:
- `analyzeDocument`: Synchronous document analysis
- Features: `TABLES`, `FORMS`, `LAYOUT`

**Input**:
- Document bytes (Buffer)
- Document type: PDF, PNG, JPG, WEBP

**Output**:
- Markdown text (per page)
- Table extraction
- Form field extraction
- Layout preservation

**Configuration**:
- Region: `AWS_REGION` env var
- Credentials: IAM role or access keys
- Timeout: 60 seconds per document

**Error Handling**:
- On failure: Throws exception with Textract error details
- Retries: Handled by AWS SDK (3 attempts)

**Usage**:
1. Document splitting: Extract markdown from entire document
2. Receipt processing: Re-extract if stored markdown unavailable

---

### 6.2 AWS Bedrock

**Service**: [bedrock-llm.service.ts](src/common/llm/bedrock-llm.service.ts)

**Purpose**: LLM inference for all AI agents

**Models Used**:
- **Claude 3.5 Sonnet**: Classification, compliance
- **Claude Sonnet 4**: Vision-based boundary detection
- **Amazon Nova Pro**: Extraction, text-based splitting

**API Operations Used**:
- `invokeModel`: Synchronous inference
- Content types: Text, Image (base64)

**Model Profiles** (centralized config):
```typescript
{
  CLASSIFICATION: {
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    temperature: 0.1,
    maxTokens: 4096
  },
  EXTRACTION: {
    modelId: 'amazon.nova-pro-v1:0',
    temperature: 0.1,
    maxTokens: 8192
  },
  COMPLIANCE: {
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    temperature: 0.2,
    maxTokens: 4096
  },
  QUALITY_ASSESSMENT: {
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    temperature: 0.1,
    maxTokens: 2048,
    supportsVision: true
  },
  DOCUMENT_SPLITTER: {
    modelId: 'amazon.nova-pro-v1:0',
    temperature: 0.1,
    maxTokens: 4096
  },
  SONNET_4: {
    modelId: 'anthropic.claude-sonnet-4-20250514-v1:0',
    temperature: 0.1,
    maxTokens: 4096,
    supportsVision: true
  }
}
```

**Rate Limiting**:
- Configurable: `BEDROCK_RATE_LIMIT_PER_SECOND` (default: 10)
- Token bucket algorithm
- Per-model rate limits

**Configuration**:
- Region: `AWS_REGION` env var
- Credentials: IAM role or access keys
- Timeout: 120 seconds per request

**Error Handling**:
- On throttling: Automatic retry with exponential backoff
- On model error: Throws exception (caught by worker)
- On invalid response: Agent-specific fallback

---

### 6.3 AWS S3

**Service**: [s3-storage.service.ts](src/common/storage/s3-storage.service.ts)

**Purpose**: File storage for documents and results

**Bucket Structure**:
```
{bucket}/
  documents/
    {expenseDocumentId}/
      original.{ext}              # Original uploaded file
      receipts/
        {receiptId}/
          markdown.txt            # Extracted markdown
          page-{n}.png            # Page images (if generated)
```

**API Operations Used**:
- `putObject`: Upload files
- `getObject`: Download files
- `deleteObject`: Delete files (cleanup)

**Upload Paths**:
1. **Original Document**: `documents/{expenseDocumentId}/original.{ext}`
2. **Markdown Extraction**: `documents/{expenseDocumentId}/receipts/{receiptId}/markdown.txt`
3. **Page Images**: `documents/{expenseDocumentId}/receipts/{receiptId}/page-{n}.png` (optional)

**Configuration**:
- Bucket: `AWS_S3_BUCKET` env var
- Region: `AWS_REGION` env var
- Credentials: IAM role or access keys

**Error Handling**:
- On upload failure: Throws exception (caught by service)
- On download failure: Returns null or throws (context-dependent)

---

### 6.4 Redis (BullMQ)

**Queues**:
1. **document-splitting**: Multi-page document splitting
2. **expense-processing**: Individual receipt processing

**Configuration**:
- Host: `REDIS_HOST` env var (default: `localhost`)
- Port: `REDIS_PORT` env var (default: `6379`)
- Password: `REDIS_PASSWORD` env var (if required)
- DB: `REDIS_DB` env var (default: `0`)

**Queue Settings**:
```typescript
{
  'document-splitting': {
    concurrency: 25,
    lockDuration: 600000,       // 10 minutes
    lockRenewTime: 30000,       // 30 seconds
    retries: 2,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  },
  'expense-processing': {
    concurrency: 5,             // Configurable via WORKER_CONCURRENCY
    lockDuration: 300000,       // 5 minutes
    lockRenewTime: 30000,       // 30 seconds
    retries: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
}
```

**Job Lifecycle**:
1. **Enqueued**: Job added to queue
2. **Active**: Worker picks up job
3. **Completed**: Job finished successfully
4. **Failed**: Job failed after all retries
5. **Delayed**: Job in backoff delay (after failure)

**Monitoring**:
- Bull Board UI: `/queues` endpoint (if enabled)
- Metrics: Job counts, processing times, error rates

---

### 6.5 Database (MySQL/Aurora)

**ORM**: TypeORM

**Connection Config**:
- Host: `DB_HOST` env var
- Port: `DB_PORT` env var (default: `3306`)
- Database: `DB_DATABASE` env var
- Username: `DB_USERNAME` env var
- Password: `DB_PASSWORD` env var (or IAM auth)
- IAM Authentication: `DB_IAM_AUTH` env var (default: `false`)

**Entities**:
1. **ExpenseDocument**: Parent document
2. **Receipt**: Individual invoice/receipt
3. **ReceiptProcessingResult**: AI processing results
4. **FileHash**: Duplicate detection
5. **CountryPolicy**: Country-specific compliance rules

**Migrations**:
- Auto-run on startup (if `DB_SYNCHRONIZE=true`)
- Manual migrations via TypeORM CLI

---

## 7. Data Models

### 7.1 ExpenseDocument Entity

**File**: [expense-document.entity.ts](src/expense-document/entities/expense-document.entity.ts)

**Purpose**: Represents the original uploaded document

**Schema**:
```typescript
{
  id: string,                   // UUID primary key

  // File metadata
  originalFileName: string,     // User-provided filename
  mimeType: string,             // application/pdf, image/png, etc.
  fileSize: number,             // Bytes
  fileHash: string,             // SHA-256 hash for duplicate detection
  originalFilePath: string,     // S3 path to original file

  // User context
  userProfile: string,          // User identifier
  policyId: string,             // Policy identifier
  expectedCountry: string,      // ISO country code (e.g., "IE", "US")

  // Processing status
  status: ExpenseDocumentStatus,
  /*
    QUEUED: Waiting for processing
    PENDING: Processing started
    TEXTRACT_COMPLETE: OCR extraction done
    BOUNDARY_DETECTION: AI boundary detection in progress
    SPLITTING: Creating receipt entities
    COMPLETED: All receipts created and enqueued
    FAILED: Processing failed
  */

  // Results
  totalReceipts: number,        // Number of receipts created
  totalPages: number,           // Number of pages in document
  errorDetails: string,         // Error message (if failed)

  // Relationships
  receipts: Receipt[],          // One-to-many: Created receipts

  // Timestamps
  createdAt: Date,
  updatedAt: Date,
  processedAt: Date             // When processing completed
}
```

**Indexes**:
- Primary key: `id`
- Unique: `fileHash` (duplicate detection)
- Indexed: `userProfile`, `status`, `createdAt`

---

### 7.2 Receipt Entity

**File**: [receipt.entity.ts](src/expense-document/entities/receipt.entity.ts)

**Purpose**: Represents a single invoice/receipt extracted from a document

**Schema**:
```typescript
{
  id: string,                   // UUID primary key

  // Parent reference
  expenseDocumentId: string,    // Foreign key to ExpenseDocument
  expenseDocument: ExpenseDocument,

  // Page reference
  startPage: number,            // 1-indexed start page
  endPage: number,              // 1-indexed end page
  pageCount: number,            // Number of pages in receipt

  // Extracted content
  markdownText: string,         // OCR markdown (stored for reuse)

  // Processing status
  status: ReceiptStatus,
  /*
    QUEUED: Waiting for processing
    PROCESSING: AI agents running
    CLASSIFICATION: Classification agent running
    EXTRACTION: Extraction agent running
    VALIDATION: Validation agent running
    QUALITY_ASSESSMENT: Quality assessment running
    COMPLETED: Processing finished
    FAILED: Processing failed
  */

  // Error tracking
  processingError: string,      // Error message (if failed)

  // Relationships
  processingResult: ReceiptProcessingResult,  // One-to-one: Processing results

  // Timestamps
  createdAt: Date,
  updatedAt: Date,
  processedAt: Date             // When processing completed
}
```

**Indexes**:
- Primary key: `id`
- Foreign key: `expenseDocumentId`
- Indexed: `status`, `createdAt`

---

### 7.3 ReceiptProcessingResult Entity

**File**: [receipt-processing-result.entity.ts](src/expense-result/entities/receipt-processing-result.entity.ts)

**Purpose**: Stores AI processing results for a receipt

**Schema**:
```typescript
{
  id: string,                   // UUID primary key

  // Parent reference
  receiptId: string,            // Foreign key to Receipt (unique)
  receipt: Receipt,

  // Quality assessment results
  qualityAssessment: {
    qualityScore: number,       // 0-10
    isSuitable: boolean,
    issues: Array<{
      type: string,
      severity: string,
      description: string,
      affectedAreas: string[]
    }>,
    recommendations: Array<{
      issue: string,
      recommendation: string,
      priority: string
    }>,
    metadata: object
  },

  // Classification results
  classification: {
    isExpense: boolean,
    expenseType: string,
    language: string,
    confidence: number,
    metadata: {
      countryMismatch: boolean,
      detectedCountry: string,
      expectedCountry: string,
      presentFields: string[],
      documentCharacteristics: object
    },
    reasoning: string
  },

  // Extraction results
  extraction: {
    vendor: object,             // Vendor details
    transaction: object,        // Transaction details
    tax: object,                // Tax information
    payment: object,            // Payment details
    lineItems: array,           // Line items
    consumer: object,           // Consumer details
    icpRequirements: object,    // ICP details (Ireland)
    totals: object,             // Total amounts
    metadata: object
  },

  // Compliance validation results
  complianceValidation: {
    isCompliant: boolean,
    complianceScore: number,    // 0-10
    issues: Array<{
      id: string,
      type: string,
      severity: string,
      category: string,
      field: string,
      message: string,
      recommendation: string,
      details: object
    }>,
    compliance: {
      requiredFieldsPresent: string[],
      missingFields: string[],
      countryCompliant: boolean,
      taxCompliant: boolean,
      policyCompliant: boolean
    },
    summary: {
      totalIssues: number,
      errorCount: number,
      warningCount: number,
      infoCount: number
    },
    recommendations: array
  },

  // Citation results (optional, currently disabled)
  citation: {
    citations: Array<{
      field: string,
      path: string,
      value: string,
      source: object,
      confidence: number,
      matchType: string,
      metadata: object
    }>,
    summary: object
  },

  // LLM-as-Judge validation results
  validation: {
    validationScore: number,    // 0-10
    validationPassed: boolean,
    dimensionScores: {
      factualAccuracy: number,
      completeness: number,
      consistency: number,
      compliance: number,
      clarity: number,
      actionability: number
    },
    feedback: string,
    recommendations: string[]
  },

  // Overall status
  processingStatus: string,     // SUCCESS, PARTIAL_SUCCESS, FAILED

  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- Primary key: `id`
- Unique: `receiptId`
- Indexed: `processingStatus`, `createdAt`

---

### 7.4 FileHash Entity

**File**: [file-hash.entity.ts](src/expense-document/entities/file-hash.entity.ts)

**Purpose**: Track file hashes for duplicate detection

**Schema**:
```typescript
{
  id: string,                   // UUID primary key
  hash: string,                 // SHA-256 hash (unique)
  expenseDocumentId: string,    // Foreign key to ExpenseDocument
  createdAt: Date
}
```

**Indexes**:
- Primary key: `id`
- Unique: `hash`

---

### 7.5 CountryPolicy Entity

**File**: [country-policy.entity.ts](src/expense-result/entities/country-policy.entity.ts)

**Purpose**: Store country-specific compliance rules

**Schema**:
```typescript
{
  id: string,                   // UUID primary key
  countryCode: string,          // ISO country code (e.g., "IE", "US")

  // Requirements
  requirements: {
    requiresVat: boolean,
    requiresIcp: boolean,       // Ireland-specific
    requiresTaxId: boolean,
    requiredFields: string[],

    taxRates: Array<{
      type: string,             // VAT, GST, Sales Tax
      rate: number,
      description: string
    }>,

    documentTypes: string[],    // Accepted document types

    validationRules: Array<{
      field: string,
      rule: string,             // REQUIRED, FORMAT, RANGE
      value: any,
      errorMessage: string
    }>
  },

  // Metadata
  description: string,
  isActive: boolean,

  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- Primary key: `id`
- Indexed: `countryCode`, `isActive`

---

## 8. Configuration

### 8.1 Environment Variables

#### Application
```env
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

#### Database
```env
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=expenses_db
DB_USERNAME=expenses_user
DB_PASSWORD=secure_password
DB_SYNCHRONIZE=false
DB_IAM_AUTH=false              # Enable IAM authentication for Aurora
```

#### Redis
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

#### AWS
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key     # Or use IAM role
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=expenses-documents
```

#### Worker Configuration
```env
WORKER_CONCURRENCY=5           # Expense processor concurrency
DOCUMENT_SPLITTER_CONCURRENCY=25
```

#### Agent Configuration
```env
CLASSIFICATION_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0
EXTRACTION_MODEL=amazon.nova-pro-v1:0
VALIDATION_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0
```

#### Validation Configuration
```env
PARALLEL_VALIDATION_ENABLED=true
VALIDATION_DIMENSION_CONCURRENCY=6
VALIDATION_JUDGE_CONCURRENCY=3
```

#### Rate Limiting
```env
BEDROCK_RATE_LIMIT_PER_SECOND=10
```

#### File Upload
```env
UPLOAD_PATH=/tmp/uploads       # Local upload path (fallback)
MAX_FILE_SIZE=52428800         # 50MB in bytes
MAX_PDF_PAGES=20
```

---

### 8.2 Agent Profiles

**File**: [agent-profiles.config.ts](src/common/config/agent-profiles.config.ts)

```typescript
export const AGENT_PROFILES = {
  CLASSIFICATION: {
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    temperature: 0.1,
    maxTokens: 4096,
    supportsVision: false
  },

  EXTRACTION: {
    modelId: 'amazon.nova-pro-v1:0',
    temperature: 0.1,
    maxTokens: 8192,
    supportsVision: false
  },

  COMPLIANCE: {
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    temperature: 0.2,
    maxTokens: 4096,
    supportsVision: false
  },

  QUALITY_ASSESSMENT: {
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    temperature: 0.1,
    maxTokens: 2048,
    supportsVision: true
  },

  CITATION: {
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    temperature: 0.1,
    maxTokens: 4096,
    supportsVision: false
  },

  DOCUMENT_SPLITTER: {
    modelId: 'amazon.nova-pro-v1:0',
    temperature: 0.1,
    maxTokens: 4096,
    supportsVision: false
  },

  SONNET_4: {
    modelId: 'anthropic.claude-sonnet-4-20250514-v1:0',
    temperature: 0.1,
    maxTokens: 4096,
    supportsVision: true
  }
};
```

---

## 9. API Endpoints

### 9.1 Document Upload

**Endpoint**: `POST /expenses/multi-receipt/upload`

**Controller**: [upload.controller.ts](src/expense-document/controllers/upload.controller.ts)

**Request**:
```http
POST /expenses/multi-receipt/upload
Content-Type: multipart/form-data

file: [binary]
userProfile: "user@example.com"
policyId: "policy-123"
expectedCountry: "IE"
```

**Response** (Success):
```json
{
  "expenseDocumentId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "QUEUED",
  "message": "Document uploaded and queued for processing"
}
```

**Response** (Duplicate):
```json
{
  "expenseDocumentId": "existing-uuid",
  "status": "COMPLETED",
  "message": "Duplicate document detected",
  "isDuplicate": true
}
```

**Response** (Error):
```json
{
  "statusCode": 400,
  "message": "File size exceeds 50MB limit",
  "error": "Bad Request"
}
```

---

### 9.2 Document Status

**Endpoint**: `GET /expenses/{documentId}/status`

**Controller**: [expense-status.controller.ts](src/expense-result/controllers/expense-status.controller.ts)

**Request**:
```http
GET /expenses/550e8400-e29b-41d4-a716-446655440000/status
```

**Response**:
```json
{
  "expenseDocumentId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "COMPLETED",
  "totalReceipts": 3,
  "totalPages": 5,
  "receipts": [
    {
      "receiptId": "receipt-uuid-1",
      "status": "COMPLETED",
      "startPage": 1,
      "endPage": 2,
      "pageCount": 2
    },
    {
      "receiptId": "receipt-uuid-2",
      "status": "PROCESSING",
      "startPage": 3,
      "endPage": 3,
      "pageCount": 1
    },
    {
      "receiptId": "receipt-uuid-3",
      "status": "QUEUED",
      "startPage": 4,
      "endPage": 5,
      "pageCount": 2
    }
  ],
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:35:00Z",
  "processedAt": "2025-01-15T10:35:00Z"
}
```

---

### 9.3 Receipt Results

**Endpoint**: `GET /expenses/receipts/{receiptId}`

**Controller**: [receipt-results.controller.ts](src/expense-result/controllers/receipt-results.controller.ts)

**Request**:
```http
GET /expenses/receipts/receipt-uuid-1
```

**Response**:
```json
{
  "receiptId": "receipt-uuid-1",
  "status": "COMPLETED",
  "expenseDocumentId": "550e8400-e29b-41d4-a716-446655440000",
  "startPage": 1,
  "endPage": 2,

  "results": {
    "qualityAssessment": {
      "qualityScore": 8.5,
      "isSuitable": true,
      "issues": [],
      "recommendations": []
    },

    "classification": {
      "isExpense": true,
      "expenseType": "RECEIPT",
      "language": "English",
      "confidence": 0.95
    },

    "extraction": {
      "vendor": {
        "name": "Acme Corp",
        "address": "123 Main St, Dublin, Ireland",
        "taxId": "IE1234567T"
      },
      "transaction": {
        "amount": 100.00,
        "currency": "EUR",
        "date": "2025-01-15",
        "time": "14:30:00",
        "receiptNumber": "REC-001"
      },
      "tax": {
        "taxAmount": 23.00,
        "taxRate": 23.0,
        "taxType": "VAT"
      },
      "totals": {
        "subtotal": 100.00,
        "taxTotal": 23.00,
        "grandTotal": 123.00
      }
    },

    "complianceValidation": {
      "isCompliant": true,
      "complianceScore": 9.0,
      "issues": [],
      "compliance": {
        "requiredFieldsPresent": ["vendor.name", "transaction.amount", "transaction.date"],
        "missingFields": [],
        "countryCompliant": true,
        "taxCompliant": true,
        "policyCompliant": true
      }
    },

    "validation": {
      "validationScore": 8.8,
      "validationPassed": true,
      "dimensionScores": {
        "factualAccuracy": 9.0,
        "completeness": 8.5,
        "consistency": 9.0,
        "compliance": 8.8,
        "clarity": 8.5,
        "actionability": 9.0
      }
    }
  },

  "createdAt": "2025-01-15T10:31:00Z",
  "updatedAt": "2025-01-15T10:34:00Z",
  "processedAt": "2025-01-15T10:34:00Z"
}
```

---

## 10. Error Handling & Monitoring

### 10.1 Error Types

#### Application Errors
- **ValidationError**: Invalid input data
- **DuplicateError**: Duplicate document upload
- **ProcessingError**: Worker processing failure
- **AgentError**: AI agent failure
- **IntegrationError**: External service failure

#### HTTP Status Codes
- **200**: Success
- **400**: Bad request (validation failure)
- **404**: Resource not found
- **409**: Duplicate resource
- **500**: Internal server error
- **503**: Service unavailable (rate limiting, external service down)

---

### 10.2 Logging

**Logger**: Winston (JSON format)

**Log Levels**:
- `error`: Critical errors requiring immediate attention
- `warn`: Warnings (non-critical issues)
- `info`: General information (job start/complete)
- `debug`: Detailed debugging information
- `verbose`: Very detailed logs (development only)

**Log Format**:
```json
{
  "timestamp": "2025-01-15T10:30:00.123Z",
  "level": "info",
  "context": "ExpenseProcessor",
  "message": "Processing receipt",
  "receiptId": "receipt-uuid-1",
  "expenseDocumentId": "550e8400-e29b-41d4-a716-446655440000",
  "phase": "EXTRACTION"
}
```

---

### 10.3 Monitoring Metrics

#### Queue Metrics
- Job counts (enqueued, active, completed, failed)
- Processing times (average, p50, p95, p99)
- Queue depth (number of waiting jobs)
- Error rates (failures per minute)

#### Worker Metrics
- Active workers
- Worker utilization (busy vs idle time)
- Lock durations
- Retry counts

#### Agent Metrics
- Agent invocation counts (per agent type)
- Agent response times
- Agent success rates
- Token usage (per model)

#### System Metrics
- CPU usage
- Memory usage
- Database connection pool
- Redis connection pool
- S3 upload/download rates

---

### 10.4 Health Checks

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00Z",
  "services": {
    "database": "ok",
    "redis": "ok",
    "s3": "ok",
    "textract": "ok",
    "bedrock": "ok"
  },
  "queues": {
    "document-splitting": {
      "active": 5,
      "waiting": 12,
      "failed": 0
    },
    "expense-processing": {
      "active": 3,
      "waiting": 8,
      "failed": 0
    }
  }
}
```

---

### 10.5 Alerting

**Alert Triggers**:
1. **High Error Rate**: >5% job failure rate
2. **Queue Backlog**: >100 jobs waiting for >10 minutes
3. **Worker Starvation**: All workers busy for >5 minutes
4. **External Service Failure**: Textract/Bedrock/S3 down
5. **Database Connection Exhaustion**: >90% pool utilization
6. **High Latency**: p99 processing time >10 minutes

**Alert Channels**:
- Email notifications
- Slack webhooks
- PagerDuty (for critical alerts)

---

## 11. Troubleshooting

### Common Issues

#### Issue: Jobs stuck in "PROCESSING"
**Cause**: Worker crashed or timed out
**Solution**: Check worker logs, increase lock duration, restart workers

#### Issue: High error rate in expense-processing
**Cause**: Bedrock throttling or model errors
**Solution**: Reduce concurrency, increase rate limit delay, check Bedrock quotas

#### Issue: Duplicate detection not working
**Cause**: File hash computation failure
**Solution**: Check file upload integrity, verify SHA-256 implementation

#### Issue: Compliance validation fails for valid documents
**Cause**: Country policy misconfiguration
**Solution**: Review country policy rules, update required fields

---

## 12. Performance Optimization

### Recommendations

1. **Worker Concurrency**
   - Document splitting: Keep at 25 (optimal for Textract)
   - Expense processing: Tune based on Bedrock rate limits (5-10)

2. **Agent Parallelization**
   - Maximize parallel group 1 (quality, classification, extraction)
   - Enable parallel validation for faster LLM-as-Judge

3. **Caching**
   - Cache country policies in memory
   - Cache Textract results (avoid re-extraction)
   - Cache S3 downloads for repeated access

4. **Database Optimization**
   - Index frequently queried fields (`status`, `createdAt`)
   - Use connection pooling (min: 10, max: 50)
   - Enable query logging for slow queries

5. **Redis Optimization**
   - Use Redis Cluster for high throughput
   - Monitor memory usage (eviction policy: `noeviction`)
   - Separate Redis instances for queues and caching

---

## 13. Future Enhancements

### Planned Features
1. **Citation Generation**: Enable field-to-source mapping
2. **Webhook Notifications**: Real-time status updates
3. **Batch Processing**: Multi-document upload
4. **Custom Policies**: User-defined validation rules
5. **Audit Trail**: Detailed processing history
6. **Human Review Queue**: Manual validation for low-confidence results
7. **Analytics Dashboard**: Processing metrics and trends
8. **Multi-language Support**: Extended language coverage
9. **OCR Alternatives**: Fallback OCR engines (Tesseract, Google Vision)
10. **Export Formats**: JSON, CSV, Excel export

---

## 14. Conclusion

This expense processing system is a sophisticated, production-ready architecture that leverages cutting-edge AI technology to automate expense document processing at scale. With intelligent document splitting, parallel AI agent processing, comprehensive validation, and robust error handling, it provides a reliable and efficient solution for expense management.

**Key Strengths**:
- **Scalability**: Queue-based architecture handles high throughput
- **Reliability**: Automatic retries, error handling, monitoring
- **Accuracy**: Multi-agent validation with LLM-as-Judge
- **Flexibility**: Configurable agents, models, policies
- **Observability**: Comprehensive logging, metrics, health checks

For questions or support, please refer to the codebase or contact the development team.
