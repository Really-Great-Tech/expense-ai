import { ImageQualityAssessmentAgent } from './image-quality-assessment.agent';
import { BedrockLlmService } from '../services/bedrock/bedrock-llm';

jest.mock('../services/bedrock/bedrock-llm');
jest.mock('pdf-to-png-converter', () => ({
  pdfToPng: jest.fn().mockResolvedValue([{ content: Buffer.from('fake-png-content') }]),
}));

describe('ImageQualityAssessmentAgent', () => {
  let agent: ImageQualityAssessmentAgent;
  let mockLlmService: jest.Mocked<BedrockLlmService>;

  beforeEach(() => {
    mockLlmService = {
      chat: jest.fn(),
      chatWithVision: jest.fn(),
      getCurrentModelName: jest.fn().mockReturnValue('eu.amazon.nova-pro-v1:0'),
      getCurrentProvider: jest.fn().mockReturnValue('bedrock'),
    } as any;

    agent = new ImageQualityAssessmentAgent();
    agent['llm'] = mockLlmService;

    // Mock the getPromptTemplate method to return a simple prompt
    jest.spyOn(agent as any, 'getPromptTemplate').mockResolvedValue('Analyze the image quality');
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
      expect(result).toBe('eu.amazon.nova-pro-v1:0');
    });
  });

  describe('isPdf', () => {
    it('should return true for PDF buffer', () => {
      // PDF magic bytes: %PDF (0x25 0x50 0x44 0x46)
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
      const result = agent['isPdf'](pdfBuffer);
      expect(result).toBe(true);
    });

    it('should return false for non-PDF buffer', () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const result = agent['isPdf'](jpegBuffer);
      expect(result).toBe(false);
    });
  });

  describe('detectMediaType', () => {
    it('should detect PNG', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      const result = agent['detectMediaType'](pngBuffer);
      expect(result).toBe('image/png');
    });

    it('should detect JPEG', () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const result = agent['detectMediaType'](jpegBuffer);
      expect(result).toBe('image/jpeg');
    });

    it('should detect GIF', () => {
      const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      const result = agent['detectMediaType'](gifBuffer);
      expect(result).toBe('image/gif');
    });

    it('should detect WebP', () => {
      const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00]);
      const result = agent['detectMediaType'](webpBuffer);
      expect(result).toBe('image/webp');
    });

    it('should default to JPEG for unknown formats', () => {
      const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      const result = agent['detectMediaType'](unknownBuffer);
      expect(result).toBe('image/jpeg');
    });
  });

  describe('createFallbackIssue', () => {
    it('should create fallback issue with correct structure', () => {
      const result = agent['createFallbackIssue']('Test description');

      expect(result).toEqual({
        detected: false,
        severity_level: 'low',
        confidence_score: 0.5,
        quantitative_measure: 0.0,
        description: 'Test description',
        recommendation: 'Manual review recommended due to assessment failure',
      });
    });
  });

  describe('getQualityLevel', () => {
    it('should return excellent for scores >= 8', () => {
      expect(agent['getQualityLevel'](8)).toBe('excellent');
      expect(agent['getQualityLevel'](9)).toBe('excellent');
      expect(agent['getQualityLevel'](10)).toBe('excellent');
    });

    it('should return good for scores >= 6 and < 8', () => {
      expect(agent['getQualityLevel'](6)).toBe('good');
      expect(agent['getQualityLevel'](7)).toBe('good');
      expect(agent['getQualityLevel'](7.9)).toBe('good');
    });

    it('should return fair for scores >= 4 and < 6', () => {
      expect(agent['getQualityLevel'](4)).toBe('fair');
      expect(agent['getQualityLevel'](5)).toBe('fair');
      expect(agent['getQualityLevel'](5.9)).toBe('fair');
    });

    it('should return poor for scores < 4', () => {
      expect(agent['getQualityLevel'](3)).toBe('poor');
      expect(agent['getQualityLevel'](2)).toBe('poor');
      expect(agent['getQualityLevel'](0)).toBe('poor');
    });
  });

  describe('assessImageQualityFromBuffer', () => {
    const createMockQualityIssue = (detected = false, severity = 'low', confidence = 0.9) => ({
      detected,
      severity_level: severity,
      confidence_score: confidence,
      quantitative_measure: 0.1,
      description: 'Test description',
      recommendation: 'No action needed',
    });

    const mockValidResponse = {
      blur_detection: createMockQualityIssue(false, 'low', 0.95),
      contrast_assessment: createMockQualityIssue(false, 'low', 0.92),
      glare_identification: createMockQualityIssue(false, 'low', 0.90),
      water_stains: createMockQualityIssue(false, 'low', 0.88),
      tears_or_folds: createMockQualityIssue(false, 'low', 0.87),
      cut_off_detection: createMockQualityIssue(false, 'low', 0.85),
      missing_sections: createMockQualityIssue(false, 'low', 0.82),
      obstructions: createMockQualityIssue(false, 'low', 0.80),
      overall_quality_score: 8.5,
      suitable_for_extraction: true,
    };

    it('should assess image quality from JPEG buffer', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

      mockLlmService.chatWithVision.mockResolvedValue({
        message: { content: JSON.stringify(mockValidResponse) },
      } as any);

      const result = await agent.assessImageQualityFromBuffer(jpegBuffer, 'test.jpg');

      expect(result).toBeDefined();
      expect(result.overall_quality_score).toBe(8.5);
      expect(result.suitable_for_extraction).toBe(true);
      expect(mockLlmService.chatWithVision).toHaveBeenCalled();
    });

    it('should assess image quality from PNG buffer', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

      mockLlmService.chatWithVision.mockResolvedValue({
        message: { content: JSON.stringify(mockValidResponse) },
      } as any);

      const result = await agent.assessImageQualityFromBuffer(pngBuffer, 'test.png');

      expect(result).toBeDefined();
      expect(result.overall_quality_score).toBe(8.5);
    });

    it('should convert PDF to image before assessment', async () => {
      // PDF magic bytes
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);

      mockLlmService.chatWithVision.mockResolvedValue({
        message: { content: JSON.stringify(mockValidResponse) },
      } as any);

      const result = await agent.assessImageQualityFromBuffer(pdfBuffer, 'test.pdf');

      expect(result).toBeDefined();
      const { pdfToPng } = require('pdf-to-png-converter');
      expect(pdfToPng).toHaveBeenCalled();
    });

    it('should return fallback result on error', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

      mockLlmService.chatWithVision.mockRejectedValue(new Error('Vision API error'));

      const result = await agent.assessImageQualityFromBuffer(jpegBuffer, 'test.jpg');

      expect(result.overall_quality_score).toBe(5);
      expect(result.suitable_for_extraction).toBe(true);
      expect(result.blur_detection.detected).toBe(false);
    });

    it('should handle images with quality issues', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

      const responseWithIssues = {
        ...mockValidResponse,
        blur_detection: {
          ...mockValidResponse.blur_detection,
          detected: true,
          severity_level: 'medium',
        },
        overall_quality_score: 5.5,
        suitable_for_extraction: true,
      };

      mockLlmService.chatWithVision.mockResolvedValue({
        message: { content: JSON.stringify(responseWithIssues) },
      } as any);

      const result = await agent.assessImageQualityFromBuffer(jpegBuffer, 'blurry.jpg');

      expect(result.blur_detection.detected).toBe(true);
      expect(result.blur_detection.severity_level).toBe('medium');
      expect(result.overall_quality_score).toBe(5.5);
    });

    it('should handle markdown code blocks in response', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const responseWithCodeBlock = '```json\n' + JSON.stringify(mockValidResponse) + '\n```';

      mockLlmService.chatWithVision.mockResolvedValue({
        message: { content: responseWithCodeBlock },
      } as any);

      const result = await agent.assessImageQualityFromBuffer(jpegBuffer, 'test.jpg');

      expect(result).toBeDefined();
      expect(result.overall_quality_score).toBe(8.5);
    });
  });

  describe('formatAssessmentForWorkflow', () => {
    const mockAssessment = {
      blur_detection: {
        detected: false,
        severity_level: 'low' as const,
        confidence_score: 0.95,
        quantitative_measure: 0.1,
        description: 'No blur detected',
        recommendation: 'No action needed',
      },
      contrast_assessment: {
        detected: false,
        severity_level: 'low' as const,
        confidence_score: 0.92,
        quantitative_measure: 0.1,
        description: 'Good contrast',
        recommendation: 'No action needed',
      },
      glare_identification: {
        detected: false,
        severity_level: 'low' as const,
        confidence_score: 0.90,
        quantitative_measure: 0.1,
        description: 'No glare',
        recommendation: 'No action needed',
      },
      water_stains: {
        detected: false,
        severity_level: 'low' as const,
        confidence_score: 0.88,
        quantitative_measure: 0.1,
        description: 'No water stains',
        recommendation: 'No action needed',
      },
      tears_or_folds: {
        detected: false,
        severity_level: 'low' as const,
        confidence_score: 0.87,
        quantitative_measure: 0.1,
        description: 'No tears',
        recommendation: 'No action needed',
      },
      cut_off_detection: {
        detected: false,
        severity_level: 'low' as const,
        confidence_score: 0.85,
        quantitative_measure: 0.1,
        description: 'No cut-off',
        recommendation: 'No action needed',
      },
      missing_sections: {
        detected: false,
        severity_level: 'low' as const,
        confidence_score: 0.82,
        quantitative_measure: 0.1,
        description: 'No missing sections',
        recommendation: 'No action needed',
      },
      obstructions: {
        detected: false,
        severity_level: 'low' as const,
        confidence_score: 0.80,
        quantitative_measure: 0.1,
        description: 'No obstructions',
        recommendation: 'No action needed',
      },
      overall_quality_score: 8.5,
      suitable_for_extraction: true,
    };

    it('should format assessment for workflow', () => {
      const result = agent.formatAssessmentForWorkflow(mockAssessment, 'test.jpg');

      expect(result.filename).toBe('test.jpg');
      expect(result.assessment_method).toBe('LLM_VISION');
      expect(result.model_used).toBe('eu.amazon.nova-pro-v1:0');
      expect(result.timestamp).toBeDefined();
      expect(result.quality_score).toBe(85); // 8.5 * 10
      expect(result.quality_level).toBe('excellent');
      expect(result.suitable_for_extraction).toBe(true);
    });

    it('should include all assessment fields', () => {
      const result = agent.formatAssessmentForWorkflow(mockAssessment, 'test.jpg');

      expect(result.blur_detection).toBeDefined();
      expect(result.contrast_assessment).toBeDefined();
      expect(result.glare_identification).toBeDefined();
      expect(result.water_stains).toBeDefined();
      expect(result.tears_or_folds).toBeDefined();
      expect(result.cut_off_detection).toBeDefined();
      expect(result.missing_sections).toBeDefined();
      expect(result.obstructions).toBeDefined();
    });

    it('should set correct quality level for different scores', () => {
      const excellentAssessment = { ...mockAssessment, overall_quality_score: 9 };
      const goodAssessment = { ...mockAssessment, overall_quality_score: 7 };
      const fairAssessment = { ...mockAssessment, overall_quality_score: 5 };
      const poorAssessment = { ...mockAssessment, overall_quality_score: 3 };

      expect(agent.formatAssessmentForWorkflow(excellentAssessment, 'test.jpg').quality_level).toBe('excellent');
      expect(agent.formatAssessmentForWorkflow(goodAssessment, 'test.jpg').quality_level).toBe('good');
      expect(agent.formatAssessmentForWorkflow(fairAssessment, 'test.jpg').quality_level).toBe('fair');
      expect(agent.formatAssessmentForWorkflow(poorAssessment, 'test.jpg').quality_level).toBe('poor');
    });
  });

  describe('convertPdfToImage', () => {
    it('should convert PDF buffer to PNG', async () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);

      const { pdfToPng } = require('pdf-to-png-converter');
      pdfToPng.mockResolvedValue([{ content: Buffer.from('png-content') }]);

      const result = await agent['convertPdfToImage'](pdfBuffer);

      expect(result).toBeDefined();
      expect(pdfToPng).toHaveBeenCalled();
    });

    it('should throw error if conversion fails', async () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);

      const { pdfToPng } = require('pdf-to-png-converter');
      pdfToPng.mockResolvedValue([]);

      await expect(agent['convertPdfToImage'](pdfBuffer)).rejects.toThrow('Failed to convert PDF to image');
    });
  });
});
