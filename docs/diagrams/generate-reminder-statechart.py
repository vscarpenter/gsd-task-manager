"""Regenerate docs/diagrams/reminder-statechart.html, the reminder state machine before and after PR #669.

Both figures are drawn from the tables in before() and after(), not parsed from
Mermaid. They redraw the charts that /pstack:statechart made from the models in
reminder-model/, so a change to a model means re-running the statechart command,
then updating the states and arrows here to match:

    python3 docs/diagrams/generate-reminder-statechart.py

Colors are the GSD Editorial light skin from the diagram-design `gsd` profile,
and every coordinate is on the plugin's 4px grid. After regenerating, check the
page and re-export the PNGs:

    P=~/.claude/plugins/cache/diagram-design/diagram-design/<version>
    python3 $P/skills/diagram-design/scripts/self_check.py docs/diagrams/reminder-statechart.html
    node docs/diagrams/export-reminder-statechart.mjs
"""
import math
import pathlib

OUT = pathlib.Path(__file__).with_name("reminder-statechart.html")

PAPER = "#f4f1e9"
PAPER2 = "#ece7dc"
INK = "#211e1a"
MUTED = "#6e6760"
SOFT = "#797368"
ACCENT = "#2c6680"
ACCENT_TINT = "rgba(44,102,128,0.14)"
SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
MONO = "ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace"
R = 8
W, H = 1280, 720
BOX_W, BOX_H = 200, 80
SHIFT_X = 16  # centers the content block on the canvas

COLS = {1: 160, 2: 512, 3: 864}
ROWS = {1: 112, 2: 312, 3: 512}


def ceil8(v):
    return int(math.ceil(v / 8.0) * 8)


def box(col, row):
    return COLS[col], ROWS[row]


def sign(v):
    return (v > 0) - (v < 0)


def on_segment(p, a, b):
    if a[0] == b[0] == p[0]:
        return min(a[1], b[1]) < p[1] < max(a[1], b[1])
    if a[1] == b[1] == p[1]:
        return min(a[0], b[0]) < p[0] < max(a[0], b[0])
    return False


def path_d(points, hops=()):
    """Orthogonal polyline with r=8 quarter-arc corners and 8px hops over crossings."""
    d = [f"M {points[0][0]} {points[0][1]}"]
    for i in range(1, len(points)):
        a, p = points[i - 1], points[i]
        ux, uy = sign(p[0] - a[0]), sign(p[1] - a[1])
        last = i == len(points) - 1
        end = p if last else (p[0] - ux * R, p[1] - uy * R)
        seg_hops = sorted(
            (h for h in hops if on_segment(h, a, p)),
            key=lambda h: (h[0] - a[0]) * ux + (h[1] - a[1]) * uy,
        )
        for h in seg_hops:
            d.append(f"L {h[0] - ux * R} {h[1] - uy * R}")
            if uy == 0:
                sweep = 1 if ux > 0 else 0
            else:
                sweep = 0 if uy > 0 else 1
            d.append(f"A {R} {R} 0 0 {sweep} {h[0] + ux * R} {h[1] + uy * R}")
        d.append(f"L {end[0]} {end[1]}")
        if not last:
            q = points[i + 1]
            vx, vy = sign(q[0] - p[0]), sign(q[1] - p[1])
            sweep = 1 if ux * vy - uy * vx > 0 else 0
            d.append(f"A {R} {R} 0 0 {sweep} {p[0] + vx * R} {p[1] + vy * R}")
    return " ".join(d)


def arrow(points, accent=False, hops=()):
    color = ACCENT if accent else MUTED
    marker = "arrow-accent" if accent else "arrow"
    width = "1.4" if accent else "1.2"
    return (
        f'<path d="{path_d(points, hops)}" fill="none" stroke="{color}" '
        f'stroke-width="{width}" marker-end="url(#{marker})"/>'
    )


