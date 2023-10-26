
export function exponentialMovingAverage(current: number, avg: number | undefined, window: number): number {
  return (current + (avg || 0) * (window - 1)) / window;
}
