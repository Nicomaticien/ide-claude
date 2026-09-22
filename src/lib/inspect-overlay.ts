import type { HighlightRequest } from "@/lib/inspect-link";
import { selectorForQuery } from "@/lib/inspect-map";

const HOST_ID = "ide-inspect-host";
const MAX_BOXES = 40;

const lastRequest = new WeakMap<Document, HighlightRequest | null>();

function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ensureHost(doc: Document): ShadowRoot | null {
  const root = doc.documentElement;
  if (!root) return null;

  let host = doc.getElementById(HOST_ID);
  if (!host) {
    host = doc.createElement("ide-inspect-host");
    host.id = HOST_ID;
    host.setAttribute("data-ide-overlay", "true");
    root.appendChild(host);
  }

  host.setAttribute(
    "style",
    "all: initial; position: fixed; inset: 0; width: 0; height: 0; overflow: visible; pointer-events: none; z-index: 2147483646;",
  );

  return host.shadowRoot ?? host.attachShadow({ mode: "open" });
}

function boxStyle(left: number, top: number, width: number, height: number, color: string): string {
  return [
    "position:fixed",
    "pointer-events:none",
    "box-sizing:border-box",
    `left:${left}px`,
    `top:${top}px`,
    `width:${Math.max(0, width)}px`,
    `height:${Math.max(0, height)}px`,
    `background:${color}`,
  ].join(";");
}

function describe(element: Element, extra: number): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id && element.id !== HOST_ID ? `#${element.id}` : "";
  const classes = [...element.classList]
    .slice(0, 3)
    .map((name) => `.${name}`)
    .join("");
  const rect = element.getBoundingClientRect();
  const size = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
  const count = extra > 1 ? ` · ${extra} éléments` : "";
  return `${tag}${id}${classes}  ${size}${count}`;
}

