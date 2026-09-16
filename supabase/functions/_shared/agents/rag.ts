import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { embedQuery } from '../voyage-client.ts';

export type RetrievedChunk = {
  id: string;
  source: string;
  source_file: string;
  page_number: number | null;
  content: string;
  similarity: number;
};

const SIMILARITY_FLOOR = 0.5;

/** Runs through the match_knowledge_chunks() SECURITY DEFINER RPC — the
 * only gateway into knowledge_chunks, so this works under the normal
 * user-scoped client without ever touching the service-role key. Chunks
 * below the similarity floor are dropped rather than stuffed into the
 * prompt as noise; an empty result means "answer from general competence,
 * don't fabricate a citation."
 *
 * Never throws: RAG grounding is an enhancement, not a dependency — a
 * missing VOYAGE_API_KEY (knowledge base not configured yet) or an RPC
 * error must degrade to "no knowledge base context" for whichever
 * specialist called this, not take down the whole chat turn. */
export async function retrieveKnowledge(
  supabase: SupabaseClient,
  query: string,
  source: 'training_guide' | 'nutrition_guide',
  topK = 5
): Promise<RetrievedChunk[]> {
  try {
    const embedding = await embedQuery(query);
    const { data, error } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: embedding,
      match_source: source,
      match_count: topK,
    });
    if (error) throw error;
    return ((data ?? []) as RetrievedChunk[]).filter((chunk) => chunk.similarity >= SIMILARITY_FLOOR);
  } catch (err) {
    console.warn(`retrieveKnowledge(${source}) unavailable, proceeding without RAG context:`, err);
    return [];
  }
}

export function formatChunksForPrompt(chunks: RetrievedChunk[], label: string): string {
  if (chunks.length === 0) return '';
  const body = chunks
    .map((c) => `[Fonte: ${label}${c.page_number ? `, p.${c.page_number}` : ''}]\n${c.content}`)
    .join('\n\n---\n\n');
  return `Contesto di riferimento (usalo se pertinente, non inventare mai una citazione se il contesto non copre la domanda):\n\n${body}`;
}
