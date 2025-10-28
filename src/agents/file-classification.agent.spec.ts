import { FileClassificationAgent } from './file-classification.agent';
import { BedrockLlmService } from '../utils/bedrockLlm';
import { FileClassificationResultSchema } from '../schemas/expense-schemas';

jest.mock('../utils/bedrockLlm');

describe('FileClassificationAgent', () => {
  let agent: FileClassificationAgent;
  let mockLlmService: jest.Mocked<BedrockLlmService>;

  beforeEach(() => {
    mockLlmService = {
      chat: jest.fn(),
      getCurrentProvider: jest.fn().mockReturnValue('bedrock'),
      getCurrentModelName: jest.fn().mockReturnValue('claude-3-5-sonnet'),
    } as any;

    agent = new FileClassificationAgent('bedrock', 'claude-3-5-sonnet');
    agent['llm'] = mockLlmService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('classifyFile', () => {
    const validClassificationResponse = {
      is_expense: true,
      expense_type: 'restaurant_receipt',
      language: 'en',
      language_confidence: 0.95,
      document_location: 'USA',
      expected_location: 'USA',
      location_match: true,
      error_type: null,
      error_message: null,
      classification_confidence: 0.92,
      reasoning: 'Document contains typical restaurant receipt elements',
      schema_field_analysis: {
        fields_found: ['vendor_name', 'total_amount', 'date'],
        fields_missing: ['tax_id'],
        total_fields_found: 3,
        expense_identification_reasoning: 'Contains vendor and transaction details',
      },
    };

    it('should successfully classify an expense document', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(validClassificationResponse) },
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await agent.classifyFile(
        'Sample receipt text with vendor and total',
        'USA',
        { properties: {} },
      );

      expect(result.is_expense).toBe(true);
      expect(result.expense_type).toBe('restaurant_receipt');
      expect(result.language).toBe('en');
      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
    });

    it('should classify non-expense document', async () => {
      const nonExpenseResponse = {
        ...validClassificationResponse,
        is_expense: false,
        expense_type: null,
        reasoning: 'Document is a personal letter, not an expense',
      };

      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(nonExpenseResponse) },
      });

      const result = await agent.classifyFile('Dear John, ...', 'USA', { properties: {} });

      expect(result.is_expense).toBe(false);
      expect(result.expense_type).toBeNull();
    });

    it('should handle markdown code blocks in response', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: {
          content: '```json\n' + JSON.stringify(validClassificationResponse) + '\n```',
        },
      });

      const result = await agent.classifyFile('Receipt text', 'USA', { properties: {} });

      expect(result.is_expense).toBe(true);
    });

    it('should handle Anthropic array format response', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: {
          content: [{ type: 'text', text: JSON.stringify(validClassificationResponse) }],
        },
      } as any);

      const result = await agent.classifyFile('Receipt text', 'USA', { properties: {} });

      expect(result.is_expense).toBe(true);
      expect(result.expense_type).toBe('restaurant_receipt');
    });

    it('should return fallback result on LLM error', async () => {
      mockLlmService.chat.mockRejectedValue(new Error('LLM service unavailable'));

      const result = await agent.classifyFile('Receipt text', 'USA', { properties: {} });

      expect(result.is_expense).toBe(false);
      expect(result.error_type).toBe('classification_error');
      expect(result.error_message).toContain('LLM service unavailable');
      expect(result.classification_confidence).toBe(0);
    });

    it('should return fallback result on invalid JSON response', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: { content: 'Invalid JSON {broken}' },
      });

      const result = await agent.classifyFile('Receipt text', 'USA', { properties: {} });

      expect(result.is_expense).toBe(false);
      expect(result.error_type).toBe('classification_error');
    });

    it('should validate response against schema', async () => {
      const invalidResponse = {
        is_expense: 'yes', // Should be boolean
        expense_type: 'receipt',
      };

      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(invalidResponse) },
      });

      const result = await agent.classifyFile('Receipt text', 'USA', { properties: {} });

      // Should return fallback due to schema validation failure
      expect(result.is_expense).toBe(false);
      expect(result.error_type).toBe('classification_error');
    });

    it('should pass expected country to prompt', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(validClassificationResponse) },
      });

      await agent.classifyFile('Receipt text', 'Germany', { properties: {} });

      const callArgs = mockLlmService.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Germany');
    });

    it('should handle location mismatch', async () => {
      const locationMismatchResponse = {
        ...validClassificationResponse,
        document_location: 'France',
        expected_location: 'USA',
        location_match: false,
      };

      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(locationMismatchResponse) },
      });

      const result = await agent.classifyFile('Receipt text', 'USA', { properties: {} });

      expect(result.location_match).toBe(false);
      expect(result.document_location).toBe('France');
      expect(result.expected_location).toBe('USA');
    });
  });

  describe('getActualModelUsed', () => {
    it('should return model name from Bedrock service', () => {
      const modelName = agent.getActualModelUsed();
      expect(modelName).toBe('claude-3-5-sonnet');
    });

    it('should fallback to constructor modelName when getCurrentModelName not available', () => {
      agent['llm'] = { getCurrentModelName: undefined } as any;
      const modelName = agent.getActualModelUsed();
      expect(modelName).toBe('claude-3-5-sonnet');
    });
  });

  describe('constructor', () => {
    it('should initialize with default provider', () => {
      const newAgent = new FileClassificationAgent();
      expect(newAgent['currentProvider']).toBe('bedrock');
    });

    it('should accept custom provider', () => {
      const newAgent = new FileClassificationAgent('anthropic');
      expect(newAgent['currentProvider']).toBe('anthropic');
    });

    it('should use MODEL_CONFIG default when no modelName provided', () => {
      const newAgent = new FileClassificationAgent('bedrock');
      expect(newAgent['modelName']).toBeDefined();
    });
  });

  describe('Integration: Full classification workflow', () => {
    it('should complete full classification with all metadata', async () => {
      const fullValidResponse = {
        is_expense: true,
        expense_type: 'restaurant_receipt',
        language: 'en',
        language_confidence: 0.95,
        document_location: 'USA',
        expected_location: 'USA',
        location_match: true,
        error_type: null,
        error_message: null,
        classification_confidence: 0.92,
        reasoning: 'Document contains typical restaurant receipt elements',
        schema_field_analysis: {
          fields_found: ['vendor_name', 'total_amount', 'date'],
          fields_missing: ['tax_id'],
          total_fields_found: 3,
          expense_identification_reasoning: 'Contains vendor and transaction details',
        },
      };

      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(fullValidResponse) },
        usage: { input_tokens: 150, output_tokens: 75 },
      });

      const markdownContent = `
        Restaurant ABC
        Date: 2024-01-15
        Total: $45.50
      `;

      const result = await agent.classifyFile(markdownContent, 'USA', {
        properties: {
          vendor_name: { type: 'string' },
          total_amount: { type: 'number' },
        },
      });

      // Verify classification
      expect(result.is_expense).toBe(true);
      expect(result.expense_type).toBe('restaurant_receipt');

      // Verify field analysis
      expect(result.schema_field_analysis.fields_found).toContain('vendor_name');
      expect(result.schema_field_analysis.total_fields_found).toBeGreaterThan(0);

      // Verify confidence scores
      expect(result.classification_confidence).toBeGreaterThan(0.5);
      expect(result.language_confidence).toBeGreaterThan(0.5);
    });
  });
});
