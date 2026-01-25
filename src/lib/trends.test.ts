import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDateInterval,
  isTrendError,
  type TrendResult,
  type TrendError,
  type KeywordCount,
  type TypeCount,
} from '~/lib/trends-types';

describe('trends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isTrendError', () => {
    it('should return true for valid TrendError objects', () => {
      const error: TrendError = { error: 'Test error' };
      expect(isTrendError(error)).toBe(true);
    });

    it('should return true for TrendError with details', () => {
      const error: TrendError = { error: 'Test error', details: 'Additional info' };
      expect(isTrendError(error)).toBe(true);
    });

    it('should return false for non-error objects', () => {
      const result: TrendResult = {
        period: 'day',
        keywords: [{ keyword: 'test', count: 1 }],
        paperTypes: [{ type: 'article', count: 1 }],
        authors: [],
        organisms: [],
        stats: { totalPapers: 0, avgAuthors: 0 },
      };
      expect(isTrendError(result)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isTrendError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isTrendError(undefined)).toBe(false);
    });

    it('should return false for plain objects without error field', () => {
      expect(isTrendError({})).toBe(false);
    });

    it('should return false for objects with non-string error field', () => {
      expect(isTrendError({ error: 123 })).toBe(false);
    });
  });

  describe('getDateInterval', () => {
    it('should calculate 24-hour interval for day period', () => {
      const { start, end } = getDateInterval('day');
      const diffMs = end.getTime() - start.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      expect(diffHours).toBeGreaterThanOrEqual(24);
      expect(diffHours).toBeLessThanOrEqual(25);
    });

    it('should calculate 7-day interval for week period', () => {
      const { start, end } = getDateInterval('week');
      const diffMs = end.getTime() - start.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeGreaterThanOrEqual(7);
      expect(diffDays).toBeLessThanOrEqual(8);
    });

    it('should calculate 30-day interval for month period', () => {
      const { start, end } = getDateInterval('month');
      const diffMs = end.getTime() - start.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeGreaterThanOrEqual(30);
      expect(diffDays).toBeLessThanOrEqual(31);
    });

    it('should calculate 365-day interval for year period', () => {
      const { start, end } = getDateInterval('year');
      const diffMs = end.getTime() - start.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeGreaterThanOrEqual(365);
      expect(diffDays).toBeLessThanOrEqual(366);
    });

    it('should return end date that is now or close to now', () => {
      const { end } = getDateInterval('day');
      const now = new Date();
      const diffMs = Math.abs(now.getTime() - end.getTime());

      expect(diffMs).toBeLessThan(1000);
    });

    it('should return start date before end date', () => {
      const { start, end } = getDateInterval('week');

      expect(start.getTime()).toBeLessThan(end.getTime());
    });
  });

  describe('data structures', () => {
    it('should have correct KeywordCount interface', () => {
      const keywordCount: KeywordCount = {
        keyword: 'test',
        count: 5,
      };

      expect(keywordCount.keyword).toBe('test');
      expect(keywordCount.count).toBe(5);
    });

    it('should have correct TypeCount interface', () => {
      const typeCount: TypeCount = {
        type: 'article',
        count: 10,
      };

      expect(typeCount.type).toBe('article');
      expect(typeCount.count).toBe(10);
    });

    it('should have correct TrendResult interface', () => {
      const trendResult: TrendResult = {
        period: 'day',
        keywords: [{ keyword: 'test', count: 1 }],
        paperTypes: [{ type: 'article', count: 1 }],
        authors: [{ author: 'Smith', count: 1 }],
        organisms: [{ organism: 'Arabidopsis', count: 5 }],
        stats: { totalPapers: 10, avgAuthors: 2.5 },
      };

      expect(trendResult.period).toBe('day');
      expect(trendResult.keywords).toHaveLength(1);
      expect(trendResult.paperTypes).toHaveLength(1);
      expect(trendResult.authors).toHaveLength(1);
      expect(trendResult.organisms).toHaveLength(1);
      expect(trendResult.stats.totalPapers).toBe(10);
    });

    it('should support all valid period types', () => {
      const periods: Array<'day' | 'week' | 'month' | 'year'> = [
        'day',
        'week',
        'month',
        'year',
      ];

      for (const period of periods) {
        const trendResult: TrendResult = {
          period,
          keywords: [],
          paperTypes: [],
          authors: [],
          organisms: [],
          stats: { totalPapers: 0, avgAuthors: 0 },
        };

        expect(['day', 'week', 'month', 'year']).toContain(trendResult.period);
      }
    });
  });
});
