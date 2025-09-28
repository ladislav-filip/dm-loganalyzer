import React, { useState, useCallback, useMemo } from 'react';
import type { AnalysisResult } from './types';

// --- SVG Icons (defined as components for reusability) ---

const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const FileIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
);

const ErrorIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const ClockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const IntervalIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const PeakTimeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
);


const Spinner = () => (
  <div className="flex justify-center items-center p-8">
    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-400"></div>
    <span className="ml-4 text-slate-300">Analyzing logs...</span>
  </div>
);

// --- Helper Components & Functions ---

interface ResultCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  colorClass: string;
}
const ResultCard: React.FC<ResultCardProps> = ({ icon, title, value, subtitle, colorClass }) => {
  return (
    <div className={`bg-slate-800 p-6 rounded-lg flex items-center space-x-4 border-l-4 ${colorClass}`}>
      <div className="text-3xl">{icon}</div>
      <div>
        <p className="text-slate-400 text-sm">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {subtitle && <p className="text-slate-500 text-xs mt-1 font-mono">{subtitle}</p>}
      </div>
    </div>
  );
};

const formatBytes = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const formatDateTime = (date: Date | string | null): string => {
    if (!date) return 'N/A';
    // The log format is 'YYYY-MM-DD HH:mm:ss,SSS'. Replace comma for Date constructor.
    const d = typeof date === 'string' ? new Date(date.replace(',', '.')) : date;
    if (isNaN(d.getTime())) return 'Invalid Date';

    const pad = (num: number) => num.toString().padStart(2, '0');

    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1); // Month is 0-indexed
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());

    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
};

