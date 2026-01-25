import { z } from 'zod';

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
  modelOrganism?: string;
}

const PaperAnalysisSchema = z.object({
  summary: z.string().trim(),
  keywords: z.array(z.string().trim()).transform((val) => val.filter((k) => k.length > 0).slice(0, 5)),
  modelOrganism: z.string().trim().optional(),
});

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
              'You are a helpful assistant that analyzes plant biology research papers. Generate a concise 2-3 sentence summary of the abstract, extract 3-5 relevant keywords, and identify the primary model organism (e.g., "Arabidopsis thaliana", "Zea mays", "Oryza sativa") if explicitly mentioned or strongly implied (use "General" or "Multi-species" if unclear). Return ONLY JSON with "summary", "keywords", and "modelOrganism" fields. No extra text.',
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

    const result = PaperAnalysisSchema.safeParse(parsed);

    if (!result.success) {
      return { 
        error: 'Invalid JSON structure returned from API', 
        details: result.error.issues 
      };
    }

    return result.data;
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
      signal: AbortSignal.timeout(30000), // 30s timeout
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
