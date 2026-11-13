from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math

S = 1024
img = Image.new("RGB", (S, S), (11, 18, 32))
d = ImageDraw.Draw(img)
# vertical gradient
for y in range(S):
    t = y / S
    r = int(11 + 18 * t); g = int(18 + 24 * t); b = int(32 + 40 * t)
    d.line([(0, y), (S, y)], fill=(r, g, b))

glow = Image.new("RGB", (S, S), (0, 0, 0))
gd = ImageDraw.Draw(glow)

# perspective grid
for i, oy in enumerate(range(640, 1024, 70)):
    y = oy + i * 6
    gd.line([(0, y), (S, y + 40)], fill=(16, 92, 84), width=4)
for i in range(-6, 7):
    x = S // 2 + i * 120
    gd.line([(S // 2 + i * 30, 700), (x * 1.8, S)], fill=(16, 92, 84), width=4)

# neon bars
gd.rectangle([120, 636, 904, 664], fill=(44, 232, 208))
gd.rectangle([150, 596, 320, 664], fill=(182, 255, 61))
gd.rectangle([704, 596, 874, 664], fill=(182, 255, 61))

try:
    font_big = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 300)
    font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 84)
except Exception:
    font_big = ImageFont.load_default()
    font_sm = font_big

gd.text((S // 2, 420), "IW", font=font_big, fill=(120, 255, 236), anchor="mm")
gd.text((S // 2, 858), "ISLAMWORK", font=font_sm, fill=(232, 246, 255), anchor="mm")

blur = glow.filter(ImageFilter.GaussianBlur(26))
img = Image.blend(img, Image.blend(img, glow, 0.95), 0.55)
img = Image.blend(img, Image.blend(img, blur, 1.0), 0.65)
img = Image.blend(img, glow, 0.18)
img.save("icons/icon-1024.png")
for s, name in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png"), (32, "favicon.png")]:
    img.resize((s, s), Image.LANCZOS).save(f"icons/{name}")
print("icons ok")
