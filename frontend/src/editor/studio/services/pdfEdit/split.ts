import { PDFDocument } from "@cantoo/pdf-lib";
import { baseName, buildFromPages, loadPdf, savePdf } from "./common";
import { readOutline } from "./outline";
import { resolvePageSelection } from "./pages";

export type SplitPlan =
  | { kind: "afterPages"; pages: string }
  | { kind: "pageCount"; count: number }
  | { kind: "docCount"; count: number }
  | { kind: "size"; maxBytes: number }
  | { kind: "chapters"; level: number };

/** "10MB", "500KB" or plain bytes. */
export function parseSize(text: string): number {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(kb|mb|gb|b)?\s*$/i.exec(text);
  if (!m) throw new Error(`"${text}" is not a size. Use e.g. 10MB.`);
  const units = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
  return Math.floor(
    Number(m[1]) * units[(m[2] ?? "b").toLowerCase() as keyof typeof units],
  );
}

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from }, (_, k) => from + k);

/** Zero-based [start, end) page groups for the page-list and count plans. */
function groupsFor(plan: SplitPlan, pageCount: number): [number, number][] {
  const cuts: number[] = [0];
  if (plan.kind === "afterPages") {
    // "3,7" cuts after page 3 and after page 7.
    for (const i of resolvePageSelection(plan.pages, pageCount))
      cuts.push(i + 1);
  } else if (plan.kind === "pageCount") {
    for (let n = plan.count; n < pageCount; n += plan.count) cuts.push(n);
  } else if (plan.kind === "docCount") {
    const per = Math.ceil(pageCount / plan.count);
    for (let n = per; n < pageCount; n += per) cuts.push(n);
  }
  cuts.push(pageCount);
  const sorted = [...new Set(cuts)]
    .filter((c) => c >= 0 && c <= pageCount)
    .sort((a, b) => a - b);
  return sorted
    .slice(1)
    .map((end, i) => [sorted[i], end] as [number, number]);
}

function chapterGroups(
  doc: PDFDocument,
  level: number,
): { title: string; pages: number[] }[] {
  const pageCount = doc.getPageCount();
  const starts = readOutline(doc)
    .filter(
      (e) =>
        e.level === level && e.pageIndex !== null && e.pageIndex < pageCount,
    )
    .map((e) => ({ title: e.title, start: e.pageIndex as number }));
  if (starts.length === 0)
    throw new Error(`No bookmarks at level ${level} to split on.`);
  if (starts[0].start > 0) starts.unshift({ title: "Front matter", start: 0 });
  const distinct = starts.filter(
    (s, i) => i === 0 || s.start > starts[i - 1].start,
  );
  return distinct.map((s, i) => ({
    title: s.title,
    pages: range(s.start, distinct[i + 1]?.start ?? pageCount),
  }));
}

const pad = (n: number, of: number) => String(n).padStart(String(of).length, "0");
const safe = (s: string) =>
  s
    .replace(/[\\/:*?"<>|]+/g, "_")
    .trim()
    .slice(0, 80) || "section";

/** Splits each file into several PDFs named `<name>_<n>.pdf`. */
export async function splitPdfs(
  plan: SplitPlan,
  files: File[],
): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    const doc = await loadPdf(file);
    const pageCount = doc.getPageCount();
    const name = baseName(file.name);
    const parts: { label: string; pages: number[] }[] = [];

    if (plan.kind === "chapters") {
      const chapters = chapterGroups(doc, plan.level);
      chapters.forEach((c, i) =>
        parts.push({
          label: `${pad(i + 1, chapters.length)}_${safe(c.title)}`,
          pages: c.pages,
        }),
      );
    } else if (plan.kind === "size") {
      let current: number[] = [];
      for (let p = 0; p < pageCount; p++) {
        const trial = [...current, p];
        const bytes = (await (await buildFromPages(doc, trial)).save()).length;
        if (bytes > plan.maxBytes && current.length > 0) {
          parts.push({ label: "", pages: current });
          current = [p];
        } else current = trial;
      }
      if (current.length) parts.push({ label: "", pages: current });
      parts.forEach((p, i) => (p.label = pad(i + 1, parts.length)));
    } else {
      const groups = groupsFor(plan, pageCount);
      groups.forEach(([a, b], i) =>
        parts.push({ label: pad(i + 1, groups.length), pages: range(a, b) }),
      );
    }

    for (const part of parts) {
      out.push(
        await savePdf(
          await buildFromPages(doc, part.pages),
          `${name}_${part.label}.pdf`,
        ),
      );
    }
  }
  return out;
}
