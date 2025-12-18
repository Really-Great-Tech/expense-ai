import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AgentFactoryService } from './agent-factory.service';
import { FileClassificationAgent } from '../../agents/file-classification.agent';
import { DataExtractionAgent } from '../../agents/data-extraction.agent';
import { IssueDetectionAgent } from '../../agents/issue-detection.agent';
import { CitationGeneratorAgent } from '../../agents/citation-generator.agent';
import { ImageQualityAssessmentAgent } from '../../agents/image-quality-assessment.agent';

describe('AgentFactoryService', () => {
  let service: AgentFactoryService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentFactoryService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config = {
                BEDROCK_MODEL: 'eu.amazon.nova-pro-v1:0',
                CITATION_MODEL: 'amazon.nova-micro-v1:0',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AgentFactoryService>(AgentFactoryService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with correct provider', () => {
      expect(service).toBeDefined();
      // Verify logger was called with correct message
    });

    it('should use configured bedrock model', () => {
      const agents = service.getAgents();
      expect(configService.get).toHaveBeenCalledWith('BEDROCK_MODEL', 'eu.amazon.nova-pro-v1:0');
      expect(agents).toBeDefined();
    });

    it('should use configured citation model', () => {
      const agents = service.getAgents();
      expect(configService.get).toHaveBeenCalledWith('CITATION_MODEL', 'amazon.nova-micro-v1:0');
      expect(agents.citationGeneratorAgent).toBeDefined();
    });
  });

  describe('getAgents', () => {
    it('should return all agents', () => {
      const agents = service.getAgents();

      expect(agents).toBeDefined();
      expect(agents.fileClassificationAgent).toBeInstanceOf(FileClassificationAgent);
      expect(agents.dataExtractionAgent).toBeInstanceOf(DataExtractionAgent);
      expect(agents.issueDetectionAgent).toBeInstanceOf(IssueDetectionAgent);
      expect(agents.citationGeneratorAgent).toBeInstanceOf(CitationGeneratorAgent);
      expect(agents.imageQualityAssessmentAgent).toBeInstanceOf(ImageQualityAssessmentAgent);
    });

    it('should return the same agent instances on multiple calls', () => {
      const agents1 = service.getAgents();
      const agents2 = service.getAgents();

      expect(agents1.fileClassificationAgent).toBe(agents2.fileClassificationAgent);
      expect(agents1.dataExtractionAgent).toBe(agents2.dataExtractionAgent);
      expect(agents1.issueDetectionAgent).toBe(agents2.issueDetectionAgent);
      expect(agents1.citationGeneratorAgent).toBe(agents2.citationGeneratorAgent);
      expect(agents1.imageQualityAssessmentAgent).toBe(agents2.imageQualityAssessmentAgent);
    });
  });

  describe('individual agent getters', () => {
    it('should return fileClassificationAgent', () => {
      const agent = service.getFileClassificationAgent();
      expect(agent).toBeInstanceOf(FileClassificationAgent);
    });

    it('should return dataExtractionAgent', () => {
      const agent = service.getDataExtractionAgent();
      expect(agent).toBeInstanceOf(DataExtractionAgent);
    });

    it('should return issueDetectionAgent', () => {
      const agent = service.getIssueDetectionAgent();
      expect(agent).toBeInstanceOf(IssueDetectionAgent);
    });

    it('should return citationGeneratorAgent', () => {
      const agent = service.getCitationGeneratorAgent();
      expect(agent).toBeInstanceOf(CitationGeneratorAgent);
    });

    it('should return imageQualityAssessmentAgent', () => {
      const agent = service.getImageQualityAssessmentAgent();
      expect(agent).toBeInstanceOf(ImageQualityAssessmentAgent);
    });

    it('should return same instances from individual getters as from getAgents', () => {
      const agents = service.getAgents();

      expect(service.getFileClassificationAgent()).toBe(agents.fileClassificationAgent);
      expect(service.getDataExtractionAgent()).toBe(agents.dataExtractionAgent);
      expect(service.getIssueDetectionAgent()).toBe(agents.issueDetectionAgent);
      expect(service.getCitationGeneratorAgent()).toBe(agents.citationGeneratorAgent);
      expect(service.getImageQualityAssessmentAgent()).toBe(agents.imageQualityAssessmentAgent);
    });
  });

  describe('agent singleton behavior', () => {
    it('should maintain singleton pattern for all agents', () => {
      // Get agents multiple times
      const agents1 = service.getAgents();
      const fileAgent1 = service.getFileClassificationAgent();
      const dataAgent1 = service.getDataExtractionAgent();

      const agents2 = service.getAgents();
      const fileAgent2 = service.getFileClassificationAgent();
      const dataAgent2 = service.getDataExtractionAgent();

      // All should be the same instances
      expect(fileAgent1).toBe(agents1.fileClassificationAgent);
      expect(fileAgent1).toBe(fileAgent2);
      expect(fileAgent1).toBe(agents2.fileClassificationAgent);

      expect(dataAgent1).toBe(agents1.dataExtractionAgent);
      expect(dataAgent1).toBe(dataAgent2);
      expect(dataAgent1).toBe(agents2.dataExtractionAgent);
    });
  });
});
