import type { CSSProperties } from "react";

const HANDLE_SIZE = 7;
const OUTLINE_BLUE = "#4aa3e8";
const FILL_BLUE = "#2d7fc6";
const FILL_VERTEX = "#c9a52a";
const EDGE = "#2b2b2b";

type HandleRenderProps = { style: CSSProperties } & Record<string, unknown>;

function sharp(
  { backgroundColor: _bg, style, ...rest }: HandleRenderProps & { backgroundColor?: string },
  fill: string,
  round: boolean,
) {
  return (
    <div
      {...rest}
      style={{
        ...style,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        background: fill,
        border: `1px solid ${EDGE}`,
        borderRadius: round ? "50%" : 0,
        boxSizing: "border-box",
      }}
    />
  );
}

/** Small, crisp handles and a thin dashed outline, the way Bluebeam draws a selected markup. */
export const selectionHandleUI = {
  selectionOutline: { color: OUTLINE_BLUE, style: "dashed", width: 1, offset: 3 },
  resizeUI: {
    size: HANDLE_SIZE,
    color: FILL_BLUE,
    component: (p: HandleRenderProps) => sharp(p, FILL_BLUE, false),
  },
  vertexUI: {
    size: HANDLE_SIZE,
    color: FILL_VERTEX,
    component: (p: HandleRenderProps) => sharp(p, FILL_VERTEX, true),
  },
  rotationUI: {
    size: HANDLE_SIZE,
    margin: 18,
    color: FILL_BLUE,
    connectorColor: OUTLINE_BLUE,
    iconColor: "transparent",
    border: { color: EDGE, style: "solid", width: 1 },
  },
} as const;
