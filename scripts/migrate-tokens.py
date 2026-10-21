#!/usr/bin/env python3
"""Design rework: replaces common light/dark Tailwind pairs with the semantic tokens.

Mechanical and idempotent. Pairs match only as whole classes (no prefix like `hover:` glued in
front unless the pair itself has it). Usage: python3 scripts/migrate-tokens.py [files...]
"""
import re
import sys
from pathlib import Path

PAIRS = {
    "text-gray-900 dark:text-gray-100": "text-content",
    "text-gray-900 dark:text-white": "text-content",
    "text-gray-700 dark:text-gray-300": "text-content-secondary",
    "text-gray-700 dark:text-gray-200": "text-content-secondary",
    "text-gray-600 dark:text-gray-400": "text-content-secondary",
    "text-gray-500 dark:text-gray-300": "text-content-secondary",
    "text-gray-500 dark:text-gray-400": "text-content-tertiary",
    "text-gray-400 dark:text-gray-500": "text-content-tertiary",
    "text-primary-600 dark:text-primary-400": "text-brand",
    "bg-white dark:bg-gray-900": "bg-surface-elevated",
    "bg-white dark:bg-gray-800": "bg-surface-elevated",
    "bg-white dark:bg-gray-700": "bg-surface-elevated",
    "bg-gray-50 dark:bg-gray-900": "bg-surface",
    "bg-gray-50 dark:bg-gray-800": "bg-surface-sunken",
    "bg-gray-50 dark:bg-gray-700/50": "bg-surface-sunken",
    "bg-gray-100 dark:bg-gray-800": "bg-surface-sunken",
    "bg-gray-100 dark:bg-gray-700": "bg-surface-sunken",
    "bg-primary-600 dark:bg-primary-500": "bg-brand",
    "bg-primary-100 dark:bg-primary-900/30": "bg-brand-soft",
    "bg-primary-50 dark:bg-primary-900/20": "bg-brand-soft",
    "border-gray-200 dark:border-gray-700": "border-line",
    "border-gray-300 dark:border-gray-600": "border-line",
    "border-gray-100 dark:border-gray-800": "border-line-subtle",
    "border-gray-200 dark:border-gray-800": "border-line-subtle",
    "border-gray-100 dark:border-gray-700": "border-line-subtle",
    "border-primary-600 dark:border-primary-500": "border-brand",
    "divide-gray-200 dark:divide-gray-700": "divide-line-subtle",
    "divide-gray-100 dark:divide-gray-800": "divide-line-subtle",
    "hover:bg-gray-100 dark:hover:bg-gray-700": "hover:bg-surface-sunken",
    "hover:bg-gray-50 dark:hover:bg-gray-600": "hover:bg-surface-sunken",
    "hover:bg-gray-50 dark:hover:bg-gray-700": "hover:bg-surface-sunken",
    "hover:bg-gray-50/50 dark:hover:bg-gray-900/50": "hover:bg-surface-sunken",
    "hover:text-gray-900 dark:hover:text-gray-100": "hover:text-content",
    "hover:text-gray-600 dark:hover:text-gray-300": "hover:text-content-secondary",
    "hover:text-gray-700 dark:hover:text-gray-300": "hover:text-content-secondary",
    "hover:text-primary-600 dark:hover:text-primary-400": "hover:text-brand",
    "focus:border-primary-500 dark:focus:border-primary-500": "focus:border-brand",
    # Money and status colors (iOS positive/negative/warning/info).
    "text-red-600 dark:text-red-400": "text-negative",
    "text-red-500 dark:text-red-400": "text-negative",
    "text-red-700 dark:text-red-400": "text-negative",
    "text-green-600 dark:text-green-400": "text-positive",
    "text-green-500 dark:text-green-400": "text-positive",
    "text-yellow-600 dark:text-yellow-400": "text-warning",
    "text-yellow-500 dark:text-yellow-400": "text-warning",
    "text-amber-600 dark:text-amber-400": "text-warning",
    "text-blue-600 dark:text-blue-400": "text-info",
    "text-blue-500 dark:text-blue-400": "text-info",
    "bg-red-50 dark:bg-red-900/20": "bg-negative-soft",
    "bg-red-100 dark:bg-red-900/30": "bg-negative-soft",
    "bg-green-50 dark:bg-green-900/20": "bg-positive-soft",
    "bg-yellow-50 dark:bg-yellow-900/20": "bg-warning/10",
    "bg-blue-50 dark:bg-blue-900/20": "bg-info/10",
    "border-red-200 dark:border-red-800": "border-negative/25",
    "border-red-300 dark:border-red-600": "border-negative/60",
    "border-red-300 dark:border-red-700": "border-negative/60",
    "border-green-200 dark:border-green-800": "border-positive/25",
    "border-yellow-200 dark:border-yellow-800": "border-warning/25",
    "border-blue-200 dark:border-blue-800": "border-info/25",
}

