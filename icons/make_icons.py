"""
make_icons.py — Tạo icon cho Fitpick bằng Pillow.

Phong cách khớp thiết kế: nền xanh rêu (#4E5B3A), biểu tượng móc treo áo màu kem (#F7F3EC)
— cùng hình móc treo ở tab "Tủ đồ" trên thanh điều hướng.

Cách chạy (từ thư mục gốc của dự án):
    python3 -m pip install pillow
    python3 icons/make_icons.py

Tạo ra trong thư mục icons/:
    icon-192.png, icon-512.png       — icon thường (Android, trình duyệt)
    icon-maskable-512.png            — icon "maskable" cho Android (chừa vùng an toàn)
    apple-touch-icon.png (180x180)   — icon cho iPhone
"""
from pathlib import Path

from PIL import Image, ImageDraw

MOSS = (78, 91, 58)       # #4E5B3A
CREAM = (247, 243, 236)   # #F7F3EC
SUPERSAMPLE = 4           # vẽ to gấp 4 rồi thu nhỏ để nét mượt

OUT_DIR = Path(__file__).resolve().parent

# Móc treo áo theo hệ tọa độ 24x24 (giống SVG trên thanh điều hướng)
HOOK_CENTER = (12.0, 6.0)
HOOK_RADIUS = 2.0
HOOK_TAIL = [(12.6, 7.9), (12.25, 8.25), (12.0, 8.8), (12.0, 10.0)]
BODY = [(12.0, 10.0), (3.7, 16.6), (4.4, 18.0),
        (19.6, 18.0), (20.3, 16.6), (12.0, 10.0)]
STROKE = 1.7
ICON_BOX = (3.0, 4.0, 21.0, 18.0)  # khung bao quanh hình móc treo


def draw_hanger(size: int, content_ratio: float) -> Image.Image:
    """Vẽ một icon vuông cạnh `size` px; hình móc treo rộng `content_ratio` cạnh icon."""
    big = size * SUPERSAMPLE
    img = Image.new("RGB", (big, big), MOSS)
    d = ImageDraw.Draw(img)

    x0, y0, x1, y1 = ICON_BOX
    scale = content_ratio * big / (x1 - x0)
    # Căn giữa hình theo cả hai chiều
    off_x = (big - (x1 - x0) * scale) / 2 - x0 * scale
    off_y = (big - (y1 - y0) * scale) / 2 - y0 * scale

    def pt(p):
        """Đổi tọa độ 24x24 sang pixel."""
        return (p[0] * scale + off_x, p[1] * scale + off_y)

    width = max(1, round(STROKE * scale))
    r = width / 2

    def dot(p):
        """Chấm tròn để đầu nét và góc nối được bo tròn."""
        x, y = pt(p)
        d.ellipse([x - r, y - r, x + r, y + r], fill=CREAM)

    # Phần móc: cung tròn từ bên trái, vòng qua đỉnh, xuống bên phải
    cx, cy = pt(HOOK_CENTER)
    rr = HOOK_RADIUS * scale
    d.arc([cx - rr - r, cy - rr - r, cx + rr + r, cy + rr + r], start=180, end=72.5, fill=CREAM, width=width)
    dot((HOOK_CENTER[0] - HOOK_RADIUS, HOOK_CENTER[1]))
    d.line([pt(p) for p in HOOK_TAIL], fill=CREAM, width=width, joint="curve")
    for p in HOOK_TAIL:
        dot(p)

    # Thân móc treo hình tam giác
    d.line([pt(p) for p in BODY], fill=CREAM, width=width, joint="curve")
    for p in BODY:
        dot(p)

    return img.resize((size, size), Image.LANCZOS)


def main():
    """Tạo tất cả icon cần cho PWA."""
    targets = [
        ("icon-192.png", 192, 0.60),
        ("icon-512.png", 512, 0.60),
        ("icon-maskable-512.png", 512, 0.48),  # vùng an toàn của icon maskable là 80% ở giữa
        ("apple-touch-icon.png", 180, 0.60),
    ]
    for name, size, ratio in targets:
        path = OUT_DIR / name
        draw_hanger(size, ratio).save(path, "PNG", optimize=True)
        print(f"Đã tạo {path.relative_to(OUT_DIR.parent)} ({size}x{size})")


if __name__ == "__main__":
    main()
