"use client";

import { useState, type CSSProperties, type ReactElement } from "react";
import { ArrowRight, CheckCircle2, Smartphone } from "lucide-react";
import Link from "next/link";

import {
  DESIGN_DIRECTIONS,
  DESIGN_TASKS,
  getDesignDirection,
  type DesignDirection,
  type DesignDirectionSlug,
  type DesignPalette,
} from "./design-data";

interface PreviewStyle extends CSSProperties {
  "--preview-canvas": string;
  "--preview-surface": string;
  "--preview-text": string;
  "--preview-muted": string;
  "--preview-accent": string;
  "--preview-line": string;
}

export function DesignLabOverview(): ReactElement {
  const [left, setLeft] = useState<DesignDirectionSlug>("refined-evolution");
  const [right, setRight] = useState<DesignDirectionSlug>("editorial-planner");

  return (
    <main className="design-lab dl-overview">
      <header className="dl-overview-hero">
        <Link href="/design-lab" className="dl-overview-wordmark">GSD design lab</Link>
        <div>
          <p>Visual and usability exploration · August 2026</p>
          <h1>Five ways to make priorities tangible.</h1>
          <span>Same tasks. Same product promises. Deliberately different decisions.</span>
        </div>
        <aside><CheckCircle2 aria-hidden="true" /><strong>Production stays untouched</strong><span>Every concept uses local mock state and isolated tokens.</span></aside>
      </header>
      <section className="dl-direction-index" aria-labelledby="direction-index-title">
        <div className="dl-section-heading"><h2 id="direction-index-title">Choose a direction to inspect</h2><p>Open the real responsive prototype, then compare its tradeoffs below.</p></div>
        <div className="dl-direction-list">{DESIGN_DIRECTIONS.map((direction) => <DirectionCard key={direction.slug} direction={direction} />)}</div>
      </section>
      <Comparison left={left} right={right} setLeft={setLeft} setRight={setRight} />
    </main>
  );
}

function DirectionCard({ direction }: { direction: DesignDirection }): ReactElement {
  return (
    <article className="dl-direction-card">
      <span className="dl-direction-number">{direction.index}</span>
      <div className="dl-direction-copy">
        <h3>{direction.name}</h3><p>{direction.thesis}</p>
        <dl><div><dt>Matrix</dt><dd>{direction.matrixModel}</dd></div><div><dt>Type</dt><dd>{direction.typeStrategy}</dd></div></dl>
      </div>
      <PaletteStrip palette={direction.light} />
      <div className="dl-direction-links">
        <a href={`/design-lab/${direction.slug}`} aria-label={`Open prototype: ${direction.name} desktop preview`}>Open prototype<ArrowRight aria-hidden="true" /></a>
        <a href={`/design-lab/${direction.slug}?preview=mobile`} aria-label={`Mobile preview: ${direction.name}`}><Smartphone aria-hidden="true" />Mobile</a>
      </div>
    </article>
  );
}

function Comparison({ left, right, setLeft, setRight }: {
  left: DesignDirectionSlug;
  right: DesignDirectionSlug;
  setLeft: (slug: DesignDirectionSlug) => void;
  setRight: (slug: DesignDirectionSlug) => void;
}): ReactElement {
  return (
    <section className="dl-comparison-section" aria-labelledby="comparison-title">
      <div className="dl-section-heading"><h2 id="comparison-title">Compare the same moment</h2><p>Hierarchy changes are easier to judge when content never moves the goalposts.</p></div>
      <div className="dl-comparison-pickers">
        <DirectionSelect label="Compare on the left" value={left} onChange={setLeft} />
        <DirectionSelect label="Compare on the right" value={right} onChange={setRight} />
      </div>
      <div className="dl-comparison" data-testid="design-comparison">
        <MiniDirection direction={getDesignDirection(left)} />
        <MiniDirection direction={getDesignDirection(right)} />
      </div>
    </section>
  );
}

function DirectionSelect({ label, value, onChange }: {
  label: string;
  value: DesignDirectionSlug;
  onChange: (slug: DesignDirectionSlug) => void;
}): ReactElement {
  return (
    <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as DesignDirectionSlug)}>{DESIGN_DIRECTIONS.map((direction) => <option key={direction.slug} value={direction.slug}>{direction.name}</option>)}</select></label>
  );
}

function MiniDirection({ direction }: { direction: DesignDirection }): ReactElement {
  const task = DESIGN_TASKS[0];
  return (
    <article className={`dl-mini-preview is-${direction.slug}`} style={previewStyle(direction.light)}>
      <header><span>{direction.index}</span><h3>{direction.name}</h3><small>{direction.character}</small></header>
      <div className="dl-mini-chrome"><i /><i /><i /><b /></div>
      <section><div><span>Do First</span><em>3</em></div><strong>{task.title}</strong><small>{task.dueLabel}</small></section>
      <footer>{direction.signature}</footer>
    </article>
  );
}

function PaletteStrip({ palette }: { palette: DesignPalette }): ReactElement {
  return <div className="dl-palette-strip" aria-hidden="true">{[palette.canvas, palette.surface, palette.text, palette.accent, palette.q2].map((color, index) => <i key={`${index}-${color}`} style={{ backgroundColor: color }} />)}</div>;
}

function previewStyle(palette: DesignPalette): PreviewStyle {
  return {
    "--preview-canvas": palette.canvas,
    "--preview-surface": palette.surface,
    "--preview-text": palette.text,
    "--preview-muted": palette.muted,
    "--preview-accent": palette.accent,
    "--preview-line": palette.line,
  };
}
