import { CitationGeneratorAgent } from './citation-generator.agent';
import { BedrockLlmService } from '../services/bedrock/bedrock-llm';

jest.mock('../services/bedrock/bedrock-llm');

describe('CitationGeneratorAgent', () => {
  let agent: CitationGeneratorAgent;
  let mockLlmService: jest.Mocked<BedrockLlmService>;

  beforeEach(() => {
    mockLlmService = {
      chat: jest.fn(),
      getCurrentModelName: jest.fn().mockReturnValue('amazon.nova-micro-v1:0'),
      getCurrentProvider: jest.fn().mockReturnValue('bedrock'),
    } as any;

    agent = new CitationGeneratorAgent();
    agent['llm'] = mockLlmService;

    // Mock the getPromptTemplate method to return a simple prompt
    jest.spyOn(agent as any, 'getPromptTemplate').mockResolvedValue('Generate citations for the following data');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(agent).toBeDefined();
    });

    it('should initialize llm service', () => {
      expect(agent['llm']).toBeDefined();
    });
  });

  describe('getActualModelUsed', () => {
    it('should return model name from LLM service', () => {
      const result = agent.getActualModelUsed();
      expect(result).toBe('amazon.nova-micro-v1:0');
    });
  });

  describe('generateCitations', () => {
    const mockExtractedData = {
      vendor_name: 'Test Store',
      total_amount: 45.99,
      date_of_issue: '2024-01-15',
    };

    const mockMarkdownContent = `
# Receipt
**Store:** Test Store
**Total:** $45.99
**Date:** January 15, 2024
    `;

    const mockValidResponse = {
      citations: {
        vendor_name: {
          field_citation: { text: 'Store:', line: 2, confidence: 0.95 },
          value_citation: { text: 'Test Store', line: 2, confidence: 0.98 },
        },
        total_amount: {
          field_citation: { text: 'Total:', line: 3, confidence: 0.92 },
          value_citation: { text: '$45.99', line: 3, confidence: 0.97 },
        },
        date_of_issue: {
          field_citation: { text: 'Date:', line: 4, confidence: 0.90 },
          value_citation: { text: 'January 15, 2024', line: 4, confidence: 0.95 },
        },
      },
      metadata: {
        total_fields_analyzed: 3,
        fields_with_field_citations: 3,
        fields_with_value_citations: 3,
        average_confidence: 0.95,
      },
    };

    it('should generate citations successfully', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(mockValidResponse) },
      } as any);

      const result = await agent.generateCitations(mockExtractedData, mockMarkdownContent, 'test.pdf');

      expect(result).toBeDefined();
      expect(result.citations).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should process fields in batches', async () => {
      // Create large dataset to trigger batching
      const largeExtractedData: Record<string, any> = {};
      for (let i = 0; i < 25; i++) {
        largeExtractedData[`field_${i}`] = `value_${i}`;
      }

      mockLlmService.chat.mockResolvedValue({
        message: {
          content: JSON.stringify({
            citations: {},
            metadata: {
              total_fields_analyzed: 10,
              fields_with_field_citations: 5,
              fields_with_value_citations: 5,
              average_confidence: 0.8,
            },
          }),
        },
      } as any);

      const result = await agent.generateCitations(largeExtractedData, mockMarkdownContent, 'test.pdf');

      expect(result).toBeDefined();
      // Should have been called multiple times for batches
      expect(mockLlmService.chat).toHaveBeenCalled();
    });

    it('should return fallback result on error', async () => {
      mockLlmService.chat.mockRejectedValue(new Error('LLM error'));

      const result = await agent.generateCitations(mockExtractedData, mockMarkdownContent, 'test.pdf');

      // When batch processing fails, it returns fallback citations per field with null values
      expect(result.citations).toBeDefined();
      expect(result.metadata.total_fields_analyzed).toBe(Object.keys(mockExtractedData).length);
      expect(result.metadata.fields_with_field_citations).toBe(0);
      expect(result.metadata.fields_with_value_citations).toBe(0);
      expect(result.metadata.average_confidence).toBe(0.0);
    });

    it('should handle empty extracted data', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: {
          content: JSON.stringify({
            citations: {},
            metadata: {
              total_fields_analyzed: 0,
              fields_with_field_citations: 0,
              fields_with_value_citations: 0,
              average_confidence: 0,
            },
          }),
        },
      } as any);

      const result = await agent.generateCitations({}, mockMarkdownContent, 'test.pdf');

      expect(result.metadata.total_fields_analyzed).toBe(0);
    });

    it('should handle markdown code blocks in response', async () => {
      const responseWithCodeBlock = '```json\n' + JSON.stringify(mockValidResponse) + '\n```';
      mockLlmService.chat.mockResolvedValue({
        message: { content: responseWithCodeBlock },
      } as any);

      const result = await agent.generateCitations(mockExtractedData, mockMarkdownContent, 'test.pdf');

      expect(result).toBeDefined();
      expect(result.citations).toBeDefined();
    });
  });

  describe('parseJsonResponse', () => {
    it('should parse valid JSON', () => {
      const validJson = JSON.stringify({
        citations: {},
        metadata: { total_fields_analyzed: 0, fields_with_field_citations: 0, fields_with_value_citations: 0, average_confidence: 0 },
      });

      const result = agent['parseJsonResponse'](validJson);

      expect(result).toBeDefined();
      expect(result.citations).toBeDefined();
    });

    it('should handle JSON with markdown code blocks', () => {
      const jsonWithBlocks =
        '```json\n{"citations":{},"metadata":{"total_fields_analyzed":0,"fields_with_field_citations":0,"fields_with_value_citations":0,"average_confidence":0}}\n```';

      const result = agent['parseJsonResponse'](jsonWithBlocks);

      expect(result).toBeDefined();
    });

    it('should handle JSON with trailing commas', () => {
      const jsonWithTrailingComma =
        '{"citations":{},"metadata":{"total_fields_analyzed":0,"fields_with_field_citations":0,"fields_with_value_citations":0,"average_confidence":0,}}';

      const result = agent['parseJsonResponse'](jsonWithTrailingComma);

      expect(result).toBeDefined();
    });

    it('should return fallback for completely invalid JSON', () => {
      const invalidJson = 'not valid json at all';

      const result = agent['parseJsonResponse'](invalidJson);

      expect(result).toEqual({
        citations: {},
        metadata: {
          total_fields_analyzed: 0,
          fields_with_field_citations: 0,
          fields_with_value_citations: 0,
          average_confidence: 0.0,
        },
      });
    });
  });

  describe('cleanJsonContent', () => {
    it('should remove markdown code blocks', () => {
      const content = '```json\n{"test": "value"}\n```';

      const result = agent['cleanJsonContent'](content);

      expect(result).toBe('{"test": "value"}');
    });

    it('should find JSON boundaries', () => {
      const content = 'Some text before {"test": "value"} some text after';

      const result = agent['cleanJsonContent'](content);

      expect(result).toBe('{"test": "value"}');
    });
  });

  describe('repairJsonContent', () => {
    it('should remove trailing commas before closing braces', () => {
      const content = '{"test": "value",}';

      const result = agent['repairJsonContent'](content);

      expect(result).toBe('{"test": "value"}');
    });

    it('should remove trailing commas before closing brackets', () => {
      const content = '["a", "b",]';

      const result = agent['repairJsonContent'](content);

      expect(result).toBe('["a", "b"]');
    });

    it('should remove content after last closing brace', () => {
      const content = '{"test": "value"} extra content';

      const result = agent['repairJsonContent'](content);

      expect(result).toBe('{"test": "value"}');
    });
  });

  describe('extractValidJsonFragments', () => {
    it('should extract citations fragment from malformed content', () => {
      const content = 'some garbage "citations": {"field1": {"field_citation": null, "value_citation": null}} more garbage';

      const result = agent['extractValidJsonFragments'](content);

      expect(result).toBeDefined();
      expect(result.citations).toBeDefined();
    });

    it('should return fallback for completely unparseable content', () => {
      const content = 'completely invalid content with no JSON';

      const result = agent['extractValidJsonFragments'](content);

      expect(result).toEqual({
        citations: {},
        metadata: {
          total_fields_analyzed: 0,
          fields_with_field_citations: 0,
          fields_with_value_citations: 0,
          average_confidence: 0.0,
        },
      });
    });
  });

  describe('getFallbackCitationResult', () => {
    it('should return correct fallback structure', () => {
      const result = agent['getFallbackCitationResult']();

      expect(result).toEqual({
        citations: {},
        metadata: {
          total_fields_analyzed: 0,
          fields_with_field_citations: 0,
          fields_with_value_citations: 0,
          average_confidence: 0.0,
        },
      });
    });
  });

  describe('processCitationBatch', () => {
    it('should process batch and return citations', async () => {
      const batchData = { vendor_name: 'Test Store' };
      const mockResponse = {
        citations: {
          vendor_name: {
            field_citation: { text: 'Store:', line: 1, confidence: 0.9 },
            value_citation: { text: 'Test Store', line: 1, confidence: 0.95 },
          },
        },
        metadata: {
          total_fields_analyzed: 1,
          fields_with_field_citations: 1,
          fields_with_value_citations: 1,
          average_confidence: 0.925,
        },
      };

      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(mockResponse) },
      } as any);

      const result = await agent['processCitationBatch'](batchData, '# Test content', 1);

      expect(result.citations.vendor_name).toBeDefined();
      expect(result.metadata.total_fields_analyzed).toBe(1);
    });

    it('should return fallback on batch processing error', async () => {
      mockLlmService.chat.mockRejectedValue(new Error('Batch error'));

      const result = await agent['processCitationBatch']({ field1: 'value1' }, 'content', 1);

      expect(result.citations).toBeDefined();
      expect(result.citations.field1).toEqual({
        field_citation: null,
        value_citation: null,
      });
    });
  });

  describe('Integration: Full citation workflow', () => {
    it('should complete full citation generation with all metadata', async () => {
      const extractedData = {
        vendor_name: 'Coffee Shop',
        total_amount: 12.50,
        date_of_issue: '2024-03-15',
        payment_method: 'credit_card',
      };

      const markdownContent = `
# Receipt
**Vendor:** Coffee Shop
**Total:** $12.50
**Date:** March 15, 2024
**Payment:** Credit Card
      `;

      const mockResponse = {
        citations: {
          vendor_name: {
            field_citation: { text: 'Vendor:', line: 2, confidence: 0.95 },
            value_citation: { text: 'Coffee Shop', line: 2, confidence: 0.98 },
          },
          total_amount: {
            field_citation: { text: 'Total:', line: 3, confidence: 0.92 },
            value_citation: { text: '$12.50', line: 3, confidence: 0.97 },
          },
          date_of_issue: {
            field_citation: { text: 'Date:', line: 4, confidence: 0.90 },
            value_citation: { text: 'March 15, 2024', line: 4, confidence: 0.95 },
          },
          payment_method: {
            field_citation: { text: 'Payment:', line: 5, confidence: 0.88 },
            value_citation: { text: 'Credit Card', line: 5, confidence: 0.92 },
          },
        },
        metadata: {
          total_fields_analyzed: 4,
          fields_with_field_citations: 4,
          fields_with_value_citations: 4,
          average_confidence: 0.93,
        },
      };

      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(mockResponse) },
      } as any);

      const result = await agent.generateCitations(extractedData, markdownContent, 'receipt.pdf');

      // Verify citation generation completed and returned expected structure
      expect(result.metadata.total_fields_analyzed).toBe(4);
      expect(result.citations).toBeDefined();
      expect(Object.keys(result.citations)).toHaveLength(4);
      // The metadata values depend on what the mocked LLM returns
      expect(result.metadata).toBeDefined();
    });
  });
});
