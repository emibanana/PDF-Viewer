import { useEffect, useMemo, useState } from "react";
import { getLocalFontFallbackConfig } from "@editor/services/pdfiumFontFallback";
import { subscribeToFontBaseUrl } from "@editor/services/fontBaseUrl";
import { loadSystemFontUrls } from "@editor/services/systemFonts";

type FontUrls = Record<string, string>;

const NO_SYSTEM_FONTS: FontUrls = {};
let loadedSystemFontUrls: FontUrls | null = null;
// Started on import so the lookup has settled by the time a document opens:
// every config change rebuilds the PDFium engine, worker and WASM included.
const systemFontUrlsPromise: Promise<FontUrls> = loadSystemFontUrls()
  .catch(() => NO_SYSTEM_FONTS)
  .then((urls) => {
    loadedSystemFontUrls = Object.keys(urls).length > 0 ? urls : NO_SYSTEM_FONTS;
    return loadedSystemFontUrls;
  });

/**
 * PDFium fallback-font configuration, recomputed when the font base URL changes.
 * The desktop webview only learns the backend port after startup, so a config
 * memoized at mount would keep an empty base URL; `subscribeToFontBaseUrl` is a
 * no-op in the web build, where the base is known immediately.
 *
 * Fonts the host can serve from the operating system replace the bundled ones
 * once they are known; until then the bundled files are used. The config keeps
 * its identity unless the fonts it names change.
 */
export function useFontFallbackConfig() {
  const [revision, setRevision] = useState(0);
  const [systemFontUrls, setSystemFontUrls] = useState<FontUrls>(
    () => loadedSystemFontUrls ?? NO_SYSTEM_FONTS,
  );

  useEffect(
    () => subscribeToFontBaseUrl(() => setRevision((current) => current + 1)),
    [],
  );

  useEffect(() => {
    if (loadedSystemFontUrls) return undefined;
    let cancelled = false;
    void systemFontUrlsPromise.then((urls) => {
      if (!cancelled) setSystemFontUrls(urls);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => getLocalFontFallbackConfig(systemFontUrls),
    // revision is the trigger: the config reads the font base URL when built.
    [revision, systemFontUrls],
  );
}
