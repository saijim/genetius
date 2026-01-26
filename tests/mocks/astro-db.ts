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
};

export const eq = vi.fn();
export const and = vi.fn();
export const or = vi.fn();
export const like = vi.fn();
export const desc = vi.fn();
export const asc = vi.fn();

// Tables
export const Paper = {
  id: 'Paper.id',
  sourceId: 'Paper.sourceId',
};

export const refreshLogs = {
  status: 'refreshLogs.status',
};
