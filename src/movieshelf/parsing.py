"""Filename/folder parsing into a clean title + match hints (via guessit)."""

import os
import re

from . import cache

try:
    from guessit import guessit as _guessit
    _HAS_GUESSIT = True
except Exception:  # pragma: no cover - guessit should be installed
    _HAS_GUESSIT = False

# Generic container folders that carry no title information.
_GENERIC_FOLDERS = {'film', 'films', 'movie', 'movies', 'video', 'videos', 'media'}

_NOISE_TOKENS = {
    '1080p', '720p', '2160p', '4k', 'x264', 'x265', 'h264', 'h265', 'hevc', 'bluray',
    'brrip', 'webrip', 'web', 'web-dl', 'webdl', 'hdrip', 'hdtv', 'dvdrip', 'yify',
    'nordic', 'eng', 'aac', 'ac3', 'dts', 'remux', '2160', '1080', '720',
}


def _first(value):
    return value[0] if isinstance(value, list) and value else value


def _as_str(value):
    value = _first(value)
    return str(value) if value is not None else ''


def _regex_clean(file_name: str) -> str:
    """Fallback title cleaner if guessit is unavailable or returns nothing."""
    title = os.path.splitext(file_name)[0]
    title = re.split(r'[(\[]', title)[0]
    title = re.sub(r'[._-]+', ' ', title)
    parts = []
    for part in title.split():
        if part.lower() in _NOISE_TOKENS or re.fullmatch(r'(19|20)\d{2}', part):
            break  # tokens after the year/quality are release cruft
        parts.append(part)
    return ' '.join(w.capitalize() for w in parts) or os.path.splitext(file_name)[0]


def _guess(name: str) -> dict:
    if not _HAS_GUESSIT:
        return {}
    try:
        return dict(_guessit(name, options={'type': 'movie'}))
    except Exception:
        return {}


def parse(path: str) -> dict:
    """Parse a movie's filename, falling back to the parent folder name for missing pieces."""
    base = os.path.basename(path)
    parent = os.path.basename(os.path.dirname(path))

    g = _guess(base)
    title = _first(g.get('title'))
    year = g.get('year')

    if parent and parent.lower() not in _GENERIC_FOLDERS and (not title or year is None):
        folder_g = _guess(parent)
        title = title or _first(folder_g.get('title'))
        if year is None:
            year = folder_g.get('year')

    if not title:
        title = _regex_clean(base)

    return {
        'title': str(title).strip(),
        'year': year if isinstance(year, int) else None,
        'edition': _as_str(g.get('edition')),
        'source': _as_str(g.get('source')),
        'screen_size': _as_str(g.get('screen_size')),
        'country': _as_str(g.get('country')),
        'language': _as_str(g.get('language')),
    }


def display_title(path: str) -> str:
    """Clean title for the library grid (cached by path+mtime). Includes the year when known."""
    cached = cache.get_title(path)
    if cached is not None:
        return cached
    info = parse(path)
    title = info['title']
    if info['year']:
        title = f"{title} ({info['year']})"
    cache.set_title(path, title)
    return title
