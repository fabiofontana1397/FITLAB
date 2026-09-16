// Plain-fetch wrapper around Voyage AI's embeddings endpoint. Anthropic has
// no first-party embeddings API, and Voyage is Anthropic's own documented
// RAG-embeddings recommendation — one small hosted call, usable identically
// from this Node ingestion script and from the Deno `chat` Edge Function at
// query time (both must use the SAME model, since cosine similarity is
// meaningless across different embedding spaces).
const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-3.5'; // 1024-dim output — must match knowledge_chunks.embedding's vector(1024)

// Without a payment method on file, Voyage caps free accounts at 3
// requests/minute and 10K tokens/minute (still draws from the same 200M
// free-token allowance — just throttled). Chunks run ~800-1000 tokens
// each, so 8/batch stays comfortably under the token cap; the fixed delay
// between batches stays under the request-rate cap. A 429 still gets a
// real retry with backoff on top, since actual chunk sizes vary.
const BATCH_SIZE = 8;
// 3 RPM in practice needs real margin, not just >20s — a run hit 429 on
// every retry up to 75s backoff before this was widened. 25s between
// batches plus a longer, more patient backoff ladder (capped at 2min) is
// still slow overall (a few hundred chunks takes on the order of an hour)
// but this is a one-off ingestion script, not a runtime path.
const DELAY_BETWEEN_BATCHES_MS = 25_000;
const MAX_RETRIES = 10;

type VoyageInputType = 'document' | 'query';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function embedBatch(texts: string[], inputType: VoyageInputType, apiKey: string): Promise<number[][]> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(VOYAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: texts, model: MODEL, input_type: inputType }),
    });
    if (response.ok) {
      const json = (await response.json()) as { data: { embedding: number[]; index: number }[] };
      return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    }
    const body = await response.text();
    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : Math.min((attempt + 1) * 30_000, 120_000);
      console.warn(`Voyage rate limit hit (attempt ${attempt + 1}/${MAX_RETRIES}), waiting ${Math.round(retryAfterMs / 1000)}s...`);
      await sleep(retryAfterMs);
      continue;
    }
    throw new Error(`Voyage embeddings request failed (${response.status}): ${body}`);
  }
  throw new Error('Voyage embeddings request failed after all retries');
}

/** Embeds document chunks for storage (ingestion time), paced to stay
 * within Voyage's free-tier rate limits (see BATCH_SIZE/DELAY above). */
export async function embedDocuments(texts: string[], apiKey: string, onProgress?: (done: number, total: number) => void): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatch(batch, 'document', apiKey);
    results.push(...embeddings);
    onProgress?.(results.length, texts.length);
    if (i + BATCH_SIZE < texts.length) {
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }
  return results;
}

/** Embeds a single user question at query time (mirrored in the Edge Function's rag.ts). */
export async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const [embedding] = await embedBatch([text], 'query', apiKey);
  return embedding;
}
