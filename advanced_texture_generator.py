#!/usr/bin/env python3
"""
Advanced Professional Minecraft Bedrock Texture Generator
Uses NumPy, OpenCV, and Pillow for high-quality texture creation
"""

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import random
import os
from pathlib import Path

class BedrockTextureGenerator:
    """Professional texture generation for Bedrock Edition"""

    def __init__(self, output_dir="textures"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True, parents=True)

    def create_metallic_texture(self, name, base_color, roughness=0.3):
        """Create realistic metallic texture"""
        size = 32
        img = np.zeros((size, size, 3), dtype=np.uint8)

        # Base color
        img[:, :] = base_color

        # Add metallic noise
        noise = np.random.randint(0, 30, (size, size, 3), dtype=np.uint8)
        img = cv2.addWeighted(img, 1 - roughness, noise, roughness, 0)

        # Add highlights
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        highlights = cv2.morphologyEx(img, cv2.MORPH_CLOSE, kernel)
        img = cv2.addWeighted(img, 0.8, highlights, 0.2, 0)

        # Convert to RGBA
        img_bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        img_rgba = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2BGRA)

        # Save
        output_path = self.output_dir / f"{name}.png"
        cv2.imwrite(str(output_path), img_rgba)
        print(f"✓ Created {name}.png (metallic)")

    def create_wood_texture(self, name, color_rgb):
        """Create realistic wood grain texture"""
        size = 32
        img = Image.new('RGBA', (size, size), (*color_rgb, 255))
        draw = ImageDraw.Draw(img)

        # Wood grain lines
        random.seed(hash(name))
        for _ in range(8):
            x1 = random.randint(0, size)
            y1 = 0
            x2 = random.randint(0, size)
            y2 = size
            grain_color = tuple(max(0, c - random.randint(10, 30)) for c in color_rgb)
            draw.line([(x1, y1), (x2, y2)], fill=(*grain_color, 255), width=1)

        # Add texture
        img = img.filter(ImageFilter.GaussianBlur(radius=0.5))

        # Save
        output_path = self.output_dir / f"{name}.png"
        img.save(output_path)
        print(f"✓ Created {name}.png (wood grain)")

    def create_ore_texture(self, name, base_color, vein_color):
        """Create ore block with procedural veining"""
        size = 32
        img = np.zeros((size, size, 3), dtype=np.uint8)
        img[:, :] = base_color

        # Perlin-like noise for veins
        x = np.linspace(0, 4, size)
        y = np.linspace(0, 4, size)
        X, Y = np.meshgrid(x, y)

        noise = np.sin(X) * np.cos(Y) * 255
        noise = ((noise + 255) / 2).astype(np.uint8)

        # Apply vein color where noise is high
        mask = noise > 180
        for i in range(3):
            img[mask, i] = vein_color[i]

        # Convert to RGBA and save
        img_bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        img_rgba = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2BGRA)

        output_path = self.output_dir / f"{name}.png"
        cv2.imwrite(str(output_path), img_rgba)
        print(f"✓ Created {name}.png (ore with veins)")

    def create_crystal_texture(self, name, color_rgb):
        """Create glowing crystal/gem texture"""
        size = 32
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Crystal shape
        center = size // 2
        points = [
            (center, 2),           # Top point
            (size - 4, center),    # Right point
            (center, size - 2),    # Bottom point
            (4, center)            # Left point
        ]

        # Main crystal
        draw.polygon(points, fill=(*color_rgb, 255))

        # Inner glow
        inner_radius = size // 4
        inner_color = tuple(min(255, c + 80) for c in color_rgb)
        draw.ellipse(
            [(center - inner_radius, center - inner_radius),
             (center + inner_radius, center + inner_radius)],
            fill=(*inner_color, 200)
        )

        # Highlight
        highlight_color = (255, 255, 255, 150)
        draw.ellipse(
            [(center - 3, center - 3), (center + 2, center + 2)],
            fill=highlight_color
        )

        # Glow effect
        img = img.filter(ImageFilter.GaussianBlur(radius=1.5))

        output_path = self.output_dir / f"{name}.png"
        img.save(output_path)
        print(f"✓ Created {name}.png (crystal)")

    def create_animated_texture_sheet(self, name, frame_color, num_frames=4):
        """Create texture sheet for animated items/blocks"""
        frame_size = 32
        width = frame_size * num_frames
        height = frame_size

        img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        for frame in range(num_frames):
            x_offset = frame * frame_size
            # Animated rotation effect
            rotation = (frame / num_frames) * 360

            # Draw frame
            bbox = [x_offset + 4, 4, x_offset + 28, 28]
            draw.rectangle(bbox, fill=(*frame_color, int(255 * (0.5 + 0.5 * frame / num_frames))))

        output_path = self.output_dir / f"{name}_animated.png"
        img.save(output_path)
        print(f"✓ Created {name}_animated.png ({num_frames} frames)")

    def generate_all(self):
        """Generate complete texture set"""
        print("\n🎨 GENERATING PROFESSIONAL TEXTURES...\n")

        # Metallic textures (for tools/weapons)
        print("⚔️  Creating weapon textures...")
        self.create_metallic_texture("sword_metal", (180, 180, 180), roughness=0.2)
        self.create_metallic_texture("gun_steel", (100, 100, 100), roughness=0.15)
        self.create_metallic_texture("armor_plate", (150, 150, 170), roughness=0.25)

        # Ore textures
        print("\n⛏️  Creating ore textures...")
        self.create_ore_texture("shadow_ore", (40, 30, 60), (80, 70, 120))
        self.create_ore_texture("bloodstone_ore", (150, 40, 40), (200, 80, 80))
        self.create_ore_texture("titanium_ore", (180, 180, 200), (220, 220, 240))

        # Crystal textures
        print("\n💎 Creating crystal textures...")
        self.create_crystal_texture("power_stone", (200, 50, 200))
        self.create_crystal_texture("space_stone", (100, 150, 255))
        self.create_crystal_texture("reality_stone", (255, 100, 100))
        self.create_crystal_texture("mind_stone", (150, 100, 255))

        # Wood textures
        print("\n🌳 Creating wood textures...")
        self.create_wood_texture("wooden_handle", (150, 100, 50))
        self.create_wood_texture("wooden_staff", (130, 90, 40))

        # Animated textures
        print("\n✨ Creating animated textures...")
        self.create_animated_texture_sheet("magic_particle", (255, 200, 100), num_frames=4)
        self.create_animated_texture_sheet("energy_effect", (100, 200, 255), num_frames=4)

        print("\n✅ ALL TEXTURES GENERATED!\n")

def main():
    """Main execution"""
    generator = BedrockTextureGenerator(output_dir="/home/user/X-MAN-Ascension/X-Man-Ascension-Mods/resource_pack/textures/generated")
    generator.generate_all()
    print("📁 All textures saved to: /home/user/X-MAN-Ascension/X-Man-Ascension-Mods/resource_pack/textures/generated/")

if __name__ == "__main__":
    main()
