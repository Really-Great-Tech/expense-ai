import { BaseAgent } from '@/agents/base.agent';
import { BedrockLlmService } from '@/services/bedrock/bedrock-llm';
import { PageMarkdown, PageAnalysisResult, PageGroup, DocumentMetadata } from '@/expense-document/types/upload.types';
import type { ILLMService } from './types/llm.types';
import { AGENT_PROFILES } from './config/models.config';
import pLimit from '@/tools/p-limit/limit';

/**
 * Configuration for parallel processing concurrency
 */
interface ParallelConfig {
  /** Concurrency for boundary detection (default: 15) */
  boundaryDetectionConcurrency: number;
  /** Concurrency for metadata extraction (default: 8) */
  metadataExtractionConcurrency: number;
}

/**
 * Result of comparing two adjacent pages
 */
interface PageComparisonResult {
  sameDocument: boolean;
  confidence: number;
  reasoning: string;
}

/**
 * Result of Expensify detection
 */
interface ExpensifyDetectionResult {
  isExpensifyExport: boolean;
  expensifyConfidence: number;
  expensifyReason?: string;
  expensifyIndicators: string[];
}

/**
 * Page classification for expense cover detection
 */
type PageClassification =
  | 'EXPENSE_COVER' // Expense report summary page (Expensify, Concur, etc.)
  | 'RECEIPT_THUMBNAIL' // Small receipt preview/thumbnail
  | 'ACTUAL_RECEIPT' // Real merchant receipt/invoice
  | 'UNKNOWN'; // Cannot determine

/**
 * Result of classifying a page
 */
interface PageClassificationResult {
  classification: PageClassification;
  indicators: string[];
}

/**
 * Result of blank/error page detection
 */
interface BlankErrorResult {
  isErrorOrBlank: boolean;
  reason?: string;
}

/**
 * Agent responsible for analyzing multi-page PDF documents to identify separate receipts/invoices
 * Detects invoice boundaries and distinguishes between document containers and individual transactions
 *
 * Features:
 * - Vision-based boundary detection (when images provided)
 * - Expensify export detection with confidence scoring
 * - Text-based fallback when no images available
 * - Parallel processing for boundary detection and metadata extraction
 * - Rich metadata extraction via LLM+vision
 */
export class DocumentSplitterAgent extends BaseAgent {
  protected llm: ILLMService;
  protected visionLlm: BedrockLlmService;
  private config: ParallelConfig;
  private boundaryLimiter: ReturnType<typeof pLimit>;
  private metadataLimiter: ReturnType<typeof pLimit>;

  constructor(config?: Partial<ParallelConfig>) {
    super();
    this.logger.log('Initializing DocumentSplitterAgent with vision support and parallel processing');

    // Configure parallel processing concurrency
    this.config = {
      boundaryDetectionConcurrency: config?.boundaryDetectionConcurrency ?? 15,
      metadataExtractionConcurrency: config?.metadataExtractionConcurrency ?? 8,
    };
    this.boundaryLimiter = pLimit(this.config.boundaryDetectionConcurrency);
    this.metadataLimiter = pLimit(this.config.metadataExtractionConcurrency);

    // Nova Pro for text-only analysis
    this.llm = new BedrockLlmService({ profile: AGENT_PROFILES.DOCUMENT_SPLITTER });
    // Claude Sonnet 4 for vision-based analysis
    this.visionLlm = new BedrockLlmService({ profile: AGENT_PROFILES.DOCUMENT_SPLITTER });
  }

  /**
   * Analyze pages of a document to identify separate invoices/receipts
   * Uses vision-based analysis when images are provided for better accuracy
   * @param pageMarkdowns Array of page content in markdown format (with optional imageBase64)
   * @returns Analysis result with invoice groupings, page boundaries, and Expensify detection
   * @throws Error if analysis fails critically
   */
  async analyzePages(pageMarkdowns: PageMarkdown[]): Promise<PageAnalysisResult> {
    try {
      this.logger.log(`Starting invoice analysis for ${pageMarkdowns.length} pages`);

      // Check if we have images for vision-based analysis
      const hasImages = pageMarkdowns.some((p) => p.imageBase64);
      if (hasImages) {
        this.logger.log('Images detected - using vision-based boundary detection');
        return await this.analyzePagesWithVision(pageMarkdowns);
      }

      // Fallback to text-only analysis
      this.logger.log('No images - using text-only analysis');
      return await this.analyzePagesTextOnly(pageMarkdowns);
    } catch (error: any) {
      this.logger.error('Invoice analysis failed:', error);

      // Return fallback: treat all pages as single invoice
      return {
        totalInvoices: 1,
        pageGroups: [
          {
            invoiceNumber: 1,
            pages: pageMarkdowns.map((p) => p.pageNumber),
            confidence: 0.3,
            reasoning: `Analysis failed (${error.message}), treating as single invoice`,
          },
        ],
      };
    }
  }

