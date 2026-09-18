import { STORAGE_KEY, type Project } from "@/lib/storage";

export const PREVIEW_PATH = "/preview";
export const PREVIEW_WINDOW_NAME = "ide-claude-preview";

const CHANNEL = "ide-claude-preview";

export type PreviewPayload = {
  html: string;
  css: string;
};

function isPayload(value: unknown): value is PreviewPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as PreviewPayload;
  return typeof record.html === "string" && typeof record.css === "string";
}

export function publishPreview(html: string, css: string) {
  if (typeof window === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage({ html, css } satisfies PreviewPayload);
  channel.close();
}

export function subscribePreview(onUpdate: (payload: PreviewPayload) => void) {
  const channel = new BroadcastChannel(CHANNEL);

  const onMessage = (event: MessageEvent<unknown>) => {
    if (isPayload(event.data)) onUpdate(event.data);
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as Project;
      if (isPayload(parsed)) onUpdate(parsed);
    } catch {
      // ignore malformed payloads
    }
  };

  channel.addEventListener("message", onMessage);
  window.addEventListener("storage", onStorage);

  return () => {
    channel.removeEventListener("message", onMessage);
    channel.close();
    window.removeEventListener("storage", onStorage);
  };
}

export function openPreviewWindow() {
  const popup = window.open(PREVIEW_PATH, PREVIEW_WINDOW_NAME);
  popup?.focus();
  return popup;
}
