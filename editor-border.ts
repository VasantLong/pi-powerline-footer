/**
 * Curved editor chrome.
 *
 * Embeds Powerline's primary row into the editor's top border and draws a
 * rounded bottom border, replacing Pi's default square border.
 *
 * Kept in its own module so the upstream upgrade surface stays one small,
 * reviewable patch: `index.ts` only calls `embedCurvedEditorChrome()` from its
 * normal editor chrome path.
 */

import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const TOP_LEFT = "\u256D";
const TOP_RIGHT = "\u256E";
const BOTTOM_LEFT = "\u2570";
const BOTTOM_RIGHT = "\u256F";
const HORIZONTAL = "\u2500";

/** Locates a run of box-drawing horizontals, i.e. Pi's closing editor border row. */
const BORDER_LINE = /\u2500{3,}/;

/** Paints a run of border glyphs. Injected so callers can reuse Pi's live editor border color. */
export type BorderPainter = (text: string) => string;

export interface CurvedEditorChromeOptions {
  /** Lines returned by the wrapped editor's own `render(contentWidth)`. */
  editorLines: readonly string[];
  /** Powerline primary row. ANSI allowed; already space-padded by the layout builder. */
  topContent: string;
  /** Full row width, including both border glyphs. */
  width: number;
  /** Inner content width used by the wrapped editor, normally `width - 3`. */
  contentWidth: number;
  /** Prefix applied to the first editor body row, e.g. ` > `. */
  promptPrefix: string;
  /** Prefix applied to continuation rows. */
  continuationPrefix: string;
  /** Paints border glyphs. */
  border: BorderPainter;
  /** Optional row rendered directly below the rounded bottom border. */
  belowBorderLine?: string;
}

/**
 * Renders one rounded border row: `╭─ <inline> ───╮` when `isTop`, otherwise `╰────╯`.
 * Falls back to truncating `inline` when it cannot fit alongside the glyphs.
 */
export function renderCurvedBorder(inline: string, width: number, isTop: boolean, border: BorderPainter): string {
  const left = isTop ? TOP_LEFT : BOTTOM_LEFT;
  const right = isTop ? TOP_RIGHT : BOTTOM_RIGHT;
  if (width < 4) return border(left + right);

  const inlineWidth = visibleWidth(inline);
  const fill = width - 2 - inlineWidth;
  if (fill >= 2) {
    const lead = inlineWidth > 0 ? 1 : 0;
    return (
      border(left) +
      (inlineWidth > 0 ? border(HORIZONTAL) + inline : "") +
      border(HORIZONTAL.repeat(Math.max(0, fill - lead))) +
      border(right)
    );
  }

  const half = Math.max(1, Math.floor((width - 2) / 2));
  return border(left) + truncateToWidth(inline, half, "...") + border(right);
}

/** Index of the wrapped editor's closing border row, or its final row when absent. */
export function findBottomBorderIndex(lines: readonly string[]): number {
  for (let index = lines.length - 1; index >= 1; index--) {
    const plain = (lines[index] ?? "").replace(/\x1b\[[0-9;]*m/g, "");
    if (plain.length > 0 && BORDER_LINE.test(plain)) return index;
  }
  return lines.length - 1;
}

/** Rebuilds editor lines with a rounded top border carrying `topContent` and a rounded bottom border. */
export function embedCurvedEditorChrome(options: CurvedEditorChromeOptions): string[] {
  const {
    editorLines,
    topContent,
    width,
    contentWidth,
    promptPrefix,
    continuationPrefix,
    border,
    belowBorderLine,
  } = options;
  if (editorLines.length === 0) return [...editorLines];

  const bottomIndex = findBottomBorderIndex(editorLines);
  const result: string[] = [renderCurvedBorder(topContent, width, true, border)];

  for (let index = 1; index < bottomIndex; index++) {
    result.push(`${index === 1 ? promptPrefix : continuationPrefix}${editorLines[index] ?? ""}`);
  }
  if (bottomIndex === 1) {
    result.push(promptPrefix + " ".repeat(contentWidth));
  }

  result.push(renderCurvedBorder("", width, false, border));
  if (belowBorderLine) result.push(belowBorderLine);

  for (let index = bottomIndex + 1; index < editorLines.length; index++) {
    result.push(editorLines[index] ?? "");
  }
  return result;
}
