import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileClassificationAgent } from '../../agents/file-classification.agent';
import { DataExtractionAgent } from '../../agents/data-extraction.agent';
import { IssueDetectionAgent } from '../../agents/issue-detection.agent';
import { CitationGeneratorAgent } from '../../agents/citation-generator.agent';
import { ImageQualityAssessmentAgent } from '../../agents/image-quality-assessment.agent';

export interface AgentSet {
  fileClassificationAgent: FileClassificationAgent;
  dataExtractionAgent: DataExtractionAgent;
  issueDetectionAgent: IssueDetectionAgent;
  citationGeneratorAgent: CitationGeneratorAgent;
  imageQualityAssessmentAgent: ImageQualityAssessmentAgent;
}

@Injectable()
export class AgentFactoryService {
  private readonly logger = new Logger(AgentFactoryService.name);
  private agents: AgentSet;

  constructor(private readonly configService: ConfigService) {
    this.initializeAgents();
  }

  private initializeAgents(): void {
    const provider: 'bedrock' | 'anthropic' = 'bedrock';
    this.logger.log(`Initializing agents with provider: ${provider}`);

    const defaultBedrockModel = this.configService.get<string>('BEDROCK_MODEL', 'eu.amazon.nova-pro-v1:0');
    const citationModel = this.configService.get<string>('CITATION_MODEL', 'amazon.nova-micro-v1:0');

    this.agents = {
      fileClassificationAgent: new FileClassificationAgent(provider, defaultBedrockModel),
      dataExtractionAgent: new DataExtractionAgent(provider, defaultBedrockModel),
      issueDetectionAgent: new IssueDetectionAgent(provider, defaultBedrockModel),
      citationGeneratorAgent: new CitationGeneratorAgent(provider, citationModel),
      imageQualityAssessmentAgent: new ImageQualityAssessmentAgent(provider, defaultBedrockModel),
    };

    this.logger.log('All agents initialized successfully');
  }

  getAgents(): AgentSet {
    return this.agents;
  }

  getFileClassificationAgent(): FileClassificationAgent {
    return this.agents.fileClassificationAgent;
  }

  getDataExtractionAgent(): DataExtractionAgent {
    return this.agents.dataExtractionAgent;
  }

  getIssueDetectionAgent(): IssueDetectionAgent {
    return this.agents.issueDetectionAgent;
  }

  getCitationGeneratorAgent(): CitationGeneratorAgent {
    return this.agents.citationGeneratorAgent;
  }

  getImageQualityAssessmentAgent(): ImageQualityAssessmentAgent {
    return this.agents.imageQualityAssessmentAgent;
  }
}
