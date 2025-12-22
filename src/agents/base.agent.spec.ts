import { BaseAgent } from './base.agent';
import { FALLBACK_PROMPTS } from './prompts/index';
import type { ILLMService, ChatResponse } from './types/llm.types';

// Concrete implementation for testing
class TestAgent extends BaseAgent {
  public llm: ILLMService;

  constructor(llmService: ILLMService) {
    super();
    this.llm = llmService;
  }

  // Expose protected methods for testing
  public testGetPromptTemplate(promptName: string, variables?: Record<string, any>) {
    return this.getPromptTemplate(promptName, variables);
  }

  public testExtractContentFromResponse(response: ChatResponse) {
    return this.extractContentFromResponse(response);
  }

  public testParseJsonResponse(content: string) {
    return this.parseJsonResponse(content);
  }

  public testGetPromptMetadata() {
    return this.getPromptMetadata();
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  let mockLlmService: jest.Mocked<ILLMService>;

  beforeEach(() => {
    mockLlmService = {
      chat: jest.fn(),
      getCurrentProvider: jest.fn().mockReturnValue('bedrock'),
      getCurrentModelName: jest.fn().mockReturnValue('test-model'),
    };
    agent = new TestAgent(mockLlmService);
  });

  describe('getPromptTemplate', () => {
    it('should load and compile prompt with variables', async () => {
      const result = await agent.testGetPromptTemplate('data-extraction-prompt', {
        markdownContent: 'test content',
      });

      expect(result).toContain('test content');
      expect(typeof result).toBe('string');
    });

    it('should throw error for non-existent prompt', async () => {
      await expect(agent.testGetPromptTemplate('non-existent-prompt')).rejects.toThrow(
        'Prompt non-existent-prompt is required but not available in local prompts',
      );
    });

    it('should store prompt info after loading', async () => {
      await agent.testGetPromptTemplate('data-extraction-prompt');
      const metadata = agent.testGetPromptMetadata();

      expect(metadata.promptName).toBe('data-extraction-prompt');
      expect(metadata).toHaveProperty('promptVersion');
    });

    it('should handle prompts without variables', async () => {
      const result = await agent.testGetPromptTemplate('image-quality-assessment-prompt');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('extractContentFromResponse', () => {
    it('should extract string content', () => {
      const response: ChatResponse = {
        message: { content: 'test string' },
      };
      const result = agent.testExtractContentFromResponse(response);
      expect(result).toBe('test string');
    });

    it('should extract content from Anthropic array format', () => {
      const response: ChatResponse = {
        message: {
          content: [{ type: 'text', text: 'extracted text' }],
        },
      };
      const result = agent.testExtractContentFromResponse(response);
      expect(result).toBe('extracted text');
    });

    it('should handle object content by stringifying', () => {
      const response: ChatResponse = {
        message: {
          content: { key: 'value' },
        },
      };
      const result = agent.testExtractContentFromResponse(response);
      expect(result).toBe('{"key":"value"}');
    });

    it('should handle empty content', () => {
      const response: ChatResponse = {
        message: { content: '' },
      };
      const result = agent.testExtractContentFromResponse(response);
      expect(result).toBe('');
    });

    it('should handle array without text type', () => {
      const response: ChatResponse = {
        message: {
          content: [{ type: 'other', data: 'test' }],
        },
      };
      const result = agent.testExtractContentFromResponse(response);
      expect(typeof result).toBe('string');
    });
  });

  describe('parseJsonResponse', () => {
    it('should parse valid JSON', () => {
      const jsonString = '{"key": "value", "number": 42}';
      const result = agent.testParseJsonResponse(jsonString);
      expect(result).toEqual({ key: 'value', number: 42 });
    });

    it('should remove markdown code blocks', () => {
      const jsonString = '```json\n{"key": "value"}\n```';
      const result = agent.testParseJsonResponse(jsonString);
      expect(result).toEqual({ key: 'value' });
    });

    it('should handle JSON without code blocks', () => {
      const jsonString = '{"test": true}';
      const result = agent.testParseJsonResponse(jsonString);
      expect(result).toEqual({ test: true });
    });

    it('should throw error for invalid JSON', () => {
      const invalidJson = '{invalid json}';
      expect(() => agent.testParseJsonResponse(invalidJson)).toThrow('Invalid JSON response');
    });

    it('should trim whitespace', () => {
      const jsonString = '  \n  {"key": "value"}  \n  ';
      const result = agent.testParseJsonResponse(jsonString);
      expect(result).toEqual({ key: 'value' });
    });
  });

  describe('getPromptMetadata', () => {
    it('should return empty object when no prompt loaded', () => {
      const metadata = agent.testGetPromptMetadata();
      expect(metadata).toEqual({});
    });

    it('should return metadata after loading prompt', async () => {
      await agent.testGetPromptTemplate('data-extraction-prompt');
      const metadata = agent.testGetPromptMetadata();

      expect(metadata).toHaveProperty('promptName');
      expect(metadata).toHaveProperty('promptVersion');
      expect(metadata).toHaveProperty('promptConfig');
    });
  });

  describe('getAvailablePrompts', () => {
    it('should return array of prompt names', () => {
      const prompts = agent['getAvailablePrompts']();
      expect(Array.isArray(prompts)).toBe(true);
      expect(prompts.length).toBeGreaterThan(0);
      expect(prompts).toContain('data-extraction-prompt');
    });
  });

  describe('hasPrompt', () => {
    it('should return true for existing prompts', () => {
      expect(agent['hasPrompt']('data-extraction-prompt')).toBe(true);
      expect(agent['hasPrompt']('file-classification-prompt')).toBe(true);
    });

    it('should return false for non-existent prompts', () => {
      expect(agent['hasPrompt']('non-existent-prompt')).toBe(false);
    });
  });

  describe('getRawPromptData', () => {
    it('should return raw prompt data', () => {
      const promptData = agent['getRawPromptData']('data-extraction-prompt');
      expect(promptData).toHaveProperty('prompt');
      expect(promptData).toHaveProperty('version');
    });

    it('should throw error for non-existent prompt', () => {
      expect(() => agent['getRawPromptData']('non-existent')).toThrow(
        'Prompt non-existent not found in local prompts',
      );
    });
  });

  describe('getActualModelUsed', () => {
    it('should return model name from LLM service', () => {
      const modelName = agent['getActualModelUsed']();
      expect(modelName).toBe('test-model');
    });

    it('should return "unknown" when LLM is not initialized', () => {
      const agentWithoutLlm = new TestAgent(null as any);
      const modelName = agentWithoutLlm['getActualModelUsed']();
      expect(modelName).toBe('unknown');
    });
  });

  describe('getPromptVersionTags', () => {
    it('should return empty array when no prompt loaded', () => {
      const tags = agent['getPromptVersionTags']();
      expect(tags).toEqual([]);
    });

    it('should return version tags after loading prompt', async () => {
      await agent.testGetPromptTemplate('data-extraction-prompt');
      const tags = agent['getPromptVersionTags']();

      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThan(0);
      expect(tags[0]).toContain('data-extraction-prompt');
    });

    it('should include general version tag when version is known', async () => {
      await agent.testGetPromptTemplate('data-extraction-prompt');
      const tags = agent['getPromptVersionTags']();

      // Should have both prompt-specific and general version tags
      const hasGeneralVersionTag = tags.some((t) => t.startsWith('prompt-v') && !t.includes('data-extraction'));
      expect(hasGeneralVersionTag || tags.some((t) => t.includes('unknown'))).toBe(true);
    });
  });

  describe('getAllPromptVersionTags', () => {
    it('should return tags for multiple prompts', () => {
      const promptInfos = [
        { name: 'prompt1', version: 1, config: {} },
        { name: 'prompt2', version: 2, config: {} },
      ];

      const tags = agent['getAllPromptVersionTags'](promptInfos);

      expect(tags).toContain('prompt1-v1');
      expect(tags).toContain('prompt2-v2');
      expect(tags).toContain('prompt-v1');
      expect(tags).toContain('prompt-v2');
    });

    it('should handle prompts without version', () => {
      const promptInfos = [
        { name: 'prompt1', config: {} },
        { name: 'prompt2', version: undefined, config: {} },
      ];

      const tags = agent['getAllPromptVersionTags'](promptInfos);

      expect(tags).toContain('prompt1-vunknown');
      expect(tags).toContain('prompt2-vunknown');
      // Should not include general version tag for unknown versions
      expect(tags.filter((t) => t === 'prompt-vunknown').length).toBe(0);
    });

    it('should deduplicate version numbers', () => {
      const promptInfos = [
        { name: 'prompt1', version: 1, config: {} },
        { name: 'prompt2', version: 1, config: {} },
        { name: 'prompt3', version: 2, config: {} },
      ];

      const tags = agent['getAllPromptVersionTags'](promptInfos);

      // Should only have one prompt-v1 tag, not two
      const v1Tags = tags.filter((t) => t === 'prompt-v1');
      expect(v1Tags.length).toBe(1);
    });

    it('should handle empty promptInfos array', () => {
      const tags = agent['getAllPromptVersionTags']([]);
      expect(tags).toEqual([]);
    });
  });

  describe('executeLLMRequest', () => {
    it('should throw error when LLM is not initialized', async () => {
      const agentWithoutLlm = new TestAgent(null as any);

      const { z } = require('zod');
      const schema = z.object({ result: z.string() });

      await expect(agentWithoutLlm['executeLLMRequest']('test', {}, schema)).rejects.toThrow(
        'LLM service not initialized',
      );
    });

    it('should execute LLM request with prompt and validate response', async () => {
      const mockResponse = { result: 'success' };
      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(mockResponse) },
      });

      const { z } = require('zod');
      const schema = z.object({ result: z.string() });

      const result = await agent['executeLLMRequest']('data-extraction-prompt', { markdownContent: 'test' }, schema);

      expect(result).toEqual(mockResponse);
      expect(mockLlmService.chat).toHaveBeenCalled();
    });

    it('should include system prompt when provided', async () => {
      const mockResponse = { result: 'success' };
      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(mockResponse) },
      });

      const { z } = require('zod');
      const schema = z.object({ result: z.string() });

      await agent['executeLLMRequest']('data-extraction-prompt', { markdownContent: 'test' }, schema, {
        systemPrompt: 'You are a helpful assistant',
      });

      expect(mockLlmService.chat).toHaveBeenCalledWith({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: 'You are a helpful assistant' }),
        ]),
      });
    });

    it('should use provided messages when available', async () => {
      const mockResponse = { result: 'success' };
      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(mockResponse) },
      });

      const { z } = require('zod');
      const schema = z.object({ result: z.string() });
      const customMessages = [{ role: 'user' as const, content: 'custom message' }];

      await agent['executeLLMRequest']('data-extraction-prompt', { markdownContent: 'test' }, schema, {
        messages: customMessages,
      });

      expect(mockLlmService.chat).toHaveBeenCalledWith({
        messages: customMessages,
      });
    });
  });

  describe('extractContentFromResponse edge cases', () => {
    it('should handle null/undefined content', () => {
      const response: ChatResponse = {
        message: { content: null as any },
      };
      const result = agent.testExtractContentFromResponse(response);
      expect(result).toBe('');
    });

    it('should handle empty array', () => {
      const response: ChatResponse = {
        message: { content: [] },
      };
      const result = agent.testExtractContentFromResponse(response);
      // Empty array doesn't satisfy length > 0, falls through to object handling and gets stringified
      expect(result).toBe('[]');
    });

    it('should stringify array when first item lacks text property', () => {
      const response: ChatResponse = {
        message: { content: [{ type: 'text' }] as any }, // Missing text property
      };
      const result = agent.testExtractContentFromResponse(response);
      expect(typeof result).toBe('string');
    });
  });

  describe('Integration: Full workflow', () => {
    it('should handle complete prompt loading and compilation workflow', async () => {
      // Load prompt
      const prompt = await agent.testGetPromptTemplate('data-extraction-prompt', {
        markdownContent: 'Sample receipt text',
      });

      // Verify prompt compiled correctly
      expect(prompt).toContain('Sample receipt text');

      // Check metadata was stored
      const metadata = agent.testGetPromptMetadata();
      expect(metadata.promptName).toBe('data-extraction-prompt');
    });

    it('should handle response extraction and parsing workflow', () => {
      // Mock LLM response
      const response: ChatResponse = {
        message: {
          content: '```json\n{"result": "success"}\n```',
        },
      };

      // Extract content
      const content = agent.testExtractContentFromResponse(response);
      expect(typeof content).toBe('string');

      // Parse JSON
      const parsed = agent.testParseJsonResponse(content);
      expect(parsed).toEqual({ result: 'success' });
    });
  });
});
