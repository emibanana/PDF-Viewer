import { useSyncExternalStore } from "react";

/** What the reader's left panel is showing, picked from the quick-nav rail. */
export type ReaderNavTab = "files" | "bookmarks" | "pages" | "comments" | "attachments";

interface ReaderNavState {
  open: boolean;
  tab: ReaderNavTab;
}

let state: ReaderNavState = { open: true, tab: "files" };
const listeners = new Set<() => void>();

function set(next: ReaderNavState) {
  if (next.open === state.open && next.tab === state.tab) return;
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useReaderNav(): ReaderNavState {
  return useSyncExternalStore(subscribe, () => state);
}

/** A rail icon: switches to its tab, or retracts the panel if that tab is already showing. */
export function selectReaderNavTab(tab: ReaderNavTab) {
  if (state.open && state.tab === tab) set({ ...state, open: false });
  else set({ open: true, tab });
}

export function setReaderNavOpen(open: boolean) {
  set({ ...state, open });
}
