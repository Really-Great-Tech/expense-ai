/**
 * Universal Document Splitter Agent
 *
 * A comprehensive document splitting system that handles up to 20 pages
 * and files under 30MB with high accuracy.
 *
 * Architecture:
 * Phase 0: Input Validation
 * Phase 1: Hierarchical Splitting (Container Detection → Classification → Initial Grouping)
 * Phase 2: Sliding Window Boundary Verification
 * Phase 3: Structural + Semantic Validation (via Eval Agent)
 * Phase 4: Output
 */

import { Injectable, Logger } from '@nestjs/common';
import { BedrockLlmService } from '../utils/bedrockLlm';
import { PageMarkdown } from '../document-splitter/types/document-splitter.types';
import {
  DocumentSplitterEvalAgent,
  SplitResult,
  PageGroup,
} from './document-splitter-eval.agent';
import { MODEL_CONFIG } from './config/models.config';

// Configuration constants
const MAX_PAGES = 20;
const MAX_FILE_SIZE_MB = 30;
const CLASSIFICATION_BATCH_SIZE = 5;

// Types
export interface PageClassification {
  pageNumber: number;
  documentType:
    | 'container'
    | 'airline'
    | 'hotel'
    | 'bus'
    | 'visa'
    | 'telecom'
    | 'receipt'
    | 'terms'
    | 'unknown';
  transactionId: string | null;
  merchantName: string | null;
  hasTotal: boolean;
  isContinuation: boolean;
  confidence: number;
}

export interface BoundaryVerification {
  pageA: number;
  pageB: number;
  decision: 'same' | 'different';
  reason: string;
  confidence: number;
}

export interface UniversalSplitResult extends SplitResult {
  classifications: PageClassification[];
  boundaryVerifications: BoundaryVerification[];
  processingPhases: {
    phase: string;
    duration: number;
    result: string;
  }[];
}

@Injectable()
export class UniversalDocumentSplitterAgent {
  private readonly logger = new Logger(UniversalDocumentSplitterAgent.name);
  private llm: BedrockLlmService;
  private evalAgent: DocumentSplitterEvalAgent;

  constructor() {
    this.llm = new BedrockLlmService({
      modelId: MODEL_CONFIG.DOCUMENT_SPLITTER,
      temperature: 0.1, // Very low for consistency
    });
    this.evalAgent = new DocumentSplitterEvalAgent();
  }

  /**
   * Main entry point - Universal document splitting
   */
  async splitDocument(
    pages: PageMarkdown[],
    fileSizeMB?: number
  ): Promise<UniversalSplitResult> {
    const startTime = Date.now();
    const phases: UniversalSplitResult['processingPhases'] = [];

    this.logger.log(`Starting universal document splitter with ${pages.length} pages`);

    // Phase 0: Input Validation
    const phase0Start = Date.now();
    this.validateInput(pages, fileSizeMB);
    phases.push({
      phase: 'validation',
      duration: Date.now() - phase0Start,
      result: 'passed',
    });

    // Phase 1a: Detect container pages
    const phase1aStart = Date.now();
    const containerPages = await this.detectContainerPages(pages.slice(0, 3));
    this.logger.log(`Container pages detected: ${containerPages.join(', ') || 'none'}`);
    phases.push({
      phase: 'container_detection',
      duration: Date.now() - phase1aStart,
      result: `found ${containerPages.length} container pages`,
    });

    // Filter out container pages
    const contentPages = pages.filter(p => !containerPages.includes(p.pageNumber));
    this.logger.log(`Content pages to analyze: ${contentPages.length}`);

    // Phase 1b: Classify each page
    const phase1bStart = Date.now();
    const classifications = await this.classifyPages(contentPages);
    phases.push({
      phase: 'page_classification',
      duration: Date.now() - phase1bStart,
      result: `classified ${classifications.length} pages`,
    });

    // Phase 1c: Initial grouping based on classification
    const phase1cStart = Date.now();
    let initialGroups = this.createInitialGroups(classifications);
    this.logger.log(`Initial groups created: ${initialGroups.length}`);
    phases.push({
      phase: 'initial_grouping',
      duration: Date.now() - phase1cStart,
      result: `${initialGroups.length} groups`,
    });

    // Phase 2: Verify uncertain boundaries
    const phase2Start = Date.now();
    const boundaryVerifications: BoundaryVerification[] = [];
    initialGroups = await this.verifyAndAdjustBoundaries(
      initialGroups,
      contentPages,
      classifications,
      boundaryVerifications
    );
    phases.push({
      phase: 'boundary_verification',
      duration: Date.now() - phase2Start,
      result: `verified ${boundaryVerifications.length} boundaries`,
    });

    // Phase 3: Run through eval agent for final validation
    const phase3Start = Date.now();
    const evalResult = await this.evalAgent.evaluate(contentPages, 2);
    phases.push({
      phase: 'eval_validation',
      duration: Date.now() - phase3Start,
      result: evalResult.converged ? 'converged' : 'max_iterations',
    });

    // Compare eval result with our initial groups and choose best
    const finalResult = this.selectBestResult(initialGroups, evalResult.finalResult, classifications);

    this.logger.log(`Universal splitter completed in ${Date.now() - startTime}ms`);
    this.logger.log(`Final result: ${finalResult.totalInvoices} invoices`);

    return {
      ...finalResult,
      classifications,
      boundaryVerifications,
      processingPhases: phases,
    };
  }

