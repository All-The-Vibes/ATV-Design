#!/usr/bin/env bash
# Sync every distribution-channel manifest to a published GitHub Release.
#
# Reads SHA256SUMS.txt from the release (one GET — no re-downloading
# installers) and rewrites version strings, URLs, and checksums across
# homebrew cask, scoop, winget, and flatpak. For winget, auto-copies the
# previous version directory when the new one does not yet exist.
#
# Also derives the mac .app bundle name from apps/desktop/electron-builder.yml
# so that renaming productName (e.g. "open-codesign" → "Open CoDesign")
# propagates into the cask without manual edits.
#
# Usage:
#   ./packaging/update-shas.sh                  # use apps/desktop/package.json version
#   ./packaging/update-shas.sh 0.1.3            # override version
#   ./packaging/update-shas.sh 0.1.3 local/dir  # hash local files instead of downloading

set -euo pipefail

VERSION="${1:-$(node -p "require('./apps/desktop/package.json').version" 2>/dev/null || echo '')}"
LOCAL_DIR="${2:-}"
if [[ -z "$VERSION" ]]; then
  echo "error: cannot determine VERSION (pass as arg 1 or ensure apps/desktop/package.json is readable)" >&2
  exit 1
fi

REPO="OpenCoworkAI/open-codesign"
REL_URL_BASE="https://github.com/${REPO}/releases/download/v${VERSION}"

# Derive productName from electron-builder.yml. Everything downstream
# (mac .app bundle, Windows .exe after install) is named after this.
PRODUCT_NAME="$(awk -F': *' '/^productName:/ {sub(/^[ \t]+|[ \t]+$/, "", $2); print $2; exit}' apps/desktop/electron-builder.yml)"
if [[ -z "$PRODUCT_NAME" ]]; then
  echo "error: could not parse productName from apps/desktop/electron-builder.yml" >&2
  exit 1
fi
APP_BUNDLE="${PRODUCT_NAME}.app"
WIN_EXE_NAME="${PRODUCT_NAME}.exe"

# Actual artifact filenames (from electron-builder.yml `artifactName` fields).
MAC_ARM64_DMG="open-codesign-${VERSION}-arm64.dmg"
MAC_X64_DMG="open-codesign-${VERSION}-x64.dmg"
WIN_X64_EXE="open-codesign-${VERSION}-x64-setup.exe"
WIN_ARM64_EXE="open-codesign-${VERSION}-arm64-setup.exe"
LINUX_APPIMAGE="open-codesign-${VERSION}-x64.AppImage"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

echo "Version : v${VERSION}"
echo "Product : ${PRODUCT_NAME}"
echo ""

# ---------------------------------------------------------------
# 1. Pull checksums. Prefer the signed SHA256SUMS.txt asset (fast,
#    one GET, already computed on the release runner); fall back to
#    re-hashing the artifacts if it's missing.
# ---------------------------------------------------------------
sums_file="$tmpdir/SHA256SUMS.txt"
if [[ -n "$LOCAL_DIR" && -f "$LOCAL_DIR/SHA256SUMS.txt" ]]; then
  cp "$LOCAL_DIR/SHA256SUMS.txt" "$sums_file"
else
  url="${REL_URL_BASE}/SHA256SUMS.txt"
  echo "Fetching ${url}"
  if ! curl -fsSL -o "$sums_file" "$url"; then
    echo "  SHA256SUMS.txt not published — rehashing installers instead" >&2
    : > "$sums_file"
    for f in "$MAC_ARM64_DMG" "$MAC_X64_DMG" "$WIN_X64_EXE" "$WIN_ARM64_EXE" "$LINUX_APPIMAGE"; do
      out="$tmpdir/$f"
      if [[ -n "$LOCAL_DIR" && -f "$LOCAL_DIR/$f" ]]; then
        cp "$LOCAL_DIR/$f" "$out"
      else
        echo "  downloading $f"
        curl -fsSL -o "$out" "${REL_URL_BASE}/$f"
      fi
      printf '%s  %s\n' "$(shasum -a 256 "$out" | awk '{print $1}')" "$f" >> "$sums_file"
    done
  fi
fi

lookup_sha() {
  local name="$1"
  local sha
  sha="$(awk -v n="$name" '$2 == n || $2 == "*"n {print $1; exit}' "$sums_file")"
  if [[ -z "$sha" ]]; then
    echo "error: no SHA256 for $name in release checksums" >&2
    return 1
  fi
  echo "$sha"
}

