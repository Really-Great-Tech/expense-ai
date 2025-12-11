import { BaseAgent } from '@/agents/base.agent';
import { BedrockProfileLlm, createClaudeSonnet, createNovaPro } from '@/utils/bedrockProfileLlm';
import { PageMarkdown, PageAnalysisResult, PageGroup } from '@/document-splitter/types/document-splitter.types';

/**
 * Agent responsible for analyzing multi-page PDF documents to identify separate receipts/invoices
 * Detects invoice boundaries and distinguishes between document containers and individual transactions
 *
 * Features:
 * - Vision-based boundary detection (when images provided)
 * - Expensify export detection with confidence scoring
 * - Text-based fallback when no images available
 * - Uses Application Inference Profiles for model access
 */
export class DocumentSplitterAgent extends BaseAgent {
  protected llm: BedrockProfileLlm;
  protected visionLlm: BedrockProfileLlm;

  constructor() {
    super();
    this.logger.log('Initializing DocumentSplitterAgent with BedrockProfileLlm');
    // Nova Pro for text-only analysis
    this.llm = createNovaPro();
    // Claude Sonnet for vision-based analysis
    this.visionLlm = createClaudeSonnet();
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
   * Vision-based page analysis using pairwise comparison
   */
  private async analyzePagesWithVision(pageMarkdowns: PageMarkdown[]): Promise<PageAnalysisResult> {
    if (pageMarkdowns.length === 0) {
      return { totalInvoices: 0, pageGroups: [] };
    }

    if (pageMarkdowns.length === 1) {
      const expensify = this.detectExpensifyFromText(pageMarkdowns[0].content);
      return {
        totalInvoices: 1,
        pageGroups: [{
          invoiceNumber: 1,
          pages: [pageMarkdowns[0].pageNumber],
          confidence: 1.0,
          reasoning: 'Single page document',
          ...expensify,
        }],
      };
    }

    // Detect boundaries using pairwise vision comparison
    const boundaries: number[] = [0]; // First page is always a boundary

    for (let i = 0; i < pageMarkdowns.length - 1; i++) {
      const pageA = pageMarkdowns[i];
      const pageB = pageMarkdowns[i + 1];

      const comparison = await this.comparePagesWithVision(pageA, pageB);

      if (!comparison.sameDocument && comparison.confidence >= 0.6) {
        boundaries.push(i + 1);
        this.logger.log(`Boundary detected between pages ${pageA.pageNumber} and ${pageB.pageNumber}`);
      }
    }

    // Convert boundaries to page groups with Expensify detection
    const pageGroups: PageGroup[] = [];
    for (let i = 0; i < boundaries.length; i++) {
      const startIdx = boundaries[i];
      const endIdx = boundaries[i + 1] ?? pageMarkdowns.length;
      const groupPages = pageMarkdowns.slice(startIdx, endIdx);
      const pages = groupPages.map((p) => p.pageNumber);

      // Detect Expensify for this group
      const combinedText = groupPages.map((p) => p.content).join('\n');
      const expensify = this.detectExpensifyFromText(combinedText);

      pageGroups.push({
        invoiceNumber: i + 1,
        pages,
        confidence: 0.8,
        reasoning: i === 0 ? 'First document in PDF' : 'Boundary detected via vision analysis',
        ...expensify,
      });
    }

    return {
      totalInvoices: pageGroups.length,
      pageGroups,
    };
  }

  /**
   * Compare two adjacent pages using vision to determine if they're from the same document
   */
  private async comparePagesWithVision(
    pageA: PageMarkdown,
    pageB: PageMarkdown,
  ): Promise<{ sameDocument: boolean; confidence: number; reasoning: string }> {
    const prompt = `Analyze these two consecutive pages. Are they from the SAME document or DIFFERENT documents?

PAGE ${pageA.pageNumber} TEXT (first 1500 chars):
${pageA.content.substring(0, 1500)}

PAGE ${pageB.pageNumber} TEXT (first 1500 chars):
${pageB.content.substring(0, 1500)}

DIFFERENT DOCUMENT indicators:
- Different logos/headers/branding
- Page numbering resets (e.g., "Page 1" after "Page 3 of 3")
- New transaction ID or reference number
- Completely different layout/style
- Different merchant/company

SAME DOCUMENT indicators:
- Continuing page numbers ("Page 2 of 3" follows "Page 1 of 3")
- Same header/footer pattern
- Content continuation
- Same merchant/company throughout

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
   * Text-only page analysis (original method)
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

    // Add Expensify detection to each page group
    for (const group of parsedResult.pageGroups) {
      const groupPages = pageMarkdowns.filter((p) => group.pages.includes(p.pageNumber));
      const combinedText = groupPages.map((p) => p.content).join('\n');
      const expensify = this.detectExpensifyFromText(combinedText);
      Object.assign(group, expensify);
    }

    this.logger.log(`Invoice analysis completed: ${parsedResult.totalInvoices} invoices detected`);
    return parsedResult as PageAnalysisResult;
  }

  /**
   * Detect Expensify export from text content
   */
  private detectExpensifyFromText(text: string): {
    isExpensifyExport: boolean;
    expensifyConfidence: number;
    expensifyReason?: string;
    expensifyIndicators: string[];
  } {
    const lower = text.toLowerCase();
    const indicators: string[] = [];

    // Check for Expensify indicators
    if (lower.includes('expensify')) indicators.push('Contains "Expensify"');
    if (lower.includes('expensify.com')) indicators.push('Contains expensify.com');
    if (/created:\s*\d{4}-\d{2}-\d{2}.*utc/i.test(text)) indicators.push('Has Created timestamp');
    if (/submitted:\s*\d{4}-\d{2}-\d{2}.*utc/i.test(text)) indicators.push('Has Submitted timestamp');
    if (/approved.*utc|approved by/i.test(text)) indicators.push('Has Approved info');
    if (/exported to netsuite|exported to/i.test(text)) indicators.push('Has Export info');
    if (/r00[a-z0-9]{8,}/i.test(text)) indicators.push('Has Expensify Report ID');
    if (lower.includes('expense report')) indicators.push('Contains "expense report"');
    if (lower.includes('receipt thumbnail') || lower.includes('preview image')) indicators.push('Has receipt thumbnails');

    const isExpensify = indicators.length >= 2;
    const confidence = Math.min(indicators.length / 5, 1.0);

    return {
      isExpensifyExport: isExpensify,
      expensifyConfidence: isExpensify ? confidence : 0.1,
      expensifyReason: isExpensify ? `Detected ${indicators.length} Expensify indicators` : undefined,
      expensifyIndicators: indicators,
    };
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
