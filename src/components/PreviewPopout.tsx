"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PreviewFrame } from "@/components/PreviewFrame";
import { previewCssForMode } from "@/lib/compose";
import { loadProject } from "@/lib/storage";
import { STARTER_CSS, STARTER_HTML } from "@/lib/starter";
import { LogoMark } from "@/components/LogoMark";
import { subscribePreview } from "@/lib/sync";

export function PreviewPopout() {
  const [html, setHtml] = useState(STARTER_HTML);
  const [css, setCss] = useState(STARTER_CSS);

  useEffect(() => {
    const saved = loadProject();
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate from the editor tab */
    if (saved) {
      setHtml(saved.html);
      setCss(previewCssForMode(saved.mode, saved.css));
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    return subscribePreview((payload) => {
      setHtml(payload.html);
      setCss(payload.css);
    });
  }, []);

  return (
    <div className="popout-preview">
      <PreviewFrame html={html} css={css} width="100%" variant="page" />
      <Link className="popout-back" href="/" title="Retour à l’éditeur">
        <LogoMark size={18} />
        IDE Claude
      </Link>
    </div>
  );
}
