const MODEL = 'xiaomi/mimo-v2-flash';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const DELAY_MS = 1000;
let lastCallTime = 0;

export interface OpenRouterError {
  error: string;
  details?: unknown;
}

export interface PaperAnalysis {
  summary: string;
  keywords: string[];
}

export async function generateSummaryAndKeywords(
  abstract: string
): Promise<PaperAnalysis | OpenRouterError> {
  try {
    await enforceRateLimit();
    const apiKey = import.meta.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return { error: 'OPENROUTER_API_KEY not set' };
    }

    const response = await fetchWithRetry(
      API_URL,
      {
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that analyzes plant biology research papers. Generate a concise 2-3 sentence summary of the abstract and extract 3-5 relevant keywords. Return ONLY JSON with "summary" and "keywords" fields. No extra text.',
          },
          {
            role: 'user',
            content: `Analyze this abstract:\n\n${abstract}`,
          },
        ],
        max_tokens: 800,
        response_format: { type: 'json_object' },
        reasoning: {
          exclude: true,
        },
      },
      apiKey
    );

    if (!response.ok) {
      return { error: `OpenRouter API error: ${response.status} ${response.statusText}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const reasoning = data.choices?.[0]?.message?.reasoning;

    const responseText = content || reasoning;

    if (!responseText) {
      console.error('API Response:', JSON.stringify(data, null, 2));
      return { error: 'No response returned from API', details: data };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      return { error: 'Invalid JSON returned from API', details: responseText };
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('summary' in parsed) ||
      !('keywords' in parsed) ||
      typeof (parsed as { summary: unknown }).summary !== 'string' ||
      !Array.isArray((parsed as { keywords: unknown }).keywords) ||
      !(parsed as { keywords: unknown[] }).keywords.every((k) => typeof k === 'string')
    ) {
      return { error: 'Invalid JSON structure returned from API', details: parsed };
    }

    const summary = (parsed as { summary: string }).summary.trim();
    const keywords = (parsed as { keywords: string[] }).keywords
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
      .slice(0, 5);

    return { summary, keywords };
  } catch (error) {
    return { error: 'Failed to generate paper analysis', details: error };
  }
}

async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  if (timeSinceLastCall < DELAY_MS) {
    const delay = DELAY_MS - timeSinceLastCall;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  lastCallTime = Date.now();
}

async function fetchWithRetry(
  url: string,
  body: unknown,
  apiKey: string,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * (attempt + 1);
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}

export function isOpenRouterError(result: unknown): result is OpenRouterError {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    typeof (result as OpenRouterError).error === 'string'
  );
}
