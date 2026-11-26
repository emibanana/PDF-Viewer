# Edits to upstream `core/`

Kept to a minimum so upstream merges stay small. Everything else lives in `studio/`.

| File | Change | Why |
|---|---|---|
| `frontend/src/editor/core/components/viewer/BookmarkSidebar.tsx` | "Add bookmark" calls `replaceTableOfContents()` from `@editor/services/tableOfContentsService` instead of posting to the Java backend | The studio build shadows that service with a pdf-lib writer (`studio/services/tableOfContentsService.ts`); core keeps the backend version |
| `frontend/src/editor/core/services/tableOfContentsService.ts` | New: the backend-calling implementation behind that seam | Same |