  /**
   * Phase 0: Validate input constraints
   */
  private validateInput(pages: PageMarkdown[], fileSizeMB?: number): void {
    if (pages.length > MAX_PAGES) {
      throw new Error(
        `Document exceeds ${MAX_PAGES} page limit (has ${pages.length} pages)`
      );
    }

    if (fileSizeMB && fileSizeMB > MAX_FILE_SIZE_MB) {
      throw new Error(
        `File size exceeds ${MAX_FILE_SIZE_MB}MB limit (is ${fileSizeMB.toFixed(1)}MB)`
      );
    }

    if (pages.length === 0) {
      throw new Error('No pages provided');
    }
  }

  /**
   * Phase 1a: Detect Expensify/report container pages
   * Returns pages to skip (typically pages 1-2 for Expensify reports)
   */
  private async detectContainerPages(firstPages: PageMarkdown[]): Promise<number[]> {
    const containerIndicators = [
      'created:',
      'submitted:',
      'approved by',
      'exported to',
      'report id',
      'utc',
      'expensify',
      'thumbnails',
      'receipt preview',
      'expense report',
      'total reimbursable',
      'non-reimbursable',
    ];

    let hasExpensifyReport = false;

    // Check if any of the first 3 pages have Expensify indicators
    for (const page of firstPages) {
      const content = page.content.toLowerCase();
      let score = 0;

      for (const indicator of containerIndicators) {
        if (content.includes(indicator)) {
          score++;
        }
      }

      // If page has 2+ container indicators, it's an Expensify report
      if (score >= 2) {
        hasExpensifyReport = true;
        break;
      }
    }

    // If we found an Expensify report, skip pages 1-2 (sometimes 1-3)
    // These are always container/summary pages
    if (hasExpensifyReport) {
      // Check if page 3 is also a container (e.g., empty or just has thumbnails)
      const page3 = firstPages.find(p => p.pageNumber === 3);
      if (page3 && (page3.content.trim().length < 100 || page3.content.toLowerCase().includes('thumbnail'))) {
        return [1, 2, 3];
      }
      return [1, 2];
    }

    return [];
  }

  /**
   * Phase 1b: Classify each page by document type and extract identifiers
   */
  private async classifyPages(pages: PageMarkdown[]): Promise<PageClassification[]> {
    const classifications: PageClassification[] = [];

    // Process in batches for efficiency
    for (let i = 0; i < pages.length; i += CLASSIFICATION_BATCH_SIZE) {
      const batch = pages.slice(i, i + CLASSIFICATION_BATCH_SIZE);
      const batchClassifications = await this.classifyBatch(batch);
      classifications.push(...batchClassifications);
    }

    return classifications;
  }

