"""Generate the MovieShelf app icon (PNG + multi-size ICO).

Dev-only tool. Requires Pillow:  pip install pillow
Run from anywhere:               python tools/generate_icon.py

Draws a simple movie clapperboard on the app's dark-blue background and writes
assets/movie_icon.png (256x256) and assets/movie_icon.ico (16-256).
"""

from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parents[1] / 'assets'

BG = (7, 17, 31, 255)        # #07111f  app background
BOARD = (27, 40, 65, 255)    # #1b2841  panel border tone
STRIPE = (237, 244, 255, 255)  # #edf4ff text/foreground
ACCENT = (109, 124, 255, 255)  # #6d7cff play gradient start


def _rounded(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def render(size: int = 256) -> Image.Image:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s = size / 256.0

    # Rounded app-colored tile.
    _rounded(draw, (8 * s, 8 * s, 248 * s, 248 * s), int(48 * s), BG)

    # Clapperboard body.
    body = (40 * s, 96 * s, 216 * s, 208 * s)
    _rounded(draw, body, int(14 * s), BOARD)

    # Clapper top bar (slightly angled look via a separate rounded bar).
    top = (40 * s, 60 * s, 216 * s, 104 * s)
    _rounded(draw, top, int(10 * s), ACCENT)

    # Diagonal stripes on the clapper top bar.
    for i in range(-2, 7):
        x = 40 * s + i * 28 * s
        draw.polygon(
            [(x, 104 * s), (x + 14 * s, 104 * s), (x + 30 * s, 60 * s), (x + 16 * s, 60 * s)],
            fill=STRIPE,
        )

    # Center play triangle on the board.
    cx, cy = 128 * s, 154 * s
    r = 34 * s
    draw.polygon(
        [(cx - r * 0.55, cy - r), (cx - r * 0.55, cy + r), (cx + r, cy)],
        fill=STRIPE,
    )
    return img


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    master = render(256)
    master.save(ASSETS / 'movie_icon.png')
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    master.save(ASSETS / 'movie_icon.ico', sizes=sizes)
    print(f'Wrote {ASSETS / "movie_icon.png"} and {ASSETS / "movie_icon.ico"}')


if __name__ == '__main__':
    main()
