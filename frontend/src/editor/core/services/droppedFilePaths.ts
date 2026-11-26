export interface DroppedPathLookup {
  /** Records the disk path of each of `files` that came from the drop. */
  link: (files: File[]) => void;
}

/**
 * Starts finding disk paths for files being dropped. Call it synchronously in
 * the drop handler, while the transfer still holds its files. Where the host
 * can report paths (the desktop shell) the studio layer replaces this; a
 * browser has none to report.
 */
export function beginDroppedPathLookup(
  _transfer: DataTransfer,
): DroppedPathLookup {
  return { link: () => {} };
}
