# 🎮 Professional Bedrock Modding Toolkit

**Complete setup for building production-quality Minecraft Bedrock mods**

---

## 🛠️ INSTALLED TOOLS

### Core Development Tools
- **Node.js v22.22.2** - JavaScript runtime for automation
- **TypeScript** - Type-safe scripting
- **Webpack** - Module bundling and optimization
- **Bridge.** - Professional addon IDE (coming soon)
- **Blockbench** - 3D model editor for custom entities

### Asset Processing
- **ImageMagick** - Professional texture manipulation
- **GraphicsMagick** - Batch image processing
- **FFmpeg** - Audio/video codec support
- **PIL/Pillow** - Python image processing
- **NumPy** - Advanced array operations
- **OpenCV** - Computer vision and texture generation
- **PSD Tools** - Photoshop file support
- **ImageIO** - Multi-format image I/O

---

## 📁 DIRECTORY STRUCTURE

```
~/bedrock-modding-tools/
├── node_modules/          # Installed packages
├── bedrock-docs/          # Documentation & schemas
└── [your-projects]/       # Your mod projects here
```

---

## 🚀 QUICK START: CREATE A NEW MOD

### 1. Create Project Structure
```bash
mkdir ~/my-minecraft-mod
cd ~/my-minecraft-mod
npm init -y
```

### 2. Install Bedrock Dependencies
```bash
npm install --save-dev @minecraft/server @minecraft/server-ui @minecraft/server-gametest
```

### 3. Create Addon Folders
```bash
mkdir -p behavior_pack/scripts
mkdir -p resource_pack/textures/items
mkdir -p resource_pack/textures/blocks
mkdir -p resource_pack/textures/entity
```

---

## 🎨 TEXTURE GENERATION

### Using Python + Pillow (Recommended)
```python
from PIL import Image, ImageDraw

def create_custom_texture(name, color_rgb):
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Add your custom drawing code here
    img.save(f'textures/items/{name}.png')
```

### Using ImageMagick Batch Processing
```bash
# Create multiple textures at once
convert -size 32x32 xc:red texture_red.png
convert -size 32x32 xc:blue texture_blue.png

# Apply effects
convert texture.png -modulate 110,100,100 -sharpen 0x1 texture_enhanced.png
```

### Using OpenCV (Advanced)
```python
import cv2
import numpy as np

# Create procedurally generated textures
texture = np.random.randint(0, 256, (32, 32, 3), dtype=np.uint8)
cv2.imwrite('procedural_texture.png', texture)
```

---

## 🧩 3D MODEL CREATION

### Using Blockbench
1. Download from: https://blockbench.net
2. Create or import models
3. Export as:
   - **Bedrock Entity** (.geo.json)
   - **Bedrock Block** (.json)
   - **OBJ** (for other tools)

### Blockbench Model Format
```json
{
  "format_version": "1.12.0",
  "minecraft:geometry": [
    {
      "description": {
        "identifier": "geometry.xman:custom_entity",
        "texture_width": 64,
        "texture_height": 64,
        "visible_bounds_width": 4,
        "visible_bounds_height": 4.5,
        "visible_bounds_offset": [0, 0.75, 0]
      },
      "bones": [
        {
          "name": "body",
          "pivot": [0, 0, 0],
          "cubes": [
            {
              "origin": [-2, 0, -2],
              "size": [4, 4, 4],
              "uv": [0, 0]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 📝 ADVANCED SCRIPTING

### TypeScript Setup
Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020"],
    "outDir": "./behavior_pack/scripts",
    "rootDir": "./src",
    "strict": true
  }
}
```

Compile TypeScript:
```bash
npx tsc
```

### Example TypeScript Script
```typescript
import { world, system } from "@minecraft/server";

world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player;
  player.sendMessage("Welcome to my custom mod!");
});

system.runInterval(() => {
  // Your game logic here
  console.log("Tick!");
}, 1);
```

---

## 📦 BUNDLING WITH WEBPACK

### webpack.config.js
```javascript
const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/main.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'behavior_pack/scripts'),
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
};
```

Build:
```bash
npx webpack
```

---

## 🎭 ENTITY & ANIMATION SETUP

### Entity Definition (JSON)
```json
{
  "format_version": "1.12.0",
  "minecraft:entity": {
    "description": {
      "identifier": "xman:custom_mob",
      "is_spawnable": true,
      "is_summonable": true,
      "is_rideable": false,
      "spawn_egg": {
        "base_color": "#FF0000",
        "overlay_color": "#FFFF00"
      }
    },
    "components": {
      "minecraft:health": {
        "value": 20
      },
      "minecraft:movement": {
        "value": 0.2
      },
      "minecraft:physics": {},
      "minecraft:collision_box": {
        "width": 1.0,
        "height": 1.5
      }
    },
    "component_groups": {
      "hostile": {
        "minecraft:combat": {
          "knockback_chance": 0.3,
          "damage": 5
        }
      }
    }
  }
}
```

---

## 🧪 TESTING YOUR MOD

### Using Bedrock Dedicated Server
```bash
# Set up test world
mkdir test-world
cd test-world
# Copy your addon here
```

### Live Testing with Minecraft
1. Copy addon to: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Minecraft Launcher\com.mojang\`
2. Create new world with addon enabled
3. Use logs: `/log -f behavior_pack/` to debug

---

## 📤 DISTRIBUTION

### Package as .mcaddon
```bash
cd your-addon
zip -r ../your-addon.mcaddon behavior_pack/ resource_pack/ manifest.json
```

### Upload to CurseForge
1. Sign up at https://curseforge.com
2. Create project
3. Upload .mcaddon files
4. Set version, description, changelog
5. Publish!

---

## 🔧 USEFUL COMMANDS

```bash
# Create procedural textures
convert -size 32x32 plasma: random_texture.png

# Batch resize all textures
mogrify -resize 32x32 textures/items/*.png

# Check texture dimensions
identify textures/items/*.png

# Compress addon
zip -9 -r addon.mcaddon behavior_pack resource_pack

# Generate from template
npm create @minecraft/addon -- my-mod
```

---

## 📚 RESOURCES

- **Official Docs**: https://learn.microsoft.com/en-us/minecraft/creator/
- **Bedrock Schema**: `/bedrock-docs/schema/`
- **Blockbench**: https://blockbench.net
- **CurseForge Creator**: https://curseforge.com

---

## ✅ YOU'RE READY!

All professional tools installed and configured. Start building! 🚀
