import { ImageQualityAssessmentSchema, type ImageQualityAssessment } from '../schemas/expense-schemas';
import * as fs from 'fs';
import * as path from 'path';
import { BedrockLlmService } from '../utils/bedrockLlm';
import { BaseAgent } from './base.agent';
import type { ILLMService } from './types/llm.types';
import { MODEL_CONFIG } from './config/models.config';

/**
 * Agent responsible for assessing image quality of expense documents
 * Evaluates blur, contrast, glare, water stains, tears, and other quality issues
 */
export class ImageQualityAssessmentAgent extends BaseAgent {
  protected llm: ILLMService;
  private currentProvider: 'bedrock' | 'anthropic';
  private readonly defaultModelId: string;

  constructor(provider: 'bedrock' | 'anthropic' = 'bedrock', defaultModelId: string = MODEL_CONFIG.QUALITY_ASSESSMENT) {
    super();
    this.currentProvider = provider;
    this.defaultModelId = defaultModelId;
    this.llm = new BedrockLlmService({ modelType: 'nova' });
  }

  /**
   * Get the actual model name used, accounting for fallback scenarios
   * @returns The current model identifier
   */
  getActualModelUsed(): string {
    if (this.currentProvider === 'bedrock' && this.llm.getCurrentModelName) {
      // For BedrockLlmService, get the actual model name (handles fallback)
      return this.llm.getCurrentModelName();
    } else if (this.currentProvider === 'bedrock') {
      // Fallback for older BedrockLlmService without getCurrentModelName
      return this.defaultModelId;
    } else {
      // Direct Anthropic usage
      return 'claude-3-5-sonnet';
    }
  }

  /**
   * Assess the quality of an expense document image
   * @param imagePath Path to the image file to assess
   * @returns Quality assessment with scores and recommendations
   * @throws Error if assessment fails critically
   */
  async assessImageQuality(imagePath: string): Promise<ImageQualityAssessment> {
    const startTime = new Date();

    this.logger.log(`Starting LLM-based quality assessment for: ${path.basename(imagePath)}`);

    try {
      // Get image info for context
      const imageInfo = this.getImageInfo(imagePath);

      // Get the assessment prompt from local prompts
      const assessmentPrompt = await this.getPromptTemplate('image-quality-assessment-prompt');

      this.logger.debug(`Using prompt: ${this.lastPromptInfo?.name} (version: ${this.lastPromptInfo?.version || 'unknown'})`);

      // Create the full user prompt that will be sent to the LLM
      const userPrompt = `Simulate a quality assessment for an expense document image. ${imageInfo}\n\n${assessmentPrompt}`;

      const response = await this.llm.chat({
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
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
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.logger.error(`Image quality assessment failed after ${duration}ms: ${error.message}`);

      // Return fallback result
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
   * Get image information for logging purposes
   * @param imagePath Path to the image file
   * @returns String with image metadata
   * @private
   */
  private getImageInfo(imagePath: string): string {
    const stats = fs.statSync(imagePath);
    const sizeKB = Math.round(stats.size / 1024);
    const filename = path.basename(imagePath);

    return `Filename: ${filename}, Size: ${sizeKB}KB, Format: ${path.extname(imagePath)}`;
  }

  /**
   * Format assessment results for workflow processing
   * @param assessment The quality assessment result
   * @param imagePath Path to the assessed image
   * @returns Formatted assessment object
   */
  formatAssessmentForWorkflow(assessment: ImageQualityAssessment, imagePath: string) {
    return {
      image_path: imagePath,
      assessment_method: 'LLM',
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
