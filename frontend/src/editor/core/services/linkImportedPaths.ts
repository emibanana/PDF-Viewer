import { pendingFilePathMappings } from "@editor/services/pendingFilePathMappings";
import { createQuickKey } from "@editor/types/fileContext";
import type { StirlingFile, StirlingFileStub } from "@editor/types/fileContext";

type UpdateStub = (
  id: StirlingFile["fileId"],
  updates: Partial<StirlingFileStub>,
) => void;

/**
 * Links each imported file to the disk path recorded for its `File` in
 * `pendingFilePathMappings`, so Save writes back to it. A mapping may still be
 * resolving (a dropped file's path arrives from the host); a path that never
 * resolves leaves the file unlinked and Save asks where to put it.
 */
export async function linkImportedPaths(
  files: File[],
  added: StirlingFile[],
  updateStub: UpdateStub,
): Promise<void> {
  const fileByQuickKey = new Map(
    files.map((file) => [createQuickKey(file), file]),
  );
  await Promise.all(
    added.map(async (stirlingFile) => {
      const source = fileByQuickKey.get(stirlingFile.quickKey);
      const mapping = source && pendingFilePathMappings.get(source);
      if (!mapping) return;
      const path = await mapping;
      if (!path) return;
      updateStub(stirlingFile.fileId, { localFilePath: path, isDirty: false });
    }),
  );
}
