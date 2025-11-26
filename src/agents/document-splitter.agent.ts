import { BaseAgent } from '@/agents/base.agent';
import { BedrockLlmService } from '@/utils/bedrockLlm';
import { PageMarkdown, PageAnalysisResult } from '@/document-splitter/types/document-splitter.types';
import type { ILLMService } from './types/llm.types';
import { MODEL_CONFIG } from './config/models.config';

/**
 * Agent responsible for analyzing multi-page PDF documents to identify separate receipts/invoices
 * Detects invoice boundaries and distinguishes between document containers and individual transactions
 */
export class DocumentSplitterAgent extends BaseAgent {
  protected llm: ILLMService;

  constructor(provider: 'bedrock' | 'anthropic' = 'bedrock') {
    super();
    this.logger.log(`Initializing DocumentSplitterAgent with provider: ${provider}`);
    this.llm = new BedrockLlmService({ modelId: MODEL_CONFIG.DOCUMENT_SPLITTER, modelType: 'nova' });
  }

  /**
   * Analyze pages of a document to identify separate invoices/receipts
   * @param pageMarkdowns Array of page content in markdown format
   * @returns Analysis result with invoice groupings and page boundaries
   * @throws Error if analysis fails critically
   */
  async analyzePages(pageMarkdowns: PageMarkdown[]): Promise<PageAnalysisResult> {
    try {
      this.logger.log(`Starting invoice analysis for ${pageMarkdowns.length} pages`);

      // Keep system prompt inline
      const systemPrompt =
        'You are an expert document analyst specializing in individual receipt/invoice identification. ' +
        `Your primary expertise is detecting separate transactions within document containers and avoiding incorrect grouping.

CORE PRINCIPLE: Distinguish between DOCUMENT CONTAINERS and INDIVIDUAL TRANSACTIONS.

CRITICAL RULE: DETECT AND SKIP EXPENSIFY SUMMARY PAGES

Expensify expense reports have container pages (typically pages 1-2) that are NOT receipts.

EXPENSIFY CONTAINER PAGE INDICATORS:
- "Created: [datetime] UTC+[timezone]" (e.g., "Created: 2024-12-03 16:42 PM UTC+02:00")
- "Submitted: [datetime] UTC+[timezone]" (e.g., "Submitted: 2024-12-05 17:35 PM UTC+02:00")
- "Approved: [datetime] UTC+[timezone]" or "Approved by [name]"
- "Exported to NetSuite" or "Exported to [system]"
- Report ID pattern: "R00[alphanumeric]" (e.g., "R00ejKn453YV")
- Employee email in header: "([email@domain.com])"
- Approval chain/timeline with multiple timestamps
- "Report Name:" or "Report #:"
- Expense report summary with thumbnail
- Receipt thumbnail/preview images (multiple small images on one page)
- "Thumbnail", "Preview", or "Receipt Image" text
- Page 2 of Expensify report (typically thumbnail page after summary)

RULE: If a page contains 3 or more of these indicators, it is a CONTAINER PAGE.

SPECIAL RULE FOR PAGE 2: If page 1 is detected as Expensify container AND page 2 has ANY of:
- Receipt thumbnails/preview images
- Multiple small images
- Continuation of report metadata
→ SKIP page 2 as well (it's the thumbnail page)

Example Analysis:
PDF with 6 pages:
- Page 1: Has "Created:", "Submitted:", "R00ejKn453YV" → CONTAINER (skip)
- Page 2: Has "Approved by:", "Exported to NetSuite" → CONTAINER (skip)
- Page 3: Restaurant receipt with items, total → RECEIPT (include)
- Page 4: Hotel invoice → RECEIPT (include)
→ Return: { "totalInvoices": 2, "pageGroups": [[3], [4]] }

CRITICAL UNDERSTANDING:
- Document containers (expense reports, compilations) hold multiple separate transactions
- Container headers like "Nota spese n° 107" or "Expense Report #123" are NOT transaction identifiers
- Look for TRANSACTION-LEVEL identifiers within each page (receipt numbers, transaction times, totals)
- Each complete transaction should be treated as a separate receipt, regardless of container

Your analysis should be precise and methodical:
1. FIRST: Identify and skip Expensify container pages (pages 1-2 typically)
2. THEN: Analyze remaining pages for transaction-level details
3. Look for complete transaction cycles on individual pages
4. Identify unique transaction markers (receipt numbers, transaction times, totals, payment methods)
5. Separate receipts even if they share the same expense report number or vendor
6. Only group pages when there's clear evidence of multi-page continuation of the SAME transaction
7. When in doubt, separate rather than group - it's better to over-split than under-split

CRITICAL: Container headers are NOT reasons to group transactions together.

Always respond with valid JSON only - no explanations or markdown formatting.`;

      // Build pages content (same formatting/truncation as before)
      const pagesContent = this.buildPagesContent(pageMarkdowns);

      // Load user prompt from external file and compile with variables
      const userContent = await this.getPromptTemplate('document-splitter-user-prompt', {
        pagesContent,
      });
      this.logger.debug(`Using prompt: ${this.lastPromptInfo?.name} (version: ${this.lastPromptInfo?.version || 'unknown'})`);

      const response = await this.llm.chat({
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
      });

      // Extract and parse response using BaseAgent utilities
      const rawContent = this.extractContentFromResponse(response);
      this.logger.debug(`Raw response: ${rawContent.substring(0, 300)}...`);

      const parsedResult = this.parseJsonResponse(rawContent);

      // Validate the structure
      if (!parsedResult.totalInvoices || !Array.isArray(parsedResult.pageGroups)) {
        throw new Error('Invalid response structure from LLM');
      }

      this.logger.log(`Invoice analysis completed: ${parsedResult.totalInvoices} invoices detected`);
      this.logger.debug(`Prompt metadata: ${JSON.stringify(this.getPromptMetadata())}`);

      return parsedResult as PageAnalysisResult;
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
