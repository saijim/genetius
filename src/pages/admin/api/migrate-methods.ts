import type { APIRoute } from 'astro';
import { db, papers, eq, isNull } from 'astro:db';
import { generateSummaryAndKeywords, isOpenRouterError } from '~/lib/openrouter';
import { toMarkdown } from '~/lib/markdown';

export const GET: APIRoute = async () => {
  console.log('Starting methods migration...');

  try {
    // Find papers with empty methods or null methods
    const papersToUpdate = await db
      .select()
      .from(papers)
      .where(isNull(papers.methods))
      .limit(5);

    console.log(`Found ${papersToUpdate.length} papers to update.`);
    let updatedCount = 0;
    const errors: string[] = [];

    for (const paper of papersToUpdate) {
      console.log(`Processing ${paper.doi}...`);

      if (!paper.abstract) {
        console.log(`Skipping ${paper.doi} due to missing abstract.`);
        continue;
      }

      const analysis = await generateSummaryAndKeywords(paper.abstract);

      if (isOpenRouterError(analysis)) {
        console.error(`Failed to analyze ${paper.doi}:`, analysis.error);
        errors.push(`Failed to analyze ${paper.doi}: ${analysis.error}`);
        continue;
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
        updatedCount++;
      } catch (err) {
        console.error(`Failed to update DB for ${paper.doi}:`, err);
        errors.push(`Failed to update DB for ${paper.doi}: ${String(err)}`);
      }
    }

    return new Response(JSON.stringify({
      message: 'Migration batch complete',
      processed: papersToUpdate.length,
      updated: updatedCount,
      errors
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
