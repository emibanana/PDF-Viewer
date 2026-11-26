/**
 * Tools that are still in the code but hidden, because their client-side port
 * is not finished. `ToolRegistryProvider` (studio) filters the registry with this
 * list, so the Tools menu, search and deep links all skip them.
 *
 * Tools that need the Java backend are not here: their code was deleted and they
 * are listed under "Deferred" in docs/IMPLEMENTATION-PLAN.md.
 *
 * To finish a port, delete the id from here and mark it done in the plan.
 */

export const PORT_PLANNED_TOOL_IDS: readonly string[] = ["showJS", "editTableOfContents", "addAttachments"];

export const HIDDEN_TOOL_IDS: ReadonlySet<string> = new Set([...PORT_PLANNED_TOOL_IDS]);

export function omitHiddenTools<T extends object>(tools: T): T {
  return Object.fromEntries(Object.entries(tools).filter(([id]) => !HIDDEN_TOOL_IDS.has(id))) as T;
}
