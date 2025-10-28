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
    this.llm = new BedrockLlmService({ modelId: MODEL_CONFIG.DOCUMENT_SPLITTER });
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

CRITICAL UNDERSTANDING:
- Document containers (expense reports, compilations) hold multiple separate transactions
- Container headers like "Nota spese n° 107" or "Expense Report #123" are NOT transaction identifiers
- Look for TRANSACTION-LEVEL identifiers within each page (receipt numbers, transaction times, totals)
- Each complete transaction should be treated as a separate receipt, regardless of container

Your analysis should be precise and methodical:
1. IGNORE document-level headers and focus on transaction-level details
2. Look for complete transaction cycles on individual pages
3. Identify unique transaction markers (receipt numbers, transaction times, totals, payment methods)
4. Separate receipts even if they share the same expense report number or vendor
5. Only group pages when there's clear evidence of multi-page continuation of the SAME transaction
6. When in doubt, separate rather than group - it's better to over-split than under-split

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
