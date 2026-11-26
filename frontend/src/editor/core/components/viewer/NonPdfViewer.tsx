import React, { useMemo } from "react";
import { Box, Center, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Icon } from "@editor/ui/Icon";
import { useAllFiles } from "@editor/contexts/FileContext";
import { useViewer } from "@editor/contexts/ViewerContext";
import { detectNonPdfFileType } from "@editor/utils/fileUtils";

import { NonPdfBanner } from "@editor/components/viewer/nonpdf/NonPdfBanner";
import { ImageViewer } from "@editor/components/viewer/nonpdf/ImageViewer";
import { CsvViewer } from "@editor/components/viewer/nonpdf/CsvViewer";
import { JsonViewer } from "@editor/components/viewer/nonpdf/JsonViewer";
import { TextViewer } from "@editor/components/viewer/nonpdf/TextViewer";
import { HtmlViewer } from "@editor/components/viewer/nonpdf/HtmlViewer";
import { privateContentClassName } from "@editor/components/shared/privateContentClassName";

export interface ViewerProps {
  onClose?: () => void;
  previewFile?: File | null;
}

export interface NonPdfViewerProps extends ViewerProps {
  file: File;
}

export function NonPdfViewer({ file }: NonPdfViewerProps) {
  const { t } = useTranslation();
  const fileType = useMemo(() => detectNonPdfFileType(file), [file]);

  const renderContent = () => {
    switch (fileType) {
      case "image":
        return <ImageViewer file={file} fileName={file.name} />;
      case "csv":
        return (
          <CsvViewer
            file={file}
            isTsv={file.name.toLowerCase().endsWith(".tsv")}
          />
        );
      case "json":
        return <JsonViewer file={file} />;
      case "markdown":
        return <TextViewer file={file} isMarkdown />;
      case "text":
        return <TextViewer file={file} isMarkdown={false} />;
      case "html":
        return <HtmlViewer file={file} />;
      default:
        return (
          <Center style={{ flex: 1 }}>
            <Stack align="center" gap="sm">
              <Icon
                name="file-text"
                size={"3rem"}
                style={{ color: "var(--mantine-color-gray-4)" }}
              />
              <Text c="dimmed" size="sm">
                {t(
                  "viewer.nonPdf.previewUnavailable",
                  "Preview not available for this file type",
                )}
              </Text>
            </Stack>
          </Center>
        );
    }
  };

  return (
    <Stack
      gap={0}
      style={{
        height: "100%",
        flex: 1,
        overflow: "hidden",
        position: "relative",
        "--nonpdf-action-inset": "0rem",
      }}
    >
      <NonPdfBanner />
      <Box
        className={privateContentClassName}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {renderContent()}
      </Box>
    </Stack>
  );
}

// ─── Wrapper that resolves the active file from FileContext ───────────────────

export function NonPdfViewerWrapper(props: ViewerProps) {
  const { t } = useTranslation();
  const { files: activeFiles } = useAllFiles();
  const { activeFileIndex } = useViewer();

  const file =
    props.previewFile ?? activeFiles[activeFileIndex] ?? activeFiles[0] ?? null;

  if (!file) {
    return (
      <Center style={{ flex: 1 }}>
        <Text c="dimmed" size="sm">
          {t("viewer.nonPdf.noFile", "No file loaded")}
        </Text>
      </Center>
    );
  }

  return <NonPdfViewer {...props} file={file} />;
}

export default NonPdfViewerWrapper;