  /**
   * Vision-based page analysis using parallel pairwise comparison with fallback boundary injection
   * and parallel metadata extraction
   */
  private async analyzePagesWithVision(pageMarkdowns: PageMarkdown[]): Promise<PageAnalysisResult> {
    if (pageMarkdowns.length === 0) {
      return { totalInvoices: 0, pageGroups: [] };
    }

    if (pageMarkdowns.length === 1) {
      const expensify = this.detectExpensifyFromText(pageMarkdowns[0].content);
      const blankCheck = this.isErrorOrBlankPage([pageMarkdowns[0].content]);
      const classification = this.classifyPageType(pageMarkdowns[0].content, pageMarkdowns[0].content.length);

      // Extract metadata for single page
      const metadata = await this.extractDocumentMetadata([pageMarkdowns[0]], 1);

      return {
        totalInvoices: 1,
        pageGroups: [
          {
            invoiceNumber: 1,
            pages: [pageMarkdowns[0].pageNumber],
            confidence: 1.0,
            reasoning: 'Single page document',
            ...expensify,
            isBlankOrError: blankCheck.isErrorOrBlank || metadata.isBlankLlm,
            blankErrorReason: blankCheck.reason,
            pageClassification: classification.classification,
            metadata,
          },
        ],
      };
    }

    // Pre-classify all pages for expense cover detection and fallback injection
    const pageClassifications = pageMarkdowns.map((p) => ({
      pageNumber: p.pageNumber,
      ...this.classifyPageType(p.content, p.content.length),
    }));

    this.logger.log(`Page classifications: ${pageClassifications.map((c) => `P${c.pageNumber}:${c.classification}`).join(', ')}`);

    // PARALLEL boundary detection using pairwise vision comparison
    this.logger.log(`Running ${pageMarkdowns.length - 1} boundary comparisons (concurrency: ${this.config.boundaryDetectionConcurrency})`);

    interface BoundaryComparisonResult {
      index: number;
      pageANum: number;
      pageBNum: number;
      comparison: PageComparisonResult;
    }

    const comparisonTasks = pageMarkdowns.slice(0, -1).map((pageA, i) => {
      const pageB = pageMarkdowns[i + 1];
      const classA = pageClassifications[i].classification;
      const classB = pageClassifications[i + 1].classification;

      return this.boundaryLimiter(async (): Promise<BoundaryComparisonResult> => {
        const comparison = await this.comparePagesWithVision(pageA, pageB, classA, classB);
        return { index: i, pageANum: pageA.pageNumber, pageBNum: pageB.pageNumber, comparison };
      }) as Promise<BoundaryComparisonResult>;
    });

    const comparisonResults = await Promise.all(comparisonTasks);

    // Process results in order to build boundaries
    const boundaries: number[] = [0]; // First page is always a boundary
    for (const { index, pageANum, pageBNum, comparison } of comparisonResults) {
      if (!comparison.sameDocument && comparison.confidence >= 0.6) {
        boundaries.push(index + 1);
        this.logger.log(`Boundary detected between pages ${pageANum} and ${pageBNum}`);
      }
    }

    // FALLBACK: Inject boundaries for expense->receipt transitions that LLM missed
    // Only inject when we have STRONG indicators of expense cover pages
    this.logger.log('Checking for fallback boundary injection...');
    for (let i = 0; i < pageClassifications.length - 1; i++) {
      const currentClass = pageClassifications[i].classification;
      const nextClass = pageClassifications[i + 1].classification;
      const currentIndicators = pageClassifications[i].indicators;

      // Only inject if current page has STRONG expense cover indicators
      // (not just a weak classification that could be a forwarded email)
      const hasStrongExpenseIndicator = currentIndicators.some(
        (ind) =>
          ind.includes('Expense Report') ||
          ind.includes('Expense management system') ||
          ind.includes('Approval status') ||
          ind.includes('Receipt thumbnails'),
      );

      // If transitioning from expense cover/thumbnail to actual receipt or unknown
      // AND we have strong indicators (not just weak pattern matches)
      if (
        (currentClass === 'EXPENSE_COVER' || currentClass === 'RECEIPT_THUMBNAIL') &&
        (nextClass === 'ACTUAL_RECEIPT' || nextClass === 'UNKNOWN') &&
        hasStrongExpenseIndicator
      ) {
        const boundaryIndex = i + 1;
        if (!boundaries.includes(boundaryIndex)) {
          this.logger.log(`Fallback: Injecting boundary at index ${boundaryIndex} (${currentClass} -> ${nextClass})`);
          this.logger.log(`  Indicators: ${currentIndicators.join(', ')}`);
          boundaries.push(boundaryIndex);
        }
      }
    }

    // Sort boundaries to ensure correct order after fallback injection
    boundaries.sort((a, b) => a - b);

    // Convert boundaries to page groups with enhanced detection
    const pageGroups: PageGroup[] = [];
    for (let i = 0; i < boundaries.length; i++) {
      const startIdx = boundaries[i];
      const endIdx = boundaries[i + 1] ?? pageMarkdowns.length;
      const groupPages = pageMarkdowns.slice(startIdx, endIdx);
      const pages = groupPages.map((p) => p.pageNumber);

      // Get page contents for this group
      const groupContents = groupPages.map((p) => p.content);

      // Detect Expensify/expense systems for this group
      const combinedText = groupContents.join('\n');
      const expensify = this.detectExpensifyFromText(combinedText);

      // Detect blank/error pages
      const blankCheck = this.isErrorOrBlankPage(groupContents);

      // Get dominant classification for this group (first page's classification)
      const dominantClassification = pageClassifications.find((c) => c.pageNumber === groupPages[0].pageNumber)?.classification || 'UNKNOWN';

      pageGroups.push({
        invoiceNumber: i + 1,
        pages,
        confidence: 0.8,
        reasoning: i === 0 ? 'First document in PDF' : 'Boundary detected via vision analysis',
        ...expensify,
        isBlankOrError: blankCheck.isErrorOrBlank,
        blankErrorReason: blankCheck.reason,
        pageClassification: dominantClassification,
      });
    }

    // PARALLEL metadata extraction for each page group
    this.logger.log(`Extracting metadata for ${pageGroups.length} groups (concurrency: ${this.config.metadataExtractionConcurrency})`);

    interface MetadataExtractionResult {
      invoiceNumber: number;
      metadata: DocumentMetadata;
    }

    const metadataTasks = pageGroups.map((group) => {
      const groupPages = pageMarkdowns.filter((p) => group.pages.includes(p.pageNumber));
      return this.metadataLimiter(async (): Promise<MetadataExtractionResult> => {
        const metadata = await this.extractDocumentMetadata(groupPages, group.invoiceNumber);
        return { invoiceNumber: group.invoiceNumber, metadata };
      }) as Promise<MetadataExtractionResult>;
    });

    const metadataResults = await Promise.all(metadataTasks);

    // Attach metadata to groups and update flags from LLM detection
    for (const { invoiceNumber, metadata } of metadataResults) {
      const group = pageGroups.find((g) => g.invoiceNumber === invoiceNumber);
      if (group) {
        group.metadata = metadata;

        // Update group-level flags from LLM metadata (combine with rule-based)
        if (metadata.isExpensifyPage) {
          group.isExpensifyExport = true;
          group.expensifyConfidence = Math.max(group.expensifyConfidence || 0, metadata.expensifyConfidenceLlm || 0);
        }
        if (metadata.isBlankLlm) {
          group.isBlankOrError = true;
          group.blankErrorReason = group.blankErrorReason || 'LLM detected blank page';
        }
      }
    }

    return {
      totalInvoices: pageGroups.length,
      pageGroups,
    };
  }

