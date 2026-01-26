import type { APIRoute } from 'astro';
import { fetchPapersOrchestration } from '~/lib/paper-fetch';

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const daysBackStr = formData.get('daysBack') as string;
    const daysBack = daysBackStr ? parseInt(daysBackStr, 10) : undefined;

    const result = await fetchPapersOrchestration(daysBack);

    if (result instanceof Error) {
      throw result;
    }

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Refresh failed:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Refresh failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
