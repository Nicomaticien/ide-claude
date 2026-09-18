const STYLE_ID = "ide-claude-css";
const LEGACY_STYLE_ID = "live-canvas-css";

const STYLE_TAG_RE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const MANAGED_STYLE_RE = new RegExp(
  `<style[^>]*id=["'](?:${STYLE_ID}|${LEGACY_STYLE_ID})["'][^>]*>[\\s\\S]*?<\\/style>`,
  "i",
);

export type FileMode = "split" | "single";

export function hasEmbeddedCss(html: string): boolean {
  return /<style\b/i.test(html);
}

export function extractEmbeddedCss(html: string): { html: string; css: string } {
  const chunks: string[] = [];
  const next = html.replace(STYLE_TAG_RE, (block) => {
    const inner = block
      .replace(/^<style\b[^>]*>/i, "")
      .replace(/<\/style>$/i, "")
      .trim();
    if (inner) chunks.push(inner);
    return "";
  });

  return {
    html: next.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n"),
    css: chunks.join("\n\n"),
  };
}

export function ensureDocument(html: string): string {
  const source = html.trim();
  if (/<!doctype/i.test(source) || /<html[\s>]/i.test(source)) {
    return source;
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Aperçu</title>
</head>
<body>
${source}
</body>
</html>`;
}

export function composeDocument(html: string, css: string): string {
  const source = html.trim();
  if (!css.trim()) {
    return ensureDocument(source);
  }

  const styleBlock = `<style id="${STYLE_ID}">\n${css}\n</style>`;

  if (MANAGED_STYLE_RE.test(source)) {
    return source.replace(MANAGED_STYLE_RE, styleBlock);
  }

  if (/<\/head>/i.test(source)) {
    return source.replace(/<\/head>/i, `${styleBlock}\n</head>`);
  }

  if (/<html[^>]*>/i.test(source)) {
    return source.replace(/<html[^>]*>/i, (tag) => `${tag}\n<head>\n${styleBlock}\n</head>`);
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Aperçu</title>
  ${styleBlock}
</head>
<body>
${source}
</body>
</html>`;
}

export function previewCssForMode(mode: FileMode, css: string): string {
  return mode === "single" ? "" : css;
}