mac_arm_sha="$(lookup_sha "$MAC_ARM64_DMG")"
mac_x64_sha="$(lookup_sha "$MAC_X64_DMG")"
win_x64_sha="$(lookup_sha "$WIN_X64_EXE")"
win_arm_sha="$(lookup_sha "$WIN_ARM64_EXE")"
linux_sha="$(lookup_sha "$LINUX_APPIMAGE")"

echo "  mac arm64      : $mac_arm_sha"
echo "  mac x64        : $mac_x64_sha"
echo "  win x64        : $win_x64_sha"
echo "  win arm64      : $win_arm_sha"
echo "  linux AppImage : $linux_sha"
echo ""

# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------
# Portable in-place perl sed. \Q…\E disables regex metachars in $2.
replace() {
  local file="$1" pattern="$2" value="$3"
  perl -pi -e "s/\\Q${pattern}\\E/${value}/g" "$file"
}

# Replace whatever SHA currently follows a marker on the same line. Used for
# idempotent re-runs (after the first fill, placeholders are gone, so we match
# the 64-hex digest instead).
replace_sha_after() {
  local file="$1" prefix_regex="$2" new_sha="$3"
  perl -pi -e "s{(${prefix_regex})(REPLACE_WITH_[A-Z0-9_]+|[a-f0-9]{64})}{\${1}${new_sha}}g" "$file"
}

# ---------------------------------------------------------------
# 2. Homebrew cask
# ---------------------------------------------------------------
echo "Homebrew cask…"
cask="packaging/homebrew/Casks/open-codesign.rb"
perl -pi -e "s/^(\\s*version\\s+)\"[^\"]+\"/\${1}\"${VERSION}\"/" "$cask"
# The cask has two sha256 lines, one inside on_arm, one inside on_intel.
# Rewriting both by matching the line after the arch-specific `url`.
perl -0777 -pi -e "s/(on_arm do[\\s\\S]*?sha256\\s+)\"[^\"]+\"/\${1}\"${mac_arm_sha}\"/s" "$cask"
perl -0777 -pi -e "s/(on_intel do[\\s\\S]*?sha256\\s+)\"[^\"]+\"/\${1}\"${mac_x64_sha}\"/s" "$cask"
# Keep the installed .app bundle aligned with productName.
perl -pi -e "s{^(\\s*app\\s+)\"[^\"]+\\.app\"}{\${1}\"${APP_BUNDLE}\"}" "$cask"
# And the xattr caveat path.
perl -pi -e "s{/Applications/[^\\s\"]+\\.app}{/Applications/${APP_BUNDLE}}g" "$cask"

# ---------------------------------------------------------------
# 3. Scoop
# ---------------------------------------------------------------
echo "Scoop manifest…"
scoop="packaging/scoop/bucket/open-codesign.json"
perl -pi -e "s/\"version\":\\s*\"[^\"]+\"/\"version\": \"${VERSION}\"/" "$scoop"
perl -pi -e "s{/v[0-9][0-9A-Za-z.\\-]*/open-codesign-[0-9][0-9A-Za-z.\\-]*-x64-setup\\.exe}{/v${VERSION}/open-codesign-${VERSION}-x64-setup.exe}g" "$scoop"
perl -pi -e "s{/v[0-9][0-9A-Za-z.\\-]*/open-codesign-[0-9][0-9A-Za-z.\\-]*-arm64-setup\\.exe}{/v${VERSION}/open-codesign-${VERSION}-arm64-setup.exe}g" "$scoop"
replace_sha_after "$scoop" '"hash":\s*"' "$win_x64_sha"   # first architecture block (64bit)
# Now patch the arm64 hash by matching it in the arm64 block specifically.
perl -0777 -pi -e "s/(\"arm64\"\\s*:\\s*\\{[^}]*?\"hash\"\\s*:\\s*\")(REPLACE_WITH_[A-Z0-9_]+|[a-f0-9]{64})/\${1}${win_arm_sha}/s" "$scoop"
# The 64bit block needed the SAME targeted fix (the loose replace_sha_after
# above hit the first "hash" which is 64bit — that's correct — but if someone
# reorders keys it'd break). Redo it explicitly for safety.
perl -0777 -pi -e "s/(\"64bit\"\\s*:\\s*\\{[^}]*?\"hash\"\\s*:\\s*\")(REPLACE_WITH_[A-Z0-9_]+|[a-f0-9]{64})/\${1}${win_x64_sha}/s" "$scoop"
# Align the bin name with productName-derived exe name.
perl -pi -e "s{\"bin\":\\s*\"[^\"]+\"}{\"bin\": \"${WIN_EXE_NAME}\"}" "$scoop"
# First element of the shortcuts array points at the exe; second is the menu label.
perl -0777 -pi -e "s{(\"shortcuts\"\\s*:\\s*\\[\\s*\\[\\s*\")[^\"]+(\"\\s*,)}{\${1}${WIN_EXE_NAME}\${2}}s" "$scoop"