def label(cx, top, lines, accent=False):
    """Masked mono arrow label. `top` is the mask's top edge; one 12px row per line."""
    if isinstance(lines, str):
        lines = [lines]
    w = ceil8(max(len(t) for t in lines) * 5.28 + 12)
    h = 12 * len(lines)
    color = ACCENT if accent else SOFT
    weight = ' font-weight="600"' if accent else ""
    out = [f'<rect x="{cx - w // 2}" y="{top}" width="{w}" height="{h}" rx="2" fill="{PAPER}"/>']
    for k, t in enumerate(lines):
        out.append(
            f'<text x="{cx}" y="{top + 9 + 12 * k}" fill="{color}" font-size="8"{weight} '
            f'font-family="{MONO}" text-anchor="middle" letter-spacing="0.06em">{t}</text>'
        )
    return "\n".join(out)


def label_w(lines):
    if isinstance(lines, str):
        lines = [lines]
    return ceil8(max(len(t) for t in lines) * 5.28 + 12)


def beside(x_line, top, lines, side="right", accent=False):
    """Label beside a vertical segment, 8px clear of the stroke."""
    w = label_w(lines)
    cx = x_line + 8 + w // 2 if side == "right" else x_line - 8 - w // 2
    return label(cx, top, lines, accent)


NODE_STYLE = {
    "backend": ("#ffffff", INK, None),
    "input": ("rgba(110,103,96,0.10)", SOFT, None),
    "lost": ("rgba(33,30,26,0.02)", "rgba(33,30,26,0.34)", "4,3"),
}


def node(col, row, name, sub=None, kind="backend"):
    x, y = box(col, row)
    fill, stroke, dash = NODE_STYLE[kind]
    cx, cy = x + BOX_W // 2, y + BOX_H // 2
    dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
    out = [
        f'<rect x="{x}" y="{y}" width="{BOX_W}" height="{BOX_H}" rx="8" fill="{PAPER}"/>',
        f'<rect x="{x}" y="{y}" width="{BOX_W}" height="{BOX_H}" rx="8" fill="{fill}" '
        f'stroke="{stroke}" stroke-width="1"{dash_attr}/>',
    ]
    name_y = cy - 2 if sub else cy + 4
    out.append(
        f'<text x="{cx}" y="{name_y}" fill="{INK}" font-size="12" font-weight="600" '
        f'font-family="{SANS}" text-anchor="middle">{name}</text>'
    )
    if sub:
        sub_color = INK if kind == "lost" else MUTED
        out.append(
            f'<text x="{cx}" y="{cy + 16}" fill="{sub_color}" font-size="9" '
            f'font-family="{MONO}" text-anchor="middle">{sub}</text>'
        )
    return "\n".join(out)


def start_dot(y):
    return (
        f'<circle cx="112" cy="{y}" r="6" fill="{INK}"/>\n'
        f'<line x1="118" y1="{y}" x2="160" y2="{y}" stroke="{MUTED}" stroke-width="1.2" '
        f'marker-end="url(#arrow)"/>'
    )


def legend(items):
    y = 660
    out = [
        f'<line x1="40" y1="{y - 8}" x2="{W - 40}" y2="{y - 8}" stroke="rgba(33,30,26,0.10)" stroke-width="0.8"/>',
        f'<text x="40" y="{y + 12}" fill="{MUTED}" font-size="8" font-family="{MONO}" letter-spacing="0.14em">LEGEND</text>',
    ]
    x = 136
    for kind, text in items:
        gy = y + 9
        if kind == "arrow":
            out.append(f'<line x1="{x}" y1="{gy}" x2="{x + 28}" y2="{gy}" stroke="{MUTED}" stroke-width="1.2" marker-end="url(#arrow)"/>')
        elif kind == "accent":
            out.append(f'<line x1="{x}" y1="{gy}" x2="{x + 28}" y2="{gy}" stroke="{ACCENT}" stroke-width="1.4" marker-end="url(#arrow-accent)"/>')
        elif kind == "lost":
            out.append(f'<rect x="{x}" y="{gy - 8}" width="28" height="16" rx="4" fill="rgba(33,30,26,0.02)" stroke="rgba(33,30,26,0.34)" stroke-dasharray="4,3"/>')
        elif kind == "hop":
            out.append(f'<line x1="{x + 14}" y1="{gy - 10}" x2="{x + 14}" y2="{gy + 10}" stroke="{MUTED}" stroke-width="1.2"/>')
            out.append(f'<path d="M {x} {gy} L {x + 6} {gy} A 8 8 0 0 1 {x + 22} {gy} L {x + 28} {gy}" fill="none" stroke="{MUTED}" stroke-width="1.2"/>')
        elif kind == "start":
            out.append(f'<circle cx="{x + 14}" cy="{gy}" r="6" fill="{INK}"/>')
        out.append(
            f'<text x="{x + 40}" y="{gy + 3}" fill="{MUTED}" font-size="8" font-family="{MONO}" '
            f'letter-spacing="0.1em">{text}</text>'
        )
        x += 40 + int(math.ceil(len(text) * 5.6 / 4) * 4) + 40
    return "\n".join(out)


