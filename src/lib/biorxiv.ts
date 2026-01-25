const API_BASE_URL = 'https://api.biorxiv.org/details/biorxiv';

export interface BiorxivPaper {
  doi: string;
  title: string;
  authors: string[];
  date: Date;
  version: number;
  type: string;
  abstract: string;
}

export interface BiorxivResponse {
  messages: Array<{
    status: string;
    category: string;
    interval: string;
    cursor: number;
    count: number;
    count_new_papers: string;
    total: string;
  }>;
  collection: Array<{
    doi: string;
    title: string;
    authors: string;
    date: string;
    version: string;
    type: string;
    abstract: string;
  }>;
}

export interface BiorxivError {
  error: string;
  details?: unknown;
}

export interface FetchOptions {
  intervalStart: Date;
  intervalEnd: Date;
  cursor?: number;
}

export async function fetchPapers(
  options: FetchOptions
): Promise<{ papers: BiorxivPaper[]; total: number } | BiorxivError> {
  try {
    const { intervalStart, intervalEnd, cursor = 0 } = options;

    const startDate = formatDate(intervalStart);
    const endDate = formatDate(intervalEnd);

    const url = new URL(`${API_BASE_URL}/${startDate}/${endDate}/${cursor.toString()}`);
    url.searchParams.set('category', 'plant_biology');

    const response = await fetch(url.toString());

    if (!response.ok) {
      return {
        error: `BioRxiv API error: ${response.status} ${response.statusText}`,
        details: response.text,
      };
    }

    const data: unknown = await response.json();

    if (!isValidBiorxivResponse(data)) {
      return { error: 'Invalid response from BioRxiv API', details: data };
    }

    const messages = data.messages[0];
    if (messages.status !== 'ok') {
      return {
        error: `BioRxiv API returned non-ok status: ${messages.status}`,
        details: messages,
      };
    }

    const papers = data.collection.map(normalizePaper);
    const total = parseInt(messages.total, 10) || 0;

    return { papers, total };
  } catch (error) {
    return { error: 'Failed to fetch papers from BioRxiv', details: error };
  }
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizePaper(raw: {
  doi: string;
  title: string;
  authors: string;
  date: string;
  version: string;
  type: string;
  abstract: string;
}): BiorxivPaper {
  const authors = raw.authors.split(';').map((a) => a.trim()).filter(Boolean);
  const version = parseInt(raw.version, 10) || 1;
  const date = new Date(raw.date);

  return {
    doi: raw.doi,
    title: raw.title,
    authors,
    date,
    version,
    type: raw.type,
    abstract: raw.abstract,
  };
}

function isValidBiorxivResponse(data: unknown): data is BiorxivResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const d = data as Record<string, unknown>;

  if (!Array.isArray(d.messages) || d.messages.length === 0) {
    return false;
  }

  const message = d.messages[0];
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  if (typeof (message as Record<string, unknown>).status !== 'string') {
    return false;
  }

  if (!Array.isArray(d.collection)) {
    return false;
  }

  return true;
}

export function isBiorxivError(result: unknown): result is BiorxivError {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    typeof (result as BiorxivError).error === 'string'
  );
}
