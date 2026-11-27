/**
 * Lets code that edits annotations on the user's behalf keep the selection where it is.
 * `AnnotationMenuEvents` selects the annotation of every committed update so its floating
 * menu opens; that is right for a direct edit and wrong for a batch the user did not aim at
 * an annotation (a page-scale change rewriting the measurements of other pages).
 *
 * Commits arrive asynchronously, so a mark is consumed by the first committed update of its
 * annotation and expires after {@link SUPPRESSION_TTL_MS}: a commit that never comes must not
 * swallow the menu for a later, real edit.
 */
const SUPPRESSION_TTL_MS = 5000;

const marks = new Map<string, number>();

export function suppressMenuSelection(
  annotationIds: Iterable<string>,
  now: number = Date.now(),
): void {
  for (const id of annotationIds) marks.set(id, now + SUPPRESSION_TTL_MS);
}

/** True once per mark: the caller skips selecting the annotation. */
export function consumeMenuSuppression(
  annotationId: string,
  now: number = Date.now(),
): boolean {
  const expires = marks.get(annotationId);
  if (expires === undefined) return false;
  marks.delete(annotationId);
  return expires > now;
}
