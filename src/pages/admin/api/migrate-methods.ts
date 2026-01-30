import type { APIRoute } from 'astro';
import { db, papers, eq, isNull, or, sql, lt, asc, and } from 'astro:db';
import { generateSummaryAndKeywords, isOpenRouterError } from '~/lib/openrouter';
import { toMarkdown } from '~/lib/markdown';

// Configuration for batch processing
const BATCH_UPDATE_SIZE = 5;

interface ProcessedPaper {
  id: number;
  doi: string;
  summary: string;
  keywords: string[];
  methods: string[];
  modelOrganism: string | null;
  markdown: string;
}

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
    const papersToUpdate = await db
      .select()
      .from(papers)
      .where(
        and(
          or(
            isNull(papers.methods),
            sql`${papers.methods} = '[]'`,
            sql`${papers.methods} = ''`
          ),
          lt(papers.updatedAt, cutoffDate)
        )
      )
      .orderBy(asc(papers.updatedAt))
      .limit(limit);

    console.log(`Found ${papersToUpdate.length} papers to update.`);

    const results: { success: boolean; error?: string; debugData?: unknown }[] = [];
    const papersBuffer: ProcessedPaper[] = [];

    for (let i = 0; i < papersToUpdate.length; i += chunkSize) {
      console.log(`Processing chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(papersToUpdate.length / chunkSize)}...`);
      const chunk = papersToUpdate.slice(i, i + chunkSize);
      
      // Process papers in chunk (with external API calls)
      const chunkResults = await Promise.all(
        chunk.map(paper => processPaperForMigration(paper, debug))
      );
      
      // Collect successfully processed papers for batch update
      for (const result of chunkResults) {
        if (result.success && result.paperData) {
          papersBuffer.push(result.paperData);
        }
        results.push({ 
          success: result.success, 
          error: result.error, 
          debugData: result.debugData 
        });
      }

      // Batch update when buffer reaches threshold
      if (papersBuffer.length >= BATCH_UPDATE_SIZE) {
        await batchUpdatePapers(papersBuffer);
        papersBuffer.length = 0;
      }
    }

    // Update any remaining papers in buffer
    if (papersBuffer.length > 0) {
      await batchUpdatePapers(papersBuffer);
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

interface ProcessResult {
  success: boolean;
  error?: string;
  paperData?: ProcessedPaper;
  debugData?: unknown;
}

async function processPaperForMigration(
  paper: {
    id: number;
    doi: string;
    abstract: string | null;
    title: string;
    authors: unknown;
    date: Date;
    version: number;
    type: string;
  },
  debug: boolean
): Promise<ProcessResult> {
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

  console.log(`Analyzed ${paper.doi} successfully, queued for batch update.`);
  
  return {
    success: true,
    paperData: {
      id: paper.id,
      doi: paper.doi,
      summary,
      keywords,
      methods,
      modelOrganism: modelOrganism ?? null,
      markdown,
    },
    debugData: debug ? { doi: paper.doi, analysis } : undefined
  };
}

/**
 * Batch update papers using db.batch() for atomicity
 */
async function batchUpdatePapers(papersToUpdate: ProcessedPaper[]): Promise<void> {
  if (papersToUpdate.length === 0) return;

  try {
    const updateQueries = papersToUpdate.map(paper =>
      db.update(papers)
        .set({
          summary: paper.summary,
          keywords: paper.keywords,
          methods: paper.methods,
          modelOrganism: paper.modelOrganism,
          markdown: paper.markdown,
          updatedAt: new Date()
        })
        .where(eq(papers.id, paper.id))
    );

    // Execute all updates atomically using batch
    await db.batch(updateQueries as [typeof updateQueries[0], ...typeof updateQueries[0][]]);

    console.log(`[Migration] Batch updated ${papersToUpdate.length} papers`);
  } catch (error) {
    console.error('[Migration] Batch update failed:', error);
    throw error;
  }
}
