import os
import math
from PIL import Image, ImageDraw, ImageFont

PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "..", "web", "public")
os.makedirs(PUBLIC_DIR, exist_ok=True)

# 1. Generate favicon.svg
svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Background Radial Gradient -->
    <radialGradient id="bgGrad" cx="50%" cy="38%" r="65%">
      <stop offset="0%" stop-color="#1A2A4A"/>
      <stop offset="60%" stop-color="#0B132B"/>
      <stop offset="100%" stop-color="#040814"/>
    </radialGradient>

    <!-- Gold Metallic Gradient -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFEAA7"/>
      <stop offset="25%" stop-color="#D4AF37"/>
      <stop offset="50%" stop-color="#FFF2B2"/>
      <stop offset="75%" stop-color="#AA771C"/>
      <stop offset="100%" stop-color="#5E3F0A"/>
    </linearGradient>

    <!-- Cyber Shield Gradient -->
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1E3A8A"/>
      <stop offset="50%" stop-color="#0F2042"/>
      <stop offset="100%" stop-color="#070E1E"/>
    </linearGradient>

    <!-- Tricolor Saffron Gradient -->
    <linearGradient id="saffronGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FF6B00"/>
      <stop offset="100%" stop-color="#FFA834"/>
    </linearGradient>

    <!-- Tricolor Green Gradient -->
    <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#057A55"/>
      <stop offset="100%" stop-color="#31C48D"/>
    </linearGradient>

    <!-- Glow Filter -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Base Circular Container -->
  <rect width="512" height="512" rx="128" fill="url(#bgGrad)"/>

  <!-- Outer Security Gold Border -->
  <rect x="16" y="16" width="480" height="480" rx="112" fill="none" stroke="url(#goldGrad)" stroke-width="8" opacity="0.85"/>
  <rect x="28" y="28" width="456" height="456" rx="100" fill="none" stroke="#D4AF37" stroke-width="2" stroke-dasharray="8 8" opacity="0.4"/>

  <!-- Central Shield -->
  <path d="M 256 68 L 388 120 C 388 280 256 420 256 420 C 256 420 124 280 124 120 Z"
        fill="url(#shieldGrad)" stroke="url(#goldGrad)" stroke-width="10" stroke-linejoin="round" filter="url(#glow)"/>

  <!-- Inner Shield Accent Lines -->
  <path d="M 256 86 L 368 132 C 368 266 256 390 256 390 C 256 390 144 266 144 132 Z"
        fill="none" stroke="#60A5FA" stroke-width="2" opacity="0.3"/>

  <!-- Top Tricolor Band: Saffron -->
  <path d="M 180 140 L 332 140 L 320 162 L 192 162 Z" fill="url(#saffronGrad)"/>

  <!-- Bottom Tricolor Band: India Green -->
  <path d="M 216 348 L 296 348 L 256 384 Z" fill="url(#greenGrad)"/>

  <!-- Ashoka Chakra / Radar Surveillance Eye (Center: 256, 238) -->
  <circle cx="256" cy="238" r="76" fill="#0A1628" stroke="url(#goldGrad)" stroke-width="6"/>
  <circle cx="256" cy="238" r="66" fill="none" stroke="#38BDF8" stroke-width="2" stroke-dasharray="4 4" opacity="0.7"/>

  <!-- 24 Chakra Spokes -->
  <g stroke="#60A5FA" stroke-width="2.5" opacity="0.85">
    <line x1="256" y1="168" x2="256" y2="308"/>
    <line x1="186" y1="238" x2="326" y2="238"/>
    <line x1="206.5" y1="188.5" x2="305.5" y2="287.5"/>
    <line x1="206.5" y1="287.5" x2="305.5" y2="188.5"/>
    <line x1="229.2" y1="173" x2="282.8" y2="303"/>
    <line x1="282.8" y1="173" x2="229.2" y2="303"/>
    <line x1="191" y1="211.2" x2="321" y2="264.8"/>
    <line x1="191" y1="264.8" x2="321" y2="211.2"/>
    <line x1="243" y1="170" x2="269" y2="306"/>
    <line x1="269" y1="170" x2="243" y2="306"/>
    <line x1="188" y1="225" x2="324" y2="251"/>
    <line x1="188" y1="251" x2="324" y2="225"/>
  </g>

  <!-- Central Surveillance Iris / Core -->
  <circle cx="256" cy="238" r="22" fill="#0F172A" stroke="url(#goldGrad)" stroke-width="4"/>
  <circle cx="256" cy="238" r="10" fill="#38BDF8"/>
  <circle cx="256" cy="238" r="4" fill="#FFFFFF"/>

  <!-- Star of Vigilance on top of shield -->
  <polygon points="256,82 262,96 276,96 264,105 268,119 256,110 244,119 248,105 236,96 250,96" fill="url(#goldGrad)"/>
