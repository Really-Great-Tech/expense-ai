import { Injectable, Logger } from '@nestjs/common';
import { ExtractedPolicyData } from '../country-policy/interfaces/policy-types.interface';
import { BedrockLlmService } from '../services/bedrock/bedrock-llm';
import { TextractApiService } from '../services/textract/textract-reader';
import { AGENT_PROFILES } from './config/models.config';
import {
  ExtractedPolicyDataSchema,
} from '../common/schemas/country-policy-schemas';
import {
  POLICY_EXTRACTION_SYSTEM_PROMPT,
  createPolicyExtractionUserPrompt,
} from '../country-policy/prompts/policy-extraction.prompt';

/**
 * ============================================================================
 * POLICY EXTRACTION AGENT
 * ============================================================================
 * 
 * Extracts structured policy data from uploaded documents using:
 * 1. Textract for PDF/image text extraction
 * 2. Claude Sonnet for intelligent policy parsing
 * 3. Zod for response validation
 * 
 * Output matches the structure in country-policies.seed.ts
 * ============================================================================
 */

@Injectable()
export class PolicyExtractionAgent {
  private readonly logger = new Logger(PolicyExtractionAgent.name);
  private readonly llm: BedrockLlmService;
  private readonly textract: TextractApiService;

  constructor() {
    // Initialize LLM with policy extraction profile (Claude Sonnet)
    this.llm = new BedrockLlmService({ profile: AGENT_PROFILES.POLICY_EXTRACTION, maxTokens: 64000 });
    this.textract = new TextractApiService();

    this.logger.log(`PolicyExtractionAgent initialized with profile: ${AGENT_PROFILES.POLICY_EXTRACTION}`);
  }

  /**
   * Extract policy data from uploaded document
   * 
   * @param fileBuffer - The file content as buffer
   * @param fileName - Original file name
   * @param mimeType - MIME type of the file
   * @param countryName - Country name for context
   * @returns Extracted policy structure matching COUNTRY_POLICY_SEEDS format
   */
  async extractPolicyFromDocument(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    countryName: string = 'Unknown',
  ): Promise<ExtractedPolicyData> {

    this.logger.log('============================================');
    this.logger.log('POLICY EXTRACTION STARTING');
    this.logger.log('============================================');
    this.logger.log(`File: ${fileName}`);
    this.logger.log(`Type: ${mimeType}`);
    this.logger.log(`Size: ${fileBuffer.length} bytes`);
    this.logger.log(`Country: ${countryName}`);
    this.logger.log('');

    // Step 1: Extract text from document
    this.logger.log('Step 1: Extracting text from document...');
    const documentText = await this.extractTextFromDocument(fileBuffer, fileName, mimeType);

    if (!documentText || documentText.trim().length < 100) {
      throw new Error(`Failed to extract sufficient text from document. Extracted ${documentText?.length || 0} characters.`);
    }

    this.logger.log(`   Extracted ${documentText.length} characters`);
    this.logger.log('');

    // Step 2: Call LLM to extract structured policies
    this.logger.log('Step 2: Calling LLM for policy extraction...');
    const startTime = Date.now();

    const response = await this.llm.chat({
      messages: [
        { role: 'system', content: POLICY_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: createPolicyExtractionUserPrompt(documentText, countryName) },
      ],
    });

    const llmDuration = Date.now() - startTime;
    this.logger.log(`   LLM response received in ${llmDuration}ms`);
    this.logger.log(`   Tokens: ${response.usage?.input_tokens || 'N/A'} input, ${response.usage?.output_tokens || 'N/A'} output`);
    this.logger.log('');

    // Step 3: Parse JSON response
    this.logger.log('Step 3: Parsing LLM response...');
    const extractedData = this.parseJsonResponse(response.message.content);
    this.logger.log('');

    // Step 4: Validate with Zod schema
    this.logger.log('Step 4: Validating extracted data...');
    const validatedData = this.validateExtractedData(extractedData);

    this.logger.log(`   - Receipt standards: ${validatedData.receiptStandards.length}`);
    this.logger.log(`   - Gross-up policies: ${validatedData.compliancePoliciesGrossUpRelated.length}`);
    this.logger.log(`   - Additional info policies: ${validatedData.compliancePoliciesAdditionalInfoRelated.length}`);
    this.logger.log('============================================');
    this.logger.log('POLICY EXTRACTION COMPLETE');
    this.logger.log('============================================');
    this.logger.log('');

    return validatedData;
  }

  /**
   * Extract text content from various document formats
   */
  private async extractTextFromDocument(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<string> {
    // PDF and images: Use Textract
    if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
      const result = await this.textract.parseDocumentFromBuffer(fileBuffer, fileName, {
        extractTables: true,
      });

      if (!result.success) {
        throw new Error(`Textract extraction failed: ${(result as any).error || 'Unknown error'}`);
      }

      return result.data || '';
    }

    // DOCX: Use mammoth (dynamic import to avoid startup dependency)
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mammoth = require('mammoth');
        const mammothResult = await mammoth.extractRawText({ buffer: fileBuffer });
        return mammothResult.value;
      } catch (error) {
        this.logger.error('mammoth import failed - install with: npm install mammoth');
        throw new Error('DOCX parsing not available. Install mammoth package.');
      }
    }

    // XLSX/CSV: Use xlsx library (dynamic import)
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'text/csv'
    ) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const XLSX = require('xlsx');
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

        // Convert all sheets to text
        const textParts: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const text = XLSX.utils.sheet_to_txt(sheet);
          textParts.push(`--- Sheet: ${sheetName} ---\n${text}`);
        }

        return textParts.join('\n\n');
      } catch (error) {
        this.logger.error('xlsx import failed - install with: npm install xlsx');
        throw new Error('Excel/CSV parsing not available. Install xlsx package.');
      }
    }

    throw new Error(`Unsupported file type: ${mimeType}`);
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
   * Validate extracted policy data using Zod schema
   */
  validateExtractedData(data: unknown): ExtractedPolicyData {
    const result = ExtractedPolicyDataSchema.safeParse(data);

    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      this.logger.error('Validation errors:', errors);
      throw new Error(`Extracted data validation failed:\n${errors.join('\n')}`);
    }

    return result.data as ExtractedPolicyData;
  }
}
