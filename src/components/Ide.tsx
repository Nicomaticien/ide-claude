"use client";

import { Group, Panel, Separator } from "react-resizable-panels";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CodeEditor } from "@/components/CodeEditor";
import { LogoMark } from "@/components/LogoMark";
import { PreviewFrame } from "@/components/PreviewFrame";
import {
  composeDocument,
  extractEmbeddedCss,
  hasEmbeddedCss,
  previewCssForMode,
  type FileMode,
} from "@/lib/compose";
import { downloadFile } from "@/lib/download";
import { loadProject, saveProject } from "@/lib/storage";
import { STARTER_CSS, STARTER_HTML } from "@/lib/starter";
import { openPreviewWindow, publishPreview } from "@/lib/sync";

type Viewport = "fluid" | "tablet" | "mobile";
type MobileTab = "html" | "css" | "preview";

const VIEWPORTS: { id: Viewport; label: string; width: string }[] = [
  { id: "fluid", label: "Desktop", width: "100%" },
  { id: "tablet", label: "Tablette", width: "768px" },
  { id: "mobile", label: "Mobile", width: "390px" },
];

function useDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 960px)");
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}

export function Ide() {
  const [html, setHtml] = useState(STARTER_HTML);
  const [css, setCss] = useState(STARTER_CSS);
  const [mode, setMode] = useState<FileMode>("split");
  const [ready, setReady] = useState(false);
  const [viewport, setViewport] = useState<Viewport>("fluid");
  const [tab, setTab] = useState<MobileTab>("html");
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDesktop = useDesktopLayout();

  useEffect(() => {
    const saved = loadProject();
    // localStorage is only available after mount; keep SSR and hydration aligned.
    /* eslint-disable react-hooks/set-state-in-effect -- client storage bootstrap */
    if (saved) {
      setHtml(saved.html);
      setCss(saved.css);
      setMode(saved.mode);
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      saveProject(html, css, mode);
      publishPreview(html, previewCssForMode(mode, css));
    }, 80);
    return () => window.clearTimeout(timer);
  }, [html, css, mode, ready]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  const liveCss = previewCssForMode(mode, css);

  const openLivePage = useCallback(() => {
    saveProject(html, css, mode);
    publishPreview(html, liveCss);
    const popup = openPreviewWindow();
    if (!popup) {
      showToast("Autorise les pop-ups pour ouvrir l’aperçu");
      return;
    }
    showToast("Aperçu ouvert dans un autre onglet");
  }, [html, css, liveCss, mode, showToast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveProject(html, css, mode);
        publishPreview(html, liveCss);
        showToast("Sauvegardé dans le navigateur");
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "Enter") {
        event.preventDefault();
        openLivePage();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [html, css, liveCss, mode, showToast, openLivePage]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  const previewWidth = useMemo(
    () => VIEWPORTS.find((item) => item.id === viewport)?.width ?? "100%",
    [viewport],
  );

  const reset = () => {
    if (!window.confirm("Réinitialiser le projet ? Les modifications non exportées seront perdues.")) {
      return;
    }
    setHtml(STARTER_HTML);
    setCss(STARTER_CSS);
    setMode("split");
    showToast("Projet réinitialisé");
  };

  const setFileMode = (next: FileMode) => {
    if (next === mode) return;
    if (next === "single") {
      setHtml(composeDocument(html, css));
      setCss("");
      setMode("single");
      if (tab === "css") setTab("html");
      showToast("Mode fichier unique : le CSS est dans le HTML");
      return;
    }
    const extracted = extractEmbeddedCss(html);
    setHtml(extracted.html);
    setCss(extracted.css);
    setMode("split");
    showToast("Mode HTML + CSS séparés");
  };

  const downloadComplete = () => {
    downloadFile(
      "index.html",
      composeDocument(html, liveCss),
      "text/html;charset=utf-8",
    );
    setMenuOpen(false);
    showToast("index.html téléchargé");
  };

  const downloadSplit = () => {
    if (mode === "single") {
      const extracted = extractEmbeddedCss(html);
      downloadFile("index.html", extracted.html, "text/html;charset=utf-8");
      downloadFile("styles.css", extracted.css, "text/css;charset=utf-8");
    } else {
      downloadFile("index.html", html, "text/html;charset=utf-8");
      downloadFile("styles.css", css, "text/css;charset=utf-8");
    }
    setMenuOpen(false);
    showToast("HTML et CSS téléchargés");
  };

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    const htmlFile = list.find((file) => !file.name.toLowerCase().endsWith(".css"));
    const cssFile = list.find((file) => file.name.toLowerCase().endsWith(".css"));
    const htmlText = htmlFile ? await htmlFile.text() : null;
    const cssText = cssFile ? await cssFile.text() : null;

    if (htmlText !== null && cssText !== null) {
      setHtml(htmlText);
      setCss(cssText);
      setMode("split");
      showToast("HTML et CSS importés");
      return;
    }

    if (cssText !== null) {
      if (mode === "single") {
        setHtml(composeDocument(html, cssText));
        showToast("CSS intégré dans le HTML");
      } else {
        setCss(cssText);
        showToast("Fichier CSS importé");
      }
      return;
    }

    if (htmlText !== null) {
      if (hasEmbeddedCss(htmlText)) {
        setHtml(htmlText);
        setCss("");
        setMode("single");
        if (tab === "css") setTab("html");
        showToast("HTML avec CSS intégré");
      } else {
        setHtml(htmlText);
        showToast("Fichier HTML importé");
      }
    }
  };

  return (
    <div className="ide-shell">
      <header className="ide-topbar">
        <div className="brand">
          <LogoMark size={32} />
          <div>
            <p className="brand-name">
              <span className="brand-ide">IDE</span> Claude
            </p>
            <p className="brand-sub">Éditeur HTML / CSS</p>
          </div>
          <span className="live-pill">
            <span className="live-dot" />
            Live
          </span>
        </div>

        <div className="topbar-actions">
          <div className="viewport-switch file-mode-switch" role="group" aria-label="Type de fichier">
            <button
              type="button"
              className={mode === "split" ? "is-active" : ""}
              onClick={() => setFileMode("split")}
            >
              HTML + CSS
            </button>
            <button
              type="button"
              className={mode === "single" ? "is-active" : ""}
              onClick={() => setFileMode("single")}
            >
              HTML intégré
            </button>
          </div>

          <div className="viewport-switch" role="group" aria-label="Largeur d’aperçu">
            {VIEWPORTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={viewport === item.id ? "is-active" : ""}
                onClick={() => setViewport(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm,.css,text/html,text/css"
            multiple
            hidden
            onChange={(event) => {
              void importFiles(event.target.files);
              event.target.value = "";
            }}
          />

          <button type="button" className="ghost-btn" onClick={openLivePage}>
            Ouvrir l’aperçu
          </button>

          <button type="button" className="ghost-btn" onClick={() => fileInputRef.current?.click()}>
            Importer
          </button>

          <div className="menu-wrap">
            <button
              type="button"
              className="ghost-btn"
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((open) => !open);
              }}
            >
              Télécharger
            </button>
            {menuOpen ? (
              <div className="menu" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={downloadComplete}>
                  Page complète (.html)
                </button>
                <button type="button" onClick={downloadSplit}>
                  HTML + CSS séparés
                </button>
              </div>
            ) : null}
          </div>

          <button type="button" className="ghost-btn danger" onClick={reset}>
            Réinitialiser
          </button>
        </div>
      </header>

      {!isDesktop ? (
        <nav className="mobile-tabs" aria-label="Panneaux">
          {(mode === "single" ? (["html", "preview"] as const) : (["html", "css", "preview"] as const)).map(
            (item) => (
              <button
                key={item}
                type="button"
                className={tab === item ? "is-active" : ""}
                onClick={() => setTab(item)}
              >
                {item === "preview" ? "Aperçu" : item.toUpperCase()}
              </button>
            ),
          )}
        </nav>
      ) : null}

      <main className="ide-main">
        {isDesktop ? (
          <DesktopWorkspace
            html={html}
            css={css}
            mode={mode}
            previewWidth={previewWidth}
            onHtmlChange={setHtml}
            onCssChange={setCss}
            onOpenPreview={openLivePage}
          />
        ) : (
          <div className="mobile-stage">
            {tab === "html" ? (
              <EditorPane language="html" value={html} onChange={setHtml} mode={mode} />
            ) : null}
            {tab === "css" && mode === "split" ? (
              <EditorPane language="css" value={css} onChange={setCss} />
            ) : null}
            {tab === "preview" ? (
              <PreviewPane
                html={html}
                css={liveCss}
                width={previewWidth}
                onOpenPreview={openLivePage}
              />
            ) : null}
          </div>
        )}
      </main>

      <footer className="ide-status">
        <span>Sauvegarde automatique</span>
        <span className="status-sep" />
        <span>HTML {html.length} car.</span>
        <span className="status-sep" />
        <span>{mode === "single" ? "CSS intégré au HTML" : `CSS ${css.length} car.`}</span>
        <span className="status-sep" />
        <span>Ctrl/⌘ + S pour forcer</span>
        <span className="status-sep" />
        <span>Ctrl/⌘ + Shift + Entrée : aperçu</span>
      </footer>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function DesktopWorkspace({
  html,
  css,
  mode,
  previewWidth,
  onHtmlChange,
  onCssChange,
  onOpenPreview,
}: {
  html: string;
  css: string;
  mode: FileMode;
  previewWidth: string;
  onHtmlChange: (value: string) => void;
  onCssChange: (value: string) => void;
  onOpenPreview: () => void;
}) {
  const liveCss = previewCssForMode(mode, css);

  return (
    <Group id="ide-claude-h" orientation="horizontal" className="h-full">
      <Panel id="editors" defaultSize="46%" minSize="24%">
        {mode === "single" ? (
          <EditorPane language="html" value={html} onChange={onHtmlChange} mode={mode} />
        ) : (
          <Group id="ide-claude-v" orientation="vertical" className="h-full">
            <Panel id="html" defaultSize="55%" minSize="20%">
              <EditorPane language="html" value={html} onChange={onHtmlChange} />
            </Panel>
            <Separator className="resize-h" />
            <Panel id="css" defaultSize="45%" minSize="20%">
              <EditorPane language="css" value={css} onChange={onCssChange} />
            </Panel>
          </Group>
        )}
      </Panel>
      <Separator className="resize-v" />
      <Panel id="preview" defaultSize="54%" minSize="28%">
        <PreviewPane
          html={html}
          css={liveCss}
          width={previewWidth}
          onOpenPreview={onOpenPreview}
        />
      </Panel>
    </Group>
  );
}

function EditorPane({
  language,
  value,
  onChange,
  mode = "split",
}: {
  language: "html" | "css";
  value: string;
  onChange: (value: string) => void;
  mode?: FileMode;
}) {
  const hint =
    language === "css"
      ? "styles.css"
      : mode === "single"
        ? "index.html · CSS dans <style>"
        : "index.html";

  return (
    <section className="pane">
      <div className="pane-header">
        <span className={`lang-pill ${language}`}>{language.toUpperCase()}</span>
        <span className="pane-hint">{hint}</span>
      </div>
      <div className="pane-body">
        <CodeEditor language={language} value={value} onChange={onChange} />
      </div>
    </section>
  );
}

function PreviewPane({
  html,
  css,
  width,
  onOpenPreview,
}: {
  html: string;
  css: string;
  width: string;
  onOpenPreview: () => void;
}) {
  return (
    <section className="pane preview-pane">
      <div className="pane-header">
        <span className="lang-pill preview">Aperçu</span>
        <button type="button" className="pane-link" onClick={onOpenPreview}>
          Ouvrir dans un onglet
        </button>
      </div>
      <div className="pane-body preview-body">
        <PreviewFrame html={html} css={css} width={width} />
      </div>
    </section>
  );
}
