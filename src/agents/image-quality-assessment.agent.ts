import { ImageQualityAssessmentSchema, type ImageQualityAssessment } from '../common/schemas/expense-schemas';
import { BedrockLlmService } from '../services/bedrock/bedrock-llm';
import { BaseAgent } from './base.agent';
import type { ILLMService } from './types/llm.types';
import { AGENT_PROFILES } from './config/models.config';
import { ServiceUnavailableError } from '../common/errors/service-errors';
import { pdf } from 'pdf-to-img';

/**
 * Agent responsible for assessing image quality of expense documents
 * Evaluates blur, contrast, glare, water stains, tears, and other quality issues
 */
export class ImageQualityAssessmentAgent extends BaseAgent {
  protected llm: ILLMService;

  constructor() {
    super();
    this.llm = new BedrockLlmService({ profile: AGENT_PROFILES.QUALITY_ASSESSMENT });
  }

  /**
   * Get the actual model name used
   * @returns The current model identifier
   */
  getActualModelUsed(): string {
    return this.llm.getCurrentModelName();
  }

  /**
   * Create a fallback quality issue object
   * @param description Description of the fallback issue
   * @returns Quality issue object
   * @private
   */
  private createFallbackIssue(description: string) {
    return {
      detected: false,
      severity_level: 'low' as const,
      confidence_score: 0.5,
      quantitative_measure: 0.0,
      description,
      recommendation: 'Manual review recommended due to assessment failure',
    };
  }

  /**
   * Check if buffer is a PDF file
   * @param buffer File buffer
   * @returns True if PDF
   * @private
   */
  private isPdf(buffer: Buffer): boolean {
    // PDF magic bytes: %PDF (25 50 44 46)
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  /**
   * Convert PDF buffer to PNG image buffer (first page only)
   * @param pdfBuffer PDF file buffer
   * @returns PNG image buffer
   * @private
   */
  private async convertPdfToImage(pdfBuffer: Buffer): Promise<Buffer> {
    const document = await pdf(pdfBuffer, { scale: 2.0 });

    for await (const image of document) {
      return image; // Return first page only
    }

    throw new Error('Failed to convert PDF to image');
  }

  /**
   * Detect image media type from buffer magic bytes
   * @param buffer Image file buffer
   * @returns Media type string for vision API
   * @private
   */
  private detectMediaType(buffer: Buffer): 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' {
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'image/png';
    }
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }
    // GIF: 47 49 46 38
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return 'image/gif';
    }
    // WebP: 52 49 46 46 ... 57 45 42 50
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      return 'image/webp';
    }
    // Default to JPEG for unknown formats
    return 'image/jpeg';
  }

  /**
   * Assess the quality of an expense document image from buffer
   * Uses vision API to analyze the actual image content
   * Supports both image files and PDFs (converts first page to image)
   * @param buffer Image or PDF file buffer
   * @param filename Original filename
   * @returns Quality assessment with scores and recommendations
   * @throws Error if assessment fails critically
   */
  async assessImageQualityFromBuffer(buffer: Buffer, filename: string): Promise<ImageQualityAssessment> {
    const startTime = new Date();

    this.logger.log(`Starting vision-based quality assessment for: ${filename}`);

    try {
      // Get the assessment prompt from local prompts
      const assessmentPrompt = await this.getPromptTemplate('image-quality-assessment-prompt');

      this.logger.debug(`Using prompt: ${this.lastPromptInfo?.name} (version: ${this.lastPromptInfo?.version || 'unknown'})`);

      // Convert PDF to image if needed
      let imageBuffer = buffer;
      if (this.isPdf(buffer)) {
        this.logger.log('Detected PDF file, converting first page to image for quality assessment');
        imageBuffer = await this.convertPdfToImage(buffer);
      }

      // Convert buffer to base64 for vision API
      const imageBase64 = imageBuffer.toString('base64');
      const mediaType = this.detectMediaType(imageBuffer);

      this.logger.log(`Sending image for vision analysis: ${mediaType}, ${Math.round(imageBuffer.length / 1024)}KB`);

      // Use chatWithVision to send actual image for analysis
      const response = await (this.llm as BedrockLlmService).chatWithVision({
        prompt: assessmentPrompt,
        images: [{ data: imageBase64, mediaType }],
      });

      // Extract and parse response using BaseAgent utilities
      const rawContent = this.extractContentFromResponse(response);
      this.logger.debug(`Extracted content: ${rawContent.substring(0, 200)}...`);

      const parsedResult = this.parseJsonResponse(rawContent);
      const result = ImageQualityAssessmentSchema.parse(parsedResult);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.logger.log(
        `Image quality assessment completed: Score ${result.overall_quality_score}/10, ` +
          `Suitable: ${result.suitable_for_extraction} in ${duration}ms`,
      );
      this.logger.debug(`Model used: ${this.getActualModelUsed()}`);
      this.logger.debug(`Prompt metadata: ${JSON.stringify(this.getPromptMetadata())}`);

      return result;
    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.logger.error(`Image quality assessment failed after ${duration}ms: ${error.message}`);

      // Re-throw ServiceUnavailableError to trigger job retry
      if (error instanceof ServiceUnavailableError) {
        throw error;
      }

      // Wrap other retryable errors
      if (error.isRetryable || error.name === 'ServiceUnavailableError') {
        throw new ServiceUnavailableError('Bedrock', error, true);
      }

      // Return fallback result for non-retryable errors
      return {
        blur_detection: this.createFallbackIssue('Blur assessment failed'),
        contrast_assessment: this.createFallbackIssue('Contrast assessment failed'),
        glare_identification: this.createFallbackIssue('Glare assessment failed'),
        water_stains: this.createFallbackIssue('Water stain assessment failed'),
        tears_or_folds: this.createFallbackIssue('Tear/fold assessment failed'),
        cut_off_detection: this.createFallbackIssue('Cut-off assessment failed'),
        missing_sections: this.createFallbackIssue('Missing section assessment failed'),
        obstructions: this.createFallbackIssue('Obstruction assessment failed'),
        overall_quality_score: 5,
        suitable_for_extraction: true, // Default to true to not block processing
      };
    }
  }

  /**
   * Format assessment results for workflow processing
   * @param assessment The quality assessment result
   * @param filename Original filename
   * @returns Formatted assessment object
   */
  formatAssessmentForWorkflow(assessment: ImageQualityAssessment, filename: string) {
    return {
      filename,
      assessment_method: 'LLM_VISION',
      model_used: this.getActualModelUsed(),
      timestamp: new Date().toISOString(),
      quality_score: assessment.overall_quality_score * 10, // Convert to 0-100 scale
      quality_level: this.getQualityLevel(assessment.overall_quality_score),
      suitable_for_extraction: assessment.suitable_for_extraction,
      ...assessment,
    };
  }

  /**
   * Get quality level string based on score
   * @param score Quality score (0-10)
   * @returns Quality level description
   * @private
   */
  private getQualityLevel(score: number): string {
    if (score >= 8) return 'excellent';
    if (score >= 6) return 'good';
    if (score >= 4) return 'fair';
    return 'poor';
  }
}
