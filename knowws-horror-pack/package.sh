#!/bin/bash
# Package KNOWWS Horror Pack as .mcaddon for easy import
set -e
cd "$(dirname "$0")"

echo "Building textures..."
python3 build_pack.py

echo "Generating definitions..."
python3 generate_definitions.py

echo "Creating .mcaddon..."
rm -f KNOWWS_Horror_Pack.mcaddon
zip -r KNOWWS_Horror_Pack.mcaddon KNOWWS_Horror_BP KNOWWS_Horror_RP -x "*.DS_Store"

echo "Done! Import KNOWWS_Horror_Pack.mcaddon into Minecraft Bedrock."