def svg(slug, title, desc, arrows, labels, nodes, legend_items):
    return _svg(slug, title, desc, arrows, labels, nodes, legend_items).replace(
        "url(#arrow-accent)", f"url(#{slug}-arrow-accent)").replace("url(#arrow)", f"url(#{slug}-arrow)")


def _svg(slug, title, desc, arrows, labels, nodes, legend_items):
    return f"""<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="{slug}-title {slug}-desc">
<title id="{slug}-title">{title}</title>
<desc id="{slug}-desc">{desc}</desc>
<defs>
<pattern id="{slug}-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.9" fill="rgba(33,30,26,0.10)"/></pattern>
<marker id="{slug}-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{MUTED}"/></marker>
<marker id="{slug}-arrow-accent" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{ACCENT}"/></marker>
</defs>
<rect width="100%" height="100%" fill="{PAPER}"/>
<rect width="100%" height="100%" fill="url(#{slug}-dots)" opacity="0.6"/>
<g transform="translate({SHIFT_X},0)">
<!-- transitions -->
{chr(10).join(arrows)}
<!-- labels -->
{chr(10).join(labels)}
<!-- states -->
{chr(10).join(nodes)}
</g>
{legend(legend_items)}
</svg>"""


# ---------------------------------------------------------------- before
def before():
    a = [
        start_dot(336),
        arrow([(208, 312), (208, 192)]),                                   # s0 -> s1 snooze
        arrow([(360, 352), (512, 352)]),                                   # s0 -> s2 time comes
        arrow([(360, 136), (512, 136)]),                                   # s1 -> s3 ends early
        arrow([(360, 168), (408, 168), (408, 232), (592, 232), (592, 312)]),  # s1 -> s2 clear or end
        arrow([(304, 112), (304, 84), (964, 84), (964, 112)]),             # s1 -> s8 snooze ends
        arrow([(552, 192), (552, 272), (320, 272), (320, 312)], hops=[(552, 232)]),  # s3 -> s0
        arrow([(672, 192), (672, 312)]),                                   # s3 -> s2 time comes
        arrow([(712, 152), (788, 152), (788, 472), (912, 472), (912, 512)], accent=True),  # s3 -> s6 BUG 2
        arrow([(712, 352), (864, 352)], hops=[(788, 352)]),                # s2 -> s5 shown
        arrow([(552, 392), (552, 448), (320, 448), (320, 512)]),           # s2 -> s4 app closed
        arrow([(964, 192), (964, 312)]),                                   # s8 -> s5 shown
        arrow([(1064, 368), (1120, 368), (1120, 624), (88, 624), (88, 368), (160, 368)]),  # s5 -> s0 loop
        arrow([(1064, 336), (1104, 336), (1104, 48), (224, 48), (224, 112)]),  # s5 -> s1 loop
        arrow([(964, 392), (964, 512)], accent=True),                      # s5 -> s6 BUG 1
        arrow([(864, 552), (712, 552)]),                                   # s6 -> s7 time comes
        arrow([(512, 552), (360, 552)]),                                   # s7 -> s4 hour passes
        arrow([(224, 512), (224, 392)]),                                   # s4 -> s0 due date later
    ]
    lb = [
        beside(208, 246, "SNOOZE"),
        label(436, 328, "TIME COMES"),
        label(436, 112, "ENDS EARLY"),
        label(492, 208, "CLEAR OR END"),
        label(612, 60, "SNOOZE ENDS"),
        label(436, 248, "APP CLOSED 1H"),
        beside(672, 246, "TIME COMES"),
        beside(788, 408, "SHOWN EARLY", accent=True),
        label(748, 328, "SHOWN"),
        label(436, 424, "APP CLOSED"),
        beside(964, 246, "SHOWN"),
        label(604, 600, "DUE DATE LATER"),
        beside(1104, 216, "SNOOZE"),
        beside(964, 440, "OTHER DEVICE", accent=True),
        label(788, 528, "TIME COMES"),
        label(436, 528, "HOUR PASSES"),
        beside(224, 446, "DUE DATE LATER", side="left"),
    ]
    nd = [
        node(1, 1, "Snoozed", kind="input"),
        node(2, 1, "Snooze over early"),
        node(3, 1, "Due again after a snooze"),
        node(1, 2, "Waiting", "notificationSent false"),
        node(2, 2, "Reminder due"),
        node(3, 2, "Reminded", "notificationSent true"),
        node(1, 3, "Hour over, never shown", kind="lost"),
        node(2, 3, "Due, but marked shown", "notificationSent true", kind="lost"),
        node(3, 3, "Waiting, marked shown", "notificationSent true", kind="lost"),
    ]
    items = [
        ("start", "START"),
        ("arrow", "TRANSITION"),
        ("accent", "THE STEP THAT LOSES THE REMINDER"),
        ("lost", "NO REMINDER COMING"),
        ("hop", "CROSSING, NOT A JOIN"),
    ]
    return svg(
        "reminders-before",
        "A task's reminder before fix/lost-reminders",
        "State machine of a web reminder before the fix: a due date moved on another device, "
        "or a snooze that ends before the reminder time, marks the reminder shown too soon, "
        "so it is never shown.",
        a, lb, nd, items,
    )


