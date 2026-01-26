import type { APIRoute } from 'astro';
import { db, refreshLogs, eq } from 'astro:db';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  console.log('Received POST request to /admin/api/reset-status');
  try {
    const result = await db
      .update(refreshLogs)
      .set({ status: 'interrupted' })
      .where(eq(refreshLogs.status, 'in_progress'));
      
    // result.rowsAffected might be available depending on the driver, 
    // but astro:db's update return type is not always consistent across drivers yet.
    // However, for the purpose of this task, we can just return success.
    
    return new Response(JSON.stringify({ 
      success: true, 
      rowsAffected: result?.rowsAffected ?? 'unknown' 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error resetting refresh logs:', error);
    return new Response(JSON.stringify({ error: 'Failed to reset status' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}
