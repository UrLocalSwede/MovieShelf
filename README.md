# 🎬 MovieShelf

![Platform](https://img.shields.io/badge/platform-Windows-0a7bbb)
![Runtime](https://img.shields.io/badge/Electron-33-47848f)
![UI](https://img.shields.io/badge/UI-React%20%2B%20TypeScript-3178c6)
![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-lightgrey)

A fast, clean desktop app for browsing a large local/network movie collection. It scans your
folders, identifies each film online, and shows posters, artwork, ratings, and details in a modern
dark interface — then plays your file in one click with a **built-in mpv player**.

MovieShelf is a native **Electron** app: a **React + TypeScript** renderer, an Electron **main
process** (TypeScript) that does all the scanning, matching, and playback, and a bundled **mpv**
engine for video. Online identification happens **only when you select a movie**, and everything is
cached locally so it's instant afterwards — and works offline.

## Features

- **Automatic identification** — parses the filename/folder, fingerprints the file
  (duration/resolution via ffprobe), searches [TMDb](https://www.themoviedb.org/), and picks the
  best match by title similarity, year, and runtime.
- **Rich detail view** — poster, backdrop, overview, genres, runtime, country, collection, and
  ratings from IMDb / Rotten Tomatoes / Metacritic (via [OMDb](https://www.omdbapi.com/)) and TMDb.
- **Cover art in the library grid**, loaded lazily in the background and cached.
- **Local trailers** — finds a trailer next to the movie (a `*-trailer.*` file or a
  `Trailers`/`Extras` subfolder, ≤ 10 min) and plays it.
- **Built-in, in-window player** — a bundled **mpv** engine plays virtually any container/codec (mkv,
  HEVC/x265, DTS/AC3, PGS/ASS subtitles) natively, embedded right in the app in a split view with a
  **fullscreen** toggle and polished [uosc](https://github.com/tomasklaen/uosc) controls. Falls back
  to VLC / your default player if the bundled engine is unavailable.
- **Offline-friendly local cache** of metadata and artwork.

## Getting started

1. Download the installer or portable `MovieShelf` executable from the
   [Releases](../../releases) page (or build it — see below).
2. Run it, add your movie folder(s) from the sidebar, and click a title.
3. (Recommended) [Add a free TMDb API key](#-api-keys) to enable online matching.

> Playback is embedded in the app. Use the uosc on-screen controls or keyboard shortcuts: space
> (pause), ←/→ (seek), **F** (fullscreen), **Esc** (close). Use the **Fullscreen** button to expand
> the video; **Close** or **Esc** returns to the library.

## 🔑 API keys

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
| Logs | `%APPDATA%\MovieShelf\logs\movieshelf.log` |
| API keys | `%APPDATA%\MovieShelf\config.json` (or env vars) |

This layout is unchanged from earlier versions, so an existing library, keys, and cache carry over.
Electron's own state is kept separately under `%APPDATA%\MovieShelf\electron`.

## Development

Requires **Node.js 20+** on Windows.

```powershell
npm install
npm run fetch:deps    # downloads mpv.exe + ffprobe.exe + uosc into resources/ (one-time)
npm run dev           # launches the app with hot-reloaded renderer
```

Useful scripts:

- `npm run typecheck` — type-check main, preload, and renderer.
- `npm run build` — bundle main/preload/renderer into `out/`.
- `npm run dev` — run in development with the Vite dev server.

### Building the installer

```powershell
npm run fetch:deps    # if not already fetched
npm run dist          # NSIS installer + portable exe in dist/
```

This produces `dist\MovieShelf Setup <version>.exe` (NSIS) and `dist\MovieShelf-<version>-portable.exe`.
The build embeds the mpv/ffmpeg engine, so the executables are large. Nothing is written into the
app folder at runtime, so the portable build stays portable.

> On Windows, embedding the app icon into the `.exe` requires either **Developer Mode** enabled or an
> elevated shell (electron-builder's `winCodeSign` toolchain needs the symbolic-link privilege). The
> build disables that step by default (`win.signAndEditExecutable: false`); the app still sets its
> window/taskbar icon at runtime. Remove that line to embed the exe icon on a capable machine.

## Tech stack

[Electron](https://www.electronjs.org/) · [React](https://react.dev/) · TypeScript ·
[electron-vite](https://electron-vite.org/) · [electron-builder](https://www.electron.build/) ·
[mpv](https://mpv.io/) (JSON IPC) · [uosc](https://github.com/tomasklaen/uosc) ·
[ffprobe](https://ffmpeg.org/) · [@ctrl/video-filename-parser](https://github.com/scttcper/video-filename-parser).

## Architecture

- **`src/main/`** — Electron main process (Node/TS): folder scanning (`library.ts`), filename parsing
  (`parsing.ts`), media fingerprinting (`fingerprint.ts`), TMDb/OMDb clients (`providers/`), match
  scoring (`matching.ts`), orchestration + caching (`metadata.ts`, `cache.ts`), settings, trailers,
  and the mpv playback subsystem (`player/`). IPC handlers in `ipc.ts` are the renderer-facing API.
- **`src/preload/`** — a `contextBridge` that exposes the typed API as `window.api`.
- **`src/renderer/`** — the React UI (grid, detail modal, embedded player pane).
- **`shared/types.ts`** — the IPC contract types shared by main and renderer.
- **`resources/`** — bundled mpv/ffprobe engines and the uosc `mpv_config`.

Playback embeds mpv (spawned once, controlled over its JSON-IPC named pipe) into a frameless, owned,
non-activating child `BrowserWindow` via `--wid`, positioned over the HTML "video pane".

## License

Licensed under [Creative Commons Attribution-NonCommercial 4.0 International](LICENSE) (CC BY-NC 4.0).

## Acknowledgements

This product uses the **TMDb API** but is not endorsed or certified by TMDb. Ratings data is provided
by [OMDb](https://www.omdbapi.com/). Playback is powered by [**mpv**](https://mpv.io/) and
[**FFmpeg**](https://ffmpeg.org/), bundled as separate executables (GPLv2+/LGPLv2.1+; source available
at mpv.io and ffmpeg.org).
