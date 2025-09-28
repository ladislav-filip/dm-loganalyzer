export interface AnalysisResult {
  fileName: string;
  fileSize: number;
  errorCount: number;
  sentDataCount: number;
  averageElapsedTime: number;
  averageInterval: number;
  maxElapsedTime: number;
  maxElapsedTimeTimestamp: string | null;
  elapsedTimeData: Array<{ timestamp: Date; value: number }>;
  intervalData: Array<{ timestamp: Date; value: number }>;
  firstLogTimestamp: string | null;
  lastLogTimestamp: string | null;
}