PATTERN = re.compile(
    r"(?<![\w:/\[-])(" + "|".join(re.escape(k) for k in sorted(PAIRS, key=len, reverse=True)) + r")(?![\w/\]-])"
)


# Hand-written text inputs become the shared `.field-control` (index.css).
INPUT_PATTERN = re.compile(
    r"(?:block )?w-full px-3 py-2(?:\.5)? border (?:border-line(?:-subtle)? )?rounded-md (?:shadow-sm )?"
    r"bg-surface-elevated text-content focus:outline-none (?:focus:ring-primary-500 )?focus:border-(?:brand|primary-500)"
    r"(?: sm:text-sm)?(?: font-light tracking-tight)?"
)
# Other recurring idioms of the old "fine line" look.
IDIOMS = [
    # Section titles inside cards.
    (re.compile(r"(<h[234][^>]*className=[{`\"]*)text-(?:lg|xl)(?: sm:text-(?:xl|2xl))? font-light tracking-tight text-content"), r"\1card-title"),
    # Big thin numbers (balances, totals) become rounded semibold with tabular digits.
    (re.compile(r"\b((?:sm:|md:|lg:)?text-(?:2xl|3xl|4xl)) font-light(?: tracking-tight)?"), r"\1 font-rounded font-semibold tabular-nums"),
    # Bordered stat tiles inside cards become tinted tiles.
    (re.compile(r"\bp-([34]) border border-line(?:-subtle)? rounded-(?:md|lg)\b"), r"p-\1 rounded-xl bg-surface-sunken/70"),
    # Raw status colors without a dark variant.
    (re.compile(r"(?<![\w:/-])text-green-500(?![\w/-])"), "text-positive"),
    (re.compile(r"(?<![\w:/-])text-red-500(?![\w/-])"), "text-negative"),
    (re.compile(r"(?<![\w:/-])text-blue-500(?![\w/-])"), "text-info"),
]
# A textarea keeps its own height.
TEXTAREA_FIX = re.compile(r'(<textarea\b[^>]*?className=[{`"]*)field-control(?! h-auto)')


def migrate(path: Path) -> int:
    text = path.read_text()
    new, count = PATTERN.subn(lambda m: PAIRS[m.group(1)], text)
    new, n = INPUT_PATTERN.subn("field-control", new)
    count += n
    for pattern, repl in IDIOMS:
        new, n = pattern.subn(repl, new)
        count += n
    new = TEXTAREA_FIX.sub(r"\1field-control h-auto min-h-[88px] py-2.5", new)
    if count:
        path.write_text(new)
    return count


def main():
    root = Path(__file__).resolve().parents[1] / "src"
    skip = {"LandingPage.tsx", "UiGallery.tsx"}
    files = [Path(f) for f in sys.argv[1:]] or [p for p in root.rglob("*.tsx") if p.name not in skip]
    total = 0
    for f in files:
        n = migrate(f)
        if n:
            total += n
            print(f"{n:4d}  {f.relative_to(root.parent)}")
    print(f"{total} replacements")


if __name__ == "__main__":
    main()
