#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
APP_NAME="AURA"
BUILD_DIR="$SCRIPT_DIR/.build"
DERIVED_DATA_DIR="$BUILD_DIR/XcodeDerivedData"
OUTPUT_DIR="$SCRIPT_DIR/dist"
APP_DIR="$OUTPUT_DIR/$APP_NAME.app"
BUILT_APP_DIR="$DERIVED_DATA_DIR/Build/Products/Release/$APP_NAME.app"

export CLANG_MODULE_CACHE_PATH="$BUILD_DIR/ModuleCache"

xcodebuild \
    -project "$SCRIPT_DIR/MissionInvoicePopup.xcodeproj" \
    -scheme MissionInvoicePopup \
    -configuration Release \
    -derivedDataPath "$DERIVED_DATA_DIR" \
    build

rm -rf "$APP_DIR"
mkdir -p "$OUTPUT_DIR"
ditto "$BUILT_APP_DIR" "$APP_DIR"
ditto -c -k --sequesterRsrc --keepParent "$APP_DIR" "$OUTPUT_DIR/AURA-macOS.zip"

echo "$APP_DIR"
