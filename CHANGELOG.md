# Changelog

All notable changes to MovieShelf are documented here. This project adheres to
[Keep a Changelog](https://keepachangelog.com/) conventions.

## [3.0.0] - 2026-07-12

### Changed
- **Rebuilt as a native Electron app.** The entire project was ported from Python (pywebview +
  python-mpv) to Electron with a **React + TypeScript** renderer and a **TypeScript main process**.
  All backend logic — folder scanning, filename parsing, media fingerprinting, TMDb/OMDb matching,
  caching, and trailer detection — was reimplemented in Node/TypeScript. No Python is required at
  runtime.
- **Playback** now embeds a bundled **mpv.exe** into a frameless, non-activating child window via
  `--wid`, controlled over mpv's JSON-IPC named pipe. This replaces the hand-rolled Win32 overlay
  (`winembed.py`) and its DPI/threading machinery — Electron owns the window and handles per-monitor
  DPI, so the overlay stays glued to the video pane on move/resize/fullscreen without any ctypes.
- **Media fingerprinting** now uses bundled **ffprobe** instead of pymediainfo.
- **Filename parsing** now uses `@ctrl/video-filename-parser` (with the same regex-clean fallback)
  instead of guessit. Title-similarity scoring reproduces Python's difflib (Ratcliff/Obershelp) so
  match confidence is unchanged.
- **Packaging** moved from PyInstaller to **electron-builder** (NSIS installer + portable exe).

### Preserved
- The `%APPDATA%\MovieShelf` data layout (`settings.txt`, `config.json`, `cache/`) is unchanged and
  reused — existing libraries, API keys, and cached metadata/artwork carry over. Cache keys are
  byte-identical to the previous version.

### Removed
- The Python package (`src/movieshelf`), PyInstaller spec, and `requirements.txt` / `pyproject.toml`.
- The WebView2 runtime dependency (Electron ships its own Chromium).

## [2.3.10] - 2026-07-02

### Fixed
- **Clicking the video in fullscreen froze the app (and playback keys stopped working).** The mpv core
  was created with `input_vo_keyboard=True`, so the video-output window grabbed keyboard focus /
  foreground when clicked. That stole focus from the WebView (so the web UI's key forwarding stopped —
  "controls don't work"), and put foreground on a player-thread window; the next alt-tab activation
  round-trip then attached the GUI thread's input queue to the player thread, hanging the UI while
  audio/video kept playing. mpv now runs with `input_vo_keyboard=False` (keys are forwarded from the
  web UI, as the design intends), so the surface never takes focus. The overlay window also now returns
  `MA_NOACTIVATE` to `WM_MOUSEACTIVATE` as defense-in-depth, so a click can never foreground it.

## [2.3.9] - 2026-07-01

### Fixed
- **The whole app froze when entering fullscreen.** Fullscreen sizing had the mpv host thread start
  repositioning the overlay to cover the monitor *at the same time* pywebview's `toggle_fullscreen`
  reconfigured the owner window on the GUI thread. Because the overlay is an owned window on a
  different thread and the GUI thread doesn't pump messages during that transition, the two
  cross-thread `SetWindowPos` calls waited on each other — a deadlock. (Dragging never hit this: the
  drag modal loop keeps pumping.) Overlay repositioning is now **suspended during the window
  transition** (the host thread keeps pumping, so no deadlock) and resumes immediately after, applying
  the monitor/pane geometry on its next tick. Also removed the `restored`/`maximized` window-event
  handlers that fired background-thread `SetWindowPos` on the overlay mid-transition (redundant now
  that the host thread tracks position continuously).

## [2.3.8] - 2026-07-01

### Fixed
- **Exiting fullscreen didn't restore the window.** Clicking the button in fullscreen shrank the
  video and brought the grid back, but the window stayed fullscreen-sized. `set_fullscreen` resolved
  the window via `webview.active_window()` (WinForms `ActiveForm`), which is `None` once the user
  interacts with the mpv overlay — so the exit `toggle_fullscreen()` was silently skipped. It now uses
  the stable `webview.windows[0]` handle and is idempotent (only toggles when the backend's real
  `is_fullscreen` differs from the requested state), so the window reliably enters and exits
  fullscreen and can't desync from the UI.

### Changed
- The Fullscreen button now relabels to **"Exit fullscreen"** while fullscreen (and back to
  "Fullscreen" otherwise), so its action is clear.

## [2.3.7] - 2026-07-01

### Fixed
- **Fullscreen enlarged only the app, not the video.** The overlay was resized by a JS
  `(0,0, innerWidth, innerHeight)` call fired on a timer, which was `innerWidth`/timing-dependent and
  raced with the new host-thread position tracker — so the video kept its pane-sized rectangle while
  the window went fullscreen. Fullscreen video is now driven from the mpv host thread: while
  fullscreen it positions the overlay to cover the **whole monitor** (`GetMonitorInfo`, matching the
  bounds pywebview sizes the fullscreen window to), deterministically and every tick. The UI now only
  reports the pane rect in windowed mode, so exiting fullscreen snaps the video straight back to the
  pane. New `winembed.monitor_rect`/`set_screen_rect`; `player.set_fullscreen`.

## [2.3.6] - 2026-07-01

### Problem Found
- **The embedded video didn't stay attached to its pane while dragging the window — the gap grew the
  further the window was moved.** Diagnostic logs showed the placement math was correct (and the
  display was at 100 %, so this was not a DPI issue): the overlay is an *owned* top-level window,
  which — unlike a child window — does not move with its owner, so it must be repositioned explicitly.
  That was driven only by pywebview's `moved` event, which is unreliable during a live modal
  window-drag and dispatches each fire on a new background thread doing a blocking cross-thread
  `SetWindowPos`. So the overlay lagged behind the window during a drag. Overlay tracking now runs
  **continuously on the mpv host thread's own message-pump loop** (~200 Hz) — the thread that owns the
  overlay, so `SetWindowPos` is instant and in-thread — re-gluing it to the pane whenever the window
  moves. This complements the 2.3.5 per-monitor-v2 change (which keeps it correct across display
  scales); together the video stays locked to the pane on any monitor.

## [2.3.5] - 2026-07-01

### Problem Found
- **The embedded video drifted away from its pane — further the more the window was dragged from its
  starting position — and was mis-placed on secondary / differently-scaled monitors.** pywebview
  initializes the process as only *System*-DPI-aware (`user32.SetProcessDPIAware`), so
  `GetDpiForWindow` returned the **primary** monitor's scale and Windows DPI-virtualized the window on
  any other-scaled monitor — while the WebView2 content renders **per-monitor** aware. The overlay was
  therefore positioned in a different coordinate space than the pane, producing an error that scaled
  with distance from the origin (≈0 on a single-monitor 100% machine, which is why it couldn't be
  reproduced there). MovieShelf now opts into **Per-Monitor-v2 DPI awareness at startup**, before
  pywebview's legacy call, so `GetDpiForWindow`, `ClientToScreen`/`SetWindowPos`, and WebView2 share
  one coordinate space and the overlay stays glued to the pane on any monitor at any display scale.

### Fixed
- **Playback failures left a stuck black video pane with no explanation.** The pane now closes cleanly
  on error and the reason is shown in the detail view's status line (previously never populated).
- **Subtitles named `Movie.en.srt` / `Movie-eng.srt` weren't detected.** Subtitle matching now treats
  `.`, `-`, and `_` — not just a space — as the boundary before a language/flag suffix.
- **A stray black overlay could linger when embedded mpv failed and fell back** to VLC / the OS
  default player; the overlay is now hidden before falling back.
- **Saved library folders on an offline network share were silently forgotten** on the next scan
  (they were pruned by an `os.path.isdir` check). Saved folders are now kept regardless of whether
  they are currently reachable.
- Declared missing ctypes signatures in `winembed.py` (`GetWindowRect`, `TranslateMessage`,
  `DispatchMessageW`, `GetModuleHandleW`) so 64-bit window/module handles aren't truncated.

### Added
- **Remove a saved folder** from the sidebar (a small × on each entry), now that offline folders are
  no longer auto-pruned.
- A "No titles match …" hint when a search filters out every movie in a non-empty library.

### Changed
- The startup log records the effective DPI-awareness mode (`dpi=per-monitor-v2`).
- `pyproject.toml` now bundles `mpv_config/**` as package data; removed an unused import in the TMDb
  client.

## [2.3.4] - 2026-06-29

### Changed
- Added diagnostic logging of the video overlay's geometry (window DPI, scale, client origin,
  requested vs. resulting rectangle, monitor) to `movieshelf.log`, to pin down a report of the
  overlay being mis-placed on a specific multi-monitor setup that could not be reproduced on a
  single-monitor 100% machine.
