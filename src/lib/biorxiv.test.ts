import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchPapers, isBiorxivError, type BiorxivError } from './biorxiv';

describe('fetchPapers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should fetch papers successfully with valid response', async () => {
    const mockResponse = {
      messages: [
        {
          status: 'ok',
          category: 'plant biology',
          interval: '2024-12-01:2024-12-02',
          cursor: 0,
          count: 2,
          count_new_papers: '2',
          total: '2',
        },
      ],
      collection: [
        {
          doi: '10.1101/2024.12.01.123456',
          title: 'Test Paper 1',
          authors: 'Smith, J.; Doe, J.',
          date: '2024-12-01',
          version: '1',
          type: 'new results',
          abstract: 'This is an abstract for test paper 1.',
        },
        {
          doi: '10.1101/2024.12.01.789012',
          title: 'Test Paper 2',
          authors: 'Johnson, A.; Williams, B.',
          date: '2024-12-01',
          version: '2',
          type: 'rescinded',
          abstract: 'This is an abstract for test paper 2.',
        },
      ],
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      text: async () => '',
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: () => null as unknown as Response,
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
    } as unknown as Response);

    const result = await fetchPapers({
      intervalStart: new Date('2024-12-01'),
      intervalEnd: new Date('2024-12-02'),
    });

    if (isBiorxivError(result)) {
      expect.fail('Expected successful result but got error');
    }

    expect(result.papers).toHaveLength(2);
    expect(result.total).toBe(2);

    expect(result.papers[0]).toEqual({
      doi: '10.1101/2024.12.01.123456',
      title: 'Test Paper 1',
      authors: ['Smith, J.', 'Doe, J.'],
      date: new Date('2024-12-01'),
      version: 1,
      type: 'new results',
      abstract: 'This is an abstract for test paper 1.',
    });

    expect(result.papers[1]).toEqual({
      doi: '10.1101/2024.12.01.789012',
      title: 'Test Paper 2',
      authors: ['Johnson, A.', 'Williams, B.'],
      date: new Date('2024-12-01'),
      version: 2,
      type: 'rescinded',
      abstract: 'This is an abstract for test paper 2.',
    });
  });

  it('should handle pagination with cursor parameter', async () => {
    const mockResponse = {
      messages: [
        {
          status: 'ok',
          category: 'plant biology',
          interval: '2024-12-01:2024-12-02',
          cursor: 100,
          count: 2,
          count_new_papers: '1',
          total: '102',
        },
      ],
      collection: [
        {
          doi: '10.1101/2024.12.01.123457',
          title: 'Test Paper 101',
          authors: 'Smith, J.',
          date: '2024-12-01',
          version: '1',
          type: 'new results',
          abstract: 'Abstract for paper 101.',
        },
      ],
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      text: async () => '',
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: () => null as unknown as Response,
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
    } as unknown as Response);

    const result = await fetchPapers({
      intervalStart: new Date('2024-12-01'),
      intervalEnd: new Date('2024-12-02'),
      cursor: 100,
    });

    if (isBiorxivError(result)) {
      expect.fail('Expected successful result but got error');
    }

    expect(fetch).toHaveBeenCalledWith(
      'https://api.biorxiv.org/details/biorxiv/2024-12-01/2024-12-02/100?category=plant_biology',
      expect.anything()
    );

    expect(result.papers).toHaveLength(1);
    expect(result.total).toBe(102);
  });

  it('should return empty results when no papers found', async () => {
    const mockResponse = {
      messages: [
        {
          status: 'ok',
          category: 'plant biology',
          interval: '2024-01-01:2024-01-02',
          cursor: 0,
          count: 0,
          count_new_papers: '0',
          total: '0',
        },
      ],
      collection: [],
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      text: async () => '',
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: () => null as unknown as Response,
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
    } as unknown as Response);

    const result = await fetchPapers({
      intervalStart: new Date('2024-01-01'),
      intervalEnd: new Date('2024-01-02'),
    });

    if (isBiorxivError(result)) {
      expect.fail('Expected successful result but got error');
    }

    expect(result.papers).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should handle 404 error from API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
      text: async () => 'Not Found',
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: () => null as unknown as Response,
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
    } as unknown as Response);

    const result = await fetchPapers({
      intervalStart: new Date('2024-01-01'),
      intervalEnd: new Date('2024-01-02'),
    });

    expect(isBiorxivError(result)).toBe(true);
    expect((result as BiorxivError).error).toContain('BioRxiv API error: 404');
  });

  it('should handle 500 error from API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
      text: async () => 'Internal Server Error',
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: () => null as unknown as Response,
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
    } as unknown as Response);

    const result = await fetchPapers({
      intervalStart: new Date('2024-01-01'),
      intervalEnd: new Date('2024-01-02'),
    });

    expect(isBiorxivError(result)).toBe(true);
    expect((result as BiorxivError).error).toContain('BioRxiv API error: 500');
  });

  it('should handle network errors', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchPapers({
      intervalStart: new Date('2024-01-01'),
      intervalEnd: new Date('2024-01-02'),
    });

    expect(isBiorxivError(result)).toBe(true);
    expect((result as BiorxivError).error).toBe('Failed to fetch papers from BioRxiv');
    expect((result as BiorxivError).details).toEqual(new Error('Network error'));
  });

  it('should filter by plant_biology category', async () => {
    const mockResponse = {
      messages: [
        {
          status: 'ok',
          category: 'plant biology',
          interval: '2024-12-01:2024-12-02',
          cursor: 0,
          count: 1,
          count_new_papers: '1',
          total: '1',
        },
      ],
      collection: [
        {
          doi: '10.1101/2024.12.01.123456',
          title: 'Plant Biology Paper',
          authors: 'Smith, J.',
          date: '2024-12-01',
          version: '1',
          type: 'new results',
          abstract: 'Plant biology abstract.',
        },
      ],
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      text: async () => '',
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: () => null as unknown as Response,
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
    } as unknown as Response);

    await fetchPapers({
      intervalStart: new Date('2024-12-01'),
      intervalEnd: new Date('2024-12-02'),
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('category=plant_biology'),
      expect.anything()
    );
  });

  it('should handle non-ok status from API messages', async () => {
    const mockResponse = {
      messages: [
        {
          status: 'error',
          category: 'plant biology',
          interval: '2024-12-01:2024-12-02',
          cursor: 0,
          count: 0,
          count_new_papers: '0',
          total: '0',
        },
      ],
      collection: [],
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      text: async () => '',
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: () => null as unknown as Response,
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
    } as unknown as Response);

    const result = await fetchPapers({
      intervalStart: new Date('2024-12-01'),
      intervalEnd: new Date('2024-12-02'),
    });

    expect(isBiorxivError(result)).toBe(true);
    expect((result as BiorxivError).error).toContain('BioRxiv API returned non-ok status');
  });

  it('should handle invalid JSON response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new SyntaxError('Invalid JSON');
      },
      text: async () => 'Invalid JSON',
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: () => null as unknown as Response,
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
    } as unknown as Response);

    const result = await fetchPapers({
      intervalStart: new Date('2024-01-01'),
      intervalEnd: new Date('2024-01-02'),
    });

    expect(isBiorxivError(result)).toBe(true);
    expect((result as BiorxivError).error).toBe('Failed to fetch papers from BioRxiv');
  });

  it('should handle malformed response structure', async () => {
    const mockResponse = {
      messages: [],
      collection: null,
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      text: async () => '',
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: () => null as unknown as Response,
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
    } as unknown as Response);

    const result = await fetchPapers({
      intervalStart: new Date('2024-01-01'),
      intervalEnd: new Date('2024-01-02'),
    });

    expect(isBiorxivError(result)).toBe(true);
    expect((result as BiorxivError).error).toBe('Invalid response from BioRxiv API');
  });

  it('should handle empty authors string', async () => {
    const mockResponse = {
      messages: [
        {
          status: 'ok',
          category: 'plant biology',
          interval: '2024-12-01:2024-12-02',
          cursor: 0,
          count: 1,
          count_new_papers: '1',
          total: '1',
        },
      ],
      collection: [
        {
          doi: '10.1101/2024.12.01.123456',
          title: 'Test Paper',
          authors: '',
          date: '2024-12-01',
          version: '1',
          type: 'new results',
          abstract: 'Abstract.',
        },
      ],
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      text: async () => '',
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: () => null as unknown as Response,
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
    } as unknown as Response);

    const result = await fetchPapers({
      intervalStart: new Date('2024-12-01'),
      intervalEnd: new Date('2024-12-02'),
    });

    if (isBiorxivError(result)) {
      expect.fail('Expected successful result but got error');
    }

    expect(result.papers[0].authors).toEqual([]);
  });

  it('should handle single author', async () => {
    const mockResponse = {
      messages: [
        {
          status: 'ok',
          category: 'plant biology',
          interval: '2024-12-01:2024-12-02',
          cursor: 0,
          count: 1,
          count_new_papers: '1',
          total: '1',
        },
      ],
      collection: [
        {
          doi: '10.1101/2024.12.01.123456',
          title: 'Test Paper',
          authors: 'Smith, J.',
          date: '2024-12-01',
          version: '1',
          type: 'new results',
          abstract: 'Abstract.',
        },
      ],
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      text: async () => '',
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: () => null as unknown as Response,
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
    } as unknown as Response);

    const result = await fetchPapers({
      intervalStart: new Date('2024-12-01'),
      intervalEnd: new Date('2024-12-02'),
    });

    if (isBiorxivError(result)) {
      expect.fail('Expected successful result but got error');
    }

    expect(result.papers[0].authors).toEqual(['Smith, J.']);
  });

  it('should handle version parsing', async () => {
    const mockResponse = {
      messages: [
        {
          status: 'ok',
          category: 'plant biology',
          interval: '2024-12-01:2024-12-02',
          cursor: 0,
          count: 1,
          count_new_papers: '1',
          total: '1',
        },
      ],
      collection: [
        {
          doi: '10.1101/2024.12.01.123456',
          title: 'Test Paper',
          authors: 'Smith, J.',
          date: '2024-12-01',
          version: '5',
          type: 'new results',
          abstract: 'Abstract.',
        },
      ],
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      text: async () => '',
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: () => null as unknown as Response,
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
    } as unknown as Response);

    const result = await fetchPapers({
      intervalStart: new Date('2024-12-01'),
      intervalEnd: new Date('2024-12-02'),
    });

    if (isBiorxivError(result)) {
      expect.fail('Expected successful result but got error');
    }

    expect(result.papers[0].version).toBe(5);
  });
});

describe('isBiorxivError', () => {
  it('should return true for BiorxivError objects', () => {
    const error: BiorxivError = { error: 'Test error', details: null };
    expect(isBiorxivError(error)).toBe(true);
  });

  it('should return true for BiorxivError with details', () => {
    const error: BiorxivError = { error: 'Test error', details: { foo: 'bar' } };
    expect(isBiorxivError(error)).toBe(true);
  });

  it('should return false for non-error objects', () => {
    expect(isBiorxivError({ papers: [], total: 0 })).toBe(false);
  });

  it('should return false for null', () => {
    expect(isBiorxivError(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isBiorxivError(undefined)).toBe(false);
  });

  it('should return false for objects without error property', () => {
    expect(isBiorxivError({ foo: 'bar' })).toBe(false);
  });

  it('should return false for objects with non-string error property', () => {
    expect(isBiorxivError({ error: 123 })).toBe(false);
  });
});
