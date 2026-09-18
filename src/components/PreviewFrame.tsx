"use client";

import { useEffect, useRef } from "react";
import { composeDocument } from "@/lib/compose";

export function PreviewFrame({
  html,
  css,
  width,
  variant = "stage",
}: {
  html: string;
  css: string;
  width: string;
  variant?: "stage" | "page";
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const paint = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const x = doc.documentElement?.scrollLeft ?? 0;
      const y = doc.documentElement?.scrollTop ?? 0;
      doc.open();
      doc.write(composeDocument(html, css));
      doc.close();
      requestAnimationFrame(() => {
        doc.documentElement?.scrollTo(x, y);
        doc.body?.scrollTo?.(x, y);
      });
    };

    paint();
  }, [html, css]);

  return (
    <div className={variant === "page" ? "preview-page" : "preview-stage"}>
      <iframe
        ref={iframeRef}
        title="Aperçu en direct"
        className={variant === "page" ? "preview-frame-page" : "preview-frame"}
        style={{ width }}
        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin allow-pointer-lock"
      />
    </div>
  );
}
