"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Markdown } from "@devdigest/ui";
import { s } from "./styles";

/** Preview tab — the (possibly unsaved) body rendered as the reviewing agent receives it. */
export function PreviewTab({ body }: { body: string }) {
  const t = useTranslations("skills");
  return (
    <div style={s.wrap}>
      <h2 style={s.h2}>{t("preview.title")}</h2>
      <p style={s.subtitle}>{t("preview.subtitle")}</p>
      {/* dd-skill-preview (globals.css) restores heading/list styling the Markdown primitive leaves out. */}
      <div className="dd-skill-preview" style={s.card}>
        {body.trim() ? <Markdown>{body}</Markdown> : <p style={s.empty}>{t("preview.empty")}</p>}
      </div>
    </div>
  );
}
