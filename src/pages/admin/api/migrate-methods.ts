import type { APIRoute } from 'astro';
import { db, papers, eq, isNull, or, sql, lt, asc, and } from 'astro:db';
import { generateSummaryAndKeywords, isOpenRouterError } from '~/lib/openrouter';
import { toMarkdown } from '~/lib/markdown';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit')) || 50;
  const chunkSize = Number(url.searchParams.get('chunk')) || 5;
  const debug = url.searchParams.get('debug') === 'true';

  console.log(`Starting methods migration (limit=${limit}, chunk=${chunkSize}, debug=${debug})...`);

  try {
    // Calculate cutoff date (12 hours ago)
    const cutoffDate = new Date(Date.now() - 12 * 60 * 60 * 1000);

    // Find papers with empty methods or null methods
    // Since we just added the column with a default of [], it might not be NULL but an empty array '[]' string in SQLite
    const papersToUpdate = await db
      .select()
      .from(papers)
      .where(
        and(
          or(
            isNull(papers.methods),
            // Check for empty JSON array if default was applied
            // In SQLite/LibSQL, JSON is stored as text
            sql`${papers.methods} = '[]'`,
            // Also check for literal empty string just in case
            sql`${papers.methods} = ''`
          ),
          // Only process papers that haven't been updated in the last 12 hours
          // This prevents infinite loops on papers where no methods can be extracted
          lt(papers.updatedAt, cutoffDate)
        )
      )
      .orderBy(asc(papers.updatedAt))
      .limit(limit);

    console.log(`Found ${papersToUpdate.length} papers to update.`);

    const processPaper = async (paper: typeof papersToUpdate[number]) => {
      console.log(`Processing ${paper.doi}...`);

      if (!paper.abstract) {
        console.log(`Skipping ${paper.doi} due to missing abstract.`);
        return { success: false, error: `Skipped ${paper.doi}: missing abstract` };
      }

      const analysis = await generateSummaryAndKeywords(paper.abstract);

      if (isOpenRouterError(analysis)) {
        console.error(`Failed to analyze ${paper.doi}:`, analysis.error);
        return { success: false, error: `Failed to analyze ${paper.doi}: ${analysis.error}` };
      }

      const { summary, keywords, methods, modelOrganism } = analysis;

      // Regenerate markdown to include methods
      const markdown = toMarkdown({
        title: paper.title,
        authors: paper.authors as string[],
        date: paper.date.toISOString(),
        version: paper.version,
        doi: paper.doi,
        category: paper.type,
        abstract: paper.abstract,
        summary,
        keywords,
        methods,
        modelOrganism
      });

      try {
        await db.update(papers)
          .set({
            summary,
            keywords,
            methods,
            modelOrganism,
            markdown,
            updatedAt: new Date()
          })
          .where(eq(papers.id, paper.id));

        console.log(`Updated ${paper.doi} successfully.`);
        return { success: true, debugData: debug ? { doi: paper.doi, analysis } : undefined };
      } catch (err) {
        console.error(`Failed to update DB for ${paper.doi}:`, err);
        return { success: false, error: `Failed to update DB for ${paper.doi}: ${String(err)}` };
      }
    };

    const results = [];
    for (let i = 0; i < papersToUpdate.length; i += chunkSize) {
      console.log(`Processing chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(papersToUpdate.length / chunkSize)}...`);
      const chunk = papersToUpdate.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map(processPaper));
      results.push(...chunkResults);
    }

    const updatedCount = results.filter(r => r.success).length;
    const errors = results.filter(r => !r.success && r.error).map(r => r.error as string);
    const debugData = results.map(r => r.debugData).filter(Boolean);

    return new Response(JSON.stringify({
      message: 'Migration batch complete',
      config: { limit, chunkSize, debug },
      processed: papersToUpdate.length,
      updated: updatedCount,
      errors,
      debugData
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
