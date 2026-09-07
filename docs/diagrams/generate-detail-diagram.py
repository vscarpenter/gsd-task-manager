"""Regenerate the detail architecture diagram inside docs/diagrams/architecture.html.

The overview figure in that file is hand-authored SVG and is left alone. The
detail figure (22 nodes, four zones) is emitted from the tables below and
spliced over the second <svg> block in place, so edits are a matter of changing
a tuple and re-running:

    python3 docs/diagrams/generate-detail-diagram.py

Colors are the GSD Editorial light skin from the diagram-design `gsd` profile
(~/.diagram-design/profiles/gsd.md); every coordinate is on the 4px grid the
plugin's geometry checker expects. After regenerating, verify and re-export:

    P=~/.claude/plugins/cache/diagram-design/diagram-design/<version>
    python3 $P/skills/diagram-design/scripts/self_check.py docs/diagrams/architecture.html
    python3 $P/scripts/verify-geometry.py <each figure wrapped alone>
    /diagram-design:export-diagram docs/diagrams/architecture.html --png-only

The geometry checker reads a whole file as one coordinate space, so run it on
each figure in isolation (wrap one <svg> in a bare <html><body>) or it reports
phantom overlaps between the two diagrams.
"""

import re
from pathlib import Path

HTML = Path(__file__).with_name("architecture.html")

PAPER, INK, MUTED, SOFT, ACCENT, LINK = "#f4f1e9", "#211e1a", "#6e6760", "#797368", "#2c6680", "#8a6a22"
SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
MONO = "ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace"
FILL = {  # type -> (fill, stroke, dash, tag stroke, tag ink)
    "focal": ("rgba(44,102,128,0.14)", ACCENT, "", "rgba(44,102,128,0.50)", ACCENT),
    "backend": ("#ffffff", INK, "", "rgba(33,30,26,0.40)", INK),
    "store": ("rgba(33,30,26,0.05)", MUTED, "", "rgba(110,103,96,0.50)", MUTED),
    "external": ("rgba(33,30,26,0.03)", "rgba(33,30,26,0.30)", "", "rgba(33,30,26,0.22)", SOFT),
    "optional": ("rgba(33,30,26,0.02)", "rgba(33,30,26,0.20)", ' stroke-dasharray="4,3"', "rgba(33,30,26,0.22)", SOFT),
}
STROKE = {"muted": MUTED, "accent": ACCENT, "link": LINK}
MARK = {"muted": "dt-arrow", "accent": "dt-arrow-accent", "link": "dt-arrow-link"}

# id, x, y, w, h, type, tag, name, sublabel
NODES = [
    ("appshell", 56, 112, 144, 56, "backend", "WEB", "App shell", "Next.js · React · PWA"),
    ("sw", 256, 112, 144, 56, "store", "PWA", "Service worker", "3 caches · offline"),
    ("store", 56, 192, 144, 56, "focal", "DATA", "Local store", "Dexie · IndexedDB"),
    ("backup", 56, 272, 144, 56, "backend", "FILE", "Backup", "JSON export · import"),
    ("errors", 256, 272, 144, 56, "backend", "LOG", "Error reporting", "content redacted"),
    ("sync", 256, 352, 144, 56, "backend", "SYNC", "Sync engine", "queue · retry · realtime"),
    ("signin", 256, 432, 144, 56, "backend", "AUTH", "Sign-in", "Google · GitHub · Apple"),
    ("cf", 456, 112, 144, 56, "external", "CDN", "CloudFront", "gsd.vinny.dev"),
    ("s3", 648, 112, 144, 56, "store", "S3", "S3 bucket", "static export"),
    ("edge", 456, 192, 144, 56, "backend", "FN", "Edge functions", "URL rewrite · headers"),
    ("agent", 648, 192, 144, 56, "backend", "API", "Agent discovery", "/.well-known · MCP card"),
    ("db", 552, 352, 144, 56, "optional", "DB", "AWS Database", "PocketBase on EC2"),
    ("sentry", 856, 272, 144, 56, "external", "EXT", "Sentry", "error monitoring"),
    ("oauth", 856, 352, 144, 56, "external", "EXT", "OAuth providers", "Google · GitHub · Apple"),
    ("mcp", 856, 448, 144, 56, "optional", "MCP", "MCP server", "stdio · 20 tools"),
    ("claude", 856, 528, 144, 56, "external", "AI", "Claude Desktop", "natural language"),
    ("ios", 72, 640, 128, 56, "backend", "IOS", "iOS app", "SwiftUI · GSDKit"),
    ("iosstore", 240, 640, 128, 56, "store", "DATA", "iOS local store", "GRDB · SQLite"),
    ("iossync", 408, 640, 128, 56, "backend", "SYNC", "iOS sync", "GSDKit Sync · auth"),
    ("android", 576, 640, 128, 56, "backend", "ANDROID", "Android app", "Kotlin · Compose"),
    ("andstore", 744, 640, 128, 56, "store", "DATA", "Android local store", "Room · SQLite"),
    ("andsync", 912, 640, 128, 56, "backend", "SYNC", "Android sync", ":core:sync · auth"),
]

