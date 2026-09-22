"use client";

import { Group, Panel, Separator } from "react-resizable-panels";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { CodeEditor } from "@/components/CodeEditor";
import { LogoMark } from "@/components/LogoMark";
import { PreviewFrame, type PreviewInspectHandle } from "@/components/PreviewFrame";
import {
  composeDocument,
  extractEmbeddedCss,
  hasEmbeddedCss,
  previewCssForMode,
  type FileMode,
} from "@/lib/compose";
import {
  linkKey,
  resolveHover,
  type HighlightRequest,
  type HoverTarget,
  type InspectLink,
  type InspectMark,
} from "@/lib/inspect-link";
import { buildInspectModel, lineOf, type InspectModel } from "@/lib/inspect-map";
import { downloadFile } from "@/lib/download";
import { loadProject, saveProject } from "@/lib/storage";
import { STARTER_CSS, STARTER_HTML } from "@/lib/starter";
import { openPreviewWindow, publishPreview } from "@/lib/sync";

type Viewport = "fluid" | "tablet" | "mobile";
type MobileTab = "html" | "css" | "preview";

const NO_MARKS: InspectMark[] = [];

const VIEWPORTS: { id: Viewport; label: string; width: string }[] = [
  { id: "fluid", label: "Desktop", width: "100%" },
  { id: "tablet", label: "Tablette", width: "768px" },
  { id: "mobile", label: "Mobile", width: "390px" },
];

function useDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(false);

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
  const [moreOpen, setMoreOpen] = useState(false);
  const [inspect, setInspect] = useState(true);
  const [link, setLink] = useState<InspectLink | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<PreviewInspectHandle>(null);
  const inspectRef = useRef(inspect);
  const sourcesRef = useRef({ html, css, mode });
  const lastHtmlLine = useRef<number | null>(null);
  const lastCssLine = useRef<number | null>(null);
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
  const inspectModel = useMemo(
    () => buildInspectModel(html, mode === "split" ? css : ""),
    [html, css, mode],
  );

  useEffect(() => {
    inspectRef.current = inspect;
    sourcesRef.current = { html, css, mode };
    lastHtmlLine.current = null;
    lastCssLine.current = null;
  }, [inspect, html, css, mode]);

  const currentModel = useCallback((): InspectModel => {
    const sources = sourcesRef.current;
    return buildInspectModel(sources.html, sources.mode === "split" ? sources.css : "");
  }, []);

  const publishHover = useCallback((target: HoverTarget | null, origin: HoverTarget["from"]) => {
    if (!inspectRef.current || !target) {
      setLink((current) => (current?.origin === origin ? null : current));
      return;
    }
    const next = resolveHover(currentModel(), target, previewRef.current);
    setLink((current) => (linkKey(current) === linkKey(next) ? current : next));
  }, [currentModel]);

  const onHtmlHover = useCallback((offset: number | null) => {
    if (offset == null) {
      lastHtmlLine.current = null;
      publishHover(null, "html");
      return;
    }
    const model = currentModel();
    const line = lineOf(model.htmlSource, offset);
    if (lastHtmlLine.current === line) return;
    lastHtmlLine.current = line;
    publishHover({ from: "html", offset }, "html");
  }, [currentModel, publishHover]);

  const onCssHover = useCallback((offset: number | null) => {
    if (offset == null) {
      lastCssLine.current = null;
      publishHover(null, "css");
      return;
    }
    const model = currentModel();
    const line = lineOf(model.cssSource, offset);
    if (lastCssLine.current === line) return;
    lastCssLine.current = line;
    publishHover({ from: "css", offset }, "css");
  }, [currentModel, publishHover]);

  const onPreviewHover = useCallback((nodeId: number | null) => {
    publishHover(nodeId == null ? null : { from: "preview", nodeId }, "preview");
  }, [publishHover]);

  const [jump, setJump] = useState<{ html: number | null; css: number | null; token: number } | null>(null);

  const clearInspectLink = useCallback(() => {
    lastHtmlLine.current = null;
    lastCssLine.current = null;
    setLink((current) => (current === null ? current : null));
    setJump(null);
  }, []);

  const toggleInspect = useCallback(() => {
    setInspect((value) => !value);
    clearInspectLink();
  }, [clearInspectLink]);

  const onPreviewClick = useCallback((nodeId: number) => {
    if (!inspectRef.current) return;
    const next = resolveHover(currentModel(), { from: "preview", nodeId }, previewRef.current);
    setLink((current) => (linkKey(current) === linkKey(next) ? current : next));
    if (!next) return;
    setJump({ html: next.scrollHtml, css: next.scrollCss, token: Date.now() });
    if (!isDesktop) {
      if (next.scrollHtml != null) setTab("html");
      else if (next.scrollCss != null) setTab("css");
    }
  }, [currentModel, isDesktop]);

  const editHtml = useCallback((value: string) => {
    sourcesRef.current = { ...sourcesRef.current, html: value };
    setHtml(value);
    clearInspectLink();
  }, [clearInspectLink]);

  const editCss = useCallback((value: string) => {
    sourcesRef.current = { ...sourcesRef.current, css: value };
    setCss(value);
    clearInspectLink();
  }, [clearInspectLink]);

  const htmlMarks = inspect && link ? link.htmlMarks : NO_MARKS;
  const cssMarks = inspect && link ? link.cssMarks : NO_MARKS;
  const highlight = useMemo<HighlightRequest | null>(() => {
    if (!inspect || !link) return null;
    if (link.primaryId == null && !link.selector) return null;
    return { primaryId: link.primaryId, selector: link.selector };
  }, [inspect, link]);

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
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        toggleInspect();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [html, css, liveCss, mode, showToast, openLivePage, toggleInspect]);

  useEffect(() => {
    if (!menuOpen && !moreOpen) return;
    const close = () => {
      setMenuOpen(false);
      setMoreOpen(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen, moreOpen]);

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
    clearInspectLink();
    showToast("Projet réinitialisé");
  };

  const setFileMode = (next: FileMode) => {
    if (next === mode) return;
    if (next === "single") {
      setHtml(composeDocument(html, css));
      setCss("");
      setMode("single");
      if (tab === "css") setTab("html");
      clearInspectLink();
      showToast("Mode fichier unique : le CSS est dans le HTML");
      return;
    }
    const extracted = extractEmbeddedCss(html);
    setHtml(extracted.html);
    setCss(extracted.css);
    setMode("split");
    clearInspectLink();
    showToast("Mode HTML + CSS séparés");
  };

  const downloadComplete = () => {
    downloadFile(
      "index.html",
      composeDocument(html, liveCss),
      "text/html;charset=utf-8",
    );
    setMenuOpen(false);
    setMoreOpen(false);
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
    setMoreOpen(false);
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
      clearInspectLink();
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
      clearInspectLink();
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
      clearInspectLink();
    }
  };

  return (
    <div className="ide-shell">
      <header className="ide-topbar">
        <div className="brand">
          <LogoMark size={isDesktop ? 32 : 24} />
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

        <div className="topbar-actions desktop-only">
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

        <button
          type="button"
          className="ghost-btn icon-btn mobile-only"
          aria-label="Menu"
          aria-expanded={moreOpen}
          onClick={(event) => {
            event.stopPropagation();
            setMoreOpen((open) => !open);
          }}
        >
          Menu
        </button>
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
            onHtmlChange={editHtml}
            onCssChange={editCss}
            onOpenPreview={openLivePage}
            inspect={inspect}
            onToggleInspect={toggleInspect}
            previewRef={previewRef}
            highlight={highlight}
            onPreviewHover={onPreviewHover}
            onPreviewClick={onPreviewClick}
            htmlMarks={htmlMarks}
            cssMarks={cssMarks}
            jump={jump}
            onHtmlHover={onHtmlHover}
            onCssHover={onCssHover}
            stampedHtml={inspectModel.stampedHtml}
          />
        ) : (
          <div className="mobile-stage">
            {tab === "html" ? (
              <EditorPane
                language="html"
                value={html}
                onChange={editHtml}
                mode={mode}
                touch
                inspectMarks={htmlMarks}
                jumpLine={jump?.html ?? null}
                jumpToken={jump?.token ?? null}
                jumpFocus={jump?.html != null}
                onHoverOffset={inspect ? onHtmlHover : undefined}
              />
            ) : null}
            {tab === "css" && mode === "split" ? (
              <EditorPane
                language="css"
                value={css}
                onChange={editCss}
                touch
                inspectMarks={cssMarks}
                jumpLine={jump?.css ?? null}
                jumpToken={jump?.token ?? null}
                jumpFocus={jump?.html == null && jump?.css != null}
                onHoverOffset={inspect ? onCssHover : undefined}
              />
            ) : null}
            {tab === "preview" ? (
              <PreviewPane
                html={inspectModel.stampedHtml}
                css={liveCss}
                width="100%"
                onOpenPreview={openLivePage}
                touch
                inspect={inspect}
                onToggleInspect={toggleInspect}
                previewRef={previewRef}
                highlight={highlight}
                onPreviewHover={onPreviewHover}
                onPreviewClick={onPreviewClick}
              />
            ) : null}
          </div>
        )}
      </main>

      <footer className="ide-status">
        <span>Sauvegarde auto</span>
        <span className="status-sep" />
        <span>HTML {html.length}</span>
        {mode === "split" ? (
          <>
            <span className="status-sep" />
            <span>CSS {css.length}</span>
          </>
        ) : (
          <>
            <span className="status-sep desktop-only" />
            <span className="desktop-only">CSS intégré</span>
          </>
        )}
        <span className="status-sep desktop-only" />
        <span className="desktop-only">Ctrl/⌘ + S</span>
        <span className="status-sep desktop-only" />
        <span className="desktop-only">Ctrl/⌘ + Shift + Entrée : aperçu</span>
        <span className="status-sep desktop-only" />
        <span className="desktop-only">Ctrl/⌘ + Shift + E : inspecter</span>
        {inspect ? (
          <>
            <span className="status-sep desktop-only" />
            <span className="desktop-only">Clic dans l’aperçu : aller au code</span>
          </>
        ) : null}
      </footer>

      {toast ? <div className="toast">{toast}</div> : null}

      {moreOpen
        ? createPortal(
            <div
              className="mobile-overlay"
              onClick={() => setMoreOpen(false)}
            >
              <div
                className="menu mobile-sheet"
                role="menu"
                onClick={(event) => event.stopPropagation()}
              >
                <p className="mobile-sheet-title">Menu</p>
                <button
                  type="button"
                  className={mode === "split" ? "is-active" : ""}
                  onClick={() => {
                    setFileMode("split");
                    setMoreOpen(false);
                  }}
                >
                  Mode HTML + CSS
                </button>
                <button
                  type="button"
                  className={mode === "single" ? "is-active" : ""}
                  onClick={() => {
                    setFileMode("single");
                    setMoreOpen(false);
                  }}
                >
                  Mode HTML intégré
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openLivePage();
                    setMoreOpen(false);
                  }}
                >
                  Ouvrir l’aperçu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setMoreOpen(false);
                  }}
                >
                  Importer
                </button>
                <button type="button" onClick={downloadComplete}>
                  Télécharger la page
                </button>
                <button type="button" onClick={downloadSplit}>
                  Télécharger HTML + CSS
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    reset();
                    setMoreOpen(false);
                  }}
                >
                  Réinitialiser
                </button>
                <button
                  type="button"
                  className={inspect ? "is-active" : ""}
                  onClick={() => {
                    toggleInspect();
                    setMoreOpen(false);
                  }}
                >
                  {inspect ? "Couper l’inspecteur" : "Activer l’inspecteur"}
                </button>
                <button type="button" onClick={() => setMoreOpen(false)}>
                  Fermer
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
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
  inspect,
  onToggleInspect,
  previewRef,
  highlight,
  onPreviewHover,
  onPreviewClick,
  htmlMarks,
  cssMarks,
  jump,
  onHtmlHover,
  onCssHover,
  stampedHtml,
}: {
  html: string;
  css: string;
  mode: FileMode;
  previewWidth: string;
  onHtmlChange: (value: string) => void;
  onCssChange: (value: string) => void;
  onOpenPreview: () => void;
  inspect: boolean;
  onToggleInspect: () => void;
  previewRef: RefObject<PreviewInspectHandle | null>;
  highlight: HighlightRequest | null;
  onPreviewHover: (nodeId: number | null) => void;
  onPreviewClick: (nodeId: number) => void;
  htmlMarks: InspectMark[];
  cssMarks: InspectMark[];
  jump: { html: number | null; css: number | null; token: number } | null;
  onHtmlHover: (offset: number | null) => void;
  onCssHover: (offset: number | null) => void;
  stampedHtml: string;
}) {
  const liveCss = previewCssForMode(mode, css);

  return (
    <Group id="ide-claude-h" orientation="horizontal" className="h-full">
      <Panel id="editors" defaultSize="46%" minSize="24%">
        {mode === "single" ? (
          <EditorPane
            language="html"
            value={html}
            onChange={onHtmlChange}
            mode={mode}
            inspectMarks={htmlMarks}
            jumpLine={jump?.html ?? null}
            jumpToken={jump?.token ?? null}
            jumpFocus={jump?.html != null}
            onHoverOffset={inspect ? onHtmlHover : undefined}
          />
        ) : (
          <Group id="ide-claude-v" orientation="vertical" className="h-full">
            <Panel id="html" defaultSize="55%" minSize="20%">
              <EditorPane
                language="html"
                value={html}
                onChange={onHtmlChange}
                inspectMarks={htmlMarks}
                jumpLine={jump?.html ?? null}
                jumpToken={jump?.token ?? null}
                jumpFocus={jump?.html != null}
                onHoverOffset={inspect ? onHtmlHover : undefined}
              />
            </Panel>
            <Separator className="resize-h" />
            <Panel id="css" defaultSize="45%" minSize="20%">
              <EditorPane
                language="css"
                value={css}
                onChange={onCssChange}
                inspectMarks={cssMarks}
                jumpLine={jump?.css ?? null}
                jumpToken={jump?.token ?? null}
                jumpFocus={false}
                onHoverOffset={inspect ? onCssHover : undefined}
              />
            </Panel>
          </Group>
        )}
      </Panel>
      <Separator className="resize-v" />
      <Panel id="preview" defaultSize="54%" minSize="28%">
        <PreviewPane
          html={stampedHtml}
          css={liveCss}
          width={previewWidth}
          onOpenPreview={onOpenPreview}
          inspect={inspect}
          onToggleInspect={onToggleInspect}
          previewRef={previewRef}
          highlight={highlight}
          onPreviewHover={onPreviewHover}
          onPreviewClick={onPreviewClick}
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
  touch = false,
  inspectMarks = NO_MARKS,
  jumpLine = null,
  jumpToken = null,
  jumpFocus = false,
  onHoverOffset,
}: {
  language: "html" | "css";
  value: string;
  onChange: (value: string) => void;
  mode?: FileMode;
  touch?: boolean;
  inspectMarks?: InspectMark[];
  jumpLine?: number | null;
  jumpToken?: number | null;
  jumpFocus?: boolean;
  onHoverOffset?: (offset: number | null) => void;
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
        <CodeEditor
          language={language}
          value={value}
          onChange={onChange}
          touch={touch}
          inspectMarks={inspectMarks}
          jumpLine={jumpLine}
          jumpToken={jumpToken}
          jumpFocus={jumpFocus}
          onHoverOffset={onHoverOffset}
        />
      </div>
    </section>
  );
}

