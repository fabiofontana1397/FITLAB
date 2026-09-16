// Page-by-page PDF text extraction. Page boundaries matter here (unlike a
// simple pdf-parse dump) because each ingested chunk needs to carry the
// page it came from for citation-style grounding, e.g.
// "[Fonte: Guida PT, p.12]" — that's what training/nutrition specialist
// agents show the model as retrieved context.
import { readFileSync } from 'node:fs';

// Legacy build: works in plain Node without a browser worker/canvas.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export type ExtractedPage = { pageNumber: number; text: string };

export async function extractPdfPages(filePath: string): Promise<ExtractedPage[]> {
  const data = new Uint8Array(readFileSync(filePath));
  const doc = await getDocument({ data, useWorkerFetch: false }).promise;

  const pages: ExtractedPage[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({ pageNumber, text });
  }
  return pages;
}
