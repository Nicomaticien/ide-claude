"use client";

import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import dynamic from "next/dynamic";
import { useMemo } from "react";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => <div className="editor-skeleton">Chargement de l’éditeur…</div>,
});

type Language = "html" | "css";

export function CodeEditor({
  language,
  value,
  onChange,
  touch = false,
}: {
  language: Language;
  value: string;
  onChange: (value: string) => void;
  touch?: boolean;
}) {
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
      },
      { dark: true },
    );

    return [
      language === "html" ? html({ autoCloseTags: true }) : css(),
      EditorView.lineWrapping,
      theme,
    ];
  }, [language, touch]);

  return (
    <div className="editor-root">
      <CodeMirror
        value={value}
        height="100%"
        theme={oneDark}
        extensions={extensions}
        onChange={onChange}
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
