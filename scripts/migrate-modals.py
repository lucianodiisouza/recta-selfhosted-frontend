#!/usr/bin/env python3
"""Design rework: restyles the hand-built modals and their buttons like components/ui/Modal.

- Backdrops become the blurred scrim.
- The standard centered container becomes a bottom sheet on phones (like the iOS sheets).
- Panels get 24px corners, the floating shadow and a hairline ring instead of the border.
- Modal titles use the rounded semibold style.
- `px-4 py-2...` buttons are mapped by meaning to the ui/Button variants.

Idempotent. Usage: python3 scripts/migrate-modals.py [files...]
"""
import re
import sys
from pathlib import Path

SCRIM = "fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop"
BACKDROPS = {
    "fixed inset-0 bg-black/60 transition-opacity": SCRIM,
    "fixed inset-0 bg-black/40 animate-fade-in transition-opacity duration-300 ease-out": SCRIM,
    "fixed inset-0 bg-black/60 animate-fade-in transition-opacity duration-300 ease-out": SCRIM,
    "fixed inset-0 bg-black/40 transition-opacity": SCRIM,
    "fixed inset-0 bg-black/50 transition-opacity": SCRIM,
    "fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-gray-900 dark:bg-opacity-70 z-50": SCRIM + " z-50",
}
CONTAINER_OLD = "flex min-h-full items-center justify-center p-4"
CONTAINER_NEW = "flex min-h-full items-end sm:items-center justify-center sm:p-4"

BTN = "inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
PRIMARY = f"{BTN} bg-brand-fill text-white hover:bg-brand-fill-hover"
SECONDARY = f"{BTN} bg-brand-soft text-brand-on-soft hover:bg-brand/15"
TERTIARY = f"{BTN} bg-surface-elevated text-content border border-line hover:bg-surface-sunken"
DANGER = f"{BTN} bg-negative-soft text-negative-on-soft hover:brightness-95 dark:hover:brightness-125"


def panel(cls: str, sheet: bool) -> str:
    parts = cls.split()
    drop = {"border", "border-line", "border-line-subtle", "shadow-2xl", "shadow-xl", "shadow-lg", "rounded-lg",
            "animate-slide-in-bottom", "animate-in", "fade-in", "zoom-in", "duration-200", "transform", "transition-all"}
    keep = [p for p in parts if p not in drop]
    corners = ["rounded-t-[28px]", "sm:rounded-2xl"] if sheet else ["rounded-2xl"]
    return " ".join(keep + corners + ["shadow-floating", "ring-1", "ring-line-subtle", "animate-modal-panel"])


def button(cls: str) -> str:
    if "text-white" in cls and ("bg-brand" in cls or "bg-primary-600" in cls):
        new = PRIMARY
    elif "text-negative" in cls or "text-red" in cls:
        new = DANGER
    elif "text-brand" in cls:
        new = SECONDARY
    elif "bg-surface-elevated" in cls:
        new = TERTIARY
    else:
        return cls
    extra = [p for p in cls.split() if p.startswith(("w-", "flex-1", "sm:w-", "mt-", "ml-", "mr-", "ms-", "me-", "hidden", "sm:inline", "order-"))]
    return " ".join([new] + extra)


def migrate(path: Path) -> bool:
    text = path.read_text()
    original = text
    for old, new in BACKDROPS.items():
        text = text.replace(f'className="{old}"', f'className="{new}"')
    sheet = CONTAINER_OLD in text or CONTAINER_NEW in text
    text = text.replace(f'className="{CONTAINER_OLD}"', f'className="{CONTAINER_NEW}"')
    text = re.sub(
        r'className="(relative (?:z-50 )?w-full[^"]*bg-surface-elevated[^"]*)"',
        lambda m: f'className="{panel(m.group(1), sheet)}"' if "animate-modal-panel" not in m.group(1) else m.group(0),
        text,
    )
    text = re.sub(r'className="(px-4 py-2(?:\.5)? [^"]*rounded-(?:md|lg)[^"]*)"', lambda m: f'className="{button(m.group(1))}"', text)
    text = re.sub(r'(<h[23] [^>]*className=")text-(?:xl|lg) font-light tracking-tight text-content', r'\1font-rounded text-lg font-semibold text-content', text)
    if text != original:
        path.write_text(text)
        return True
    return False


def main():
    root = Path(__file__).resolve().parents[1] / "src"
    files = [Path(f).resolve() for f in sys.argv[1:]] or [p for p in root.rglob("*.tsx") if "fixed inset-0" in p.read_text()]
    for f in files:
        if migrate(f):
            print(f.relative_to(root.parent))


if __name__ == "__main__":
    main()