  /**
   * Compare two adjacent pages using vision to determine if they're from the same document
   * @param pageA First page
   * @param pageB Second page
   * @param classificationA Optional pre-computed classification for page A
   * @param classificationB Optional pre-computed classification for page B
   */
  private async comparePagesWithVision(
    pageA: PageMarkdown,
    pageB: PageMarkdown,
    classificationA?: PageClassification,
    classificationB?: PageClassification,
  ): Promise<PageComparisonResult> {
    const classHintA = classificationA ? `[CLASSIFICATION HINT: ${classificationA}]` : '';
    const classHintB = classificationB ? `[CLASSIFICATION HINT: ${classificationB}]` : '';

    const prompt = `Analyze these two consecutive pages. Are they from the SAME document or DIFFERENT documents?

PAGE ${pageA.pageNumber} ${classHintA} TEXT (first 1500 chars):
${pageA.content.substring(0, 1500)}

PAGE ${pageB.pageNumber} ${classHintB} TEXT (first 1500 chars):
${pageB.content.substring(0, 1500)}

CRITICAL RULE - EXPENSE MANAGEMENT SYSTEM SEPARATION:
Expense management systems (Expensify, SAP Concur, Zoho, Ramp) create PDFs that bundle:
1. Cover/summary pages (showing "Approved", "Reimbursed", expense lists, thumbnails)
2. Actual receipts/invoices from merchants

These MUST be treated as DIFFERENT documents because:
- They come from DIFFERENT sources (expense system vs. merchant)
- Cover pages are GENERATED by the expense system
- Receipts are ORIGINAL documents from vendors

CRITICAL EDGE CASE - SUMMARY GRID vs DETAIL VIEW:
If one page shows a GRID/TABLE with multiple transactions and the next page shows a DETAILED view of ONE transaction from that grid:
- These are DIFFERENT documents (even if they share transaction details)
- The grid is a SUMMARY/OVERVIEW page
- The detail is the ACTUAL SOURCE RECEIPT
- DO NOT group them together just because transaction details match
- Example: Page 10 shows a grid of 5 transactions, Page 11 shows full details of one transaction → DIFFERENT documents

DIFFERENT DOCUMENT indicators:
- Different logos/headers/branding
- Page numbering resets (e.g., "Page 1" after "Page 3 of 3")
- New transaction ID or reference number
- Completely different layout/style
- Different merchant/company
- One page is expense summary, other is actual receipt
- One page is transaction grid/table, other is detailed single transaction view

SAME DOCUMENT indicators:
- Continuing page numbers ("Page 2 of 3" follows "Page 1 of 3")
- Same header/footer pattern
- Content continuation
- Same merchant/company throughout

IMPORTANT: If classification hints suggest EXPENSE_COVER or RECEIPT_THUMBNAIL followed by ACTUAL_RECEIPT,
these are almost certainly DIFFERENT documents even if they reference the same transaction.

Respond with JSON only:
{"sameDocument": true/false, "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

    try {
      // Use vision if both pages have images
      if (pageA.imageBase64 && pageB.imageBase64) {
        const response = await this.visionLlm.chatWithVision({
          prompt,
          images: [
            { data: pageA.imageBase64, mediaType: 'image/png' },
            { data: pageB.imageBase64, mediaType: 'image/png' },
          ],
          systemPrompt: 'You are a document boundary detection expert. Respond with JSON only.',
        });

        const result = this.parseJsonResponse(this.extractContentFromResponse(response));
        return {
          sameDocument: result.sameDocument ?? true,
          confidence: result.confidence ?? 0.5,
          reasoning: result.reasoning ?? '',
        };
      }

      // Fallback to text-only comparison
      const response = await this.llm.chat({
        messages: [
          { role: 'system', content: 'You are a document boundary detection expert. Respond with JSON only.' },
          { role: 'user', content: prompt },
        ],
      });

      const result = this.parseJsonResponse(this.extractContentFromResponse(response));
      return {
        sameDocument: result.sameDocument ?? true,
        confidence: result.confidence ?? 0.5,
        reasoning: result.reasoning ?? '',
      };
    } catch (error: any) {
      this.logger.warn(`Vision comparison failed: ${error.message}, defaulting to same document`);
      return { sameDocument: true, confidence: 0.3, reasoning: 'Comparison failed' };
    }
  }

  /**
   * Text-only page analysis with parallel metadata extraction
   */
  private async analyzePagesTextOnly(pageMarkdowns: PageMarkdown[]): Promise<PageAnalysisResult> {
    const systemPrompt = this.getSystemPrompt();
    const pagesContent = this.buildPagesContent(pageMarkdowns);

    const userContent = await this.getPromptTemplate('document-splitter-user-prompt', {
      pagesContent,
    });
    this.logger.debug(`Using prompt: ${this.lastPromptInfo?.name} (version: ${this.lastPromptInfo?.version || 'unknown'})`);

    const response = await this.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    });

    const rawContent = this.extractContentFromResponse(response);
    this.logger.debug(`Raw response: ${rawContent.substring(0, 300)}...`);

    const parsedResult = this.parseJsonResponse(rawContent);

    if (!parsedResult.totalInvoices || !Array.isArray(parsedResult.pageGroups)) {
      throw new Error('Invalid response structure from LLM');
    }

    // Add Expensify detection, blank check, and classification to each page group
    for (const group of parsedResult.pageGroups) {
      const groupPages = pageMarkdowns.filter((p) => group.pages.includes(p.pageNumber));
      const groupContents = groupPages.map((p) => p.content);
      const combinedText = groupContents.join('\n');

      const expensify = this.detectExpensifyFromText(combinedText);
      const blankCheck = this.isErrorOrBlankPage(groupContents);

      // Get classification of first page in group
      const firstPageContent = groupPages[0]?.content || '';
      const classification = this.classifyPageType(firstPageContent, firstPageContent.length);

      Object.assign(group, {
        ...expensify,
        isBlankOrError: blankCheck.isErrorOrBlank,
        blankErrorReason: blankCheck.reason,
        pageClassification: classification.classification,
      });
    }

    // PARALLEL metadata extraction for each page group
    this.logger.log(`Extracting metadata for ${parsedResult.pageGroups.length} groups (concurrency: ${this.config.metadataExtractionConcurrency})`);

    interface MetadataExtractionResult {
      invoiceNumber: number;
      metadata: DocumentMetadata;
    }

    const metadataTasks = parsedResult.pageGroups.map((group: PageGroup) => {
      const groupPages = pageMarkdowns.filter((p) => group.pages.includes(p.pageNumber));
      return this.metadataLimiter(async (): Promise<MetadataExtractionResult> => {
        const metadata = await this.extractDocumentMetadata(groupPages, group.invoiceNumber);
        return { invoiceNumber: group.invoiceNumber, metadata };
      }) as Promise<MetadataExtractionResult>;
    });

    const metadataResults = await Promise.all(metadataTasks);

    // Attach metadata to groups and update flags from LLM detection
    for (const { invoiceNumber, metadata } of metadataResults) {
      const group = parsedResult.pageGroups.find((g: PageGroup) => g.invoiceNumber === invoiceNumber);
      if (group) {
        group.metadata = metadata;

        // Update group-level flags from LLM metadata (combine with rule-based)
        if (metadata.isExpensifyPage) {
          group.isExpensifyExport = true;
          group.expensifyConfidence = Math.max(group.expensifyConfidence || 0, metadata.expensifyConfidenceLlm || 0);
        }
        if (metadata.isBlankLlm) {
          group.isBlankOrError = true;
          group.blankErrorReason = group.blankErrorReason || 'LLM detected blank page';
        }
      }
    }

    this.logger.log(`Invoice analysis completed: ${parsedResult.totalInvoices} invoices detected`);
    return parsedResult as PageAnalysisResult;
  }

  /**
   * Check if page content contains blank or error pages
   * Rule-based detection (no LLM calls)
   * @param pageContents Array of page content strings
   * @returns Detection result with reason if applicable
   */
  private isErrorOrBlankPage(pageContents: string[]): BlankErrorResult {
    const combinedText = pageContents.join(' ').trim();
    const textLen = combinedText.length;

    // 1. Blank page: very little or no text (< 50 chars)
    if (textLen < 50) {
      return { isErrorOrBlank: true, reason: 'Blank or nearly blank page' };
    }

    // 2. Error patterns from OCR/Textract
    const errorPatterns = [
      /no text (extracted|found|detected)/i,
      /ocr (failed|error)/i,
      /extraction (failed|error)/i,
      /unable to (read|extract|process)/i,
      /empty page/i,
      /blank page/i,
    ];

    for (const pattern of errorPatterns) {
      if (pattern.test(combinedText)) {
        return { isErrorOrBlank: true, reason: `OCR error detected: ${combinedText.substring(0, 100)}` };
      }
    }

    // 3. Page with only whitespace/special characters
    if (/^[\s\n\r\t.,;:!?-]*$/.test(combinedText)) {
      return { isErrorOrBlank: true, reason: 'Page contains only whitespace or punctuation' };
    }

    return { isErrorOrBlank: false };
  }

  /**
   * Classify a page as expense cover, receipt thumbnail, actual receipt, or unknown
   * Used to provide hints for boundary detection and fallback injection
   * @param pageContent Text content of the page
   * @param pageLength Length of the page content
   * @returns Classification with supporting indicators
   */
  private classifyPageType(pageContent: string, pageLength: number): PageClassificationResult {
    const textLower = pageContent.toLowerCase();
    const indicators: string[] = [];

    // === EXPENSE_COVER detection ===
    // Check for approval/status headers at start of page
    if (/^(approved|reimbursed|submitted|pending|rejected)/im.test(pageContent)) {
      indicators.push('Approval status header');
    }
    // Multi-language approval status
    if (/^(genehmigt|approvato|aprobado|approuvé|godkänd)/im.test(pageContent)) {
      indicators.push('Approval status (non-English)');
    }
    // Expense Report title with date
    if (/expense\s*report.*\d{4}/i.test(pageContent)) {
      indicators.push('Expense Report with date');
    }

    // Expense management system detection - use STRONG positive indicators only
    // Don't just check for "expensify" word alone - require combination patterns
    // that indicate this is an actual Expensify-generated page, not just a mention

    // Strong Expensify indicators (actual Expensify pages have these)
    const hasExpensifyBranding = textLower.includes('powered by expensify');
    const hasExpensifyExportFormat = textLower.includes('expensify') && (textLower.includes('expense report') || textLower.includes('report id'));

    // Strong Concur indicators
    const hasConcurBranding = textLower.includes('sap concur') || (textLower.includes('concur') && textLower.includes('expense report'));

    // Generic expense system indicators (need multiple signals)
    const hasExpenseClaimFormat = textLower.includes('expense claim') || textLower.includes('expense summary');

    if (hasExpensifyBranding || hasExpensifyExportFormat || hasConcurBranding || hasExpenseClaimFormat) {
      indicators.push('Expense management system');
    }

    // Expense list format (From/To headers typical in Expensify)
    if (/from\s+to\s+.*@/i.test(pageContent)) {
      indicators.push('Expense email format');
    }
    // Receipt Thumbnails section
    if (textLower.includes('receipt thumbnail') || textLower.includes('attached receipt')) {
      indicators.push('Receipt thumbnails section');
    }

    // If we have expense cover indicators, classify as EXPENSE_COVER
    if (indicators.length >= 2 || indicators.some((i) => i.includes('Expense Report') || i.includes('Expense management'))) {
      return { classification: 'EXPENSE_COVER', indicators };
    }

    // === RECEIPT_THUMBNAIL detection ===
    // Short text with receipt metadata format
    if (pageLength < 400) {
      if (/date:\s*\w+\s+\d+/i.test(pageContent) && /merchant:/i.test(pageContent) && /total:/i.test(pageContent)) {
        indicators.push('Receipt thumbnail metadata format');
        return { classification: 'RECEIPT_THUMBNAIL', indicators };
      }
      // Very short with just basic receipt info
      if (textLower.includes('receipt') && /€|\$|£|usd|eur/i.test(pageContent)) {
        indicators.push('Short receipt reference');
        return { classification: 'RECEIPT_THUMBNAIL', indicators };
      }
    }

    // === ACTUAL_RECEIPT detection ===
    // Page numbering patterns (indicates multi-page document)
    if (/page\s*\d+\s*(of|\/)\s*\d+/i.test(pageContent) || /pagina\s*\d+\s*\/\s*\d+/i.test(pageContent)) {
      indicators.push('Page numbering');
    }
    // Invoice/receipt number patterns (multi-language)
    if (
      /invoice\s*(no|number|#|n\.)?\s*:?\s*[A-Z0-9-]+/i.test(pageContent) ||
      /fattura\s*(n\.|numero)?\s*:?\s*[A-Z0-9-]+/i.test(pageContent) ||
      /rechnung\s*(nr|nummer)?\s*:?\s*[A-Z0-9-]+/i.test(pageContent) ||
      /factura\s*(n\.|numero)?\s*:?\s*[A-Z0-9-]+/i.test(pageContent)
    ) {
      indicators.push('Invoice/receipt number');
    }
    // VAT/Tax ID patterns
    if (/vat\s*(id|number)?|tax\s*id|p\.?\s*iva|ust-?id|mwst/i.test(pageContent)) {
      indicators.push('VAT/Tax ID');
    }
    // Company registration/address
    if (/sede\s*legale|registered\s*office|company\s*reg/i.test(pageContent)) {
      indicators.push('Company registration');
    }
    // Detailed billing/payment info
    if (/total\s*(amount|due|payable)|importo\s*totale|gesamtbetrag|total\s*a\s*pagar/i.test(pageContent)) {
      indicators.push('Billing details');
    }

    // Longer text content with business document patterns
    if (pageLength > 800 && indicators.length > 0) {
      return { classification: 'ACTUAL_RECEIPT', indicators };
    }

    // If we have some receipt indicators
    if (indicators.length >= 2) {
      return { classification: 'ACTUAL_RECEIPT', indicators };
    }

    // === UNKNOWN ===
    return { classification: 'UNKNOWN', indicators };
  }

  /**
   * Detect expense management system export from text content
   * Supports: Expensify, SAP Concur, Zoho Expense, Ramp, and generic expense reports
   */
  private detectExpensifyFromText(text: string): ExpensifyDetectionResult {
    const lower = text.toLowerCase();
    const indicators: string[] = [];

    // Expensify-specific indicators
    if (lower.includes('expensify')) indicators.push('Contains "Expensify"');
    if (lower.includes('expensify.com')) indicators.push('Contains expensify.com');
    if (/r00[a-z0-9]{8,}/i.test(text)) indicators.push('Has Expensify Report ID');
    if (lower.includes('powered by expensify')) indicators.push('Powered by Expensify');

    // SAP Concur indicators
    if (lower.includes('concur') || lower.includes('sap concur')) indicators.push('Contains SAP Concur');
    if (/concur\.com/i.test(text)) indicators.push('Contains concur.com');

    // Zoho Expense indicators
    if (lower.includes('zoho expense') || lower.includes('zoho.com/expense')) {
      indicators.push('Contains Zoho Expense');
    }

    // Ramp indicators
    if (lower.includes('ramp') && lower.includes('expense')) indicators.push('Contains Ramp expense');

    // Generic expense report indicators
    if (/created:\s*\d{4}-\d{2}-\d{2}.*utc/i.test(text)) indicators.push('Has Created timestamp');
    if (/submitted:\s*\d{4}-\d{2}-\d{2}.*utc/i.test(text)) indicators.push('Has Submitted timestamp');
    if (/approved.*utc|approved by/i.test(text)) indicators.push('Has Approved info');
    if (/exported to netsuite|exported to/i.test(text)) indicators.push('Has Export info');
    if (lower.includes('expense report')) indicators.push('Contains "expense report"');
    if (lower.includes('receipt thumbnail') || lower.includes('preview image')) {
      indicators.push('Has receipt thumbnails');
    }

    // Multi-language approval patterns
    if (/^(approved|genehmigt|approvato|aprobado|approuvé|godkänd)/im.test(text)) {
      indicators.push('Approval status header (multi-language)');
    }

    // Aggregate page detection (multiple receipts on single page)
    if ((lower.includes('receipt') || lower.includes('expense')) && (lower.match(/total/gi) || []).length > 2) {
      indicators.push('Aggregate expense page');
    }

    const isExpensify = indicators.length >= 2;
    const confidence = Math.min(indicators.length / 5, 1.0);

    return {
      isExpensifyExport: isExpensify,
      expensifyConfidence: isExpensify ? confidence : 0.1,
      expensifyReason: isExpensify ? `Detected ${indicators.length} expense system indicators` : undefined,
      expensifyIndicators: indicators,
    };
  }

  /**
   * Extract rich metadata from a document group using LLM + vision analysis
   * Combines rule-based detection with LLM-enhanced classification
   * @param pageMarkdowns Pages in this document group
   * @param docIndex Document index for logging
   * @returns Rich metadata including document type, merchant, amount, and enhanced detection
   */
  private async extractDocumentMetadata(pageMarkdowns: PageMarkdown[], docIndex: number): Promise<DocumentMetadata> {
    // Combine page text with separators
    const combinedText = pageMarkdowns.map((p) => p.content).join('\n---PAGE BREAK---\n');

    // Run rule-based detection first (fast, no LLM cost)
    const ruleBasedExpensify = this.detectExpensifyFromText(combinedText);
    const ruleBasedBlank = this.isErrorOrBlankPage(pageMarkdowns.map((p) => p.content));

    // Build LLM prompt for metadata extraction
    const prompt = `Analyze this document and extract metadata.

DOCUMENT TEXT:
${combinedText.substring(0, 6000)}

Extract the following information and respond with ONLY valid JSON:
{
  "document_type": "Invoice, Receipt, Statement, Contract, Form, Report, Letter, or other appropriate type",
  "document_subtype": "more specific type if applicable (e.g., Hotel Receipt, Flight Itinerary, Bank Statement)",
  "header_info": "header text or title visible on the document",
  "footer_info": "footer text visible on the document",
  "main_content": "1-2 sentence summary of what this document contains",
  "key_entities": ["list", "of", "key", "names", "or", "entities"],
  "merchant_name": "company or merchant name if this is a receipt/invoice",
  "transaction_id": "transaction or reference ID if found",
  "date_period": "date or date range mentioned",
  "total_amount": "total amount if this is a financial document",
  "currency": "currency code (USD, EUR, GBP, etc.)",
  "has_logo": true or false,
  "logo_description": "brief description of logo if present",
  "is_expensify_page": true or false (is this an Expensify/Concur/expense system cover page?),
  "expensify_confidence": 0.0-1.0 (confidence that this is an expense system page),
  "expensify_reason": "explanation if is_expensify_page is true",
  "is_blank": true or false (is this page blank or contains only errors?)
}`;

    try {
      let response: any;

      // Use vision if first page has image
      const firstPageImage = pageMarkdowns[0]?.imageBase64;
      if (firstPageImage) {
        response = await this.visionLlm.chatWithVision({
          prompt,
          images: [{ data: firstPageImage, mediaType: 'image/png' }],
          systemPrompt: 'You are a document analysis expert. Extract metadata and respond with valid JSON only.',
        });
      } else {
        // Text-only fallback
        response = await this.llm.chat({
          messages: [
            { role: 'system', content: 'You are a document analysis expert. Extract metadata and respond with valid JSON only.' },
            { role: 'user', content: prompt },
          ],
        });
      }

      const rawContent = this.extractContentFromResponse(response);
      const parsed = this.parseJsonResponse(rawContent);

      // Combine rule-based and LLM detection (rule-based takes precedence if confident)
      const isExpensifyPage = ruleBasedExpensify.isExpensifyExport || parsed.is_expensify_page === true;
      const expensifyConfidenceLlm = Math.max(ruleBasedExpensify.expensifyConfidence, parsed.expensify_confidence || 0);
      const isBlankLlm = ruleBasedBlank.isErrorOrBlank || parsed.is_blank === true;

      return {
        documentType: parsed.document_type || 'Unknown',
        documentSubtype: parsed.document_subtype,
        confidence: 0.8,
        headerInfo: parsed.header_info || '',
        footerInfo: parsed.footer_info || '',
        mainContent: parsed.main_content || '',
        keyEntities: Array.isArray(parsed.key_entities) ? parsed.key_entities : [],
        merchantName: parsed.merchant_name,
        transactionId: parsed.transaction_id,
        datePeriod: parsed.date_period,
        totalAmount: parsed.total_amount,
        currency: parsed.currency,
        hasLogo: parsed.has_logo === true,
        logoDescription: parsed.logo_description,
        isExpensifyPage,
        expensifyConfidenceLlm,
        expensifyReasonLlm: parsed.expensify_reason || ruleBasedExpensify.expensifyReason,
        isBlankLlm,
      };
    } catch (error: any) {
      this.logger.warn(`Metadata extraction failed for doc ${docIndex}: ${error.message}`);

      // Return fallback metadata based on rule-based detection only
      return {
        documentType: 'Unknown',
        confidence: 0.3,
        headerInfo: '',
        footerInfo: '',
        mainContent: 'Metadata extraction failed',
        keyEntities: [],
        hasLogo: false,
        isExpensifyPage: ruleBasedExpensify.isExpensifyExport,
        expensifyConfidenceLlm: ruleBasedExpensify.expensifyConfidence,
        expensifyReasonLlm: ruleBasedExpensify.expensifyReason,
        isBlankLlm: ruleBasedBlank.isErrorOrBlank,
      };
    }
  }

  /**
   * Get the system prompt for text-only analysis
   */
  private getSystemPrompt(): string {
    return `You are an expert document analyst specializing in individual receipt/invoice identification.
Your primary expertise is detecting separate transactions within document containers and avoiding incorrect grouping.

CORE PRINCIPLE: Distinguish between DOCUMENT CONTAINERS and INDIVIDUAL TRANSACTIONS.

CRITICAL RULE: DETECT AND SKIP EXPENSIFY SUMMARY PAGES

Expensify expense reports have container pages (typically pages 1-2) that are NOT receipts.

EXPENSIFY CONTAINER PAGE INDICATORS:
- "Created: [datetime] UTC+[timezone]"
- "Submitted: [datetime] UTC+[timezone]"
- "Approved: [datetime] UTC+[timezone]" or "Approved by [name]"
- "Exported to NetSuite" or "Exported to [system]"
- Report ID pattern: "R00[alphanumeric]"
- Approval chain/timeline with multiple timestamps
- Receipt thumbnail/preview images

RULE: If a page contains 3+ of these indicators, it is a CONTAINER PAGE - skip it.

Your analysis should:
1. FIRST: Identify and skip Expensify container pages
2. THEN: Analyze remaining pages for transaction-level details
3. Look for complete transaction cycles on individual pages
4. Identify unique transaction markers (receipt numbers, transaction times, totals)
5. Separate receipts even if they share the same expense report number
6. Only group pages when there's clear multi-page continuation of SAME transaction
7. When in doubt, separate rather than group

Always respond with valid JSON only.`;
  }

  /**
   * Build formatted page content for LLM analysis
   * @param pages Array of page markdown objects
   * @returns Formatted string with all page content
   * @private
   */
  private buildPagesContent(pages: PageMarkdown[]): string {
    return pages
      .map((page) => {
        const content = page.content.substring(0, 2000);
        const suffix = page.content.length > 2000 ? '...' : '';
        return `=== PAGE ${page.pageNumber} ===\n${content}${suffix}\n`;
      })
      .join('\n');
  }
}
