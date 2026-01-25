import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateSummaryAndKeywords,
  isOpenRouterError,
  type OpenRouterError,
  type PaperAnalysis,
} from '~/lib/openrouter';

describe('generateSummaryAndKeywords', () => {
  beforeEach(() => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    global.fetch = vi.fn();
  });

  it('should generate summary and keywords with valid input', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: 'This is a summary of the plant biology research.',
                    keywords: ['genetics', 'photosynthesis', 'plant growth'],
                  }),
                },
              },
            ],
          }),
      } as Response)
    );

    const result = await generateSummaryAndKeywords('This is an abstract about plant genetics.');
    expect(isOpenRouterError(result)).toBe(false);
    expect(result).toEqual({
      summary: 'This is a summary of the plant biology research.',
      keywords: ['genetics', 'photosynthesis', 'plant growth'],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should return error when OPENROUTER_API_KEY is not set', async () => {
    vi.unstubAllEnvs();

    const result = await generateSummaryAndKeywords('test abstract');
    expect(isOpenRouterError(result)).toBe(true);
    expect((result as OpenRouterError).error).toBe('OPENROUTER_API_KEY not set');
  });

  it('should return error when API returns non-200 status', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response)
    );

    const result = await generateSummaryAndKeywords('test abstract');
    expect(isOpenRouterError(result)).toBe(true);
    expect((result as OpenRouterError).error).toContain('OpenRouter API error: 500');
  });

  it('should return error when no content returned from API', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ choices: [] }),
      } as Response)
    );

    const result = await generateSummaryAndKeywords('test abstract');
    expect(isOpenRouterError(result)).toBe(true);
    expect((result as OpenRouterError).error).toBe('No response returned from API');
  });

  it('should return error when JSON is invalid', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: 'not valid json',
                },
              },
            ],
          }),
      } as Response)
    );

    const result = await generateSummaryAndKeywords('test abstract');
    expect(isOpenRouterError(result)).toBe(true);
    expect((result as OpenRouterError).error).toBe('Invalid JSON returned from API');
  });

  it('should return error when JSON structure is invalid (missing summary)', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({ keywords: ['test'] }),
                },
              },
            ],
          }),
      } as Response)
    );

    const result = await generateSummaryAndKeywords('test abstract');
    expect(isOpenRouterError(result)).toBe(true);
    expect((result as OpenRouterError).error).toBe('Invalid JSON structure returned from API');
  });

  it('should return error when JSON structure is invalid (missing keywords)', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({ summary: 'test' }),
                },
              },
            ],
          }),
      } as Response)
    );

    const result = await generateSummaryAndKeywords('test abstract');
    expect(isOpenRouterError(result)).toBe(true);
    expect((result as OpenRouterError).error).toBe('Invalid JSON structure returned from API');
  });

  it('should return error when keywords contains non-string values', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({ summary: 'test', keywords: ['valid', 123, null] }),
                },
              },
            ],
          }),
      } as Response)
    );

    const result = await generateSummaryAndKeywords('test abstract');
    expect(isOpenRouterError(result)).toBe(true);
    expect((result as OpenRouterError).error).toBe('Invalid JSON structure returned from API');
  });

  it('should trim whitespace from summary and keywords', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: '  Summary with spaces  ',
                    keywords: ['  genetics  ', '  photosynthesis  ', '  plant growth  '],
                  }),
                },
              },
            ],
          }),
      } as Response)
    );

    const result = await generateSummaryAndKeywords('test abstract');
    expect(isOpenRouterError(result)).toBe(false);
    expect(result).toEqual({
      summary: 'Summary with spaces',
      keywords: ['genetics', 'photosynthesis', 'plant growth'],
    });
  });

  it('should filter empty keywords', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: 'test summary',
                    keywords: ['genetics', '', '   ', 'photosynthesis'],
                  }),
                },
              },
            ],
          }),
      } as Response)
    );

    const result = await generateSummaryAndKeywords('test abstract');
    expect(isOpenRouterError(result)).toBe(false);
    expect(result).toEqual({
      summary: 'test summary',
      keywords: ['genetics', 'photosynthesis'],
    });
  });

  it('should limit to 5 keywords', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: 'test summary',
                    keywords: [
                      'genetics',
                      'photosynthesis',
                      'plant growth',
                      'biochemistry',
                      'molecular biology',
                      'ecology',
                    ],
                  }),
                },
              },
            ],
          }),
      } as Response)
    );

    const result = await generateSummaryAndKeywords('test abstract');
    expect(isOpenRouterError(result)).toBe(false);
    expect(result).toEqual({
      summary: 'test summary',
      keywords: ['genetics', 'photosynthesis', 'plant growth', 'biochemistry', 'molecular biology'],
    });
  });

  it('should return error when fetch throws exception', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const result = await generateSummaryAndKeywords('test abstract');
    expect(isOpenRouterError(result)).toBe(true);
    expect((result as OpenRouterError).error).toBe('Failed to generate paper analysis');
    expect((result as OpenRouterError).details).toBeDefined();
  });
});

describe('isOpenRouterError', () => {
  it('should return true for valid error object', () => {
    const error: OpenRouterError = { error: 'Test error' };
    expect(isOpenRouterError(error)).toBe(true);
  });

  it('should return true for error with details', () => {
    const error: OpenRouterError = { error: 'Test error', details: { foo: 'bar' } };
    expect(isOpenRouterError(error)).toBe(true);
  });

  it('should return false for PaperAnalysis', () => {
    const analysis: PaperAnalysis = { summary: 'test', keywords: ['test'] };
    expect(isOpenRouterError(analysis)).toBe(false);
  });

  it('should return false for string', () => {
    expect(isOpenRouterError('not an error')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isOpenRouterError(null)).toBe(false);
  });

  it('should return false for object without error property', () => {
    expect(isOpenRouterError({ foo: 'bar' })).toBe(false);
  });

  it('should return false for object with non-string error property', () => {
    expect(isOpenRouterError({ error: 123 })).toBe(false);
  });
});

describe('rate limiting', () => {
  beforeEach(() => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    global.fetch = vi.fn();
  });

  it('should enforce 1s delay between calls', async () => {
    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: 'test response',
                    keywords: ['test'],
                  }),
                },
              },
            ],
          }),
      } as Response);
    });

    const promise1 = generateSummaryAndKeywords('test abstract 1');
    await vi.runAllTimersAsync();

    const promise2 = generateSummaryAndKeywords('test abstract 2');
    await vi.runAllTimersAsync();

    const promise3 = generateSummaryAndKeywords('test abstract 3');
    await vi.runAllTimersAsync();

    await Promise.all([promise1, promise2, promise3]);

    expect(callCount).toBe(3);
  });
});

describe('retry logic', () => {
  beforeEach(() => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    global.fetch = vi.fn();
  });

  it('should return error after max retries', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'Retry-After': '0' }),
      } as Response)
    );

    const result = await generateSummaryAndKeywords('test abstract');

    expect(isOpenRouterError(result)).toBe(true);
    expect((result as OpenRouterError).error).toContain('OpenRouter API error: 429');
  });
});
