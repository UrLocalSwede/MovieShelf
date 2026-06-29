# 🎬 MovieShelf

![Platform](https://img.shields.io/badge/platform-Windows-0a7bbb)
![Python](https://img.shields.io/badge/python-3.11%2B-3776ab)
![UI](https://img.shields.io/badge/UI-HTML%2FCSS%20via%20pywebview-f43f5e)
![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-lightgrey)

A fast, clean desktop app for browsing a large local/network movie collection. It scans your
folders, identifies each film online, and shows posters, artwork, ratings, and details in a modern
dark interface — then plays your file in one click with a **built-in mpv player**.

The UI is plain **HTML/CSS/JS** rendered in a native window via
[pywebview](https://pywebview.flowrl.com/) (over the Windows WebView2 runtime). **Python** does all
the scanning, matching, and playback. Online identification is **only performed when you select a
movie**, and everything is cached locally so it's instant afterward — and works offline.

## Features

- **Automatic identification** — parses the filename/folder, fingerprints the file
  (duration/resolution), searches [TMDb](https://www.themoviedb.org/), and picks the best match by
  title similarity, year, and runtime.
- **Rich detail view** — poster, backdrop, overview, genres, runtime, country, collection, and
  ratings from IMDb / Rotten Tomatoes / Metacritic (via [OMDb](https://www.omdbapi.com/)) and TMDb.
- **Cover art in the library grid**, loaded lazily in the background and cached.
- **Local trailers** — finds a trailer next to the movie (a `*-trailer.*` file or a
  `Trailers`/`Extras` subfolder, ≤ 10 min) and plays it; says so clearly when there isn't one.
- **Built-in player** — a bundled **mpv** engine plays virtually any container/codec (mkv, HEVC/x265,
  DTS/AC3, PGS/ASS subtitles) natively, with on-screen controls and keyboard shortcuts. No external
  player needed (falls back to VLC / your default player only if the bundled engine is unavailable).
- **Offline-friendly local cache** of metadata and artwork.
- **Self-contained executable** — no Python (or VLC) install required to run.

## Getting started

1. Download `MovieShelf.exe` from the [Releases](../../releases) page (or build it — see below).
2. Make sure the **WebView2 runtime** is installed (it ships with Microsoft Edge and is present on
   virtually all current Windows 10/11 machines).
3. (Recommended) [Add a free TMDb API key](#-api-keys) to enable online matching.
4. Run `MovieShelf.exe`, add your movie folder(s) from the sidebar, and click a title.

> Playback uses the bundled **mpv** player. In the player window, use the on-screen controls or
> keyboard shortcuts: space (pause), ←/→ (seek), `f` (fullscreen), `j`/`k` (subtitle track),
> `#` (audio track), `q` (close).

## API keys

Online matching needs a **free TMDb API key** (themoviedb.org → *Settings → API*). OMDb (for
IMDb/RT/Metacritic ratings) is optional and falls back to a public sample key.

Provide them either way:

- **Environment variables:** `TMDB_API_KEY` (and optionally `OMDB_API_KEY`), or
- **A `config.json`** in `%APPDATA%\MovieShelf` (see [`config.example.json`](config.example.json)):

  ```json
  { "tmdb_api_key": "your_tmdb_key", "omdb_api_key": "your_omdb_key" }
  ```

## Where your data lives

| Data | Location |
| --- | --- |
| Saved library folders | `%APPDATA%\MovieShelf\settings.txt` |
| Cached metadata + artwork | `%APPDATA%\MovieShelf\cache` |
| Logs (and crash reports) | `%APPDATA%\MovieShelf\logs\movieshelf.log` |
| API keys | `%APPDATA%\MovieShelf\config.json` (or env vars) |

Nothing is written into the app folder, so the executable stays portable.

## Development

Requires Python 3.11+ on Windows.

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:PYTHONPATH = "src"
.venv\Scripts\python.exe -m movieshelf
```

### Building the executable

First fetch the bundled mpv engine (one-time; downloads `libmpv-2.dll` into `vendor/`):

```powershell
.venv\Scripts\python.exe tools\fetch_libmpv.py
```

Then build:

```powershell
.venv\Scripts\python.exe -m PyInstaller --noconfirm build\MovieShelf.spec
```

This produces a single `dist\MovieShelf.exe` (larger than a typical app — it embeds the mpv/ffmpeg
engine). To regenerate the app icon (requires `pillow`):

```powershell
.venv\Scripts\python.exe tools\generate_icon.py
```

## Tech stack

Python · [pywebview](https://pywebview.flowrl.com/) · [mpv](https://mpv.io/) /
[python-mpv](https://github.com/jaseg/python-mpv) · [guessit](https://guessit.io/) ·
[pymediainfo](https://pymediainfo.readthedocs.io/) · [PyInstaller](https://pyinstaller.org/) ·
HTML/CSS/JS.

## Contributing

Issues and pull requests are welcome. Keep changes focused, match the existing style, and update
`CHANGELOG.md`. The backend modules are small and single-purpose, so most features touch only one or
two files.

## License

Licensed under [Creative Commons Attribution-NonCommercial 4.0 International](LICENSE) (CC BY-NC 4.0):
free to share and adapt with attribution, **not for commercial use**.

## Acknowledgements

This product uses the **TMDb API** but is not endorsed or certified by
[TMDb](https://www.themoviedb.org/). Ratings data is provided by [OMDb](https://www.omdbapi.com/).
Playback is powered by [**mpv**](https://mpv.io/), bundled as a separate `libmpv-2.dll`
(GPLv2+/LGPLv2.1+; source available at mpv.io).
