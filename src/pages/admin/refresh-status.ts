import type { APIRoute } from 'astro';
import { db, refreshLogs, desc } from 'astro:db';

export const GET: APIRoute = async () => {
  const latestLog = await db
    .select()
    .from(refreshLogs)
    .orderBy(desc(refreshLogs.date))
    .limit(1);

  if (latestLog.length === 0) {
    return new Response(JSON.stringify({ status: 'none' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const log = latestLog[0];

  return new Response(
    JSON.stringify({
      status: log.status,
      papersFetched: log.papersFetched,
      papersProcessed: log.papersProcessed,
      date: log.date.toISOString(),
      intervalStart: log.intervalStart.toISOString(),
      intervalEnd: log.intervalEnd.toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
