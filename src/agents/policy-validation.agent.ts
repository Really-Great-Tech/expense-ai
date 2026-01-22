import { Injectable, Logger } from '@nestjs/common';
import { BedrockLlmService } from '../services/bedrock/bedrock-llm';
import { AGENT_PROFILES } from './config/models.config';
import { 
  POLICY_VALIDATION_SYSTEM_PROMPT,
  createPolicyValidationUserPrompt
} from '../country-policy/prompts/policy-validation.prompt';
import { 
  ExtractedPolicyDataValidated,
  PolicyValidationResult,
  PolicyValidationResultSchema
} from '../common/schemas/country-policy-schemas';

/**
 * PolicyValidationAgent validates extracted policy rules against source documents
 * to ensure accuracy, completeness, and proper categorization
 */
@Injectable()
export class PolicyValidationAgent {
  protected readonly logger = new Logger(PolicyValidationAgent.name);
  private readonly llm: BedrockLlmService;

  constructor() {
    // Initialize LLM with policy extraction profile (Claude Sonnet)
    this.llm = new BedrockLlmService({ profile: AGENT_PROFILES.POLICY_EXTRACTION, maxTokens: 8000 });
    this.logger.log(`PolicyValidationAgent initialized with profile: ${AGENT_PROFILES.POLICY_EXTRACTION}`);
  }

  /**
   * Validate extracted policy data against source documents
   * @param extractedPolicies - The extracted policy data to validate
   * @param sourceDocument - Original source document content
   * @param countryName - Country name for context
   * @returns Validation results with scores and judgments for each rule
   */
  async validatePolicies(
    extractedPolicies: ExtractedPolicyDataValidated,
    sourceDocument: string,
    countryName: string
  ): Promise<PolicyValidationResult> {
    this.logger.log(`Validating policy extraction for ${countryName}`);

    const userPrompt = createPolicyValidationUserPrompt(
      extractedPolicies,
      sourceDocument,
      countryName
    );

    try {
      const response = await this.llm.chat({
        messages: [
          { role: 'system', content: POLICY_VALIDATION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });

      // Parse JSON response
      const validationData = this.parseJsonResponse(response.message.content);
      
      // Validate with Zod schema
      const result = this.validateResponse(validationData);

      this.logger.log(`Policy validation completed for ${countryName}`);
      return result;
    } catch (error) {
      this.logger.error(`Policy validation failed for ${countryName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse JSON from LLM response, handling potential markdown code blocks
   */
  private parseJsonResponse(content: string): unknown {
    let jsonString = content.trim();

    // Remove markdown code blocks if present
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.slice(7);
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.slice(3);
    }

    if (jsonString.endsWith('```')) {
      jsonString = jsonString.slice(0, -3);
    }

    jsonString = jsonString.trim();

    try {
      return JSON.parse(jsonString);
    } catch (error) {
      this.logger.error('Failed to parse LLM response as JSON');
      this.logger.error(`Response preview: ${jsonString.substring(0, 500)}...`);
      throw new Error('LLM response is not valid JSON. Please retry.');
    }
  }

  /**
   * Validate validation result using Zod schema
   */
  private validateResponse(data: unknown): PolicyValidationResult {
    const result = PolicyValidationResultSchema.safeParse(data);

    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      this.logger.error('Validation errors:', errors);
      throw new Error(`Validation result schema validation failed:\n${errors.join('\n')}`);
    }

    return result.data as PolicyValidationResult;
  }

  /**
   * Validate multiple documents for a country
   * @param extractedPolicies - The extracted policy data to validate
   * @param documents - Array of source documents with filenames
   * @param countryName - Country name for context
   * @returns Validation results
   */
  async validatePoliciesMultiDocument(
    extractedPolicies: ExtractedPolicyDataValidated,
    documents: Array<{ fileName: string; content: string }>,
    countryName: string
  ): Promise<PolicyValidationResult> {
    this.logger.log(`Validating policy extraction for ${countryName} (${documents.length} documents)`);

    // Combine documents into one source for validation
    const combinedSource = documents
      .map((doc, index) => {
        return `---
DOCUMENT ${index + 1}: ${doc.fileName}
---

${doc.content}

---
END DOCUMENT ${index + 1}
---`;
      })
      .join('\n\n');

    return this.validatePolicies(extractedPolicies, combinedSource, countryName);
  }
}
