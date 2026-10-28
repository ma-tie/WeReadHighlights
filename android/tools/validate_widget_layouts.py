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
    for required in ("widget_root", "quote_text", "source_text"):
        assert any(item.endswith("/" + required) for item in found), (layout, required)
    meta = ET.parse(root / "xml" / (info + ".xml")).getroot()
    assert meta.attrib[ns + "targetCellWidth"] == str(columns), info
    assert meta.attrib[ns + "targetCellHeight"] == str(rows), info
    assert meta.attrib[ns + "initialLayout"] == "@layout/" + layout, info
    print(f"OK {layout}: {columns}x{rows} cells and compatible RemoteViews children")
