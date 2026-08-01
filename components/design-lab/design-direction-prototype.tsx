"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { Monitor, Smartphone } from "lucide-react";

import { EditorialPlanner } from "./editorial-planner";
import { NativeCalm } from "./native-calm";
import { PrecisionUtility } from "./precision-utility";
import { RefinedEvolution } from "./refined-evolution";
import { SpatialFocus } from "./spatial-focus";
import {
  getDesignDirection,
  type DesignDirectionSlug,
  type DesignPalette,
} from "./design-data";
import { DesignLabBackLink, PrototypeEditor } from "./prototype-shared";
import { usePrototypeState } from "./prototype-state";

type PreviewMode = "responsive" | "mobile";

const DIRECTION_COMPONENTS = {
  "refined-evolution": RefinedEvolution,
  "editorial-planner": EditorialPlanner,
  "precision-utility": PrecisionUtility,
  "spatial-focus": SpatialFocus,
  "native-calm": NativeCalm,
} as const;

interface DirectionStyle extends CSSProperties {
  "--dl-canvas": string;
  "--dl-surface": string;
  "--dl-raised": string;
  "--dl-text": string;
  "--dl-muted": string;
  "--dl-accent": string;
  "--dl-accent-text": string;
  "--dl-focus": string;
  "--dl-line": string;
  "--dl-q1": string;
  "--dl-q2": string;
  "--dl-q3": string;
  "--dl-q4": string;
}

export function DesignDirectionPrototype({ slug, initialPreview = "responsive", initialTheme = "light" }: {
  slug: DesignDirectionSlug;
  initialPreview?: PreviewMode;
  initialTheme?: "light" | "dark";
}): ReactElement {
  const direction = getDesignDirection(slug);
  const state = usePrototypeState(initialTheme);
  const [preview, setPreview] = useState<PreviewMode>(initialPreview);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const DirectionComponent = DIRECTION_COMPONENTS[slug];
  const palette = state.theme === "light" ? direction.light : direction.dark;

  useEffect(() => workspaceRef.current?.setAttribute("data-ready", "true"), []);

  return (
    <div className="design-lab dl-prototype-route" style={toDirectionStyle(palette)}>
      <header className="dl-lab-toolbar">
        <DesignLabBackLink />
        <div className="dl-lab-toolbar-copy">
          <span>{direction.index}</span>
          <div><strong>{direction.name}</strong><small>{direction.thesis}</small></div>
        </div>
        <PreviewControls preview={preview} setPreview={setPreview} />
      </header>
      <div className="dl-preview-stage" data-preview={preview}>
        <div
          ref={workspaceRef}
          className={`dl-workspace dl-${slug}`}
          data-testid="prototype-workspace"
          data-direction={slug}
          data-theme={state.theme}
          data-ready="false"
        >
          <a className="dl-skip-link" href="#prototype-main">Skip to priorities</a>
          <div><DirectionComponent state={state} /></div>
          <p key={state.announcementVersion} className="sr-only" role="status" aria-live="polite">{state.announcement}</p>
        </div>
      </div>
      {state.editorTask ? (
        <PrototypeEditor key={`${slug}-${state.editorTask.id}`} task={state.editorTask} direction={direction} state={state} />
      ) : null}
    </div>
  );
}

function PreviewControls({ preview, setPreview }: {
  preview: PreviewMode;
  setPreview: (preview: PreviewMode) => void;
}): ReactElement {
  return (
    <div className="dl-preview-controls" role="group" aria-label="Preview size">
      <button type="button" aria-pressed={preview === "responsive"} onClick={() => setPreview("responsive")}>
        <Monitor aria-hidden="true" />Responsive
      </button>
      <button type="button" aria-pressed={preview === "mobile"} onClick={() => setPreview("mobile")}>
        <Smartphone aria-hidden="true" />Mobile frame
      </button>
    </div>
  );
}

function toDirectionStyle(palette: DesignPalette): DirectionStyle {
  return {
    "--dl-canvas": palette.canvas,
    "--dl-surface": palette.surface,
    "--dl-raised": palette.raised,
    "--dl-text": palette.text,
    "--dl-muted": palette.muted,
    "--dl-accent": palette.accent,
    "--dl-accent-text": palette.accentText,
    "--dl-focus": palette.focus,
    "--dl-line": palette.line,
    "--dl-q1": palette.q1,
    "--dl-q2": palette.q2,
    "--dl-q3": palette.q3,
    "--dl-q4": palette.q4,
  };
}
