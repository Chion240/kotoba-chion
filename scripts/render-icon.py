from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
SIZE = 1024

image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)

# 与界面主题一致的灰绿色底；圆角外保持真实透明。
draw.rounded_rectangle((64, 64, 960, 960), radius=224, fill="#506457")

# 高对比度开卷图形。页脚略向外展开，缩至 16 px 仍能辨认轮廓。
left_page = [(204, 300), (300, 278), (404, 300), (492, 355), (492, 785), (396, 744), (300, 727), (204, 737)]
right_page = [(820, 300), (724, 278), (620, 300), (532, 355), (532, 785), (628, 744), (724, 727), (820, 737)]
draw.polygon(left_page, fill="#f7faf8")
draw.polygon(right_page, fill="#e6ebe8")
draw.line((512, 355, 512, 785), fill="#304238", width=28)

font_path = Path(r"C:\Windows\Fonts\msyhbd.ttc")
if not font_path.exists():
    raise SystemExit(f"缺少发行图标字体：{font_path}")
font = ImageFont.truetype(str(font_path), 276)
label = "言"
bounds = draw.textbbox((0, 0), label, font=font)
text_width = bounds[2] - bounds[0]
text_height = bounds[3] - bounds[1]
text_x = (SIZE - text_width) / 2 - bounds[0]
text_y = 504 - text_height / 2 - bounds[1]
draw.text((text_x, text_y), label, font=font, fill="#304238")

png_path = BUILD / "icon.png"
ico_path = BUILD / "icon.ico"
image.save(png_path, "PNG", optimize=True)
image.save(ico_path, "ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(f"wrote {png_path}")
print(f"wrote {ico_path}")
