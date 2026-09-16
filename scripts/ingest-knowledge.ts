// One-off, rerunnable ingestion script: turns the two reference PDFs in
// `Materiale addestramento agente/` into embedded, page-tagged chunks in
// the local Supabase instance's `knowledge_chunks` table, so the training
// and nutrition specialist agents can ground their advice in real,
// curated material via RAG instead of undifferentiated general knowledge.
//
// Usage (after `npm run supabase:start` + `npm run supabase:reset`):
//   npm run knowledge:ingest
//
// Idempotent: deletes existing chunks for a source before re-inserting, so
// it's safe to rerun after tweaking chunking/extraction.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { chunkPages } from './lib/chunker';
import { extractPdfPages } from './lib/pdf-extract';
import { embedDocuments } from './lib/voyage-embed';

const ROOT = path.join(import.meta.dirname, '..');

// Minimal inline .env parser — avoids adding a `dotenv` dependency for a
// one-off script. Loads `supabase/.env.local` (Edge Function secrets: same
// file `supabase functions serve --env-file` uses) then falls back to the
// root `.env` for SUPABASE_URL/keys not already set.
function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(path.join(ROOT, 'supabase', '.env.local'));
loadEnvFile(path.join(ROOT, '.env'));

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

if (!SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing SUPABASE_SERVICE_ROLE_KEY. Copy it from `npm run supabase:start`\'s printed output into supabase/.env.local.'
  );
}
if (!VOYAGE_API_KEY) {
  throw new Error('Missing VOYAGE_API_KEY in supabase/.env.local — get one at https://dashboard.voyageai.com.');
}

const DOCUMENTS: { file: string; source: string; label: string }[] = [
  {
    file: '[studocu.com] - Guida Definitiva al Personal Training - Academy Invictus.pdf',
    source: 'training_guide',
    label: 'Guida PT',
  },
  { file: 'Dieta_Guida-ProjectInVictus.pdf', source: 'nutrition_guide', label: 'Guida Dieta' },
];

// Untyped (no generated Database schema) — this is a one-off admin
// script, not the app, so the loosely-typed client is a fine tradeoff.
async function ingestDocument(supabase: SupabaseClient, doc: (typeof DOCUMENTS)[number]) {
  const filePath = path.join(ROOT, 'Materiale addestramento agente', doc.file);
  console.log(`\n[${doc.source}] extracting ${doc.file}...`);
  const pages = await extractPdfPages(filePath);
  const chunks = chunkPages(pages);
  console.log(`[${doc.source}] ${pages.length} pages -> ${chunks.length} chunks, embedding via Voyage...`);

  const embeddings = await embedDocuments(
    chunks.map((c) => c.content),
    VOYAGE_API_KEY!,
    (done, total) => console.log(`[${doc.source}] embedded ${done}/${total} chunks...`)
  );

  console.log(`[${doc.source}] deleting existing chunks and inserting ${chunks.length} new rows...`);
  const { error: deleteError } = await supabase.from('knowledge_chunks').delete().eq('source', doc.source);
  if (deleteError) throw deleteError;

  const rows = chunks.map((chunk, i) => ({
    source: doc.source,
    source_file: doc.file,
    chunk_index: chunk.chunkIndex,
    page_number: chunk.pageNumber,
    content: chunk.content,
    embedding: embeddings[i],
    metadata: { label: doc.label, char_count: chunk.content.length },
  }));

  // Insert in batches to keep individual request payloads modest.
  const INSERT_BATCH = 50;
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const { error: insertError } = await supabase.from('knowledge_chunks').insert(rows.slice(i, i + INSERT_BATCH));
    if (insertError) throw insertError;
  }
  console.log(`[${doc.source}] done — ${rows.length} chunks ingested.`);
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  for (const doc of DOCUMENTS) {
    await ingestDocument(supabase, doc);
  }
  console.log('\nKnowledge base ingestion complete.');
}

main().catch((err) => {
  console.error('Knowledge ingestion failed:', err);
  process.exit(1);
});