# x, y, w, h, label
ZONES = [
    (40, 72, 376, 440, "WEB APP · BROWSER"),
    (440, 72, 368, 360, "AWS · HOSTING & BACKEND"),
    (840, 232, 176, 368, "OTHER SERVICES · YOUR COMPUTER"),
    (56, 600, 1000, 128, "NATIVE APPS · iOS & ANDROID"),
]

# path d, stroke role, width, dashed  (arrows are painted before nodes)
ARROWS = [
    ("M 128,168 V 192", "accent", 1.4, False),  # appshell -> store   SAVES
    ("M 256,140 H 200", "muted", 1.2, False),  # sw -> appshell      SERVES
    ("M 128,272 V 248", "muted", 1.2, False),  # backup -> store     JSON
    ("M 200,232 H 220 Q 228,232 228,240 V 372 Q 228,380 236,380 H 256", "muted", 1.2, False),  # store -> sync CHANGES
    ("M 456,140 H 400", "link", 1.2, False),  # cf -> sw            FILES
    ("M 648,140 H 600", "muted", 1.2, False),  # s3 -> cf            ORIGIN
    ("M 528,192 V 168", "muted", 1.2, False),  # edge -> cf          RUNS IN
    ("M 720,192 V 168", "muted", 1.2, False),  # agent -> s3         STATIC
    ("M 400,380 H 552", "muted", 1.0, True),  # sync -> db          SYNC · LIVE
    ("M 400,460 H 576 Q 584,460 584,452 V 408", "link", 1.2, False),  # signin -> db  OAUTH
    ("M 696,380 H 856", "link", 1.2, False),  # db -> oauth         IDENTITY
    ("M 400,300 H 856", "muted", 1.0, True),  # errors -> sentry    REDACTED
    ("M 856,492 H 656 Q 648,492 648,484 V 408", "link", 1.2, False),  # mcp -> db     API
    ("M 928,528 V 504", "muted", 1.2, False),  # claude -> mcp       ASKS
    ("M 200,668 H 240", "muted", 1.2, False),  # ios -> iosstore
    ("M 368,668 H 408", "muted", 1.2, False),  # iosstore -> iossync
    ("M 704,668 H 744", "muted", 1.2, False),  # android -> andstore
    ("M 872,668 H 912", "muted", 1.2, False),  # andstore -> andsync
    ("M 472,640 V 488 Q 472,480 480,480 H 608 Q 616,480 616,472 V 408", "muted", 1.0, True),  # iossync -> db
    ("M 1024,640 V 436 Q 1024,428 1016,428 H 688 Q 680,428 680,420 V 408", "muted", 1.0, True),  # andsync -> db
]

# text, centre x, mask y, mask w, ink role   (mask sits 6-10px clear of its stroke)
LABELS = [
    ("SAVES", 156, 174, 40, "accent"),
    ("SERVES", 228, 120, 44, "muted"),
    ("JSON", 152, 254, 32, "muted"),
    ("CHANGES", 258, 256, 44, "muted"),
    ("FILES", 428, 120, 32, "link"),
    ("ORIGIN", 624, 120, 36, "muted"),
    ("RUNS IN", 558, 174, 44, "muted"),
    ("STATIC", 748, 174, 40, "muted"),
    ("SYNC · LIVE", 476, 360, 64, "muted"),
    ("OAUTH", 488, 440, 40, "link"),
    ("IDENTITY", 776, 360, 56, "link"),
    ("REDACTED", 628, 280, 48, "muted"),
    ("API", 756, 472, 28, "link"),
    ("ASKS", 952, 510, 32, "muted"),
    ("SYNC", 452, 560, 32, "muted"),
    ("SYNC", 1044, 540, 32, "muted"),
]

LEGEND_Y = 756
LEGEND = [  # x, kind, text
    (56, "focal", "Your data"),
    (148, "backend", "Component"),
    (264, "store", "Store / cache"),
    (380, "external", "External"),
    (472, "optional", "Opt-in"),
    (560, "arrow-link", "HTTP"),
    (648, "arrow-accent", "Saves"),
    (744, "arrow-dash", "Sync / async"),
]


def text(x, y, s, size, fill, family, weight=None, anchor="middle", ls=None):
    w = f' font-weight="{weight}"' if weight else ""
    tracking = f' letter-spacing="{ls}"' if ls else ""
    return f'<text x="{x}" y="{y}" fill="{fill}" font-size="{size}"{w} font-family="{family}" text-anchor="{anchor}"{tracking}>{s}</text>'


def mask_width(label, pad):
    return (len(label) * 5 + pad + 3) // 4 * 4