# ---------------------------------------------------------------
# 4. winget — auto-copy previous version directory if needed
# ---------------------------------------------------------------
echo "winget manifests…"
winget_root="packaging/winget/manifests/o/OpenCoworkAI/OpenCoDesign"
winget_dir="${winget_root}/${VERSION}"
if [[ ! -d "$winget_dir" ]]; then
  prev="$(ls "$winget_root" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1 || true)"
  if [[ -n "$prev" ]]; then
    echo "  creating $winget_dir from $prev"
    cp -R "${winget_root}/${prev}" "$winget_dir"
  else
    echo "  warning: no previous winget version directory to copy from — skipping"
  fi
fi

if [[ -d "$winget_dir" ]]; then
  for f in "$winget_dir"/*.yaml; do
    perl -pi -e "s/^PackageVersion:.*/PackageVersion: ${VERSION}/" "$f"
  done
  installer="$winget_dir/OpenCoworkAI.OpenCoDesign.installer.yaml"
  # Rewrite the entire Installers block to the current (per-arch) shape.
  # electron-builder now emits separate x64 and arm64 NSIS installers.
  python3 - "$installer" "$VERSION" "$win_x64_sha" "$win_arm_sha" <<'PY'
import re, sys
path, version, x64, arm64 = sys.argv[1:]
src = open(path).read()
new_block = (
    "Installers:\n"
    f"  - Architecture: x64\n"
    f"    InstallerUrl: https://github.com/OpenCoworkAI/open-codesign/releases/download/v{version}/open-codesign-{version}-x64-setup.exe\n"
    f"    InstallerSha256: {x64.upper()}\n"
    f"  - Architecture: arm64\n"
    f"    InstallerUrl: https://github.com/OpenCoworkAI/open-codesign/releases/download/v{version}/open-codesign-{version}-arm64-setup.exe\n"
    f"    InstallerSha256: {arm64.upper()}\n"
)
out = re.sub(r"Installers:\n(?:(?:  -|    ).*\n)+", new_block, src, count=1)
open(path, "w").write(out)
PY
  locale="$winget_dir/OpenCoworkAI.OpenCoDesign.locale.en-US.yaml"
  [[ -f "$locale" ]] && perl -pi -e "s{releases/tag/v[0-9][0-9A-Za-z.\\-]*}{releases/tag/v${VERSION}}g" "$locale"
fi

# ---------------------------------------------------------------
# 5. Flatpak (manual Flathub PR; we just keep the template fresh)
# ---------------------------------------------------------------
echo "Flatpak manifest…"
flatpak="packaging/flatpak/ai.opencowork.codesign.yaml"
if [[ -f "$flatpak" ]]; then
  perl -pi -e "s{releases/download/v[0-9][0-9A-Za-z.\\-]*/open-codesign-[0-9][0-9A-Za-z.\\-]*-x64\\.AppImage}{releases/download/v${VERSION}/open-codesign-${VERSION}-x64.AppImage}g" "$flatpak"
  perl -pi -e "s/(sha256:\\s+)(REPLACE_WITH_[A-Z0-9_]+|[a-f0-9]{64})/\${1}${linux_sha}/g" "$flatpak"
  # Size: HEAD the release asset for Content-Length.
  size="$(curl -fsSLI "${REL_URL_BASE}/${LINUX_APPIMAGE}" | awk 'tolower($1)=="content-length:" {gsub("\r",""); print $2}' | tail -1 || true)"
  if [[ -n "${size:-}" ]]; then
    perl -pi -e "s/^(\\s+size:).*/\${1} ${size}/" "$flatpak"
  fi
fi

echo ""
echo "Done. Review with:  git diff packaging/"