function paintBoxes(doc: Document, elements: Element[]) {
  const shadow = ensureHost(doc);
  if (!shadow) return;
  shadow.innerHTML = "";
  if (elements.length === 0) return;

  const style = doc.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .label {
      position: fixed;
      z-index: 2;
      max-width: min(420px, calc(100vw - 16px));
      padding: 3px 7px;
      border-radius: 4px;
      background: #1a73e8;
      color: #fff;
      font: 600 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    .outline {
      position: fixed;
      pointer-events: none;
      box-sizing: border-box;
      border: 2px solid #1a73e8;
      background: rgba(26, 115, 232, 0.12);
    }
  `;
  shadow.appendChild(style);

  const [primary, ...rest] = elements;
  const primaryRect = primary.getBoundingClientRect();
  const computed = doc.defaultView?.getComputedStyle(primary);

  if (computed && primaryRect.width + primaryRect.height > 0) {
    const marginTop = px(computed.marginTop);
    const marginRight = px(computed.marginRight);
    const marginBottom = px(computed.marginBottom);
    const marginLeft = px(computed.marginLeft);
    const borderTop = px(computed.borderTopWidth);
    const borderRight = px(computed.borderRightWidth);
    const borderBottom = px(computed.borderBottomWidth);
    const borderLeft = px(computed.borderLeftWidth);
    const paddingTop = px(computed.paddingTop);
    const paddingRight = px(computed.paddingRight);
    const paddingBottom = px(computed.paddingBottom);
    const paddingLeft = px(computed.paddingLeft);

    const layers: Array<[number, number, number, number, string]> = [
      [
        primaryRect.left - marginLeft,
        primaryRect.top - marginTop,
        primaryRect.width + marginLeft + marginRight,
        primaryRect.height + marginTop + marginBottom,
        "rgba(246, 178, 107, 0.66)",
      ],
      [primaryRect.left, primaryRect.top, primaryRect.width, primaryRect.height, "rgba(255, 229, 153, 0.75)"],
      [
        primaryRect.left + borderLeft,
        primaryRect.top + borderTop,
        primaryRect.width - borderLeft - borderRight,
        primaryRect.height - borderTop - borderBottom,
        "rgba(147, 196, 125, 0.7)",
      ],
      [
        primaryRect.left + borderLeft + paddingLeft,
        primaryRect.top + borderTop + paddingTop,
        primaryRect.width - borderLeft - borderRight - paddingLeft - paddingRight,
        primaryRect.height - borderTop - borderBottom - paddingTop - paddingBottom,
        "rgba(111, 168, 220, 0.55)",
      ],
    ];

    for (const [left, top, width, height, color] of layers) {
      const layer = doc.createElement("div");
      layer.setAttribute("style", boxStyle(left, top, width, height, color));
      shadow.appendChild(layer);
    }

    const label = doc.createElement("div");
    label.className = "label";
    label.textContent = describe(primary, elements.length);
    const labelTop = primaryRect.top - marginTop;
    const placeAbove = labelTop > 26;
    label.setAttribute(
      "style",
      `left:${Math.max(4, primaryRect.left - marginLeft)}px;top:${placeAbove ? labelTop - 22 : primaryRect.top + 4}px;`,
    );
    shadow.appendChild(label);
  }

  for (const element of rest) {
    const rect = element.getBoundingClientRect();
    if (rect.width + rect.height <= 0) continue;
    const outline = doc.createElement("div");
    outline.className = "outline";
    outline.setAttribute("style", `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`);
    shadow.appendChild(outline);
  }
}

function isOverlay(element: Element): boolean {
  return element.id === HOST_ID || Boolean(element.closest(`#${HOST_ID}`));
}

export function elementsForHighlight(doc: Document, request: HighlightRequest): Element[] {
  const found: Element[] = [];
  const seen = new Set<Element>();
  const add = (element: Element | null) => {
    if (!element || seen.has(element) || isOverlay(element)) return;
    seen.add(element);
    found.push(element);
  };

  if (request.primaryId != null) {
    add(doc.querySelector(`[data-ide-node="${request.primaryId}"]`));
  }

  if (request.selector) {
    const query = selectorForQuery(request.selector);
    if (query) {
      try {
        for (const element of doc.querySelectorAll(query)) {
          if (found.length >= MAX_BOXES) break;
          add(element);
        }
      } catch {
        // The selector is not valid for querySelector.
      }
    }
  }

  return found;
}

export function drawHighlight(doc: Document, request: HighlightRequest | null) {
  lastRequest.set(doc, request);
  if (!request || (!request.selector && request.primaryId == null)) {
    const shadow = doc.getElementById(HOST_ID)?.shadowRoot;
    if (shadow) shadow.innerHTML = "";
    return;
  }
  paintBoxes(doc, elementsForHighlight(doc, request));
}

export function nodeIdsForSelector(doc: Document, selector: string): number[] {
  const query = selectorForQuery(selector);
  if (!query) return [];
  try {
    const ids: number[] = [];
    for (const element of doc.querySelectorAll(query)) {
      if (isOverlay(element)) continue;
      const stamped = element.closest("[data-ide-node]");
      const id = Number(stamped?.getAttribute("data-ide-node"));
      if (!Number.isFinite(id) || ids.includes(id)) continue;
      ids.push(id);
    }
    return ids;
  } catch {
    return [];
  }
}

export function selectorMatchesNode(doc: Document, selector: string, nodeId: number): boolean {
  const element = doc.querySelector(`[data-ide-node="${nodeId}"]`);
  if (!element) return false;
  const query = selectorForQuery(selector);
  if (!query) return false;
  try {
    return element.matches(query);
  } catch {
    return false;
  }
}

function nodeIdFromEvent(event: Event): number | null {
  const target = event.target;
  // The node belongs to the iframe realm, so parent `instanceof Element` is false.
  if (!target || (target as Node).nodeType !== 1) return null;
  const element = target as Element;
  if (isOverlay(element)) return null;
  const stamped = element.closest("[data-ide-node]");
  const id = Number(stamped?.getAttribute("data-ide-node"));
  return Number.isFinite(id) && stamped ? id : null;
}

export function bindPreviewHover(
  doc: Document,
  onHover: (nodeId: number | null) => void,
  onSelect: (nodeId: number) => void,
): () => void {
  let lastId: number | null | undefined;

  const emit = (nodeId: number | null) => {
    if (lastId === nodeId) return;
    lastId = nodeId;
    onHover(nodeId);
  };

  const onMove = (event: Event) => emit(nodeIdFromEvent(event));
  const onClick = (event: Event) => {
    const id = nodeIdFromEvent(event);
    if (id == null) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(id);
  };
  const onLeave = () => emit(null);
  const onScroll = () => {
    const request = lastRequest.get(doc);
    if (request) drawHighlight(doc, request);
  };

  doc.addEventListener("mousemove", onMove, true);
  doc.addEventListener("click", onClick, true);
  doc.documentElement.addEventListener("mouseleave", onLeave);
  doc.addEventListener("scroll", onScroll, true);

  return () => {
    doc.removeEventListener("mousemove", onMove, true);
    doc.removeEventListener("click", onClick, true);
    doc.documentElement.removeEventListener("mouseleave", onLeave);
    doc.removeEventListener("scroll", onScroll, true);
  };
}