// --- Chart Component ---
interface LineChartProps {
    data: Array<{ timestamp: Date; value: number }>;
    className?: string;
    yAxisLabel: string;
    color: string;
    unit: string;
    gradientId: string;
}
const LineChart: React.FC<LineChartProps> = ({ data, className, yAxisLabel, color, unit, gradientId }) => {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; timestamp: Date; value: number } | null>(null);

    const chartParams = useMemo(() => {
        const width = 800;
        const height = 400;
        const margin = { top: 20, right: 20, bottom: 70, left: 60 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        if (data.length === 0) {
            return { width, height, margin, innerWidth, innerHeight, linePath: '', areaPath: '', yTicks: [], xTicks: [] };
        }

        const xMin = data[0].timestamp.getTime();
        const xMax = data[data.length - 1].timestamp.getTime();
        const yMax = Math.max(...data.map(d => d.value), 0);
        const yMin = 0;

        const xScale = (time: number) => ((time - xMin) / (xMax - xMin)) * innerWidth;
        const yScale = (value: number) => innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight;
        
        const linePath = data.map(d => `${xScale(d.timestamp.getTime())},${yScale(d.value)}`).join(' L ');
        const areaPath = `M ${xScale(xMin)},${innerHeight} L ${linePath} L ${xScale(xMax)},${innerHeight} Z`;
        
        const yTicks = Array.from({ length: 5 }, (_, i) => {
            const value = yMin + (i * (yMax - yMin)) / 4;
            return { value: parseFloat(value.toFixed(1)), y: yScale(value) };
        });

        const xTicks = [data[0], data[Math.floor(data.length / 2)], data[data.length - 1]].map(d => ({
            value: d.timestamp,
            x: xScale(d.timestamp.getTime())
        }));

        return { width, height, margin, innerWidth, innerHeight, xScale, yScale, linePath, areaPath, yTicks, xTicks };
    }, [data]);

    const handleMouseMove = (event: React.MouseEvent<SVGRectElement>) => {
        if (!chartParams.xScale) return;
        const { margin, innerWidth, xScale, yScale } = chartParams;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const svgX = (x / rect.width) * innerWidth;

        let closestPoint = data[0];
        let minDistance = Infinity;
        for (const point of data) {
            const pointX = xScale(point.timestamp.getTime());
            const distance = Math.abs(svgX - pointX);
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
            }
        }
        setTooltip({
            x: xScale(closestPoint.timestamp.getTime()),
            y: yScale(closestPoint.value),
            timestamp: closestPoint.timestamp,
            value: closestPoint.value,
        });
    };

    const handleMouseLeave = () => {
        setTooltip(null);
    };

    const formatTimeForAxis = (date: Date) => date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (data.length < 2) {
        return <div className="text-center text-slate-500 p-8">Not enough data to display chart.</div>
    }

    return (
        <div className={className}>
            <svg viewBox={`0 0 ${chartParams.width} ${chartParams.height}`} className="w-full h-auto">
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <g transform={`translate(${chartParams.margin.left}, ${chartParams.margin.top})`}>
                    {/* Grid lines */}
                    {chartParams.yTicks.map(({ y, value }) => (
                         <g key={`grid-${value}`} className="text-slate-600">
                            <line x1={0} x2={chartParams.innerWidth} y1={y} y2={y} stroke="currentColor" strokeDasharray="2,3" />
                        </g>
                    ))}

                    {/* Axes */}
                    <line x1="0" y1="0" x2="0" y2={chartParams.innerHeight} stroke="#475569" />
                    <line x1="0" y1={chartParams.innerHeight} x2={chartParams.innerWidth} y2={chartParams.innerHeight} stroke="#475569" />
                    
                    {/* Y-axis labels */}
                    {chartParams.yTicks.map(({ y, value }) => (
                        <text key={`label-y-${value}`} x={-10} y={y} textAnchor="end" dominantBaseline="middle" fill="#94a3b8" fontSize="12">{value}</text>
                    ))}
                    <text transform={`translate(-45, ${chartParams.innerHeight / 2}) rotate(-90)`} textAnchor="middle" fill="#94a3b8" fontSize="14">{yAxisLabel}</text>

                    {/* X-axis labels */}
                    {chartParams.xTicks.map(({ x, value }) => (
                         <text key={`label-x-${value.getTime()}`} x={x} y={chartParams.innerHeight + 20} textAnchor="middle" fill="#94a3b8" fontSize="12">{formatTimeForAxis(value)}</text>
                    ))}
                    <text x={chartParams.innerWidth / 2} y={chartParams.innerHeight + 50} textAnchor="middle" fill="#94a3b8" fontSize="14">Time</text>

                    {/* Data paths */}
                    <path d={chartParams.areaPath} fill={`url(#${gradientId})`} />
                    <path d={`M ${chartParams.linePath}`} fill="none" stroke={color} strokeWidth={2} />

                    {/* Tooltip */}
                    <rect width={chartParams.innerWidth} height={chartParams.innerHeight} fill="transparent" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} />
                    {tooltip && chartParams.xScale && (
                        <g>
                            <line x1={tooltip.x} y1={0} x2={tooltip.x} y2={chartParams.innerHeight} stroke="#f8fafc" strokeDasharray="3,3" strokeOpacity="0.5" />
                            <circle cx={tooltip.x} cy={tooltip.y} r="5" fill={color} stroke="white" strokeWidth="2" />
                            <g transform={`translate(${tooltip.x + 10}, ${tooltip.y - 10})`}>
                                <rect x="-5" y="-22" width="150" height="40" fill="#1e293b" stroke="#334155" rx="4" />
                                <text x="70" y="-5" textAnchor="middle" fill="#cbd5e1" fontSize="12">{`${tooltip.value} ${unit}`}</text>
                                <text x="70" y="12" textAnchor="middle" fill="#94a3b8" fontSize="10" className="font-mono">{formatDateTime(tooltip.timestamp)}</text>
                            </g>
                        </g>
                    )}
                </g>
            </svg>
        </div>
    );
};


// --- Main App Component ---

