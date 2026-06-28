#!/bin/bash
# Package KNOWWS Horror Pack as .mcaddon for easy import
set -e
cd "$(dirname "$0")"

echo "Building textures & models..."
python3 build_art.py
python3 build_verity.py
python3 build_models.py

echo "Generating definitions..."
python3 generate_definitions.py

echo "Creating .mcaddon..."
rm -f KNOWWS_Horror_Pack.mcaddon
zip -r KNOWWS_Horror_Pack.mcaddon KNOWWS_Horror_BP KNOWWS_Horror_RP -x "*.DS_Store"

# Copy to web-accessible locations
cp KNOWWS_Horror_Pack.mcaddon ../KNOWWS_Horror_Pack.mcaddon 2>/dev/null || true
cp download.html ../download-knowws-pack.html 2>/dev/null || true
cp verity-voice.html ../verity-voice.html 2>/dev/null || true

echo ""
echo "============================================"
echo "  DOWNLOAD READY!"
echo "  Open: knowws-horror-pack/download.html"
echo "  Or drag: knowws-horror-pack/KNOWWS_Horror_Pack.mcaddon"
echo "============================================"
