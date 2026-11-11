"""Build the downloadable Übersicht installer without requiring macOS."""

import argparse
import re
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=Path("dist"))
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    version = (root / "VERSION").read_text(encoding="utf-8").strip()
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        parser.error(f"Invalid release version: {version!r}")

    package_name = f"WeReadHighlights-macOS-v{version}"
    args.output_dir.mkdir(parents=True, exist_ok=True)
    output = args.output_dir / f"{package_name}.zip"
    files = (
        "LICENSE",
        "ios/WeReadHighlights.js",
        "macos/uebersicht/Install.command",
        "macos/uebersicht/README.md",
        "macos/uebersicht/ScriptableHost.js",
        "macos/uebersicht/install.cjs",
        "macos/uebersicht/request.cjs",
        "macos/uebersicht/widget.jsx",
    )
    with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
        for relative in files:
            archive_path = "Install.command" if relative.endswith(".command") else relative
            member = ZipInfo(f"{package_name}/{archive_path}")
            member.create_system = 3  # Unix file modes
            member.external_attr = (0o100755 if relative.endswith(".command") else 0o100644) << 16
            archive.writestr(member, (root / relative).read_bytes(), compress_type=ZIP_DEFLATED)
    print(output)


if __name__ == "__main__":
    main()
