import { describe, expect, it, vi } from "vitest";
import { linkImportedPaths } from "@editor/services/linkImportedPaths";
import { pendingFilePathMappings } from "@editor/services/pendingFilePathMappings";
import { createQuickKey } from "@editor/types/fileContext";
import type { StirlingFile } from "@editor/types/fileContext";

function imported(file: File, id: string) {
  return { fileId: id, quickKey: createQuickKey(file) } as StirlingFile;
}

describe("linkImportedPaths", () => {
  it("links a file to the path recorded for it, even one still resolving", async () => {
    const opened = new File(["a"], "a.pdf");
    const dropped = new File(["bb"], "b.pdf");
    pendingFilePathMappings.set(opened, "C:docsa.pdf");
    pendingFilePathMappings.set(dropped, Promise.resolve("C:docs\b.pdf"));
    const update = vi.fn();

    await linkImportedPaths(
      [opened, dropped],
      [imported(opened, "1"), imported(dropped, "2")],
      update,
    );

    expect(update).toHaveBeenCalledWith("1", {
      localFilePath: "C:docsa.pdf",
      isDirty: false,
    });
    expect(update).toHaveBeenCalledWith("2", {
      localFilePath: "C:docs\b.pdf",
      isDirty: false,
    });
  });

  it("leaves files without a resolved path unlinked", async () => {
    const plain = new File(["c"], "c.pdf");
    const unresolved = new File(["dd"], "d.pdf");
    pendingFilePathMappings.set(unresolved, Promise.resolve(undefined));
    const update = vi.fn();

    await linkImportedPaths(
      [plain, unresolved],
      [imported(plain, "1"), imported(unresolved, "2")],
      update,
    );

    expect(update).not.toHaveBeenCalled();
  });
});
