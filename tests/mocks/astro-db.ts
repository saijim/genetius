// Mock implementation of astro:db for tests
import { vi } from 'vitest';

export const db = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  run: vi.fn().mockResolvedValue({ rows: [] }),
  batch: vi.fn().mockResolvedValue([]),
};

export const eq = vi.fn();
export const and = vi.fn();
export const or = vi.fn();
export const like = vi.fn();
export const desc = vi.fn();
export const asc = vi.fn();
export const inArray = vi.fn();
export const count = vi.fn();
export const isNull = vi.fn();
export const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
  toString: () => strings.join('?'),
  values,
}));
export const lt = vi.fn();

// Tables
export const papers = {
  id: 'papers.id',
  doi: 'papers.doi',
  title: 'papers.title',
  authors: 'papers.authors',
  date: 'papers.date',
  version: 'papers.version',
  type: 'papers.type',
  abstract: 'papers.abstract',
  summary: 'papers.summary',
  keywords: 'papers.keywords',
  methods: 'papers.methods',
  modelOrganism: 'papers.modelOrganism',
  markdown: 'papers.markdown',
  createdAt: 'papers.createdAt',
  updatedAt: 'papers.updatedAt',
};

export const Paper = papers; // Backward compatibility

export const refreshLogs = {
  id: 'refreshLogs.id',
  date: 'refreshLogs.date',
  intervalStart: 'refreshLogs.intervalStart',
  intervalEnd: 'refreshLogs.intervalEnd',
  papersFetched: 'refreshLogs.papersFetched',
  papersProcessed: 'refreshLogs.papersProcessed',
  status: 'refreshLogs.status',
};

export const keywordFilters = {
  keyword: 'keywordFilters.keyword',
  count: 'keywordFilters.count',
  lastUpdated: 'keywordFilters.lastUpdated',
};

export const organismFilters = {
  organism: 'organismFilters.organism',
  count: 'organismFilters.count',
  lastUpdated: 'organismFilters.lastUpdated',
};
