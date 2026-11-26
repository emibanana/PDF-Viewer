import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFString,
} from "@cantoo/pdf-lib";
import { loadPdf, savePdf } from "./common";

export interface OutlineEntry {
  title: string;
  /** Zero-based page the bookmark points at, or null when its destination cannot be resolved. */
  pageIndex: number | null;
  /** 1 for top-level bookmarks. */
  level: number;
}

/** Reads the document's bookmarks as a flat, depth-first list. */
export function readOutline(doc: PDFDocument): OutlineEntry[] {
  const root = doc.catalog.lookupMaybe(PDFName.of("Outlines"), PDFDict);
  if (!root) return [];
  const pageRefs = doc.getPages().map((p) => p.ref);
  const named = namedDestinations(doc);
  const out: OutlineEntry[] = [];
  const seen = new Set<PDFDict>();

  const pageOf = (dest: unknown): number | null => {
    let d = dest;
    if (
      d instanceof PDFName ||
      d instanceof PDFString ||
      d instanceof PDFHexString
    ) {
      d = named.get(d.decodeText());
    }
    if (d instanceof PDFDict) d = d.lookup(PDFName.of("D"));
    if (!(d instanceof PDFArray)) return null;
    const target = d.get(0);
    if (target instanceof PDFRef) {
      const i = pageRefs.findIndex((r) => r === target);
      return i >= 0 ? i : null;
    }
    return target instanceof PDFNumber ? target.asNumber() : null;
  };

  const walk = (first: PDFDict | undefined, level: number) => {
    for (let node = first; node && !seen.has(node); ) {
      seen.add(node);
      const title = node.lookupMaybe(
        PDFName.of("Title"),
        PDFString,
        PDFHexString,
      );
      let dest: unknown = node.lookup(PDFName.of("Dest"));
      if (!dest) {
        const action = node.lookupMaybe(PDFName.of("A"), PDFDict);
        dest = action?.lookup(PDFName.of("D"));
      }
      out.push({
        title: title?.decodeText() ?? "",
        pageIndex: pageOf(dest),
        level,
      });
      walk(node.lookupMaybe(PDFName.of("First"), PDFDict), level + 1);
      node = node.lookupMaybe(PDFName.of("Next"), PDFDict);
    }
  };
  walk(root.lookupMaybe(PDFName.of("First"), PDFDict), 1);
  return out;
}

function namedDestinations(doc: PDFDocument): Map<string, unknown> {
  const map = new Map<string, unknown>();
  const dests = doc.catalog.lookupMaybe(PDFName.of("Dests"), PDFDict);
  dests?.entries().forEach(([k, v]) => map.set(k.decodeText(), v));
  const visit = (node: PDFDict | undefined) => {
    const names = node?.lookupMaybe(PDFName.of("Names"), PDFArray);
    for (let i = 0; names && i + 1 < names.size(); i += 2) {
      const key = names.lookupMaybe(i, PDFString, PDFHexString);
      if (key) map.set(key.decodeText(), names.lookup(i + 1));
    }
    const kids = node?.lookupMaybe(PDFName.of("Kids"), PDFArray);
    for (let i = 0; kids && i < kids.size(); i++) {
      visit(kids.lookupMaybe(i, PDFDict));
    }
  };
  visit(
    doc.catalog
      .lookupMaybe(PDFName.of("Names"), PDFDict)
      ?.lookupMaybe(PDFName.of("Dests"), PDFDict),
  );
  return map;
}

/** A bookmark to write: `pageNumber` is one-based and clamped into the document. */
export interface OutlineInput {
  title: string;
  pageNumber: number;
  children: OutlineInput[];
}

/** Replaces the document's bookmarks with `items` (nested). An empty list removes them. */
export function writeOutline(doc: PDFDocument, items: OutlineInput[]): void {
  if (items.length === 0) {
    doc.catalog.delete(PDFName.of("Outlines"));
    return;
  }
  const { context } = doc;
  const lastPage = doc.getPageCount() - 1;
  const rootRef = context.nextRef();

  const build = (list: OutlineInput[], parent: PDFRef): { first: PDFRef; last: PDFRef; count: number } => {
    const refs = list.map(() => context.nextRef());
    let count = list.length;
    list.forEach((item, i) => {
      const page = doc.getPage(Math.min(Math.max(item.pageNumber - 1, 0), lastPage));
      const kids = item.children.length ? build(item.children, refs[i]) : undefined;
      count += kids?.count ?? 0;
      context.assign(
        refs[i],
        context.obj({
          Title: PDFHexString.fromText(item.title),
          Parent: parent,
          Dest: [page.ref, PDFName.of("Fit")],
          ...(i > 0 ? { Prev: refs[i - 1] } : {}),
          ...(i < list.length - 1 ? { Next: refs[i + 1] } : {}),
          ...(kids ? { First: kids.first, Last: kids.last, Count: kids.count } : {}),
        }),
      );
    });
    return { first: refs[0], last: refs[refs.length - 1], count };
  };

  const top = build(items, rootRef);
  context.assign(
    rootRef,
    context.obj({ Type: "Outlines", First: top.first, Last: top.last, Count: top.count }),
  );
  doc.catalog.set(PDFName.of("Outlines"), rootRef);
}

/** Rewrites `file` with `items` as its bookmarks. */
export async function replaceOutline(file: File, items: OutlineInput[]): Promise<File> {
  const doc = await loadPdf(file);
  writeOutline(doc, items);
  return savePdf(doc, file.name);
}
