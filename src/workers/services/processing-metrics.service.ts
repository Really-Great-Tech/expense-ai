import { Injectable, Logger } from '@nestjs/common';

export interface PhaseMetrics {
  start_time: string;
  end_time: string;
  duration_seconds: string;
  model_used?: string;
  execution_mode?: string;
  [key: string]: any;
}

export interface ProcessingTiming {
  phase_timings: {
    [key: string]: string;
  };
  agent_performance: {
    [key: string]: PhaseMetrics;
  };
  total_processing_time_seconds: string;
  performance_metrics?: {
    parallel_group_1_seconds?: string;
    parallel_group_2_seconds?: string;
    total_parallel_time_seconds?: string;
  };
}

@Injectable()
export class ProcessingMetricsService {
  private readonly logger = new Logger(ProcessingMetricsService.name);

  createTimingObject(markdownExtractionInfo?: { markdownExtractionTime: number; documentReader: string }): {
    timing: ProcessingTiming;
    trueStartTime: number;
  } {
    const trueStartTime = markdownExtractionInfo ? Date.now() - markdownExtractionInfo.markdownExtractionTime : Date.now();

    const timing: ProcessingTiming = {
      phase_timings: {},
      agent_performance: {},
      total_processing_time_seconds: '0.0',
    };

    if (markdownExtractionInfo) {
      timing.phase_timings.markdown_extraction_seconds = (markdownExtractionInfo.markdownExtractionTime / 1000).toFixed(1);
      timing.agent_performance.markdown_extraction = {
        start_time: new Date(trueStartTime).toISOString(),
        end_time: new Date(Date.now()).toISOString(),
        duration_seconds: (markdownExtractionInfo.markdownExtractionTime / 1000).toFixed(1),
        document_reader_used: markdownExtractionInfo.documentReader,
      };
    }

    return { timing, trueStartTime };
  }

  recordPhase(
    timing: ProcessingTiming,
    phaseName: string,
    startTime: number,
    endTime: number,
    additionalMetrics?: Partial<PhaseMetrics>,
  ): void {
    const duration = (endTime - startTime) / 1000;
    timing.phase_timings[`${phaseName}_seconds`] = duration.toFixed(1);
    timing.agent_performance[phaseName] = {
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      duration_seconds: duration.toFixed(1),
      execution_mode: 'parallel',
      ...additionalMetrics,
    };
  }

  addParallelGroupMetrics(timing: ProcessingTiming, group1Duration: number, group2Duration: number): void {
    timing.performance_metrics = {
      parallel_group_1_seconds: group1Duration.toFixed(1),
      parallel_group_2_seconds: group2Duration.toFixed(1),
      total_parallel_time_seconds: (group1Duration + group2Duration).toFixed(1),
    };
  }

  finalizeTiming(timing: ProcessingTiming, trueStartTime: number): void {
    const processingTime = Date.now() - trueStartTime;
    timing.total_processing_time_seconds = (processingTime / 1000).toFixed(1);
  }

  validateTimingConsistency(timing: ProcessingTiming, group1Duration?: number, group2Duration?: number): void {
    try {
      const totalTime: number = parseFloat(timing.total_processing_time_seconds || '0');

      if (group1Duration !== undefined && group2Duration !== undefined) {
        // Parallel processing validation
        this.logger.log(`Parallel processing completed in ${totalTime.toFixed(1)}s`);
      } else {
        // Sequential processing validation (if needed in future)
        const phaseTimings = timing.phase_timings || {};
        const phaseSum: number = Object.values(phaseTimings)
          .filter((time): time is string => time !== undefined && time !== null && typeof time === 'string')
          .reduce((sum: number, time: string) => sum + parseFloat(time), 0);

        const tolerance = 3.0;
        const difference = Math.abs(totalTime - phaseSum);

        if (difference > tolerance) {
          this.logger.warn(
            `Timing inconsistency detected: Total time (${totalTime.toFixed(1)}s) vs Phase sum (${phaseSum.toFixed(1)}s). Difference: ${difference.toFixed(1)}s`,
          );
        } else {
          this.logger.log(`Timing validation passed: Total time matches phase sum within tolerance`);
        }
      }
    } catch (error) {
      this.logger.error('Error validating timing consistency:', error);
    }
  }
}
