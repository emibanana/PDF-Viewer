"""Generates every PDF Viewer logo/icon from ONE master: mark.svg (+ brand.json).

To rebrand: edit src/editor/studio/assets/brand/mark.svg and brand.json, then run
from frontend/:

    python scripts/studio/gen-brand.py

Writes (all overwrite-safe, none hand-edited):
  src/editor/studio/assets/brand/modern-logo/*   web logos, logo192/512, favicon.ico
  src/editor/studio/assets/brand/branding-logo/* wordmarks
  src/editor/studio/icons/svg/stirling/stirling-mark.svg   in-app mark icon
  public/favicon.png, public/manifest.json name
  src-tauri/icons/*                               window, taskbar, installer icons

The mark keeps the file names the core UI imports (StirlingPDFLogo*.svg,
stirling-mark.svg) so no core code changes; only their content is ours.
Needs Pillow (PNG resize) and the Tauri CLI from node_modules (SVG rasterising).
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / "src/editor/studio/assets/brand"
MARK = BRAND / "mark.svg"
CFG = json.loads((BRAND / "brand.json").read_text(encoding="utf-8"))
NAME = CFG["name"]
FONT = CFG["font"]
LOGO = BRAND / "modern-logo"
WORD = BRAND / "branding-logo"
ICON_SVG = ROOT / "src/editor/studio/icons/svg/stirling/stirling-mark.svg"
TAURI_ICONS = ROOT / "src-tauri/icons"


def mark_inner() -> str:
    """The master's drawing, without the outer <svg> and comments."""
    text = MARK.read_text(encoding="utf-8")
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    return re.sub(r"</?svg[^>]*>", "", text).strip()


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def logo_with_text(color: str) -> str:
    return (
        '<svg width="360" height="100" viewBox="0 0 360 100" xmlns="http://www.w3.org/2000/svg">'
        f"{mark_inner()}"
        f'<text x="116" y="66" font-family="{FONT}" font-weight="700" font-size="46" fill="{color}">{NAME}</text>'
        "</svg>\n"
    )


def wordmark(color: str) -> str:
    return (
        '<svg width="110" height="21" viewBox="0 0 110 21" xmlns="http://www.w3.org/2000/svg">'
        f'<text x="0" y="17" font-family="{FONT}" font-weight="700" font-size="19" fill="{color}">{NAME}</text>'
        "</svg>\n"
    )


def mark_only() -> str:
    return f'<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">{mark_inner()}</svg>\n'


def rasterise_with_tauri() -> Path:
    """`tauri icon` renders the SVG master to PNG/ICO sets."""
    out = Path(tempfile.mkdtemp(prefix="brand-icons-"))
    npx = "npx.cmd" if sys.platform == "win32" else "npx"
    subprocess.run(
        [npx, "tauri", "icon", str(MARK), "-o", str(out)],
        cwd=ROOT,
        check=True,
        stdout=subprocess.DEVNULL,
    )
    return out


def main() -> None:
    if not MARK.exists():
        sys.exit(f"missing master mark: {MARK}")

    # Vector logos for the web UI.
    write(LOGO / "StirlingPDFLogoNoTextDark.svg", mark_only())
    write(LOGO / "StirlingPDFLogoNoTextLight.svg", mark_only())
    write(LOGO / "StirlingPDFLogoBlackText.svg", logo_with_text(CFG["textColorOnLight"]))
    write(LOGO / "StirlingPDFLogoWhiteText.svg", logo_with_text(CFG["textColorOnDark"]))
    write(LOGO / "StirlingPDFLogoGreyText.svg", logo_with_text(CFG["textColorGrey"]))
    write(LOGO / "logo-tooltip.svg", mark_only())
    write(WORD / "wordmark-dark.svg", wordmark(CFG["textColorOnDark"]))
    write(WORD / "wordmark-light.svg", wordmark(CFG["textColorOnLight"]))

    # The in-app mark icon: the master as-is. A "brand" icon paints itself.
    write(ICON_SVG, mark_only())

    # Raster outputs, all derived from the Tauri render of the master.
    rendered = rasterise_with_tauri()
    try:
        big = Image.open(rendered / "icon.png").convert("RGBA")
        big.resize((192, 192), Image.LANCZOS).save(LOGO / "logo192.png")
        big.resize((512, 512), Image.LANCZOS).save(LOGO / "logo512.png")
        big.save(LOGO / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])
        big.resize((64, 64), Image.LANCZOS).save(ROOT / "public/favicon.png")

        # Desktop shell icons: replace the whole set so no stale brand remains.
        if TAURI_ICONS.exists():
            shutil.rmtree(TAURI_ICONS)
        (TAURI_ICONS / "windows").mkdir(parents=True)
        for item in rendered.iterdir():
            if item.is_file() and item.suffix == ".png":
                shutil.copy(item, TAURI_ICONS / item.name)
        shutil.copy(rendered / "icon.ico", TAURI_ICONS / "windows/app.ico")
    finally:
        shutil.rmtree(rendered, ignore_errors=True)

    # Web app manifest name.
    manifest = ROOT / "public/manifest.json"
    data = json.loads(manifest.read_text(encoding="utf-8"))
    data["name"] = NAME
    data["short_name"] = NAME
    manifest.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"brand assets regenerated from {MARK.name} ({NAME})")


if __name__ == "__main__":
    main()
