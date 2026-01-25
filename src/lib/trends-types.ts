export interface KeywordCount {
  keyword: string;
  count: number;
}

export interface TypeCount {
  type: string;
  count: number;
}

export interface AuthorCount {
  author: string;
  count: number;
}

export interface PeriodStats {
  totalPapers: number;
  avgAuthors: number;
}

export interface TrendResult {
  period: 'day' | 'week' | 'month' | 'year';
  keywords: KeywordCount[];
  paperTypes: TypeCount[];
  authors: AuthorCount[];
  stats: PeriodStats;
}

export interface TrendError {
  error: string;
  details?: unknown;
}

export function isTrendError(result: unknown): result is TrendError {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    typeof (result as TrendError).error === 'string'
  );
}

export function getDateInterval(
  period: 'day' | 'week' | 'month' | 'year'
): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case 'day':
      start.setHours(start.getHours() - 24);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setDate(start.getDate() - 30);
      break;
    case 'year':
      start.setDate(start.getDate() - 365);
      break;
  }

  return { start, end };
}