# ---------------------------------------------------------------- after
def after():
    a = [
        start_dot(336),
        arrow([(208, 312), (208, 192)]),                                   # s0 -> s1 snooze
        arrow([(320, 192), (320, 312)], accent=True),                      # s1 -> s0 ends early (FIX 2)
        arrow([(360, 352), (512, 352)]),                                   # s0 -> s2 time comes
        arrow([(360, 168), (612, 168), (612, 312)]),                       # s1 -> s2 clear or end
        arrow([(360, 136), (864, 136)]),                                   # s1 -> s5 snooze ends
        arrow([(964, 192), (964, 312)]),                                   # s5 -> s4 shown
        arrow([(712, 352), (864, 352)]),                                   # s2 -> s4 shown
        arrow([(552, 392), (552, 448), (320, 448), (320, 512)]),           # s2 -> s3 app closed
        arrow([(224, 512), (224, 392)]),                                   # s3 -> s0 due date later
        arrow([(1064, 368), (1120, 368), (1120, 624), (88, 624), (88, 368), (160, 368)], accent=True),  # s4 -> s0 (FIX 1)
        arrow([(1064, 336), (1104, 336), (1104, 48), (224, 48), (224, 112)]),  # s4 -> s1 snooze
    ]
    lb = [
        beside(208, 246, "SNOOZE", side="left"),
        beside(320, 246, "ENDS EARLY", accent=True),
        label(436, 328, "TIME COMES"),
        beside(612, 246, "CLEAR OR END"),
        label(612, 112, "SNOOZE ENDS"),
        beside(964, 246, "SHOWN"),
        label(788, 328, "SHOWN"),
        label(436, 424, "APP CLOSED"),
        beside(224, 436, ["DUE DATE LATER", "ANY DEVICE"], side="left"),
        label(604, 588, ["DUE DATE LATER", "ANY DEVICE"], accent=True),
        beside(1104, 216, "SNOOZE"),
    ]
    nd = [
        node(1, 1, "Snoozed", kind="input"),
        node(3, 1, "Due again after a snooze"),
        node(1, 2, "Waiting", "notificationSent false"),
        node(2, 2, "Reminder due"),
        node(3, 2, "Reminded", "notificationSent true"),
        node(1, 3, "Hour over, never shown", kind="lost"),
    ]
    items = [
        ("start", "START"),
        ("arrow", "TRANSITION"),
        ("accent", "THE FIX: BACK TO WAITING"),
        ("lost", "NO REMINDER COMING"),
    ]
    return svg(
        "reminders-after",
        "A task's reminder after fix/lost-reminders",
        "State machine of a web reminder after the fix: a due date moved on any device resets "
        "the reminder, and a snooze that ends before the reminder time goes back to waiting.",
        a, lb, nd, items,
    )


PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Two ways a reminder went missing · GSD state machine</title>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --paper: #f4f1e9; --paper-2: #ece7dc; --ink: #211e1a; --muted: #6e6760; --soft: #797368;
      --rule: rgba(33,30,26,0.12); --rule-solid: #d8d1c1; --accent: #2c6680; --accent-tint: rgba(44,102,128,0.14);
      --font-serif: 'Newsreader', ui-serif, 'New York', Georgia, serif;
      --font-sans: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      --font-mono: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace;
    }
    body { font-family: var(--font-sans); background: var(--paper); color: var(--ink); padding: 3.5rem 2rem 3rem; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0.5rem 0; background: var(--paper); }
    .eyebrow { font-family: var(--font-mono); font-size: 0.66rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }
    .header { display: grid; grid-template-columns: 1.35fr 1fr; gap: 3rem; align-items: end; padding-bottom: 2rem; margin-bottom: 2.25rem; border-bottom: 1px solid var(--rule); }
    .header .eyebrow { margin-bottom: 1rem; }
    h1 { font-family: var(--font-serif); font-size: clamp(2.25rem, 3.4vw + 1rem, 3.5rem); font-weight: 500; letter-spacing: -0.025em; line-height: 1.02; }
    h1 em { font-style: italic; font-weight: 400; color: var(--accent); }
    .subtitle { font-size: 1rem; line-height: 1.6; color: var(--muted); max-width: 46ch; }
    .stats { display: flex; gap: 2.25rem; margin-top: 1.25rem; }
    .stat b { display: block; font-family: var(--font-serif); font-size: 2rem; font-weight: 500; line-height: 1; letter-spacing: -0.02em; }
    .stat span { font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--soft); }
    .stat.fixed b { color: var(--accent); }
    figure { margin-bottom: 2.25rem; }
    figcaption { display: flex; justify-content: space-between; align-items: baseline; gap: 2rem; margin-bottom: 0.75rem; }
    figcaption .what { font-family: var(--font-serif); font-size: 1.35rem; font-weight: 500; letter-spacing: -0.01em; }
    figcaption .what em { font-style: italic; font-weight: 400; color: var(--muted); }
    .frame { background: var(--paper); border: 1px solid var(--rule); border-radius: 8px; overflow: hidden; }
    .frame svg { width: 100%; display: block; }
    .note { margin-top: 0.75rem; font-size: 0.875rem; line-height: 1.55; color: var(--muted); max-width: 80ch; }
    .cards { display: grid; grid-template-columns: 1.1fr 1fr 0.9fr; gap: 1rem; margin-top: 0.5rem; }
    .card { background: #fff; border: 1px solid var(--rule); border-radius: 6px; padding: 1.25rem; }
    .card .eyebrow { font-size: 0.55rem; margin-bottom: 0.5rem; }
    .card-header { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.875rem; padding-bottom: 0.875rem; border-bottom: 1px solid rgba(33,30,26,0.08); }
    .card-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
    .card-dot.accent { background: var(--accent); } .card-dot.ink { background: var(--ink); }
    .card h3 { font-size: 0.9rem; font-weight: 600; }
    .card p, .card li { color: var(--muted); font-size: 0.8125rem; line-height: 1.55; }
    .card p + p { margin-top: 0.5rem; }
    .card ul { list-style: none; }
    .card li { padding-left: 1rem; position: relative; margin-bottom: 0.3rem; }
    .card li::before { content: ''; position: absolute; left: 0; top: 0.7em; width: 6px; height: 1px; background: rgba(33,30,26,0.3); }
    .card code { font-family: var(--font-mono); font-size: 0.75rem; color: var(--ink); }
    .footer { margin-top: 2rem; padding-top: 1.25rem; border-top: 1px solid rgba(33,30,26,0.10); font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.06em; color: var(--soft); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; }
    @media (max-width: 860px) { .header, .cards { grid-template-columns: 1fr; } figcaption { flex-direction: column; gap: 0.25rem; } }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div>
        <p class="eyebrow">State machine · TLA+ model · GSD web reminders</p>
        <h1>Two ways a reminder went <em>missing</em></h1>
      </div>
      <div>
        <p class="subtitle">TLC walked every path through the reminder checker, snoozes, and sync from a second device. Before the fix, two paths mark a reminder shown before its time comes, so it never shows.</p>
        <div class="stats">
          <div class="stat"><b>52</b><span>states before</span></div>
          <div class="stat"><b>1</b><span>rule broken</span></div>
          <div class="stat fixed"><b>6/6</b><span>rules hold after</span></div>
        </div>
      </div>
    </header>

    <figure>
      <figcaption>
        <span class="what">Before the fix <em>· two tide arrows into the bottom row</em></span>
        <span class="eyebrow">52 states checked · one rule breaks</span>
      </figcaption>
      <div class="frame">
BEFORE_SVG
      </div>
      <p class="note">Both tide arrows end in a state that is still waiting but already marked shown. When the reminder time comes, the checker skips it, and the hour runs out.</p>
    </figure>

    <figure>
      <figcaption>
        <span class="what">After fix/lost-reminders <em>· both paths lead back to waiting</em></span>
        <span class="eyebrow">41 states checked · every rule holds</span>
      </figcaption>
      <div class="frame">
AFTER_SVG
      </div>
      <p class="note">The bottom row keeps one state, the reminder you missed with the app closed. A due date moved on any device joins the outer reset loop, and an early snooze end fires nothing.</p>
    </figure>

    <div class="cards">
      <div class="card">
        <p class="eyebrow">Bug 1 · sync</p>
        <div class="card-header"><span class="card-dot accent"></span><h3>Another device moves the due date</h3></div>
        <p>The reminder shows here, then another device moves the due date later. The pull kept this device's <code>notificationSent</code>, so the new reminder never came.</p>
        <p>Now a pull that moves the due date resets it, the same way a local edit does.</p>
      </div>
      <div class="card">
        <p class="eyebrow">Bug 2 · snooze</p>
        <div class="card-header"><span class="card-dot accent"></span><h3>A snooze ends before the reminder time</h3></div>
        <p>The checker fired when the snooze ended and marked the task shown, so the reminder at its own time never came.</p>
        <p>Now an early snooze end fires nothing, and the reminder comes on time.</p>
      </div>
      <div class="card">
        <p class="eyebrow">What TLC checked</p>
        <div class="card-header"><span class="card-dot ink"></span><h3>Every rule holds after the fix</h3></div>
        <ul>
          <li>A due reminder still shows</li>
          <li>A snooze brings it back</li>
          <li>Each reminder shows once</li>
          <li>No reminder before its time</li>
          <li>Every state has a way out</li>
          <li>Every value stays in its type</li>
        </ul>
      </div>
    </div>

    <div class="footer">
      <span>fix/lost-reminders · PR #669 · web 14.6.2</span>
      <span>TLC 1.7.4 · redrawn from the /pstack:statechart output</span>
    </div>
  </div>
</body>
</html>
"""

OUT.write_text(PAGE.replace("BEFORE_SVG", before()).replace("AFTER_SVG", after()))
print(f"wrote {OUT}")
