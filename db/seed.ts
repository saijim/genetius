import { db, refreshLogs } from 'astro:db';

export default async function() {
  await db.insert(refreshLogs).values({
    id: 1,
    intervalStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    intervalEnd: new Date(),
    papersFetched: 0,
    papersProcessed: 0,
    status: 'initialized',
  });
}
