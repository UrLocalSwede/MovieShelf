# Changelog

All notable changes to MovieShelf are documented here. This project adheres to
[Keep a Changelog](https://keepachangelog.com/) conventions.

## [2.2.0] - 2026-06-29

### Added
- **Integrated, bundled media player (mpv).** Playback now uses an embedded **mpv** engine
  (`libmpv`, via [python-mpv](https://github.com/jaseg/python-mpv)) instead of requiring an external
  VLC install. mpv plays virtually any container/codec natively (mkv, HEVC/x265, DTS/AC3, PGS/ASS
  subtitles) with no transcoding, and provides its own on-screen controls + keyboard shortcuts.
  Selected subtitles are passed through. A **Stop** button was added to the detail view.
- `tools/fetch_libmpv.py` downloads `libmpv-2.dll` into `vendor/` for bundling; the PyInstaller spec
  embeds it. New `config.libmpv_dir()` + a `mpv=` capability log line.

### Changed
- External VLC / system default player is now only a **fallback** when the bundled engine can't load.
- The executable is larger now (it embeds the mpv/ffmpeg engine, ~110 MB DLL).

## [2.1.2] - 2026-06-29

### Changed
- Prepared the project for public release: rewrote the README, expanded `.gitignore` (ignores
  `.venv`, build output, `config.json`, `.claude/`, editor/OS files), and added `config.example.json`.
- Removed the hardcoded private network share from the default folders; the library now defaults to
  `~/Documents/Movies`, and users add their own folders from the sidebar.

## [2.1.1] - 2026-06-29

### Fixed
- **No metadata shown for most movies in the exe.** `config.json` written with a UTF-8 BOM made
  `json.loads` fail, so the app read no TMDb key and every selection fell back to "no key / no data".
  Keys are now read with `utf-8-sig` (BOM-tolerant). Matching itself was fine (~97% on a 30-movie
  sample); this was purely a key-loading bug.

### Added
- **Movie covers in the library grid.** A lightweight `get_cover` (one TMDb search + one poster
  download, cached) lazily populates each card's artwork in the background; cached covers appear
  instantly and the grid falls back to the film icon when no confident match exists.

## [2.1.0] - 2026-06-29

Real metadata matching pipeline, local caching, richer detail view, and a new palette.

### Added
- **Metadata pipeline (runs on selection)**: parse filename + parent folder with **guessit** →
  **fingerprint** the file (duration / resolution / embedded title) with **pymediainfo** → search
  **TMDb** → score candidates by title similarity, year, runtime, and language → fetch the best
  match's poster, backdrop, overview, genres, runtime, countries, and collection → enrich ratings
  via **OMDb** (IMDb / Rotten Tomatoes / Metacritic). New modules: `parsing`, `fingerprint`,
  `matching`, `metadata`, `trailers`, `cache`, and `providers/` (`tmdb`, `omdb`).
- **Local cache** under `%APPDATA%\MovieShelf\cache` (sibling to `logs`): `movies/<hash>/`
  (meta.json + poster/backdrop/collection art) and `titles.json`. Re-selecting a movie loads
  instantly and works offline.
- **Local trailer detection**: finds a trailer in the movie's folder or a `Trailers`/`Extras`/
  `Featurettes` subfolder, accepting only files ≤ 10 min (verified by fingerprint); otherwise shows
  "No trailer available".
- **Richer detail view**: backdrop hero, poster, rating badges, genre chips, runtime/country,
  overview, collection row, and a match-confidence indicator; plus Play / Watch-trailer / Re-match.
- **API keys via `config.json`** in `%APPDATA%\MovieShelf` (or `TMDB_API_KEY` / `OMDB_API_KEY` env).

### Changed
- **New "Crimson Dark" palette** (base `#100e11`, accent `#f43f5e`→`#e11d48`) — no yellow.
- Grid titles now come from guessit (cached), replacing the noisy regex `clean_title`.
- The selection bridge call is now `get_metadata(path)` (replaces `get_details(title)`); added
  `refresh_metadata` and `play_trailer`.

## [2.0.0] - 2026-06-29

Frontend rewritten in HTML/CSS/JS with a fresh dark theme; Python remains the backend.

### Changed
- **New UI built with HTML/CSS/JS rendered via [pywebview](https://pywebview.flowrl.com/)** (native
  window over the Windows WebView2 runtime). The PyQt6 widget UI is gone. JavaScript calls Python
  through a `js_api` bridge, so scanning and OMDb lookups run async without freezing the UI — the
  old `QThread`/`MovieDetailsWorker` machinery (and its crash class) is removed entirely.
- **New dark theme**: deep charcoal base with a warm amber→coral accent, a poster-style movie-card
  grid, live search, and a slide-in details drawer. Replaces the previous navy/indigo widget layout.
- `fetch_movie_details` now returns the poster **URL** (loaded directly by the frontend) instead of
  downloading image bytes.
- **Smaller executable**: ~14 MB (was ~36 MB) — WebView2 is provided by the OS rather than bundled.

### Added
- `src/movieshelf/api.py` — the JS bridge; `src/movieshelf/web/` — `index.html`, `styles.css`,
  `app.js`; `config.web_dir()` resolves the frontend for source and frozen runs.

### Removed
- `src/movieshelf/ui.py` and the PyQt6 dependency (replaced by pywebview).
- Legacy project-root `settings.txt` (already migrated to `%APPDATA%\MovieShelf`).

### Requirements
- The **WebView2 runtime** must be present (ships with Microsoft Edge; standard on current
  Windows 10/11).

## [1.0.1] - 2026-06-29

### Fixed
- **Crash when selecting a movie a second time.** The online-details `QThread` was
  `deleteLater`'d when its first fetch finished, but the window kept a reference to the now-deleted
  C++ object; the next selection called `.isRunning()` on it and PyQt aborted the process. The
  thread lifecycle now clears its references on completion, guards against deleted objects, and
  ignores results from superseded selections (`sender()` checks). `closeEvent` stops the thread
  cleanly with a terminate fallback so shutdown never destroys a running thread.

### Added
- **Log files for crashes/testing.** Logs are written to `%APPDATA%\MovieShelf\logs\movieshelf.log`
  (rotating, 5 backups). A global excepthook records uncaught exceptions before the app aborts, and
  playback/lifecycle events are logged. See `src/movieshelf/logsetup.py`.

## [1.0.0] - 2026-06-29

First cleaned-up release. The app was reorganized from a single 491-line `app.py` into a proper
package, several bugs were fixed, and it now ships as one self-contained executable.

### Added
- `src/movieshelf/` package split into focused modules: `config`, `settings`, `library`,
  `player`, `omdb`, `ui`, `app`, and a `__main__` entry point (`python -m movieshelf`).
- A generated movie-clapperboard app icon (`assets/movie_icon.png` / `.ico`), wired into the
  window and the executable. Reproducible via `tools/generate_icon.py`.
- `pyproject.toml` and `requirements.txt` for standard packaging and dependency installation.
- This `CHANGELOG.md`.

### Changed
- **Standardized the name to "MovieShelf"** everywhere (window title, executable, README); the app
  was previously called "Movie Browser", "MovieShelf", and "MovieVault" in different places.
- Settings now persist to `%APPDATA%\MovieShelf\settings.txt` instead of next to the code. Existing
  saved folders are migrated automatically on first run.
- README rewritten: one run method (`dist/MovieShelf.exe`), plus dev/build notes; removed the stale
  hardcoded Python path.
- PyInstaller spec rewritten (`build/MovieShelf.spec`) to build the package and bundle the icon,
  using paths that resolve relative to the project root.

### Fixed
- **Build was broken**: the old spec and code referenced `movie_icon.ico` / `movie_icon.png` that
  did not exist, so `pyinstaller` failed. The icon now exists and is bundled.
- **Saved folders were lost when running the exe**: settings were written next to `__file__`, which
  in a one-file PyInstaller build is a temporary extraction directory. Now stored in a stable
  user-writable location.
- `find_subtitles` no longer falls back to attaching *every* subtitle in a folder when no name match
  is found; it returns none so "Auto" lets the player auto-detect.
- `find_subtitles` is now resilient to unreadable folders (returns `[]` instead of raising).

### Removed
- Both `run_app.bat` launchers (workspace root and project) and all alternative run instructions —
  the executable is the only supported way to run the app.
- Redundant `!= 'Auto'` check in `play_selected` (the value is already normalized to empty).
- Stale build artifacts: old `MovieBrowser.spec`, `dist/MovieBrowser.exe`, and `build/MovieBrowser/`.
