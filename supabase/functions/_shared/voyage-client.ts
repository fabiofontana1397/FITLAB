// Query-time embedding, mirroring scripts/lib/voyage-embed.ts's ingestion-
// time logic (duplicated rather than imported across the Deno/Node
// boundary, and because only supabase/functions/** gets bundled when this
// is deployed later — a relative import reaching outside this folder would
// break at deploy time). Must use the SAME model as ingestion
// (voyage-3.5, 1024-dim) since cosine similarity is meaningless across
// different embedding spaces.
const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-3.5';

export async function embedQuery(text: string): Promise<number[]> {
  const apiKey = Deno.env.get('VOYAGE_API_KEY');
  if (!apiKey) throw new Error('Missing VOYAGE_API_KEY');

  const response = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: [text], model: MODEL, input_type: 'query' }),
  });
  if (!response.ok) {
    throw new Error(`Voyage embeddings request failed (${response.status}): ${await response.text()}`);
  }
  const json = (await response.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}
