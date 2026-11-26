import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox, Group, Modal, ScrollArea, Stack, Text } from "@mantine/core";
import { Button } from "@editor/ui/Button";
import type { StirlingFileStub } from "@editor/types/fileContext";
import { formatFileSize } from "@editor/utils/fileUtils";
import { privateContentClassName } from "@editor/components/shared/privateContentClassName";

interface AddFromRecentModalProps {
  opened: boolean;
  onClose: () => void;
  /** Library files, newest first. */
  stubs: StirlingFileStub[];
  /** Ids already in the workbench; shown, but not pickable twice. */
  openIds: ReadonlySet<string>;
  /** Ids whose bytes are gone; shown, but they can't be added. */
  unavailableIds: ReadonlySet<string>;
  onAdd: (stubs: StirlingFileStub[]) => void | Promise<void>;
}

/** Picks any number of library files to add to the workbench in one go. */
export function AddFromRecentModal({ opened, onClose, stubs, openIds, unavailableIds, onAdd }: AddFromRecentModalProps) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (opened) setPicked(new Set());
  }, [opened]);

  const isDisabled = (stub: StirlingFileStub) =>
    openIds.has(stub.id) || stub.dataUnavailable === true || unavailableIds.has(stub.id);

  const pickable = useMemo(
    () => stubs.filter((s) => !isDisabled(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stubs, openIds, unavailableIds],
  );

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const confirm = async () => {
    const chosen = pickable.filter((s) => picked.has(s.id));
    if (chosen.length === 0) return;
    setAdding(true);
    try {
      await onAdd(chosen);
      onClose();
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("fileSidebar.recentPicker.title", "Add from recent files")}
      centered
      size="md"
      transitionProps={{ duration: 0 }}
      styles={{ body: { paddingTop: "var(--mantine-spacing-md)" } }}
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {t("fileSidebar.recentPicker.selected", {
              count: picked.size,
              defaultValue_one: "{{count}} selected",
              defaultValue_other: "{{count}} selected",
            })}
          </Text>
          <Group gap="xs">
            <Button size="sm" variant="secondary" onClick={() => setPicked(new Set(pickable.map((s) => s.id)))}>
              {t("pageEdit.selectAll", "Select All")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setPicked(new Set())}>
              {t("pageEdit.deselectAll", "Select None")}
            </Button>
          </Group>
        </Group>

        {stubs.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {t("fileSidebar.noFiles", "No files yet")}
          </Text>
        ) : (
          <ScrollArea.Autosize mah={360}>
            <Stack gap={4}>
              {stubs.map((stub) => {
                const disabled = isDisabled(stub);
                return (
                  <Checkbox
                    key={stub.id}
                    checked={picked.has(stub.id)}
                    disabled={disabled}
                    onChange={() => toggle(stub.id)}
                    label={<span className={privateContentClassName}>{stub.name}</span>}
                    description={
                      disabled
                        ? openIds.has(stub.id)
                          ? t("fileSidebar.recentPicker.alreadyOpen", "Open")
                          : t("fileSidebar.fileItem.dataLost", "Data lost")
                        : [
                            stub.lastModified
                              ? new Date(stub.lastModified).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "",
                            stub.size ? formatFileSize(stub.size) : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")
                    }
                    styles={{ root: { padding: "6px 4px" } }}
                  />
                );
              })}
            </Stack>
          </ScrollArea.Autosize>
        )}

        <Group justify="flex-end">
          <Button variant="secondary" onClick={onClose}>
            {t("fileSidebar.rename.cancel", "Cancel")}
          </Button>
          <Button onClick={() => void confirm()} loading={adding} disabled={picked.size === 0}>
            {t("fileSidebar.recentPicker.add", "Add")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
