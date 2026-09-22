"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { composeDocument } from "@/lib/compose";
import type { HighlightRequest } from "@/lib/inspect-link";
import {
  bindPreviewHover,
  drawHighlight,
  nodeIdsForSelector,
  selectorMatchesNode,
} from "@/lib/inspect-overlay";

export type PreviewInspectHandle = {
  nodeIdsForSelector(selector: string): number[];
  selectorMatchesNode(selector: string, nodeId: number): boolean;
};

export const PreviewFrame = forwardRef<
  PreviewInspectHandle,
  {
    html: string;
    css: string;
    width: string;
    variant?: "stage" | "page";
    inspect?: boolean;
    highlight?: HighlightRequest | null;
    onHoverNode?: (nodeId: number | null) => void;
    onSelectNode?: (nodeId: number) => void;
  }
>(function PreviewFrame(
  { html, css, width, variant = "stage", inspect = false, highlight = null, onHoverNode, onSelectNode },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onHoverRef = useRef(onHoverNode);
  const onSelectRef = useRef(onSelectNode);

  useEffect(() => {
    onHoverRef.current = onHoverNode;
    onSelectRef.current = onSelectNode;
  }, [onHoverNode, onSelectNode]);

  useImperativeHandle(
    ref,
    () => ({
      nodeIdsForSelector(selector: string) {
        const doc = iframeRef.current?.contentDocument;
        return doc ? nodeIdsForSelector(doc, selector) : [];
      },
      selectorMatchesNode(selector: string, nodeId: number) {
        const doc = iframeRef.current?.contentDocument;
        return doc ? selectorMatchesNode(doc, selector, nodeId) : false;
      },
    }),
    [],
  );

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

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || !inspect) {
      if (doc?.documentElement) doc.documentElement.style.cursor = "";
      return;
    }
    doc.documentElement.style.cursor = "crosshair";
    const iframe = iframeRef.current;
    const unbind = bindPreviewHover(
      doc,
      (nodeId) => onHoverRef.current?.(nodeId),
      (nodeId) => onSelectRef.current?.(nodeId),
    );
    const onFrameLeave = () => onHoverRef.current?.(null);
    iframe?.addEventListener("mouseleave", onFrameLeave);
    return () => {
      unbind();
      iframe?.removeEventListener("mouseleave", onFrameLeave);
    };
  }, [html, css, inspect]);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    drawHighlight(doc, inspect ? highlight : null);
  }, [html, css, inspect, highlight]);

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
});
