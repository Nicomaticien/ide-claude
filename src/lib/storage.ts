import type { FileMode } from "@/lib/compose";

export type Project = {
  html: string;
  css: string;
  mode: FileMode;
  updatedAt: number;
};

export const STORAGE_KEY = "ide-claude.v1";
const LEGACY_STORAGE_KEY = "live-canvas.v1";

function asMode(value: unknown): FileMode {
  return value === "single" ? "single" : "split";
}

function parseProject(raw: string): Project | null {
  try {
    const parsed = JSON.parse(raw) as Partial<Project>;
    if (typeof parsed.html !== "string" || typeof parsed.css !== "string") {
      return null;
    }
    return {
      html: parsed.html,
      css: parsed.css,
      mode: asMode(parsed.mode),
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function loadProject(): Project | null {
  if (typeof window === "undefined") return null;
  const current = localStorage.getItem(STORAGE_KEY);
  if (current) return parseProject(current);
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  return legacy ? parseProject(legacy) : null;
}

export function saveProject(html: string, css: string, mode: FileMode) {
  const payload: Project = { html, css, mode, updatedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearProject() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}
