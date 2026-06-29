"""Application constants and path helpers (resources, user config)."""

import json
import logging
import os
import sys
from pathlib import Path

from . import APP_NAME

log = logging.getLogger('movieshelf.config')

MOVIES_DIR = os.path.join(os.path.expanduser('~'), 'Documents', 'Movies')
# Starter folder; users add their own (local or network) from the sidebar — saved to settings.txt.
DEFAULT_FOLDERS = [MOVIES_DIR]
SUPPORTED_EXTENSIONS = ('.mkv', '.mp4')
VIDEO_EXTENSIONS = ('.mkv', '.mp4', '.mov', '.avi', '.m4v', '.wmv')
SUBTITLE_EXTENSIONS = {'.srt', '.vtt', '.ass', '.ssa', '.sub', '.idx'}

# TMDb (primary metadata source).
TMDB_API_BASE = 'https://api.themoviedb.org/3'
TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'
TMDB_POSTER_SIZE = 'w500'
TMDB_COVER_SIZE = 'w342'       # grid cover art (smaller than the detail poster)
TMDB_BACKDROP_SIZE = 'w1280'
TMDB_COLLECTION_POSTER_SIZE = 'w185'

# A local file near the movie is only treated as a trailer if it is at most this long.
MAX_TRAILER_MINUTES = 10


def load_keys() -> dict:
    """API keys merged from environment variables (preferred) and config.json.

    config.json (in the user config dir) may contain ``tmdb_api_key`` / ``omdb_api_key``.
    Reading on demand means a key added later is picked up without rebuilding.
    """
    keys = {'tmdb': '', 'omdb': ''}
    config_file = user_config_dir() / 'config.json'
    if config_file.exists():
        try:
            # utf-8-sig tolerates a BOM (e.g. files written by PowerShell's Set-Content -Encoding utf8).
            data = json.loads(config_file.read_text(encoding='utf-8-sig'))
            keys['tmdb'] = (data.get('tmdb_api_key') or '').strip()
            keys['omdb'] = (data.get('omdb_api_key') or '').strip()
        except (ValueError, OSError) as exc:
            log.warning('Could not read config.json: %s', exc)
    keys['tmdb'] = os.environ.get('TMDB_API_KEY', keys['tmdb']).strip()
    # OMDb falls back to a public sample key so ratings degrade gracefully without setup.
    keys['omdb'] = os.environ.get('OMDB_API_KEY', keys['omdb']).strip() or 'trilogy'
    return keys


def _assets_dir() -> Path:
    """Directory holding bundled assets, for both source and PyInstaller-frozen runs."""
    if getattr(sys, 'frozen', False):
        base = Path(getattr(sys, '_MEIPASS', Path(sys.executable).parent))
        return base / 'assets'
    # src/movieshelf/config.py -> project root is two levels up from this file's package.
    return Path(__file__).resolve().parents[2] / 'assets'


def resource_path(name: str) -> Path:
    """Absolute path to a bundled asset (e.g. an icon)."""
    return _assets_dir() / name


def web_dir() -> Path:
    """Directory holding the HTML/CSS/JS frontend, for source and frozen runs."""
    if getattr(sys, 'frozen', False):
        base = Path(getattr(sys, '_MEIPASS', Path(sys.executable).parent))
        return base / 'web'
    return Path(__file__).resolve().parent / 'web'


def libmpv_dir() -> Path:
    """Directory containing libmpv-2.dll. Frozen: the bundle root; source: vendor/libmpv."""
    if getattr(sys, 'frozen', False):
        return Path(getattr(sys, '_MEIPASS', Path(sys.executable).parent))
    return Path(__file__).resolve().parents[2] / 'vendor' / 'libmpv'


def user_config_dir() -> Path:
    """User-writable config directory (persists across exe restarts), created on demand."""
    base = os.environ.get('APPDATA') or os.path.join(os.path.expanduser('~'), '.config')
    path = Path(base) / APP_NAME
    path.mkdir(parents=True, exist_ok=True)
    return path


def log_dir() -> Path:
    """Directory for crash/diagnostic log files, created on demand."""
    path = user_config_dir() / 'logs'
    path.mkdir(parents=True, exist_ok=True)
    return path


def cache_dir() -> Path:
    """Directory for cached metadata and artwork (sibling to logs), created on demand."""
    path = user_config_dir() / 'cache'
    path.mkdir(parents=True, exist_ok=True)
    return path
