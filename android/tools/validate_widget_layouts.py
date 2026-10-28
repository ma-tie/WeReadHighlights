#!/usr/bin/env python3
"""Static smoke test for RemoteViews layouts and Android 12+ launcher cells."""
from pathlib import Path
from xml.etree import ElementTree as ET

root = Path(__file__).resolve().parents[1] / "app/src/main/res"
ns = "{http://schemas.android.com/apk/res/android}"

# Generic <View>, arbitrary custom views and unsupported layouts can make
# Launcher fail widget inflation with "Can't load widget".
allowed = {
    "FrameLayout", "LinearLayout", "RelativeLayout", "GridLayout",
    "TextView", "ImageView", "Button", "ImageButton", "ProgressBar",
    "Chronometer", "ViewFlipper", "ViewStub",
}
widgets = (
    ("widget_quote_small", "quote_widget_small_info", 2, 2),
    ("widget_quote", "quote_widget_info", 4, 2),
    ("widget_quote_large", "quote_widget_large_info", 4, 4),
)
for layout, info, columns, rows in widgets:
    tree = ET.parse(root / "layout" / (layout + ".xml"))
    found = set()
    for node in tree.iter():
        assert node.tag in allowed, f"{layout}: unsupported RemoteViews tag {node.tag}"
        node_id = node.attrib.get(ns + "id", "")
        if node_id:
            found.add(node_id)
    for required in ("widget_root", "quote_text", "source_title", "source_author"):
        assert any(item.endswith("/" + required) for item in found), (layout, required)
    # The book title must share the footer with a dedicated, width-limited
    # author label; a long title should ellipsize before the author's area.
    titles = [node for node in tree.iter() if node.attrib.get(ns + "id", "").endswith("/source_title")]
    authors = [node for node in tree.iter() if node.attrib.get(ns + "id", "").endswith("/source_author")]
    assert len(titles) == 1 and len(authors) == 1, layout
    title, author = titles[0], authors[0]
    assert title.attrib.get(ns + "layout_width") == "0dp", layout
    assert title.attrib.get(ns + "layout_weight") == "1", layout
    assert title.attrib.get(ns + "ellipsize") == "end", layout
    assert author.attrib.get(ns + "maxWidth", "").endswith("dp"), layout
    assert title in list(tree.iter()) and author in list(tree.iter()), layout
    # Font-based glyphs were offset by Android text metrics; the background
    # mark must be a fixed-size vector immediately right of the accent.
    mark = [node for node in tree.iter() if node.attrib.get(ns + "id", "").endswith("/quote_mark")]
    assert len(mark) == 1 and mark[0].tag == "ImageView", layout
    assert mark[0].attrib[ns + "src"] == "@drawable/widget_quote_mark", layout
    assert not any(node.attrib.get(ns + "text") == "“" for node in tree.iter()), layout
    accent = [node for node in tree.iter() if node.attrib.get(ns + "background") == "@drawable/widget_accent"]
    assert len(accent) == 1, layout
    quote_left = int(mark[0].attrib[ns + "layout_marginStart"].removesuffix("dp"))
    accent_left = int(accent[0].attrib[ns + "layout_marginStart"].removesuffix("dp"))
    quote_top = int(mark[0].attrib[ns + "layout_marginTop"].removesuffix("dp"))
    accent_top = int(accent[0].attrib[ns + "layout_marginTop"].removesuffix("dp"))
    assert 5 <= quote_left - accent_left <= 13, (layout, quote_left, accent_left)
    assert -6 <= quote_top - accent_top <= 2, (layout, quote_top, accent_top)
    assert int(mark[0].attrib[ns + "layout_width"].removesuffix("dp")) <= 50, layout
    meta = ET.parse(root / "xml" / (info + ".xml")).getroot()
    assert meta.attrib[ns + "targetCellWidth"] == str(columns), info
    assert meta.attrib[ns + "targetCellHeight"] == str(rows), info
    assert meta.attrib[ns + "initialLayout"] == "@layout/" + layout, info
    print(f"OK {layout}: {columns}x{rows} cells and compatible RemoteViews children")

mark_vector = ET.parse(root / "drawable" / "widget_quote_mark.xml").getroot()
assert mark_vector.tag == "vector"
paths = list(mark_vector)
assert len(paths) == 1 and paths[0].tag == "path"
assert paths[0].attrib[ns + "fillAlpha"] == "0.14"
assert paths[0].attrib.get(ns + "pathData", "").count(" M") >= 1
print("OK quote watermark: stable double-quote vector with translucent fill")
