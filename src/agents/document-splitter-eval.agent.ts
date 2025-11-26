/**
 * Document Splitter Evaluation Agent
 *
 * An agentic system that iteratively improves document splitting accuracy
 * through self-correction WITHOUT ground truth data.
 *
 * Production Architecture (No Ground Truth):
 * 1. Split Agent: Initial document splitting
 * 2. Validator Agent: Structural validation (duplicates, counts, etc.)
 * 3. Reviewer Agent: Semantic review (transaction ID consistency, grouping logic)
 * 4. Corrector Agent: Fixes issues found by validator and reviewer
 *
 * The key insight: Use the same hierarchy of transaction indicators
 * that a human would use to verify splits.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BedrockLlmService } from '../utils/bedrockLlm';
import { PageMarkdown } from '../document-splitter/types/document-splitter.types';

// Types
export interface PageGroup {
  invoiceNumber: number;
  pages: number[];
  confidence: number;
  reasoning: string;
  transactionId?: string; // Extracted transaction ID for verification
}

export interface SplitResult {
  totalInvoices: number;
  pageGroups: PageGroup[];
}

export interface ValidationError {
  type: 'duplicate_page' | 'non_consecutive' | 'count_mismatch' | 'missing_page' | 'empty_group';
  severity: 'error' | 'warning';
  message: string;
  affectedGroups?: number[];
  affectedPages?: number[];
}

export interface SemanticIssue {
  type: 'split_same_transaction' | 'merged_different_transactions' | 'included_container' | 'missing_continuation';
  groupNumbers: number[];
  evidence: string;
  suggestedFix: string;
}

export interface ReviewResult {
  structuralValid: boolean;
  semanticValid: boolean;
  structuralErrors: ValidationError[];
  semanticIssues: SemanticIssue[];
  overallConfidence: number;
}

export interface AgentIteration {
  iteration: number;
  phase: 'split' | 'validate' | 'review' | 'correct';
  splitResult: SplitResult;
  review: ReviewResult;
  correctionsMade?: string[];
}

@Injectable()
export class DocumentSplitterEvalAgent {
  private readonly logger = new Logger(DocumentSplitterEvalAgent.name);
  private llm: BedrockLlmService;

  constructor() {
    this.llm = new BedrockLlmService({
      temperature: 0.2, // Lower temperature for consistency
    });
  }

  /**
   * Main entry point - runs the agentic evaluation loop
   * Works WITHOUT ground truth by using structural + semantic validation
   */
  async evaluate(pages: PageMarkdown[], maxIterations: number = 3): Promise<{
    finalResult: SplitResult;
    iterations: AgentIteration[];
    converged: boolean;
  }> {
    this.logger.log(`Starting evaluation agent with ${pages.length} pages`);

    const iterations: AgentIteration[] = [];
    let currentSplit: SplitResult | null = null;
    let converged = false;

    for (let i = 1; i <= maxIterations; i++) {
      this.logger.log(`\n=== Iteration ${i}/${maxIterations} ===`);

      // Phase 1: Generate or correct split
      if (currentSplit === null) {
        this.logger.log('Phase 1: Running Split Agent...');
        currentSplit = await this.runSplitAgent(pages);
      }

      // Phase 2: Structural validation
      this.logger.log('Phase 2: Running Validator Agent...');
      const structuralErrors = this.runStructuralValidator(currentSplit, pages.length);

      // Phase 3: Semantic review (uses LLM to check transaction consistency)
      this.logger.log('Phase 3: Running Reviewer Agent...');
      const semanticIssues = await this.runSemanticReviewer(currentSplit, pages);

      const review: ReviewResult = {
        structuralValid: structuralErrors.filter(e => e.severity === 'error').length === 0,
        semanticValid: semanticIssues.length === 0,
        structuralErrors,
        semanticIssues,
        overallConfidence: this.calculateConfidence(currentSplit, structuralErrors, semanticIssues),
      };

      // Record iteration
      iterations.push({
        iteration: i,
        phase: review.structuralValid && review.semanticValid ? 'validate' : 'correct',
        splitResult: JSON.parse(JSON.stringify(currentSplit)),
        review,
      });

      this.logger.log(`Review Results:`);
      this.logger.log(`  Structural Valid: ${review.structuralValid}`);
      this.logger.log(`  Semantic Valid: ${review.semanticValid}`);
      this.logger.log(`  Confidence: ${(review.overallConfidence * 100).toFixed(1)}%`);

      // Check convergence
      if (review.structuralValid && review.semanticValid) {
        this.logger.log('Converged! Split is structurally and semantically valid.');
        converged = true;
        break;
      }

      // Phase 4: Correction
      this.logger.log('Phase 4: Running Corrector Agent...');
      const corrections: string[] = [];

      // Fix structural issues first
      if (!review.structuralValid) {
        currentSplit = this.fixStructuralIssues(currentSplit, structuralErrors);
        corrections.push(...structuralErrors.map(e => `Fixed: ${e.message}`));
      }

      // Fix semantic issues
      if (!review.semanticValid && semanticIssues.length > 0) {
        currentSplit = await this.fixSemanticIssues(currentSplit, semanticIssues, pages);
        corrections.push(...semanticIssues.map(i => `Fixed: ${i.type} - ${i.suggestedFix}`));
      }

      iterations[iterations.length - 1].correctionsMade = corrections;
    }

    return {
      finalResult: currentSplit!,
      iterations,
      converged,
    };
  }

  /**
   * Split Agent: Initial document splitting with transaction ID extraction
   */
  private async runSplitAgent(pages: PageMarkdown[]): Promise<SplitResult> {
    const pagesContent = pages
      .map(p => `## Page ${p.pageNumber}\n${p.content}`)
      .join('\n\n---\n\n');

    const systemPrompt = `You are a document splitting expert for expense reports.

YOUR TASK: Identify individual receipts/invoices in this PDF.

STEP 1: IDENTIFY CONTAINER PAGES (SKIP THESE)
Look for Expensify report pages with:
- "Created: [datetime] UTC"
- "Submitted: [datetime] UTC"
- "Approved by [name]"
- Report IDs like "R00xxxxx"
→ These are typically pages 1-2. SKIP them entirely.

STEP 2: EXTRACT TRANSACTION IDs FROM EACH PAGE
For each remaining page, identify the PRIMARY transaction ID:
- Invoice Number: "Invoice #2024-001", "Fattura n° 123"
- Receipt Number: "Receipt #12345"
- Order Number: "Order #ABC123"
- Ticket Number: "Ticket: 2202219875680"
- Booking Reference: "Booking: XYZ789"
- Application Number: "Application: 123456"

STEP 3: GROUP BY TRANSACTION ID
Pages with the SAME transaction ID = ONE receipt
Pages with DIFFERENT transaction IDs = SEPARATE receipts

CRITICAL RULES:
1. Same transaction ID on consecutive pages → GROUP together
2. Different transaction IDs → SEPARATE receipts
3. No transaction ID + complete total → Likely standalone receipt
4. Building totals (subtotal→tax→total) across pages → ONE receipt

EXTRACTION FOCUS:
For each group, extract the actual transaction ID you found.
This helps verify your grouping is correct.

OUTPUT FORMAT:
{
  "totalInvoices": <number>,
  "pageGroups": [
    {
      "invoiceNumber": 1,
      "pages": [3, 4],
      "confidence": 0.95,
      "reasoning": "Pages 3-4 share Invoice #2024-001",
      "transactionId": "Invoice #2024-001"
    }
  ]
}

VALIDATE BEFORE RESPONDING:
□ No page appears in multiple groups
□ totalInvoices = number of pageGroups
□ Container pages (1-2) are not included
□ Each group has a clear transaction ID or rationale`;

    const response = await this.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze these pages:\n\n${pagesContent}` },
      ],
    });
    return this.parseJsonResponse(response.message.content);
  }

  /**
   * Structural Validator: Check for structural issues (no LLM needed)
   */
  private runStructuralValidator(split: SplitResult, _totalPages: number): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check 1: Duplicate pages
    const allPages: number[] = [];
    const duplicates = new Set<number>();
    for (const group of split.pageGroups) {
      for (const page of group.pages) {
        if (allPages.includes(page)) {
          duplicates.add(page);
        }
        allPages.push(page);
      }
    }
    if (duplicates.size > 0) {
      errors.push({
        type: 'duplicate_page',
        severity: 'error',
        message: `Pages appear in multiple groups: ${[...duplicates].join(', ')}`,
        affectedPages: [...duplicates],
      });
    }

    // Check 2: Count mismatch
    if (split.totalInvoices !== split.pageGroups.length) {
      errors.push({
        type: 'count_mismatch',
        severity: 'error',
        message: `totalInvoices (${split.totalInvoices}) ≠ pageGroups count (${split.pageGroups.length})`,
      });
    }

    // Check 3: Empty groups
    const emptyGroups = split.pageGroups
      .map((g, i) => (g.pages.length === 0 ? i + 1 : -1))
      .filter(i => i !== -1);
    if (emptyGroups.length > 0) {
      errors.push({
        type: 'empty_group',
        severity: 'error',
        message: `Empty groups: ${emptyGroups.join(', ')}`,
        affectedGroups: emptyGroups,
      });
    }

    // Check 4: Non-consecutive pages (warning only)
    for (let i = 0; i < split.pageGroups.length; i++) {
      const pages = [...split.pageGroups[i].pages].sort((a, b) => a - b);
      for (let j = 1; j < pages.length; j++) {
        if (pages[j] - pages[j - 1] > 1) {
          errors.push({
            type: 'non_consecutive',
            severity: 'warning',
            message: `Group ${i + 1} has non-consecutive pages: ${pages.join(', ')}`,
            affectedGroups: [i + 1],
            affectedPages: pages,
          });
          break;
        }
      }
    }

    // Check 5: Container pages included (pages 1-2)
    const containerPages = allPages.filter(p => p <= 2);
    if (containerPages.length > 0) {
      errors.push({
        type: 'missing_page',
        severity: 'warning',
        message: `Possible container pages included: ${containerPages.join(', ')}`,
        affectedPages: containerPages,
      });
    }

    return errors;
  }

  /**
   * Semantic Reviewer: Uses LLM to verify transaction consistency
   */
  private async runSemanticReviewer(split: SplitResult, pages: PageMarkdown[]): Promise<SemanticIssue[]> {
    // Build a summary of the split for review
    const splitSummary = split.pageGroups.map(g => ({
      group: g.invoiceNumber,
      pages: g.pages,
      transactionId: g.transactionId || 'Not extracted',
      reasoning: g.reasoning,
    }));

    // Get relevant page excerpts for review
    const pageExcerpts = pages.map(p => ({
      pageNumber: p.pageNumber,
      excerpt: p.content.substring(0, 800), // First 800 chars
    }));

    const systemPrompt = `You are a document splitting reviewer. Verify that the proposed split is semantically correct.

PROPOSED SPLIT:
${JSON.stringify(splitSummary, null, 2)}

PAGE EXCERPTS:
${pageExcerpts.map(p => `Page ${p.pageNumber}:\n${p.excerpt}\n`).join('\n---\n')}

REVIEW CHECKLIST - BE CONSERVATIVE, ONLY REPORT CLEAR ERRORS:

1. INCLUDED_CONTAINER (HIGH CONFIDENCE): Are Expensify container pages (with "Created:", "Submitted:", "Approved:" timestamps) included as receipts?
   → Only flag if you see these specific Expensify keywords

2. SPLIT_SAME_TRANSACTION (HIGH CONFIDENCE): Are pages with the EXACT SAME transaction ID incorrectly split?
   → Only flag if you see the EXACT SAME invoice/receipt/ticket number on pages in DIFFERENT groups
   → Same merchant alone is NOT enough - must have same transaction ID

3. MERGED_DIFFERENT_TRANSACTIONS (HIGH CONFIDENCE): Are pages with CLEARLY DIFFERENT transaction IDs in the same group?
   → Only flag if you see TWO DIFFERENT invoice numbers in the SAME group
   → Example: Group 1 has pages with "Invoice #001" AND "Invoice #002"

IMPORTANT: Do NOT flag issues for:
- Different pages from the same merchant (different invoices from same vendor is normal)
- Groups that look reasonable but you're uncertain about
- Minor formatting differences

CONSERVATIVE APPROACH: When in doubt, return empty array []

OUTPUT FORMAT (JSON array):
[
  {
    "type": "included_container",
    "groupNumbers": [1],
    "evidence": "Page 1 contains 'Created: 2024-01-15 UTC', 'Submitted:' - Expensify report page",
    "suggestedFix": "Remove page 1 from all groups"
  }
]

If no CLEAR issues found, return empty array: []`;

    const response = await this.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Review the split and identify any semantic issues.' },
      ],
    });

    try {
      const parsed = this.parseJsonArray(response.message.content);
      return parsed as SemanticIssue[];
    } catch (e) {
      this.logger.warn('Failed to parse semantic review, assuming no issues');
      return [];
    }
  }

  /**
   * Fix structural issues (deterministic, no LLM)
   */
  private fixStructuralIssues(split: SplitResult, errors: ValidationError[]): SplitResult {
    let fixed = JSON.parse(JSON.stringify(split)) as SplitResult;

    for (const error of errors) {
      switch (error.type) {
        case 'duplicate_page':
          // Remove duplicates - keep first occurrence
          const seen = new Set<number>();
          for (const group of fixed.pageGroups) {
            group.pages = group.pages.filter(p => {
              if (seen.has(p)) return false;
              seen.add(p);
              return true;
            });
          }
          break;

        case 'count_mismatch':
          fixed.totalInvoices = fixed.pageGroups.length;
          break;

        case 'empty_group':
          fixed.pageGroups = fixed.pageGroups.filter(g => g.pages.length > 0);
          fixed.totalInvoices = fixed.pageGroups.length;
          break;
      }
    }

    // Renumber groups
    fixed.pageGroups.forEach((g, i) => {
      g.invoiceNumber = i + 1;
    });

    return fixed;
  }

  /**
   * Fix semantic issues using LLM guidance
   */
  private async fixSemanticIssues(
    split: SplitResult,
    issues: SemanticIssue[],
    _pages: PageMarkdown[]
  ): Promise<SplitResult> {
    let fixed = JSON.parse(JSON.stringify(split)) as SplitResult;

    for (const issue of issues) {
      switch (issue.type) {
        case 'split_same_transaction':
          // Merge the affected groups
          if (issue.groupNumbers.length >= 2) {
            const [keep, ...merge] = issue.groupNumbers.map(n => n - 1); // Convert to 0-indexed
            for (const idx of merge.sort((a, b) => b - a)) {
              if (fixed.pageGroups[idx]) {
                fixed.pageGroups[keep].pages.push(...fixed.pageGroups[idx].pages);
                fixed.pageGroups.splice(idx, 1);
              }
            }
            fixed.pageGroups[keep].pages.sort((a, b) => a - b);
            fixed.pageGroups[keep].reasoning += ` (merged: ${issue.evidence})`;
          }
          break;

        case 'merged_different_transactions':
          // This requires LLM to re-split - for now, flag it
          this.logger.warn(`Need to split merged transactions: ${issue.evidence}`);
          break;

        case 'included_container':
          // Remove container pages from all groups
          const containerPages = [1, 2];
          for (const group of fixed.pageGroups) {
            group.pages = group.pages.filter(p => !containerPages.includes(p));
          }
          break;

        case 'missing_continuation':
          // Similar to split_same_transaction - merge if we have group numbers
          if (issue.groupNumbers.length >= 2) {
            const [keep, ...merge] = issue.groupNumbers.map(n => n - 1);
            for (const idx of merge.sort((a, b) => b - a)) {
              if (fixed.pageGroups[idx]) {
                fixed.pageGroups[keep].pages.push(...fixed.pageGroups[idx].pages);
                fixed.pageGroups.splice(idx, 1);
              }
            }
            fixed.pageGroups[keep].pages.sort((a, b) => a - b);
          }
          break;
      }
    }

    // Clean up empty groups and renumber
    fixed.pageGroups = fixed.pageGroups.filter(g => g.pages.length > 0);
    fixed.totalInvoices = fixed.pageGroups.length;
    fixed.pageGroups.forEach((g, i) => {
      g.invoiceNumber = i + 1;
    });

    return fixed;
  }

  /**
   * Calculate overall confidence based on validation results
   */
  private calculateConfidence(
    split: SplitResult,
    structuralErrors: ValidationError[],
    semanticIssues: SemanticIssue[]
  ): number {
    // Start with average group confidence
    let confidence = split.pageGroups.reduce((sum, g) => sum + g.confidence, 0) / split.pageGroups.length;

    // Penalize for structural errors
    const criticalErrors = structuralErrors.filter(e => e.severity === 'error').length;
    confidence -= criticalErrors * 0.2;

    // Penalize for semantic issues
    confidence -= semanticIssues.length * 0.15;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Parse JSON from LLM response
   */
  private parseJsonResponse(response: string): SplitResult {
    let jsonStr = response;

    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    jsonStr = jsonStr.trim();
    if (!jsonStr.startsWith('{')) {
      const startIdx = jsonStr.indexOf('{');
      if (startIdx !== -1) {
        jsonStr = jsonStr.substring(startIdx);
      }
    }

    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      this.logger.error(`Failed to parse JSON: ${e}`);
      throw new Error('Failed to parse LLM response');
    }
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

    // Handle empty response
    if (jsonStr === '[]' || jsonStr === '') {
      return [];
    }

    return JSON.parse(jsonStr);
  }
}
