/**
 * Fonts the host operating system can serve to the PDF engine, as a map from the bundled fallback
 * file name to a URL that serves the installed font in its place. Empty here: the web build has
 * no access to the system font folder.
 */
export async function loadSystemFontUrls(): Promise<Record<string, string>> {
  return {};
}
