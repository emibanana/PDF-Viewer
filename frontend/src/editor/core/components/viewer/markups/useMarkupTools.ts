export interface MarkupToolsSource {
  /** False while the document cannot be annotated; the studio hook then registers nothing. */
  enabled: boolean;
  file: File | Blob | null | undefined;
}

/**
 * Registers the viewer's markup tools. Must run under the EmbedPDF provider; core has none, and
 * the studio layer supplies this hook with the same path.
 */
export function useMarkupTools(_source: MarkupToolsSource): void {}
