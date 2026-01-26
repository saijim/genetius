import type { APIRoute } from 'astro';
import { clearTrendsCache } from '~/lib/trends';
import { clearHomePageCache } from '~/lib/home-data';

export const POST: APIRoute = async ({ redirect }) => {
  // Clear the in-memory cache to force a fresh calculation on the next request
  clearTrendsCache();
  clearHomePageCache();
  
  // Since trends are real-time aggregations of the `papers` table, 
  // there is no specific "regeneration" task needed other than ensuring papers exist.
  // However, we'll redirect back to the admin page to acknowledge the action.
  return redirect('/admin');
};
