import { parseSelection } from "@editor/utils/bulkselection/parseSelection";
import { BLANK_PAGE, buildFromPages, loadPdf, savePdf } from "@editor/services/pdfEdit/common";

/**
 * Turns a page selection ("1,3,5-8", "all", "2n+1", "odd & 1-10") into zero-based
 * indices. Plain numbers and ranges keep the order they were written in (and may
 * repeat); anything fancier goes through the shared selection parser, which yields
 * ascending pages.
 */
export function resolvePageSelection(expression: string, pageCount: number): number[] {
  const text = expression.trim();
  const pages: number[] = [];
  const parts = /[()&|!]|\b(and|or|not)\b/i.test(text) ? [text] : text.split(",");
  for (const part of parts) {
    const token = part.replace(/\s+/g, "");
    if (!token) continue;
    const range = /^(\d+)(-(\d*))?$/.exec(token);
    const from = range ? Number(range[1]) : NaN;
    const to = !range?.[2] ? from : range[3] ? Number(range[3]) : pageCount;
    if (range && from >= 1 && from <= to) {
      for (let n = from; n <= Math.min(to, pageCount); n++) pages.push(n);
    } else {
      pages.push(...parseSelection(token, pageCount));
    }
  }
  return pages.map((n) => n - 1);
}

const ascendingUnique = (indices: number[]): number[] => [...new Set(indices)].sort((a, b) => a - b);

/** Deletes the selected pages from each file. */
export async function removePages(pageNumbers: string, files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    const doc = await loadPdf(file);
    const count = doc.getPageCount();
    const removed = new Set(resolvePageSelection(pageNumbers, count));
    if (removed.size === 0) {
      throw new Error(`No pages of ${file.name} match "${pageNumbers}".`);
    }
    const kept = doc.getPageIndices().filter((i) => !removed.has(i));
    if (kept.length === 0) {
      throw new Error(`Cannot remove every page of ${file.name}.`);
    }
    out.push(await savePdf(await buildFromPages(doc, kept), file.name));
  }
  return out;
}

/** Keeps only the selected pages of each file, in ascending order. */
export async function extractPages(pageNumbers: string, files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    const doc = await loadPdf(file);
    const kept = ascendingUnique(resolvePageSelection(pageNumbers, doc.getPageCount()));
    if (kept.length === 0) {
      throw new Error(`No pages of ${file.name} match "${pageNumbers}".`);
    }
    out.push(await savePdf(await buildFromPages(doc, kept), file.name));
  }
  return out;
}

/** Page order for each preset of the Reorganize Pages tool; zero-based, BLANK_PAGE pads booklets. */
export function reorganizeSequence(mode: string, pageNumbers: string, n: number): number[] {
  const all = Array.from({ length: n }, (_, i) => i);
  const padded = (indices: number[]) => indices.map((i) => (i < n ? i : BLANK_PAGE));

  switch (mode) {
    case "":
    case "CUSTOM":
      return resolvePageSelection(pageNumbers, n);
    case "REVERSE_ORDER":
      return [...all].reverse();
    case "DUPLEX_SORT": // 1, n, 2, n-1, ...
      return all.slice(0, Math.ceil(n / 2)).flatMap((i) => (i === n - 1 - i ? [i] : [i, n - 1 - i]));
    case "BOOKLET_SORT": {
      // Per sheet: front = last, first; back = second, second last.
      const total = Math.ceil(n / 4) * 4;
      const order: number[] = [];
      for (let k = 0; k < total / 4; k++) {
        order.push(total - 1 - 2 * k, 2 * k, 2 * k + 1, total - 2 - 2 * k);
      }
      return padded(order);
    }
    case "SIDE_STITCH_BOOKLET_SORT": {
      const order: number[] = [];
      for (let b = 0; b < n; b += 4) order.push(b + 3, b, b + 1, b + 2);
      return padded(order);
    }
    case "ODD_EVEN_SPLIT": // odd pages (1, 3, ...) then even pages
      return [...all.filter((i) => i % 2 === 0), ...all.filter((i) => i % 2)];
    case "ODD_EVEN_MERGE": {
      // Inverse of the split: interleave the first half with the second half.
      const half = Math.ceil(n / 2);
      return all.slice(0, half).flatMap((i) => (i + half < n ? [i, i + half] : [i]));
    }
    case "REMOVE_FIRST":
      return all.slice(1);
    case "REMOVE_LAST":
      return all.slice(0, -1);
    case "REMOVE_FIRST_AND_LAST":
      return all.slice(1, -1);
    case "DUPLICATE": {
      const copies = Math.max(1, Math.floor(Number(pageNumbers)) || 2);
      return all.flatMap((i) => Array<number>(copies).fill(i));
    }
    default:
      throw new Error(`Unknown page order "${mode}".`);
  }
}

/** Rebuilds each file with its pages in the order the chosen mode gives. */
export async function reorganizePages(mode: string, pageNumbers: string, files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    const doc = await loadPdf(file);
    const sequence = reorganizeSequence(mode, pageNumbers, doc.getPageCount());
    if (sequence.length === 0) {
      throw new Error(`The page order leaves nothing to keep in ${file.name}.`);
    }
    out.push(await savePdf(await buildFromPages(doc, sequence), file.name));
  }
  return out;
}