</svg>'''

svg_path = os.path.join(PUBLIC_DIR, "favicon.svg")
with open(svg_path, "w", encoding="utf-8") as f:
    f.write(svg_content)
print(f"Written: {svg_path}")


# 2. Render PNG / ICO using Pillow with high visual fidelity
def draw_satark_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    scale = size / 512.0

    # Background rounded rect
    corner = int(128 * scale)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=corner, fill=(11, 19, 43, 255), outline=(212, 175, 55, 255), width=max(1, int(10 * scale)))

    # Inner gold border
    draw.rounded_rectangle([int(20 * scale), int(20 * scale), size - 1 - int(20 * scale), size - 1 - int(20 * scale)],
                           radius=int(100 * scale), outline=(170, 119, 28, 120), width=max(1, int(3 * scale)))

    # Central shield polygon
    cx, cy = size / 2, size * 0.46
    shield_pts = [
        (256 * scale, 76 * scale),
        (380 * scale, 124 * scale),
        (376 * scale, 260 * scale),
        (256 * scale, 408 * scale),
        (136 * scale, 260 * scale),
        (132 * scale, 124 * scale),
    ]
    draw.polygon(shield_pts, fill=(15, 32, 66, 255), outline=(212, 175, 55, 255))

    # Tricolor top bar (Saffron)
    saff_pts = [
        (180 * scale, 140 * scale),
        (332 * scale, 140 * scale),
        (320 * scale, 162 * scale),
        (192 * scale, 162 * scale),
    ]
    draw.polygon(saff_pts, fill=(255, 107, 0, 255))

    # Tricolor bottom (Green)
    grn_pts = [
        (216 * scale, 348 * scale),
        (296 * scale, 348 * scale),
        (256 * scale, 384 * scale),
    ]
    draw.polygon(grn_pts, fill=(5, 122, 85, 255))

    # Outer Chakra Ring
    r_out = 72 * scale
    draw.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], fill=(10, 22, 40, 255), outline=(212, 175, 55, 255), width=max(1, int(6 * scale)))

    # Spokes (12 lines = 24 spokes)
    spoke_r = 62 * scale
    for i in range(12):
        angle = i * (math.pi / 12)
        x1 = cx + spoke_r * math.cos(angle)
        y1 = cy + spoke_r * math.sin(angle)
        x2 = cx - spoke_r * math.cos(angle)
        y2 = cy - spoke_r * math.sin(angle)
        draw.line([x1, y1, x2, y2], fill=(96, 165, 250, 220), width=max(1, int(2.5 * scale)))

    # Central pupil / eye of vigilance
    r_core = 20 * scale
    draw.ellipse([cx - r_core, cy - r_core, cx + r_core, cy + r_core], fill=(15, 23, 42, 255), outline=(212, 175, 55, 255), width=max(1, int(3 * scale)))
    r_iris = 9 * scale
    draw.ellipse([cx - r_iris, cy - r_iris, cx + r_iris, cy + r_iris], fill=(56, 189, 248, 255))
    r_dot = 3 * scale
    draw.ellipse([cx - r_dot, cy - r_dot, cx + r_dot, cy + r_dot], fill=(255, 255, 255, 255))

    return img

# Save Apple Touch Icon (180x180)
icon_180 = draw_satark_icon(180)
apple_icon_path = os.path.join(PUBLIC_DIR, "apple-touch-icon.png")
icon_180.save(apple_icon_path, format="PNG")
print(f"Written: {apple_icon_path}")

# Save Multi-resolution favicon.ico (16, 32, 48, 64)
sizes = [16, 32, 48, 64]
ico_images = [draw_satark_icon(s) for s in sizes]
ico_path = os.path.join(PUBLIC_DIR, "favicon.ico")
ico_images[0].save(ico_path, format="ICO", sizes=[(s, s) for s in sizes], append_images=ico_images[1:])
print(f"Written: {ico_path}")

# 3. Generate 1200x630 OpenGraph Banner image for social link sharing previews
og_img = Image.new("RGBA", (1200, 630), (10, 15, 28, 255))
og_draw = ImageDraw.Draw(og_img)

# Background border
og_draw.rectangle([0, 0, 1199, 629], outline=(212, 175, 55, 160), width=4)
og_draw.rectangle([12, 12, 1187, 617], outline=(30, 58, 138, 100), width=2)

# Paste large emblem on left
emblem_320 = draw_satark_icon(320)
og_img.paste(emblem_320, (100, 155), emblem_320)

# Render Typography
try:
    font_large = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 60)
    font_mid = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 30)
    font_sm = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 22)
except Exception:
    font_large = ImageFont.load_default()
    font_mid = ImageFont.load_default()
    font_sm = ImageFont.load_default()

og_draw.text((470, 170), "SATARK • MPLADS", fill=(255, 255, 255), font=font_large)
og_draw.text((470, 250), "National Intelligence & Forensic Command Center", fill=(212, 175, 55), font=font_mid)
og_draw.text((470, 310), "Ministry of Statistics & Programme Implementation (MoSPI)", fill=(148, 163, 184), font=font_sm)

og_draw.line([(470, 360), (1100, 360)], fill=(51, 65, 85), width=2)

og_draw.text((470, 385), "• 543 Parliamentary Constituencies & 732+ Districts Monitored", fill=(226, 232, 240), font=font_sm)
og_draw.text((470, 425), "• AI-Driven Anomaly Detection (D1–D15 Red Flag Engine)", fill=(226, 232, 240), font=font_sm)
og_draw.text((470, 465), "• 100% Real-Time Forensic Integrity & Geospatial Tracking", fill=(56, 189, 248), font=font_sm)

og_path = os.path.join(PUBLIC_DIR, "satark-og.png")
og_img.save(og_path, format="PNG")
print(f"Written: {og_path}")
