import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchPapersOrchestration } from './paper-fetch';
import { fetchPapers } from '~/lib/biorxiv';
import {
  generateSummaryAndKeywords,
} from '~/lib/openrouter';
import { toMarkdown } from '~/lib/markdown';

vi.mock('~/lib/biorxiv');
vi.mock('~/lib/openrouter');

const mockSelectBuilder = {
  from: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
  then: vi.fn(),
  catch: vi.fn(),
};

const mockInsertBuilder = {
  values: vi.fn(),
};

const mockUpdateBuilder = {
  set: vi.fn(),
  where: vi.fn(),
};

vi.mock('astro:db', () => ({
  db: {
    select: vi.fn(() => mockSelectBuilder),
    insert: vi.fn(() => mockInsertBuilder),
    update: vi.fn(() => mockUpdateBuilder),
  },
  papers: { doi: 'papers_doi' },
  refreshLogs: { id: 'refreshLogs_id', date: 'refreshLogs_date' },
  desc: vi.fn((col: unknown) => ({ direction: 'desc', column: col })),
  eq: vi.fn((col: unknown, val: unknown) => ({ operator: 'eq', column: col, value: val })),
  inArray: vi.fn((col: unknown, val: unknown) => ({ operator: 'in', column: col, value: val })),
}));

describe('fetchPapersOrchestration', () => {
  const mockPapers = [
    {
      doi: '10.1101/2024.001',
      title: 'Paper 1',
      authors: ['Author 1', 'Author 2'],
      date: new Date('2024-01-01'),
      version: 1,
      type: 'Research Article',
      abstract: 'Abstract 1',
    },
    {
      doi: '10.1101/2024.002',
      title: 'Paper 2',
      authors: ['Author 3'],
      date: new Date('2024-01-02'),
      version: 1,
      type: 'Review',
      abstract: 'Abstract 2',
    },
  ];

  const mockSummaryResult = {
    summary: 'Test summary of the paper',
    keywords: ['keyword1', 'keyword2', 'keyword3'],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockSelectBuilder.from.mockReturnValue(mockSelectBuilder);
    mockSelectBuilder.orderBy.mockReturnValue(mockSelectBuilder);
    mockSelectBuilder.limit.mockReturnValue(mockSelectBuilder);
    mockSelectBuilder.where.mockReturnValue(mockSelectBuilder);

    // Mock implementation for select chains
    // When fetchPapersOrchestration starts, it calls calculateIntervalStart which calls db.select()...limit(1)
    // Then it calls createRefreshLog which calls db.insert() and then db.select()...limit(1)
    
    // We need to handle multiple calls to limit() potentially returning different things
    // 1. calculateIntervalStart -> returns [] (empty means use default 7 days ago) or [{ date: ... }]
    // 2. createRefreshLog -> returns [{ id: 123 }] (the newly created log)

    let callCount = 0;
    
    // Helper to create a promise-like object that fits the builder pattern
    const createPromise = (resolveValue: any) => {
      const promise = Promise.resolve(resolveValue);
      return {
        from: mockSelectBuilder.from,
        orderBy: mockSelectBuilder.orderBy,
        limit: mockSelectBuilder.limit,
        where: mockSelectBuilder.where,
        then: (fn: (value: any) => any) => promise.then(fn),
        catch: (fn: (error: any) => any) => promise.catch(fn),
        [Symbol.iterator]: function* () { yield* resolveValue; } // Make it iterable if needed
      };
    };

    mockSelectBuilder.limit.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
             // For calculateIntervalStart: return empty array to trigger default logic
             return createPromise([]);
        } else if (callCount === 2) {
             // For createRefreshLog: return the new log
             return createPromise([{ id: 123, date: new Date() }]);
        }
        return createPromise([]);
    });
    
    // Default fallback for other selects (like getExistingDoisFromBatch)
    mockSelectBuilder.where.mockImplementation(() => {
         return createPromise([]); 
    });

    mockInsertBuilder.values.mockReturnValue({
      then: (fn: (value: unknown) => unknown) => Promise.resolve({ rows: [] }).then(fn),
      catch: (fn: (error: unknown) => unknown) => Promise.resolve({ rows: [] }).catch(fn),
    });

    mockUpdateBuilder.where.mockReturnValue({
      then: (fn: (value: unknown) => unknown) => Promise.resolve({ rows: [] }).then(fn),
      catch: (fn: (error: unknown) => unknown) => Promise.resolve({ rows: [] }).catch(fn),
    });
    mockUpdateBuilder.set.mockReturnValue(mockUpdateBuilder);
    // Mock isBiorxivError to return true if 'error' property exists
    // This is needed because the auto-mock returns undefined by default
    const { isBiorxivError } = await import('~/lib/biorxiv');
    vi.mocked(isBiorxivError).mockImplementation((res: any) => !!res.error);
    });

  it('should handle BioRxiv API errors', async () => {
    vi.mocked(fetchPapers).mockResolvedValue({
      error: 'BioRxiv API error: 500 Internal Server Error',
    } as any);

    const result = await fetchPapersOrchestration();

    expect(result).toBeInstanceOf(Error);
    expect(result).toHaveProperty('message', 'BioRxiv API error: 500 Internal Server Error');
  });

  it('should handle empty results from BioRxiv', async () => {
    vi.mocked(fetchPapers).mockResolvedValue({
      papers: [],
      total: 0,
    });

    vi.mocked(generateSummaryAndKeywords).mockResolvedValue(mockSummaryResult);

    const result = await fetchPapersOrchestration();

    expect(result).not.toBeInstanceOf(Error);
    if (result && !(result instanceof Error)) {
      expect(result.fetched).toBe(0);
      expect(result.processed).toBe(0);
    }
  });

  it('should generate markdown with correct format', async () => {
    const markdown = toMarkdown({
      title: mockPapers[0].title,
      authors: mockPapers[0].authors,
      date: mockPapers[0].date.toISOString(),
      version: mockPapers[0].version,
      doi: mockPapers[0].doi,
      category: 'plant_biology',
      abstract: mockPapers[0].abstract,
      summary: mockSummaryResult.summary,
      keywords: mockSummaryResult.keywords,
    });

    expect(markdown).toContain(`# ${mockPapers[0].title}`);
    expect(markdown).toContain('**Authors:**');
    expect(markdown).toContain('**Date:**');
    expect(markdown).toContain('**Version:**');
    expect(markdown).toContain('**DOI:**');
    expect(markdown).toContain('## Abstract');
    expect(markdown).toContain('## AI Summary');
    expect(markdown).toContain('## Keywords');
  });
});
