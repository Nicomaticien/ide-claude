import {
  deepestNode,
  lineOf,
  nodeById,
  ruleAt,
  type CssRule,
  type HtmlNode,
  type InspectModel,
} from "@/lib/inspect-map";

export type InspectMark = {
  line: number;
  kind: "primary" | "related";
};

export type HighlightRequest = {
  primaryId: number | null;
  selector: string | null;
};

export type InspectLink = {
  origin: "html" | "css" | "preview";
  primaryId: number | null;
  selector: string | null;
  htmlMarks: InspectMark[];
  cssMarks: InspectMark[];
  scrollHtml: number | null;
  scrollCss: number | null;
};

export type HoverTarget =
  | { from: "html"; offset: number }
  | { from: "css"; offset: number }
  | { from: "preview"; nodeId: number };

export type MatchApi = {
  nodeIdsForSelector(selector: string): number[];
  selectorMatchesNode(selector: string, nodeId: number): boolean;
};

const EMPTY_MATCH: MatchApi = {
  nodeIdsForSelector: () => [],
  selectorMatchesNode: () => false,
};

function addRange(
  source: string,
  start: number,
  end: number,
  kind: InspectMark["kind"],
  marks: InspectMark[],
) {
  if (source.length === 0) return;
  const from = lineOf(source, start);
  const to = end > start ? lineOf(source, end - 1) : from;
  const last = Math.min(to, from + 79);
  for (let line = from; line <= last; line += 1) marks.push({ line, kind });
}

function dedupe(marks: InspectMark[]): InspectMark[] {
  const kinds = new Map<number, InspectMark["kind"]>();
  for (const mark of marks) {
    const previous = kinds.get(mark.line);
    if (!previous || mark.kind === "primary") kinds.set(mark.line, mark.kind);
  }
  return [...kinds.entries()]
    .map(([line, kind]) => ({ line, kind }))
    .sort((left, right) => left.line - right.line);
}

function markNode(source: string, node: HtmlNode, kind: InspectMark["kind"], marks: InspectMark[]) {
  addRange(source, node.openStart, node.openEnd, kind, marks);
}

function matchingCss(rules: CssRule[], nodeId: number, api: MatchApi): CssRule[] {
  return rules.filter((rule) => api.selectorMatchesNode(rule.selector, nodeId)).slice(-12);
}

function linkElement(
  model: InspectModel,
  node: HtmlNode,
  origin: InspectLink["origin"],
  api: MatchApi,
): InspectLink {
  const htmlMarks: InspectMark[] = [];
  const cssMarks: InspectMark[] = [];
  markNode(model.htmlSource, node, "primary", htmlMarks);

  for (const rule of matchingCss(model.embeddedRules, node.id, api)) {
    addRange(model.htmlSource, rule.start, rule.end, "related", htmlMarks);
  }
  const cssHits = matchingCss(model.cssRules, node.id, api);
  for (const rule of cssHits) {
    addRange(model.cssSource, rule.start, rule.end, "related", cssMarks);
  }

  const htmlLines = dedupe(htmlMarks);
  const cssLines = dedupe(cssMarks);
  return {
    origin,
    primaryId: node.id,
    selector: null,
    htmlMarks: htmlLines,
    cssMarks: cssLines,
    scrollHtml: htmlLines.find((mark) => mark.kind === "primary")?.line ?? null,
    scrollCss: cssLines.at(-1)?.line ?? null,
  };
}

function linkRule(
  model: InspectModel,
  rule: CssRule,
  origin: "html" | "css",
  api: MatchApi,
): InspectLink {
  const htmlMarks: InspectMark[] = [];
  const cssMarks: InspectMark[] = [];
  const ids = api.nodeIdsForSelector(rule.selector).slice(0, 20);

  if (origin === "css") {
    addRange(model.cssSource, rule.start, rule.end, "primary", cssMarks);
  } else {
    addRange(model.htmlSource, rule.start, rule.end, "primary", htmlMarks);
  }

  let firstNode: HtmlNode | null = null;
  for (const id of ids) {
    const node = nodeById(model.nodes, id);
    if (!node) continue;
    firstNode ??= node;
    markNode(model.htmlSource, node, origin === "css" ? "related" : "primary", htmlMarks);
  }

  const htmlLines = dedupe(htmlMarks);
  const cssLines = dedupe(cssMarks);
  return {
    origin,
    primaryId: null,
    selector: rule.selector,
    htmlMarks: htmlLines,
    cssMarks: cssLines,
    scrollHtml: firstNode ? lineOf(model.htmlSource, firstNode.openStart) : null,
    scrollCss: origin === "css" ? null : (cssLines[0]?.line ?? null),
  };
}

export function resolveHover(
  model: InspectModel,
  hover: HoverTarget | null,
  api: MatchApi | null,
): InspectLink | null {
  if (!hover) return null;
  const match = api ?? EMPTY_MATCH;

  if (hover.from === "preview") {
    const node = nodeById(model.nodes, hover.nodeId);
    return node ? linkElement(model, node, "preview", match) : null;
  }

  if (hover.from === "css") {
    const rule = ruleAt(model.cssRules, hover.offset);
    return rule ? linkRule(model, rule, "css", match) : null;
  }

  const node = deepestNode(model.nodes, hover.offset);
  if (
    node?.tag === "style" &&
    hover.offset >= node.openEnd &&
    node.closeStart >= 0 &&
    hover.offset < node.closeStart
  ) {
    const rule = ruleAt(model.embeddedRules, hover.offset);
    if (rule) return linkRule(model, rule, "html", match);
  }

  return node ? linkElement(model, node, "html", match) : null;
}

export function linkKey(link: InspectLink | null): string {
  if (!link) return "";
  const lines = (marks: InspectMark[]) => marks.map((mark) => `${mark.kind}:${mark.line}`).join(",");
  return [
    link.origin,
    link.primaryId ?? "",
    link.selector ?? "",
    lines(link.htmlMarks),
    lines(link.cssMarks),
  ].join("|");
}
