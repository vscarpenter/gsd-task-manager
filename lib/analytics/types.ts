/** Statistics for a specific task tag. */
export interface TagStatistic {
  tag: string;
  count: number;
  completedCount: number;
  completionRate: number;
}