function PreviewPane({
  html,
  css,
  width,
  onOpenPreview,
  touch = false,
  inspect = false,
  onToggleInspect,
  previewRef,
  highlight = null,
  onPreviewHover,
  onPreviewClick,
}: {
  html: string;
  css: string;
  width: string;
  onOpenPreview: () => void;
  touch?: boolean;
  inspect?: boolean;
  onToggleInspect?: () => void;
  previewRef?: RefObject<PreviewInspectHandle | null>;
  highlight?: HighlightRequest | null;
  onPreviewHover?: (nodeId: number | null) => void;
  onPreviewClick?: (nodeId: number) => void;
}) {
  return (
    <section className="pane preview-pane">
      <div className="pane-header">
        <span className="lang-pill preview">Aperçu</span>
        <div className="pane-header-actions">
          {onToggleInspect ? (
            <button
              type="button"
              className={inspect ? "inspect-toggle is-on" : "inspect-toggle"}
              aria-pressed={inspect}
              title="Activer ou couper l’inspecteur (Ctrl+Shift+E)"
              onClick={onToggleInspect}
            >
              Inspecter
              <kbd>Ctrl+Shift+E</kbd>
            </button>
          ) : null}
          <button type="button" className="pane-link" onClick={onOpenPreview}>
            Ouvrir dans un onglet
          </button>
        </div>
      </div>
      <div className="pane-body preview-body">
        <PreviewFrame
          ref={previewRef}
          html={html}
          css={css}
          width={width}
          variant={touch ? "page" : "stage"}
          inspect={inspect}
          highlight={highlight}
          onHoverNode={onPreviewHover}
          onSelectNode={onPreviewClick}
        />
      </div>
    </section>
  );
}