def render():
    out = []
    out.append('    <svg viewBox="0 0 1120 840" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="gsd-detail-title gsd-detail-desc">')
    out.append("      <title id=\"gsd-detail-title\">GSD Task Manager in detail</title>")
    out.append("      <desc id=\"gsd-detail-desc\">Detailed architecture showing the web app internals (app shell, service worker, local IndexedDB store, backup, sync engine, sign-in, error reporting), AWS hosting through CloudFront, S3, edge functions and the agent-discovery files, the AWS-hosted PocketBase database as the sync hub, third-party OAuth providers, Sentry, the MCP server and Claude Desktop, and the iOS and Android apps each with a local store and sync module.</desc>")
    out.append("      <defs>")
    for role, mid in MARK.items():
        out.append(f'        <marker id="{mid}" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{STROKE[role]}"/></marker>')
    out.append("      </defs>")
    out.append(f'      <rect width="100%" height="100%" fill="{PAPER}"/>')

    out.append("      <!-- Zones -->")
    for x, y, w, h, label in ZONES:
        mw = mask_width(label, 16)
        cx = x + w // 2
        out.append(f'      <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="rgba(33,30,26,0.02)" stroke="rgba(33,30,26,0.10)" stroke-width="0.8"/>')
        out.append(f'      <rect x="{cx - mw // 2}" y="{y + 4}" width="{mw}" height="12" rx="2" fill="{PAPER}"/>')
        out.append("      " + text(cx, y + 13, label, 7, "rgba(33,30,26,0.40)", MONO, ls="0.14em"))

    out.append("      <!-- Arrows -->")
    for d, role, w, dashed in ARROWS:
        dash = ' stroke-dasharray="4,3"' if dashed else ""
        out.append(f'      <path d="{d}" fill="none" stroke="{STROKE[role]}" stroke-width="{w}"{dash} marker-end="url(#{MARK[role]})"/>')

    out.append("      <!-- Arrow labels -->")
    for s, cx, my, mw, role in LABELS:
        out.append(f'      <rect x="{cx - mw // 2}" y="{my}" width="{mw}" height="12" rx="2" fill="{PAPER}"/>')
        out.append("      " + text(cx, my + 9, s, 8, STROKE[role], MONO, ls="0.08em"))

    out.append("      <!-- Nodes -->")
    for _, x, y, w, h, kind, tag, name, sub in NODES:
        fill, stroke, dash, tstroke, tink = FILL[kind]
        tw = mask_width(tag, 8)
        cx = x + w // 2
        out.append(f'      <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{PAPER}"/>')
        out.append(f'      <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="1"{dash}/>')
        out.append(f'      <rect x="{x + 8}" y="{y + 6}" width="{tw}" height="12" rx="2" fill="transparent" stroke="{tstroke}" stroke-width="0.8"/>')
        out.append("      " + text(x + 8 + tw // 2, y + 15, tag, 7, tink, MONO, ls="0.08em"))
        out.append("      " + text(cx, y + 33, name, 12, INK, SANS, weight=600))
        out.append("      " + text(cx, y + 47, sub, 9, MUTED, MONO))

    out.append("      <!-- Legend strip -->")
    out.append(f'      <line x1="56" y1="{LEGEND_Y}" x2="1064" y2="{LEGEND_Y}" stroke="rgba(33,30,26,0.10)" stroke-width="0.8"/>')
    out.append("      " + text(56, LEGEND_Y + 16, "LEGEND", 8, MUTED, MONO, anchor="start", ls="0.18em"))
    sy = LEGEND_Y + 30
    for x, kind, label in LEGEND:
        if kind.startswith("arrow-"):
            role = {"arrow-link": "link", "arrow-accent": "accent", "arrow-dash": "muted"}[kind]
            dash = ' stroke-dasharray="4,3"' if kind == "arrow-dash" else ""
            wdt = {"link": 1.2, "accent": 1.4, "muted": 1.0}[role]
            out.append(f'      <line x1="{x}" y1="{sy + 6}" x2="{x + 28}" y2="{sy + 6}" stroke="{STROKE[role]}" stroke-width="{wdt}"{dash} marker-end="url(#{MARK[role]})"/>')
            tx = x + 36
        else:
            fill, stroke, dash, _, _ = FILL[kind]
            out.append(f'      <rect x="{x}" y="{sy}" width="14" height="10" rx="2" fill="{fill}" stroke="{stroke}" stroke-width="1"{dash}/>')
            tx = x + 20
        out.append("      " + text(tx, sy + 8, label, 8.5, MUTED, SANS, anchor="start"))
    out.append("    </svg>")
    return "\n".join(out)


def splice(html, svg):
    blocks = list(re.finditer(r"^    <svg .*?^    </svg>", html, re.M | re.S))
    if len(blocks) != 2:
        raise SystemExit(f"expected 2 <svg> blocks in {HTML}, found {len(blocks)}")
    second = blocks[1]
    return html[: second.start()] + svg + html[second.end() :]


if __name__ == "__main__":
    html = HTML.read_text(encoding="utf-8")
    HTML.write_text(splice(html, render()), encoding="utf-8")
    print(f"nodes {len(NODES)} · arrows {len(ARROWS)} · labels {len(LABELS)} · zones {len(ZONES)} → {HTML}")
