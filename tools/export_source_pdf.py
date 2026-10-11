#!/usr/bin/env python3
"""Generate the copy-friendly single-page source PDF used by WeReadHighlights.

Default input:  <repo>/WeReadHighlights.js
Default output: <repo>/WeReadHighlights.pdf

The layout intentionally uses one very tall PDF page so the complete source can
be selected and copied without page headers, footers, line numbers, or Word/WPS
rich-text conversions altering code characters.
"""

from __future__ import annotations

import argparse
import html
from pathlib import Path

from weasyprint import HTML

PAGE_WIDTH_PT = 841.89  # 297 mm, A4 landscape width
PAGE_MARGIN_PT = 14.0
FONT_SIZE_PT = 5.55
LINE_HEIGHT_PT = 7.45
MAX_PAGE_HEIGHT_PT = 14_000.0

FONT_STACK = (
    '"Noto Sans Mono CJK SC", "Noto Sans CJK SC", '
    '"Source Han Sans SC", monospace'
)


def make_html(source: str, page_height_pt: float) -> str:
    escaped = html.escape(source, quote=True)

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
@page {{
  size: {PAGE_WIDTH_PT:.2f}pt {page_height_pt:.2f}pt;
  margin: {PAGE_MARGIN_PT:g}pt {PAGE_MARGIN_PT:g}pt {PAGE_MARGIN_PT:g}pt {PAGE_MARGIN_PT:g}pt;
}}
html, body {{ margin: 0; padding: 0; background: #fff; }}
pre {{
  margin: 0;
  padding: 0;
  white-space: pre;
  overflow: visible;
  font-family: {FONT_STACK};
  font-size: {FONT_SIZE_PT:.2f}pt;
  line-height: {LINE_HEIGHT_PT:.2f}pt;
  font-variant-ligatures: none;
  color: #000;
  tab-size: 2;
}}
</style>
</head>
<body><pre>{escaped}</pre></body>
</html>
"""


def export_pdf(source_path: Path, output_path: Path, html_output: Path | None = None) -> None:
    source = source_path.read_text(encoding="utf-8")

    # count("\n") + 1 intentionally includes the final visual line when the
    # source ends with a newline. This reproduces the original export layout.
    visual_lines = source.count("\n") + 1
    page_height_pt = 2 * PAGE_MARGIN_PT + visual_lines * LINE_HEIGHT_PT

    if page_height_pt > MAX_PAGE_HEIGHT_PT:
        raise RuntimeError(
            f"Source needs a {page_height_pt:.0f} pt page, above the configured "
            f"{MAX_PAGE_HEIGHT_PT:.0f} pt safety limit. Reduce FONT_SIZE_PT or "
            "LINE_HEIGHT_PT, or change this tool to a paginated layout."
        )

    document = make_html(source, page_height_pt)

    if html_output is not None:
        html_output.parent.mkdir(parents=True, exist_ok=True)
        html_output.write_text(document, encoding="utf-8")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    HTML(string=document, base_url=str(source_path.parent)).write_pdf(str(output_path))


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]

    parser = argparse.ArgumentParser(
        description="Export JavaScript source to a copy-friendly single-page PDF."
    )
    parser.add_argument(
        "source",
        nargs="?",
        type=Path,
        default=repo_root / "WeReadHighlights.js",
        help="source file (default: WeReadHighlights.js in repository root)",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=repo_root / "WeReadHighlights.pdf",
        help="PDF output path (default: WeReadHighlights.pdf in repository root)",
    )
    parser.add_argument(
        "--html-output",
        type=Path,
        default=None,
        help="optionally save the intermediate HTML for debugging",
    )
    args = parser.parse_args()

    export_pdf(
        args.source.resolve(),
        args.output.resolve(),
        args.html_output.resolve() if args.html_output else None,
    )
    print(f"Generated: {args.output.resolve()}")


if __name__ == "__main__":
    main()