- Sidebar stat now reads "built-in player" instead of the stale "VLC preferred".

## [2.3.3] - 2026-06-29

### Problem Found
- **Video overlay drifted (≈2× on a scaled display) when dragging the window, and fullscreen didn't
  resize the video.** The pane rectangle was multiplied by the browser `devicePixelRatio`, but the
  WebView reports a per-monitor scale that can differ from the System-aware DPI the Win32
  positioning APIs (`ClientToScreen`/`SetWindowPos`) actually use — so on a scaled/secondary monitor
  the offset was mis-scaled and the fullscreen size was wrong. The overlay is now positioned from the
  owner window's own DPI (`GetDpiForWindow`), inside the owner's DPI context, with the pane rect
  reported in CSS/logical pixels — keeping the video in the same coordinate space as the window at
  any display scale.

## [2.3.2] - 2026-06-29

### Worked on
- **Freeze when clicking/hovering the playing video.** The video overlay was an activatable window,
  so interacting with it stole foreground from the web UI (and coupled the threads' input queues),
  freezing the interface until another app was focused. The overlay is now created with
  `WS_EX_NOACTIVATE`, so it never takes focus — the web UI stays responsive while video plays. Mouse
  (uosc) controls still work.
- **White box inside the video while dragging the window.** The overlay used the system `STATIC`
  class (white background brush); it now uses a custom class with a black background, so repositioning
  no longer flashes white.
- **Fullscreen only enlarged the frame, not the video.** In fullscreen the overlay now fills the
  entire window client area instead of tracking the (smaller) pane rectangle.
- **Stop left the movie playing.** The overlay is now hidden before issuing the mpv stop, so video
  and audio stop immediately and the surface disappears.

### Added
- **Keyboard transport control.** Because the video surface can't hold focus, Space (pause), ←/→
  (seek), ↑/↓ (volume), `m` (mute) and `f` (fullscreen) are forwarded from the app to mpv while a
  movie is playing.

## [2.3.1] - 2026-06-29

### Problem Found
- **UI froze after a movie started playing.** mpv creates its *own* video window on its own thread;
  when that window is a `WS_CHILD` of the app window, Windows implicitly `AttachThreadInput`s the two
  threads' input queues, coupling mpv's busy, focus-grabbing thread to pywebview's GUI thread — so
  once a movie played, the whole window stopped responding to input (the message loop itself stayed
  alive, confirming input-queue starvation rather than a hang). The video now renders into a
  borderless, **owned top-level window** positioned exactly over the video pane instead of a child
  window: it still looks embedded (no pop-out) and floats above / minimizes with the app window, but
  shares no input queue with the GUI thread, so the UI stays responsive during playback. The overlay
  is kept glued to the pane as the window resizes/moves/restores.

## [2.3.0] - 2026-06-29

### Added
- **In-window player (no more pop-out).** mpv now renders into a child surface embedded in the
  MovieShelf window (libmpv `wid`), shown in a **split view**: video on top, the library grid still
  scrollable below so you can browse while watching. A **Fullscreen** toggle expands the video to the
  whole window (Esc returns); **Close**/Esc stops and returns to the library.
- **Polished controls via [uosc](https://github.com/tomasklaen/uosc)** — a modern mpv OSC (timeline,
  volume, subtitle/audio menus, chapters) themed to the crimson accent, bundled in `mpv_config/`.
- `winembed.py` (ctypes Win32 helpers) and a dedicated player **host thread** that owns the video
  window + mpv core and pumps messages. `tools/fetch_uosc.py` vendors uosc; `config.mpv_config_dir()`.

### Changed
- The player no longer opens a separate window. If embedding is unavailable it falls back to a pop-out
  mpv window, then VLC / the OS default.

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
