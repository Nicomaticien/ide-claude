"use client";

import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { StateEffect, StateField } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { InspectMark } from "@/lib/inspect-link";

const NO_MARKS: InspectMark[] = [];

function revealLine(view: EditorView, lineNo: number, focus: boolean) {
  const line = view.state.doc.line(Math.min(Math.max(lineNo, 1), view.state.doc.lines));
  const place = () => {
    const block = view.lineBlockAt(line.from);
    const scroller = view.scrollDOM;
    const next = block.top - Math.max(0, (scroller.clientHeight - block.height) / 2);
    if (Number.isFinite(next)) scroller.scrollTop = Math.max(0, next);
  };

  if (focus) view.focus();
  view.dispatch({
    selection: { anchor: line.from },
    effects: EditorView.scrollIntoView(line.from, { y: "center" }),
  });
  place();
  requestAnimationFrame(() => {
    place();
    requestAnimationFrame(place);
  });
}

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => <div className="editor-skeleton">Chargement de l’éditeur…</div>,
});

type Language = "html" | "css";

const setInspectMarks = StateEffect.define<InspectMark[]>();

const inspectHighlight = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (!effect.is(setInspectMarks)) continue;
      const ranges = [];
      const seen = new Set<number>();
      for (const mark of effect.value) {
        if (mark.line < 1 || mark.line > transaction.state.doc.lines || seen.has(mark.line)) continue;
        seen.add(mark.line);
        const line = transaction.state.doc.line(mark.line);
        ranges.push(
          Decoration.line({
            class: mark.kind === "primary" ? "cm-inspect-primary" : "cm-inspect-related",
          }).range(line.from),
        );
      }
      return Decoration.set(ranges, true);
    }
    return value.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function CodeEditor({
  language,
  value,
  onChange,
  touch = false,
  inspectMarks = NO_MARKS,
  jumpLine = null,
  jumpToken = null,
  jumpFocus = false,
  onHoverOffset,
}: {
  language: Language;
  value: string;
  onChange: (value: string) => void;
  touch?: boolean;
  inspectMarks?: InspectMark[];
  jumpLine?: number | null;
  jumpToken?: number | null;
  jumpFocus?: boolean;
  onHoverOffset?: (offset: number | null) => void;
}) {
  const viewRef = useRef<EditorView | null>(null);
  const hoverRef = useRef(onHoverOffset);
  const [viewEpoch, setViewEpoch] = useState(0);

  useEffect(() => {
    hoverRef.current = onHoverOffset;
  }, [onHoverOffset]);

  const extensions = useMemo(() => {
    const theme = EditorView.theme(
      {
        "&": {
          height: "100%",
          fontSize: touch ? "16px" : "13px",
          backgroundColor: "transparent",
        },
        "&.cm-editor": {
          height: "100%",
          backgroundColor: "transparent",
        },
        ".cm-scroller": {
          fontFamily:
            "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
          lineHeight: "1.65",
          overflow: "auto",
          paddingBottom: touch ? "24px" : "0",
        },
        ".cm-focused": { outline: "none" },
        ".cm-gutters": {
          backgroundColor: "transparent",
          border: "none",
          color: "#667085",
        },
        ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.035)" },
        ".cm-activeLineGutter": { backgroundColor: "transparent" },
        ".cm-inspect-primary": {
          backgroundColor: "rgba(111, 168, 220, 0.28)",
          boxShadow: "inset 3px 0 0 #6fa8dc",
        },
        ".cm-inspect-related": {
          backgroundColor: "rgba(246, 178, 107, 0.2)",
          boxShadow: "inset 3px 0 0 #f6b26b",
        },
      },
      { dark: true },
    );

    return [
      language === "html" ? html({ autoCloseTags: true }) : css(),
      EditorView.lineWrapping,
      inspectHighlight,
      theme,
    ];
  }, [language, touch]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setInspectMarks.of(onHoverOffset ? inspectMarks : NO_MARKS) });
  }, [inspectMarks, onHoverOffset, value, viewEpoch]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || jumpToken == null || jumpLine == null) return;
    revealLine(view, jumpLine, jumpFocus);
  }, [jumpLine, jumpToken, jumpFocus, viewEpoch]);

  return (
    <div className="editor-root">
      <CodeMirror
        value={value}
        height="100%"
        theme={oneDark}
        extensions={extensions}
        onChange={onChange}
        onCreateEditor={(view) => {
          viewRef.current = view;
          const onMove = (event: MouseEvent) => {
            if (!hoverRef.current) return;
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            hoverRef.current(pos);
          };
          const onLeave = () => hoverRef.current?.(null);
          view.dom.addEventListener("mousemove", onMove);
          view.dom.addEventListener("mouseleave", onLeave);
          setViewEpoch((epoch) => epoch + 1);
        }}
        basicSetup={{
          foldGutter: !touch,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          autocompletion: !touch,
          bracketMatching: true,
          closeBrackets: true,
          indentOnInput: true,
          tabSize: 2,
        }}
      />
    </div>
  );
}
