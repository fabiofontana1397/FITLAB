// Hand-rolled chunker (~40 lines, no langchain-style dependency needed for
// a one-off script): joins all pages into one string with a page-offset
// map, then slides a window sized in characters (~4 chars/token is a fine
// approximation for a throwaway ingestion script — exact tokenization
// isn't worth a dependency here), snapping each boundary to the nearest
// paragraph break so chunks don't split mid-sentence, with ~15% overlap
// between consecutive chunks so an idea spanning a boundary isn't lost to
// either chunk alone.
import type { ExtractedPage } from './pdf-extract';

export type Chunk = { content: string; pageNumber: number; chunkIndex: number };

const TARGET_CHARS = 3600; // ~900 tokens
const OVERLAP_CHARS = 500; // ~15% of target
const MIN_TRAILING_CHARS = 400; // merge a too-small final slice into the previous chunk

function snapToParagraphBoundary(text: string, roughEnd: number, searchWindow = 300): number {
  if (roughEnd >= text.length) return text.length;
  const windowEnd = Math.min(roughEnd + searchWindow, text.length);
  const slice = text.slice(roughEnd, windowEnd);
  const paragraphBreak = slice.indexOf('\n\n');
  if (paragraphBreak !== -1) return roughEnd + paragraphBreak;
  const sentenceBreak = slice.indexOf('. ');
  if (sentenceBreak !== -1) return roughEnd + sentenceBreak + 1;
  return roughEnd;
}

export function chunkPages(pages: ExtractedPage[]): Chunk[] {
  let full = '';
  const pageStartOffsets: { offset: number; pageNumber: number }[] = [];
  for (const page of pages) {
    pageStartOffsets.push({ offset: full.length, pageNumber: page.pageNumber });
    full += (full ? '\n\n' : '') + page.text;
  }

  const pageAt = (offset: number): number => {
    let pageNumber = pageStartOffsets[0]?.pageNumber ?? 1;
    for (const entry of pageStartOffsets) {
      if (entry.offset > offset) break;
      pageNumber = entry.pageNumber;
    }
    return pageNumber;
  };

  const chunks: Chunk[] = [];
  let start = 0;
  while (start < full.length) {
    const roughEnd = Math.min(start + TARGET_CHARS, full.length);
    const end = snapToParagraphBoundary(full, roughEnd);
    const content = full.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({ content, pageNumber: pageAt(start), chunkIndex: chunks.length });
    }
    if (end >= full.length) break;
    start = end - OVERLAP_CHARS;
    if (start < 0) start = end;
  }

  // Merge a too-short trailing chunk into its predecessor rather than
  // storing a near-empty embedding.
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    if (last.content.length < MIN_TRAILING_CHARS) {
      const prev = chunks[chunks.length - 2];
      prev.content = `${prev.content}\n\n${last.content}`;
      chunks.pop();
    }
  }

  return chunks;
}
