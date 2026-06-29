"""Local cache for matched metadata, artwork, and cleaned grid titles.

Lives under ``%APPDATA%\\MovieShelf\\cache`` (a sibling of ``logs``):
    cache/movies/<hash>/meta.json      matched metadata
    cache/movies/<hash>/poster.jpg     downloaded poster
    cache/movies/<hash>/backdrop.jpg   downloaded backdrop
    cache/titles.json                  path -> cleaned grid title (with mtime)
"""

import base64
import hashlib
import json
import logging
import os

from .config import cache_dir

log = logging.getLogger('movieshelf.cache')


def _key(path: str) -> str:
    norm = os.path.normcase(os.path.normpath(path))
    return hashlib.sha1(norm.encode('utf-8')).hexdigest()


def movie_dir(path: str):
    d = cache_dir() / 'movies' / _key(path)
    d.mkdir(parents=True, exist_ok=True)
    return d


# -- matched metadata ---------------------------------------------------------
def load(path: str):
    meta_file = cache_dir() / 'movies' / _key(path) / 'meta.json'
    if not meta_file.exists():
        return None
    try:
        return json.loads(meta_file.read_text(encoding='utf-8'))
    except (ValueError, OSError) as exc:
        log.warning('Bad cache meta for %s: %s', path, exc)
        return None


def save(path: str, meta: dict) -> None:
    (movie_dir(path) / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')


def save_image(path: str, name: str, data: bytes) -> str:
    """Persist image bytes (e.g. 'poster.jpg') and return the file name stored."""
    (movie_dir(path) / name).write_bytes(data)
    return name


def image_data_uri(path: str, name: str) -> str:
    """Return a base64 data URI for a cached image, or '' if missing.

    Data URIs avoid WebView2 file:// cross-directory access restrictions.
    """
    if not name:
        return ''
    f = cache_dir() / 'movies' / _key(path) / name
    if not f.exists():
        return ''
    try:
        mime = 'image/png' if name.lower().endswith('.png') else 'image/jpeg'
        return f'data:{mime};base64,' + base64.b64encode(f.read_bytes()).decode('ascii')
    except OSError:
        return ''


# -- grid titles --------------------------------------------------------------
_titles = None


def _titles_file():
    return cache_dir() / 'titles.json'


def _load_titles() -> dict:
    global _titles
    if _titles is None:
        f = _titles_file()
        if f.exists():
            try:
                _titles = json.loads(f.read_text(encoding='utf-8'))
            except (ValueError, OSError):
                _titles = {}
        else:
            _titles = {}
    return _titles


def _mtime(path: str):
    try:
        return os.path.getmtime(path)
    except OSError:
        return 0.0


def get_title(path: str):
    entry = _load_titles().get(os.path.normcase(path))
    if entry and entry.get('mtime') == _mtime(path):
        return entry.get('title')
    return None


def set_title(path: str, title: str) -> None:
    titles = _load_titles()
    titles[os.path.normcase(path)] = {'title': title, 'mtime': _mtime(path)}
    try:
        _titles_file().write_text(json.dumps(titles, ensure_ascii=False), encoding='utf-8')
    except OSError as exc:
        log.debug('Could not write titles cache: %s', exc)