const App = () => {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState<number>(Date.now()); // Used to reset the file input

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsLoading(true);
    setAnalysisResult(null);
    setError(null);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (typeof content !== 'string') {
          throw new Error("Failed to read file content.");
        }
        
        const lines = content.split('\n');
        let errorCount = 0;
        let sentDataCount = 0;
        let totalElapsedTime = 0;
        let elapsedTimeCount = 0;
        let maxElapsedTime = -1;
        let maxElapsedTimeTimestamp: string | null = null;
        let firstLogTimestamp: string | null = null;
        let lastLogTimestamp: string | null = null;
        const sentDataTimestamps: Date[] = [];
        const elapsedTimeData: Array<{ timestamp: Date; value: number }> = [];
        const intervalData: Array<{ timestamp: Date; value: number }> = [];
        const errorPattern = "] ERROR";
        const sentDataPattern = "INFO  Sent data to: WMS_SNIMACLOG";
        const elapsedTimeRegex = /Elapsed time: (\d+) ms/;
        const timestampRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}/;

        for (const line of lines) {
            const timestampMatch = line.match(timestampRegex);
            if (timestampMatch) {
                const currentTimestamp = timestampMatch[0];
                if (!firstLogTimestamp) {
                    firstLogTimestamp = currentTimestamp;
                }
                lastLogTimestamp = currentTimestamp;
            }

            if (line.includes(errorPattern)) {
                errorCount++;
            }

            if (line.includes(sentDataPattern)) {
                sentDataCount++;
            
                const timestampStr = line.substring(0, 23).replace(',', '.');
                const timestamp = new Date(timestampStr);
                if (!isNaN(timestamp.getTime())) {
                    sentDataTimestamps.push(timestamp);
                }

                const match = line.match(elapsedTimeRegex);
                if (match && match[1]) {
                    const currentElapsedTime = parseInt(match[1], 10);
                    totalElapsedTime += currentElapsedTime;
                    elapsedTimeCount++;

                    if (timestamp && !isNaN(timestamp.getTime())) {
                        elapsedTimeData.push({ timestamp, value: currentElapsedTime });
                    }

                    if (currentElapsedTime > maxElapsedTime) {
                        maxElapsedTime = currentElapsedTime;
                        maxElapsedTimeTimestamp = line.substring(0, 23);
                    }
                }
            }
        }

        const averageElapsedTime = elapsedTimeCount > 0 ? Math.round(totalElapsedTime / elapsedTimeCount) : 0;
        
        let averageInterval = 0;
        if (sentDataTimestamps.length > 1) {
            let totalIntervalSeconds = 0;
            for (let i = 1; i < sentDataTimestamps.length; i++) {
                const intervalMs = sentDataTimestamps[i].getTime() - sentDataTimestamps[i-1].getTime();
                totalIntervalSeconds += intervalMs / 1000;
                intervalData.push({
                    timestamp: sentDataTimestamps[i],
                    value: parseFloat((intervalMs / 1000).toFixed(2))
                });
            }
            averageInterval = totalIntervalSeconds / (sentDataTimestamps.length - 1);
        }

        let processedIntervalData = intervalData;
        // Remove the highest peak if there are enough data points to still draw a meaningful chart
        if (processedIntervalData.length > 2) { 
            const maxIntervalValue = Math.max(...processedIntervalData.map(d => d.value));
            const peakIndex = processedIntervalData.findIndex(d => d.value === maxIntervalValue);
            
            if (peakIndex > -1) {
                // Filter out the first occurrence of the highest peak
                processedIntervalData = processedIntervalData.filter((_, index) => index !== peakIndex);
            }
        }

        setAnalysisResult({
          fileName: file.name,
          fileSize: file.size,
          errorCount,
          sentDataCount,
          averageElapsedTime,
          averageInterval,
          maxElapsedTime: maxElapsedTime === -1 ? 0 : maxElapsedTime,
          maxElapsedTimeTimestamp,
          elapsedTimeData,
          intervalData: processedIntervalData,
          firstLogTimestamp,
          lastLogTimestamp,
        });

      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred during parsing.");
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setError("Failed to read the file. Please check file permissions and try again.");
      setIsLoading(false);
    };

    reader.readAsText(file);
  }, []);
  
  const handleReset = useCallback(() => {
    setAnalysisResult(null);
    setError(null);
    setIsLoading(false);
    setFileKey(Date.now());
  }, []);

  return (
    <main className="bg-slate-900 text-white min-h-screen p-4 sm:p-8 flex flex-col items-center antialiased">
      <div className="w-full max-w-5xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
            Log Analyzer
          </h1>
          <p className="text-slate-400 mt-2 max-w-2xl mx-auto">
            Upload your log file to quickly count ERROR entries and "Sent data to: WMS_SNIMACLOG" messages.
          </p>
        </header>

        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="border-2 border-dashed border-slate-600 hover:border-cyan-400 transition-colors duration-300 rounded-lg p-8 text-center bg-slate-800/50">
            <div className="flex flex-col items-center">
              <UploadIcon />
              <p className="mt-2 text-lg font-semibold text-slate-300">
                <span className="text-cyan-400">Click to upload</span> or drag and drop
              </p>
              <p className="text-sm text-slate-500">Select any .log or .txt file</p>
            </div>
          </div>
          <input 
            id="file-upload"
            key={fileKey}
            type="file" 
            className="hidden" 
            onChange={handleFileChange}
            accept=".log,.txt,text/plain"
          />
        </label>
        
        <div className="mt-8 min-h-[250px]">
          {isLoading && <Spinner />}

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {analysisResult && (
            <div className="animate-fade-in">
              <div className="bg-slate-800 rounded-lg p-4 mb-6 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-3">
                    <FileIcon/>
                    <div>
                        <h2 className="font-semibold text-white">{analysisResult.fileName}</h2>
                        <p className="text-sm text-slate-400">{formatBytes(analysisResult.fileSize)}</p>
                    </div>
                </div>
                <button 
                  onClick={handleReset}
                  className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 text-sm">
                  Analyze Another File
                </button>
              </div>

              {analysisResult.firstLogTimestamp && analysisResult.lastLogTimestamp && (
                  <div className="bg-slate-800/50 rounded-lg p-4 mb-6 text-center ring-1 ring-slate-700">
                      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Log Period</h3>
                      <p className="font-mono text-base text-slate-200 flex items-center justify-center flex-wrap gap-x-4 gap-y-1">
                          <span>{formatDateTime(analysisResult.firstLogTimestamp)}</span>
                          <span className="text-cyan-400 font-sans">&rarr;</span>
                          <span>{formatDateTime(analysisResult.lastLogTimestamp)}</span>
                      </p>
                  </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <ResultCard 
                  icon={<ErrorIcon />}
                  title="Total ERROR records"
                  value={analysisResult.errorCount}
                  colorClass="border-red-500"
                />
                <ResultCard 
                  icon={<InfoIcon />}
                  title="'Sent data to: ...'"
                  value={analysisResult.sentDataCount}
                  colorClass="border-sky-500"
                />
                <ResultCard 
                  icon={<ClockIcon />}
                  title="Avg. Elapsed Time"
                  value={`${analysisResult.averageElapsedTime} ms`}
                  colorClass="border-amber-500"
                />
                 <ResultCard 
                  icon={<IntervalIcon />}
                  title="Avg. Interval"
                  value={`${analysisResult.averageInterval.toFixed(2)} s`}
                  colorClass="border-green-500"
                />
                <ResultCard
                  icon={<PeakTimeIcon />}
                  title="Peak Elapsed Time"
                  value={`${analysisResult.maxElapsedTime} ms`}
                  subtitle={formatDateTime(analysisResult.maxElapsedTimeTimestamp)}
                  colorClass="border-purple-500"
                />
              </div>

              <div className="mt-8 space-y-8">
                {analysisResult.elapsedTimeData.length > 1 && (
                    <div className="bg-slate-800/50 rounded-lg p-4 sm:p-6 ring-1 ring-slate-700">
                      <h3 className="text-xl font-bold text-white mb-4 text-center sm:text-left">
                        Elapsed Time Over Time
                      </h3>
                      <LineChart 
                        data={analysisResult.elapsedTimeData}
                        yAxisLabel="Elapsed Time (ms)"
                        color="#06b6d4"
                        unit="ms"
                        gradientId="elapsedTimeGradient"
                      />
                    </div>
                )}
                {analysisResult.intervalData.length > 1 && (
                    <div className="bg-slate-800/50 rounded-lg p-4 sm:p-6 ring-1 ring-slate-700">
                      <h3 className="text-xl font-bold text-white mb-4 text-center sm:text-left">
                        Data Send Interval Over Time
                      </h3>
                      <LineChart 
                        data={analysisResult.intervalData}
                        yAxisLabel="Interval (s)"
                        color="#22c55e"
                        unit="s"
                        gradientId="intervalGradient"
                      />
                    </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default App;
