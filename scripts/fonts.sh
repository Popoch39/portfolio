#!/usr/bin/env bash
# Rebuilds the woff2 subsets in src/assets/fonts from the google/fonts sources (ADR 0002).
# Run it again when the site's copy gains a character outside GLYPHS.
# Requires fonttools and brotli (`pip install fonttools brotli`), and curl.
set -euo pipefail

OUTPUT="$(cd "$(dirname "$0")/.." && pwd)/src/assets/fonts"
SOURCES="https://github.com/google/fonts/raw/main/ofl"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Basic Latin, Latin-1 (French accents, no-break space), œ/Œ/Ÿ, typographic punctuation, € and arrows.
GLYPHS="U+0020-007E,U+00A0-00FF,U+0152-0153,U+0178,U+2013-2014,U+2018-2019,U+201C-201D,U+2022,U+2026,U+202F,U+2039-203A,U+20AC,U+2190,U+2192,U+2197"
FEATURES="kern,liga,calt,ccmp,locl,mark,mkmk"

curl -sSfL -o "$TMP/archivo.ttf" "$SOURCES/archivo/Archivo%5Bwdth%2Cwght%5D.ttf"
curl -sSfL -o "$TMP/fragment-mono.ttf" "$SOURCES/fragmentmono/FragmentMono-Regular.ttf"

# Archivo keeps both axes, narrowed to what the site uses: width 62 to 100 %, weight 400 to 900.
fonttools varLib.instancer "$TMP/archivo.ttf" wdth=62:100 wght=400:900 -q -o "$TMP/archivo-axes.ttf"

subset() {
	pyftsubset "$1" --unicodes="$GLYPHS" --layout-features="$FEATURES" --flavor=woff2 --output-file="$OUTPUT/$2"
}
subset "$TMP/archivo-axes.ttf" archivo-variable.woff2
subset "$TMP/fragment-mono.ttf" fragment-mono-400.woff2

ls -l "$OUTPUT"/*.woff2
