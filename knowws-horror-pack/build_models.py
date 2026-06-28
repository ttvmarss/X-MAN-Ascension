#!/usr/bin/env python3
"""3D gun geometries for first-person attachables."""
import json
from pathlib import Path

ROOT = Path(__file__).parent
RP = ROOT / "KNOWWS_Horror_RP"


def gun_geo(identifier, cubes):
    return {
        "description": {
            "identifier": identifier,
            "texture_width": 16,
            "texture_height": 16,
            "visible_bounds_width": 2,
            "visible_bounds_height": 2,
            "visible_bounds_offset": [0, 0, 0],
        },
        "bones": [
            {
                "name": "gun",
                "pivot": [0, 0, 0],
                "binding": "q.item_slot_to_bone_name(c.item_slot)",
                "cubes": cubes,
            }
        ],
    }


def main():
    geos = [
        gun_geo("geometry.knws.pistol", [
            {"origin": [-1, -1, -6], "size": [2, 2, 8], "uv": [0, 0]},
            {"origin": [-1, -2, 2], "size": [2, 3, 3], "uv": [0, 4]},
        ]),
        gun_geo("geometry.knws.rifle", [
            {"origin": [-1, -1, -10], "size": [2, 2, 14], "uv": [0, 0]},
            {"origin": [-1, -2, 4], "size": [2, 3, 4], "uv": [0, 4]},
            {"origin": [-1, 0, -12], "size": [2, 1, 2], "uv": [4, 0]},
        ]),
        gun_geo("geometry.knws.shotgun", [
            {"origin": [-1, -1, -8], "size": [2, 2, 12], "uv": [0, 0]},
            {"origin": [-1.5, -1.5, -10], "size": [3, 3, 2], "uv": [0, 6]},
            {"origin": [-1, -2, 4], "size": [2, 3, 3], "uv": [0, 4]},
        ]),
        gun_geo("geometry.knws.smg", [
            {"origin": [-1, -1, -6], "size": [2, 2, 10], "uv": [0, 0]},
            {"origin": [-1, -3, 0], "size": [2, 2, 4], "uv": [0, 4]},
        ]),
        gun_geo("geometry.knws.sniper", [
            {"origin": [-1, -1, -14], "size": [2, 2, 18], "uv": [0, 0]},
            {"origin": [-1, 0, -16], "size": [2, 1, 2], "uv": [4, 0]},
            {"origin": [-1, -2, 4], "size": [2, 3, 4], "uv": [0, 4]},
        ]),
        gun_geo("geometry.knws.minigun", [
            {"origin": [-2, -2, -4], "size": [4, 4, 8], "uv": [0, 0]},
            {"origin": [-1, -1, -8], "size": [2, 2, 4], "uv": [0, 6]},
        ]),
        gun_geo("geometry.knws.rpg", [
            {"origin": [-2, -2, -10], "size": [4, 4, 14], "uv": [0, 0]},
            {"origin": [-2, -2, 4], "size": [4, 4, 4], "uv": [0, 8]},
        ]),
        gun_geo("geometry.knws.flamethrower", [
            {"origin": [-2, -2, -6], "size": [4, 4, 10], "uv": [0, 0]},
            {"origin": [-1, -1, 4], "size": [2, 2, 3], "uv": [0, 6]},
        ]),
    ]

    write_json(RP / "models" / "entity" / "guns.geo.json", {
        "format_version": "1.12.0",
        "minecraft:geometry": geos,
    })
    print("Gun models generated.")


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


if __name__ == "__main__":
    main()
