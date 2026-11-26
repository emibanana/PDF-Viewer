import { loadPdf, savePdf } from "./common";

/**
 * Burns each file's interactive form fields into the page content so they can no
 * longer be edited. Flattening whole pages to images is not done here.
 */
export async function flattenForms(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    const doc = await loadPdf(file);
    doc.getForm().flatten();
    out.push(await savePdf(doc, file.name));
  }
  return out;
}
