const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const RAW_TEXT_TAGS = new Set(["script", "style", "textarea", "title"]);

const DECL_ONLY_AT = new Set([
  "font-face",
  "page",
  "counter-style",
  "font-palette-values",
  "property",
  "color-profile",
  "font-feature-values",
  "charset",
]);

const ACTION_PSEUDOS =
  /:(?:hover|focus-visible|focus-within|focus|active|visited|any-link|link|target)\b/g;

export type HtmlNode = {
  id: number;
  tag: string;
  openStart: number;
  openEnd: number;
  closeStart: number;
  closeEnd: number;
  parentId: number | null;
};

export type CssRule = {
  selector: string;
  start: number;
  end: number;
};

export type HtmlMap = {
  stamped: string;
  nodes: HtmlNode[];
};

export type InspectModel = {
  stampedHtml: string;
  nodes: HtmlNode[];
  embeddedRules: CssRule[];
  cssRules: CssRule[];
  htmlSource: string;
  cssSource: string;
};

function isNameChar(char: string): boolean {
  return /[A-Za-z0-9:_-]/.test(char);
}

export function mapHtml(source: string): HtmlMap {
  const nodes: HtmlNode[] = [];
  const stack: number[] = [];
  let out = "";
  let index = 0;
  let nextId = 1;

  const copyTo = (end: number) => {
    out += source.slice(index, end);
    index = end;
  };

  while (index < source.length) {
    if (source.startsWith("<!--", index)) {
      const end = source.indexOf("-->", index + 4);
      copyTo(end === -1 ? source.length : end + 3);
      continue;
    }

    if (source.startsWith("<!", index) || source.startsWith("<?", index)) {
      const end = source.indexOf(">", index + 2);
      copyTo(end === -1 ? source.length : end + 1);
      continue;
    }

    if (source[index] !== "<") {
      const next = source.indexOf("<", index);
      copyTo(next === -1 ? source.length : next);
      continue;
    }

    const tagStart = index;
    const isClose = source[index + 1] === "/";
    let cursor = index + 1 + (isClose ? 1 : 0);
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
    const nameStart = cursor;
    while (cursor < source.length && isNameChar(source[cursor])) cursor += 1;
    const tag = source.slice(nameStart, cursor).toLowerCase();
    if (!tag) {
      copyTo(index + 1);
      continue;
    }

    let quote: string | null = null;
    let selfClosing = false;
    while (cursor < source.length) {
      const char = source[cursor];
      if (quote) {
        if (char === quote) quote = null;
        cursor += 1;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        cursor += 1;
        continue;
      }
      if (char === "/" && source[cursor + 1] === ">") {
        selfClosing = true;
        cursor += 2;
        break;
      }
      if (char === ">") {
        cursor += 1;
        break;
      }
      cursor += 1;
    }
    const tagEnd = cursor;

    if (isClose) {
      copyTo(tagEnd);
      for (let slot = stack.length - 1; slot >= 0; slot -= 1) {
        if (nodes[stack[slot]].tag !== tag) continue;
        const node = nodes[stack[slot]];
        node.closeStart = tagStart;
        node.closeEnd = tagEnd;
        stack.length = slot;
        break;
      }
      continue;
    }

    const parentId = stack.length ? nodes[stack[stack.length - 1]].id : null;
    const id = nextId;
    nextId += 1;
    const node: HtmlNode = {
      id,
      tag,
      openStart: tagStart,
      openEnd: tagEnd,
      closeStart: -1,
      closeEnd: -1,
      parentId,
    };
    nodes.push(node);

    const raw = source.slice(tagStart, tagEnd);
    const attr = ` data-ide-node="${id}"`;
    const slash = raw.lastIndexOf("/>");
    const stamped =
      selfClosing && slash !== -1
        ? `${raw.slice(0, slash)}${attr}${raw.slice(slash)}`
        : `${raw.slice(0, raw.lastIndexOf(">"))}${attr}>`;
    out += stamped;
    index = tagEnd;

    if (selfClosing || VOID_TAGS.has(tag)) {
      node.closeStart = tagStart;
      node.closeEnd = tagEnd;
      continue;
    }

    stack.push(nodes.length - 1);
    if (!RAW_TEXT_TAGS.has(tag)) continue;

    const closer = new RegExp(`</${tag}\\s*>`, "i");
    const match = closer.exec(source.slice(index));
    if (match) copyTo(index + match.index);
  }

  for (const node of nodes) {
    if (node.closeEnd >= 0 || VOID_TAGS.has(node.tag)) continue;
    node.closeStart = source.length;
    node.closeEnd = source.length;
  }

  return { stamped: out, nodes };
}

function atKeyword(prelude: string): string {
  const match = prelude.trim().match(/^@([a-zA-Z-]+)/);
  return match ? match[1].toLowerCase() : "";
}

function cleanSelector(raw: string): string {
  return raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ").trim();
}

function splitSelectors(selector: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;
  let paren = 0;

  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index];
    if (quote) {
      current += char;
      if (char === "\\") {
        current += selector[index + 1] ?? "";
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === "," && paren === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function resolveSelector(selector: string, parent: string | null): string {
  if (!selector) return "";
  if (!parent) return selector.replace(/&/g, ":scope");

  const parents = splitSelectors(parent);
  const parts = splitSelectors(selector);
  const expanded = parts.flatMap((part) =>
    parents.map((item) =>
      part.includes("&") ? part.replace(/&/g, item).trim() : `${item} ${part}`.trim(),
    ),
  );
  return expanded.join(", ");
}

export function selectorForQuery(selector: string): string {
  return selector
    .replace(/::[a-zA-Z-]+(?:\([^)]*\))?/g, "")
    .replace(ACTION_PSEUDOS, "")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/^,|,$/g, "")
    .trim();
}

