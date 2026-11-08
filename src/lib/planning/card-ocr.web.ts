import type { WorkoutCardFile } from '@/lib/api/workout-card';

/**
 * Free reading of a workout card, entirely in the browser: the text of a PDF comes straight from the file (pdf.js),
 * a photo or a scanned PDF goes through Tesseract OCR in Italian. Nothing is uploaded and no credits are spent.
 * The OCR engine and language data are fetched once from a public CDN and cached by the browser.
 */

const PDFJS_VERSION = '6.3.289';
const MIN_PDF_TEXT = 20;

async function ocr(image: string | Blob | HTMLCanvasElement): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('ita');
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

type PdfTextItem = { str?: string; transform?: number[] };

/** Rows of a PDF page: text items sharing a baseline are joined left to right, so a table row stays on one line. */
function pageLines(items: PdfTextItem[]): string[] {
  const rows: { y: number; parts: { x: number; text: string }[] }[] = [];
  for (const item of items) {
    const text = item.str?.trim();
    if (!text || !item.transform) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const row = rows.find((r) => Math.abs(r.y - y) < 3);
    if (row) row.parts.push({ x, text });
    else rows.push({ y, parts: [{ x, text }] });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.text).join(' '));
}

async function readPdf(file: WorkoutCardFile, onProgress?: (label: string) => void): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
  const data = file.base64 ? Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0)) : new Uint8Array(await (await fetch(file.uri)).arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = Math.min(pdf.numPages, 6);

  const lines: string[] = [];
  for (let n = 1; n <= pages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    lines.push(...pageLines(content.items as PdfTextItem[]));
  }
  const text = lines.join('\n');
  if (text.replace(/\s/g, '').length >= MIN_PDF_TEXT) return text;

  // A scanned PDF has no text: draw each page and read it like a photo.
  onProgress?.('PDF scansionato: lo leggo come un’immagine…');
  const out: string[] = [];
  for (let n = 1; n <= pages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, viewport }).promise;
    out.push(await ocr(canvas));
  }
  return out.join('\n');
}

export async function readCardLocally(file: WorkoutCardFile, onProgress?: (label: string) => void): Promise<string | null> {
  try {
    if (file.mediaType === 'application/pdf') return (await readPdf(file, onProgress)).trim() || null;
    onProgress?.('Leggo la foto sul dispositivo…');
    const source = file.base64 ? `data:${file.mediaType};base64,${file.base64}` : file.uri;
    return (await ocr(source)).trim() || null;
  } catch (err) {
    console.warn('local card reading failed', err);
    return null;
  }
}
