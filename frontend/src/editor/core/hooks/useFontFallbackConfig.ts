import { useEffect, useMemo, useState } from "react";
import { getLocalFontFallbackConfig } from "@editor/services/pdfiumFontFallback";
import { subscribeToFontBaseUrl } from "@editor/services/fontBaseUrl";
import { loadSystemFontUrls } from "@editor/services/systemFonts";

/**
 * PDFium fallback-font configuration, recomputed when the font base URL changes.
 * The desktop webview only learns the backend port after startup, so a config
 * memoized at mount would keep an empty base URL; `subscribeToFontBaseUrl` is a
 * no-op in the web build, where the base is known immediately.
 *
 * Fonts the host can serve from the operating system replace the bundled ones once they are
 * known; until then the bundled files are used.
 */
export function useFontFallbackConfig() {
  const [revision, setRevision] = useState(0);
  const [systemFontUrls, setSystemFontUrls] = useState<Record<string, string>>({});

  useEffect(
    () => subscribeToFontBaseUrl(() => setRevision((current) => current + 1)),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    loadSystemFontUrls()
      .then((urls) => {
        if (!cancelled) setSystemFontUrls(urls);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => getLocalFontFallbackConfig(systemFontUrls),
    [revision, systemFontUrls],
  );
}