  /**
   * Classify a batch of pages using LLM
   */
  private async classifyBatch(pages: PageMarkdown[]): Promise<PageClassification[]> {
    const pagesContent = pages
      .map(p => `=== PAGE ${p.pageNumber} ===\n${p.content.substring(0, 1500)}`)
      .join('\n\n');

    const systemPrompt = `You are a document classifier for expense reports.

For each page, extract:
1. documentType: One of: airline, hotel, bus, visa, telecom, receipt, terms, unknown
2. transactionId: The PRIMARY identifier (invoice #, ticket #, booking ref, etc.) or null
3. merchantName: The merchant/vendor name or null
4. hasTotal: Does this page show a final total amount? (true/false)
5. isContinuation: Does this page appear to continue from a previous page? (true/false)
6. confidence: How confident are you in this classification? (0.0-1.0)

DOCUMENT TYPE INDICATORS:
- airline: Flight itinerary, ticket number, PNR, boarding pass, airline name
- hotel: Hotel booking, reservation number, check-in/out dates
- bus: Bus ticket, route, departure time, bus company
- visa: Visa application, ESTA, passport info, government document
- telecom: Phone/internet bill, contract number, usage details
- receipt: Store receipt, restaurant bill, purchase receipt
- terms: Terms and conditions, legal text, policy information
- unknown: Cannot determine type

TRANSACTION ID HIERARCHY (extract the most specific):
1. Invoice/Receipt number: "Invoice #2024-001", "Receipt #12345"
2. Ticket number: "Ticket: 2202219875680", "E-ticket: 105 2485452619"
3. Booking reference: "Booking: UKGT44", "PNR: ABC123"
4. Order number: "Order #12345"
5. Application number: "Application: H1J09453F4P1271J"

OUTPUT FORMAT (JSON array):
[
  {
    "pageNumber": 3,
    "documentType": "airline",
    "transactionId": "Ticket: 2202219875680",
    "merchantName": "British Airways",
    "hasTotal": true,
    "isContinuation": false,
    "confidence": 0.95
  }
]`;

    const response = await this.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Classify these pages:\n\n${pagesContent}` },
      ],
    });

    try {
      const parsed = this.parseJsonArray(response.message.content);
      return parsed as PageClassification[];
    } catch (e) {
      this.logger.warn('Failed to parse classification, using defaults');
      return pages.map(p => ({
        pageNumber: p.pageNumber,
        documentType: 'unknown' as const,
        transactionId: null,
        merchantName: null,
        hasTotal: false,
        isContinuation: false,
        confidence: 0.5,
      }));
    }
  }

  /**
   * Phase 1c: Create initial groups based on classification
   */
  private createInitialGroups(classifications: PageClassification[]): PageGroup[] {
    const groups: PageGroup[] = [];
    let currentGroup: PageClassification[] = [];

    for (let i = 0; i < classifications.length; i++) {
      const current = classifications[i];
      const prev = classifications[i - 1];

      // Decide if this page starts a new group
      const shouldStartNew = i === 0 || this.shouldStartNewGroup(current, prev);

      if (shouldStartNew && currentGroup.length > 0) {
        groups.push(this.createGroupFromClassifications(currentGroup, groups.length + 1));
        currentGroup = [];
      }

      currentGroup.push(current);
    }

    // Don't forget the last group
    if (currentGroup.length > 0) {
      groups.push(this.createGroupFromClassifications(currentGroup, groups.length + 1));
    }

    return groups;
  }

  /**
   * Determine if current page should start a new group
   */
  private shouldStartNewGroup(
    current: PageClassification,
    prev: PageClassification
  ): boolean {
    // 1. Different transaction IDs (and both have IDs)
    if (
      current.transactionId &&
      prev.transactionId &&
      current.transactionId !== prev.transactionId
    ) {
      return true;
    }

    // 2. Different document types (unless one is 'terms' or 'unknown')
    if (
      current.documentType !== prev.documentType &&
      current.documentType !== 'terms' &&
      current.documentType !== 'unknown' &&
      prev.documentType !== 'terms' &&
      prev.documentType !== 'unknown'
    ) {
      return true;
    }

    // 3. Previous page had a total and current is NOT a continuation
    // This handles same-merchant different receipts (e.g., multiple Uber rides)
    if (prev.hasTotal && !current.isContinuation) {
      return true;
    }

    // 4. Current page is explicitly NOT a continuation and has a total
    // (standalone receipts)
    if (!current.isContinuation && current.hasTotal && prev.hasTotal) {
      return true;
    }

    // 5. Different merchants (usually indicates different receipts)
    if (
      current.merchantName &&
      prev.merchantName &&
      current.merchantName !== prev.merchantName
    ) {
      return true;
    }

    return false;
  }

  /**
   * Create a PageGroup from classifications
   */
  private createGroupFromClassifications(
    classifications: PageClassification[],
    invoiceNumber: number
  ): PageGroup {
    const pages = classifications.map(c => c.pageNumber);
    const primary = classifications[0];
    const avgConfidence =
      classifications.reduce((sum, c) => sum + c.confidence, 0) / classifications.length;

    return {
      invoiceNumber,
      pages,
      confidence: avgConfidence,
      reasoning: `${primary.documentType}: ${primary.transactionId || primary.merchantName || 'unknown'} (pages ${pages.join(',')})`,
      transactionId: primary.transactionId || undefined,
    };
  }

  /**
   * Phase 2: Verify and adjust boundaries using sliding window
   */
  private async verifyAndAdjustBoundaries(
    groups: PageGroup[],
    pages: PageMarkdown[],
    classifications: PageClassification[],
    verifications: BoundaryVerification[]
  ): Promise<PageGroup[]> {
    if (groups.length <= 1) {
      return groups;
    }

    const adjustedGroups = [...groups];
    const pageMap = new Map(pages.map(p => [p.pageNumber, p]));

    // Check each boundary between groups
    for (let i = 0; i < adjustedGroups.length - 1; i++) {
      const groupA = adjustedGroups[i];
      const groupB = adjustedGroups[i + 1];

      const lastPageA = groupA.pages[groupA.pages.length - 1];
      const firstPageB = groupB.pages[0];

      // Only verify if pages are consecutive
      if (firstPageB - lastPageA === 1) {
        const pageAContent = pageMap.get(lastPageA);
        const pageBContent = pageMap.get(firstPageB);

        if (pageAContent && pageBContent) {
          const verification = await this.verifyBoundary(
            pageAContent,
            pageBContent,
            classifications
          );

          verifications.push(verification);

          // If pages should be together, merge groups
          if (verification.decision === 'same' && verification.confidence > 0.7) {
            this.logger.log(
              `Merging groups ${i + 1} and ${i + 2}: ${verification.reason}`
            );
            groupA.pages.push(...groupB.pages);
            groupA.reasoning += ` (merged: ${verification.reason})`;
            adjustedGroups.splice(i + 1, 1);
            i--; // Re-check this boundary with the next group
          }
        }
      }
    }

    // Renumber groups
    adjustedGroups.forEach((g, idx) => {
      g.invoiceNumber = idx + 1;
    });

    return adjustedGroups;
  }

  /**
   * Verify if two consecutive pages belong to the same receipt
   */
  private async verifyBoundary(
    pageA: PageMarkdown,
    pageB: PageMarkdown,
    classifications: PageClassification[]
  ): Promise<BoundaryVerification> {
    const classA = classifications.find(c => c.pageNumber === pageA.pageNumber);
    const classB = classifications.find(c => c.pageNumber === pageB.pageNumber);

    // Quick checks before LLM
    // Same transaction ID = definitely same
    if (
      classA?.transactionId &&
      classB?.transactionId &&
      classA.transactionId === classB.transactionId
    ) {
      return {
        pageA: pageA.pageNumber,
        pageB: pageB.pageNumber,
        decision: 'same',
        reason: `Same transaction ID: ${classA.transactionId}`,
        confidence: 0.95,
      };
    }

    // Different transaction IDs = definitely different
    if (
      classA?.transactionId &&
      classB?.transactionId &&
      classA.transactionId !== classB.transactionId
    ) {
      return {
        pageA: pageA.pageNumber,
        pageB: pageB.pageNumber,
        decision: 'different',
        reason: `Different transaction IDs: ${classA.transactionId} vs ${classB.transactionId}`,
        confidence: 0.95,
      };
    }

    // Page B is terms/continuation of same type
    if (classB?.documentType === 'terms' && classA?.documentType !== 'terms') {
      return {
        pageA: pageA.pageNumber,
        pageB: pageB.pageNumber,
        decision: 'same',
        reason: 'Terms page follows main document',
        confidence: 0.8,
      };
    }

    // Use LLM for uncertain cases
    const systemPrompt = `You are verifying if two consecutive pages belong to the SAME receipt/invoice.

PAGE ${pageA.pageNumber}:
${pageA.content.substring(0, 1000)}

---

PAGE ${pageB.pageNumber}:
${pageB.content.substring(0, 1000)}

DECISION CRITERIA:
- SAME if: Same transaction ID, continuation markers, building totals, same merchant context
- DIFFERENT if: Different transaction IDs, different merchants with new totals, complete transaction on first page

Respond with JSON:
{
  "decision": "same" or "different",
  "reason": "brief explanation",
  "confidence": 0.0-1.0
}`;

    const response = await this.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Verify this boundary.' },
      ],
    });

    try {
      const parsed = JSON.parse(
        response.message.content.replace(/```json\n?|\n?```/g, '').trim()
      );
      return {
        pageA: pageA.pageNumber,
        pageB: pageB.pageNumber,
        decision: parsed.decision,
        reason: parsed.reason,
        confidence: parsed.confidence,
      };
    } catch (e) {
      // Default to different if parsing fails
      return {
        pageA: pageA.pageNumber,
        pageB: pageB.pageNumber,
        decision: 'different',
        reason: 'Could not determine - defaulting to separate',
        confidence: 0.5,
      };
    }
  }

  /**
   * Select the best result between initial groups and eval result
   */
  private selectBestResult(
    initialGroups: PageGroup[],
    evalResult: SplitResult,
    classifications: PageClassification[]
  ): SplitResult {
    // Score each result based on classification alignment
    const initialScore = this.scoreResult(initialGroups, classifications);
    const evalScore = this.scoreResult(evalResult.pageGroups, classifications);

    this.logger.log(`Initial groups score: ${initialScore.toFixed(2)}`);
    this.logger.log(`Eval result score: ${evalScore.toFixed(2)}`);

    // Prefer eval result if scores are close (it has more validation)
    if (evalScore >= initialScore - 0.1) {
      return evalResult;
    }

    return {
      totalInvoices: initialGroups.length,
      pageGroups: initialGroups,
    };
  }

  /**
   * Score a result based on how well it aligns with classifications
   */
  private scoreResult(
    groups: PageGroup[],
    classifications: PageClassification[]
  ): number {
    let score = 0;
    const classMap = new Map(classifications.map(c => [c.pageNumber, c]));

    for (const group of groups) {
      const groupClasses = group.pages.map(p => classMap.get(p)).filter(Boolean);

      // Check transaction ID consistency
      const transactionIds = new Set(
        groupClasses.map(c => c?.transactionId).filter(Boolean)
      );
      if (transactionIds.size === 1) {
        score += 1; // Perfect - all pages have same transaction ID
      } else if (transactionIds.size === 0) {
        score += 0.5; // OK - no transaction IDs found
      } else {
        score -= 0.5; // Bad - multiple different transaction IDs
      }

      // Check document type consistency
      const docTypes = new Set(
        groupClasses
          .map(c => c?.documentType)
          .filter(t => t !== 'terms' && t !== 'unknown')
      );
      if (docTypes.size <= 1) {
        score += 0.5; // Good - consistent document type
      }
    }

    return score / groups.length;
  }

  /**
   * Parse JSON array from LLM response
   */
  private parseJsonArray(response: string): any[] {
    let jsonStr = response;

    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    jsonStr = jsonStr.trim();
    if (!jsonStr.startsWith('[')) {
      const startIdx = jsonStr.indexOf('[');
      if (startIdx !== -1) {
        jsonStr = jsonStr.substring(startIdx);
      }
    }

    if (jsonStr === '[]' || jsonStr === '') {
      return [];
    }

    return JSON.parse(jsonStr);
  }
}