export function mapCss(source: string, base = 0): CssRule[] {
  const rules: CssRule[] = [];
  let index = 0;

  const skipSpace = () => {
    for (;;) {
      while (index < source.length && /\s/.test(source[index])) index += 1;
      if (!source.startsWith("/*", index)) return;
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
    }
  };

  const readPrelude = (): "semi" | "brace" | "close" | "end" => {
    let quote: string | null = null;
    let paren = 0;
    while (index < source.length) {
      const char = source[index];
      if (quote) {
        if (char === "\\") {
          index += 2;
          continue;
        }
        if (char === quote) quote = null;
        index += 1;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        index += 1;
        continue;
      }
      if (source.startsWith("/*", index)) {
        const end = source.indexOf("*/", index + 2);
        index = end === -1 ? source.length : end + 2;
        continue;
      }
      if (char === "(") {
        paren += 1;
        index += 1;
        continue;
      }
      if (char === ")" && paren > 0) {
        paren -= 1;
        index += 1;
        continue;
      }
      if (paren === 0 && char === ";") {
        index += 1;
        return "semi";
      }
      if (paren === 0 && char === "{") {
        index += 1;
        return "brace";
      }
      if (paren === 0 && char === "}") return "close";
      index += 1;
    }
    return "end";
  };

  const consumeBalanced = () => {
    let depth = 1;
    let quote: string | null = null;
    while (index < source.length && depth > 0) {
      const char = source[index];
      if (quote) {
        if (char === "\\") {
          index += 2;
          continue;
        }
        if (char === quote) quote = null;
        index += 1;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        index += 1;
        continue;
      }
      if (source.startsWith("/*", index)) {
        const end = source.indexOf("*/", index + 2);
        index = end === -1 ? source.length : end + 2;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      index += 1;
    }
  };

  const parseRuleBody = (parentSelector: string | null) => {
    while (index < source.length) {
      skipSpace();
      if (index >= source.length) return;
      if (source[index] === "}") {
        index += 1;
        return;
      }

      const from = index;
      const kind = readPrelude();
      if (kind === "close") {
        if (source[index] === "}") index += 1;
        return;
      }
      if (kind === "end" || kind === "semi") continue;

      const text = source.slice(from, index - 1).trim();
      if (text.startsWith("@")) {
        consumeAt(text, parentSelector);
        continue;
      }

      const selector = resolveSelector(cleanSelector(text), parentSelector);
      parseRuleBody(selector || parentSelector);
      if (!selector) continue;
      rules.push({ selector, start: base + from, end: base + index });
    }
  };

  const consumeAt = (prelude: string, parentSelector: string | null) => {
    const name = atKeyword(prelude);
    if (name === "keyframes" || name.endsWith("keyframes") || DECL_ONLY_AT.has(name)) {
      consumeBalanced();
      return;
    }
    parseRules(parentSelector);
    skipSpace();
    if (source[index] === "}") index += 1;
  };

  const parseRules = (parentSelector: string | null) => {
    while (index < source.length) {
      skipSpace();
      if (index >= source.length || source[index] === "}") return;

      const from = index;
      const kind = readPrelude();
      if (kind === "close" || kind === "end") return;
      if (kind === "semi") continue;

      const text = source.slice(from, index - 1).trim();
      if (text.startsWith("@")) {
        consumeAt(text, parentSelector);
        continue;
      }

      const selector = resolveSelector(cleanSelector(text), null);
      parseRuleBody(selector || null);
      if (!selector) continue;
      rules.push({ selector, start: base + from, end: base + index });
    }
  };

  parseRules(null);
  return rules;
}

export function embeddedCssRules(source: string, nodes: HtmlNode[]): CssRule[] {
  const rules: CssRule[] = [];
  for (const node of nodes) {
    if (node.tag !== "style" || node.closeStart < node.openEnd) continue;
    rules.push(...mapCss(source.slice(node.openEnd, node.closeStart), node.openEnd));
  }
  return rules;
}

export function buildInspectModel(html: string, css: string): InspectModel {
  const mapped = mapHtml(html);
  return {
    stampedHtml: mapped.stamped,
    nodes: mapped.nodes,
    embeddedRules: embeddedCssRules(html, mapped.nodes),
    cssRules: css.trim() ? mapCss(css) : [],
    htmlSource: html,
    cssSource: css,
  };
}

export function lineOf(source: string, offset: number): number {
  const end = Math.max(0, Math.min(offset, source.length));
  let line = 1;
  for (let index = 0; index < end; index += 1) {
    if (source.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

export function deepestNode(nodes: HtmlNode[], offset: number): HtmlNode | null {
  let best: HtmlNode | null = null;
  let bestSpan = Infinity;
  for (const node of nodes) {
    const end = node.closeEnd >= 0 ? node.closeEnd : node.openEnd;
    if (offset < node.openStart || offset >= end) continue;
    const span = end - node.openStart;
    if (span < bestSpan) {
      best = node;
      bestSpan = span;
    }
  }
  return best;
}

export function ruleAt(rules: CssRule[], offset: number): CssRule | null {
  let best: CssRule | null = null;
  let bestSpan = Infinity;
  for (const rule of rules) {
    if (offset < rule.start || offset >= rule.end) continue;
    const span = rule.end - rule.start;
    if (span < bestSpan) {
      best = rule;
      bestSpan = span;
    }
  }
  return best;
}

export function nodeById(nodes: HtmlNode[], id: number): HtmlNode | null {
  return nodes.find((node) => node.id === id) ?? null;
}
