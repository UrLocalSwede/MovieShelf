"""Find a local trailer near a movie file.

A trailer is a short video (<= MAX_TRAILER_MINUTES) located either:
  * in the movie's own folder, named like a trailer AND related to the movie, or
  * inside a dedicated Trailers/Extras/Featurettes subfolder of the movie's folder.
This avoids mistaking another full movie (e.g. in a flat library folder) for a trailer.
"""

import logging
import os
from difflib import SequenceMatcher

from .config import MAX_TRAILER_MINUTES, VIDEO_EXTENSIONS
from .fingerprint import probe

log = logging.getLogger('movieshelf.trailers')

_TRAILER_WORDS = ('trailer', 'teaser', 'preview')
_EXTRA_DIRS = {'trailer', 'trailers', 'extras', 'featurettes', 'extra'}


def _is_video(name: str) -> bool:
    return os.path.splitext(name)[1].lower() in VIDEO_EXTENSIONS


def _named_trailer(name: str) -> bool:
    low = name.lower()
    return any(word in low for word in _TRAILER_WORDS)


def _strip_trailer_words(stem: str) -> str:
    low = stem.lower()
    for word in _TRAILER_WORDS:
        low = low.replace(word, ' ')
    return ' '.join(low.replace('.', ' ').replace('_', ' ').replace('-', ' ').split())


def _relates(movie_base: str, entry_stem: str) -> bool:
    cleaned = _strip_trailer_words(entry_stem)
    if not cleaned:
        return True  # e.g. just "trailer.mkv" sitting beside the movie
    if movie_base in cleaned or cleaned in movie_base:
        return True
    return SequenceMatcher(None, movie_base, cleaned).ratio() >= 0.6


def _duration_ok(path: str, named: bool) -> bool:
    duration = probe(path).get('duration_min')
    if duration is None:
        return named  # unknown length: trust a trailer-named file, reject anonymous ones
    return duration <= MAX_TRAILER_MINUTES


def find_trailer(path: str):
    """Return {'path', 'name'} for a local trailer, or None."""
    folder = os.path.dirname(path)
    movie_norm = os.path.normcase(os.path.normpath(path))
    movie_base = os.path.splitext(os.path.basename(path))[0].lower()
    candidates = []  # (priority, full_path, named)

    try:
        entries = os.listdir(folder)
    except OSError:
        return None

    for entry in entries:
        full = os.path.join(folder, entry)
        if os.path.isdir(full) and entry.lower() in _EXTRA_DIRS:
            try:
                for sub in sorted(os.listdir(full)):
                    sub_full = os.path.join(full, sub)
                    if os.path.isfile(sub_full) and _is_video(sub):
                        candidates.append((0, sub_full, _named_trailer(sub)))
            except OSError:
                continue
        elif os.path.isfile(full) and _is_video(entry):
            if os.path.normcase(os.path.normpath(full)) == movie_norm:
                continue
            stem = os.path.splitext(entry)[0]
            if _named_trailer(entry) and _relates(movie_base, stem):
                candidates.append((1, full, True))

    # Prefer dedicated-folder trailers, then trailer-named, then verify duration.
    candidates.sort(key=lambda c: (c[0], not c[2]))
    for _priority, full, named in candidates:
        if _duration_ok(full, named):
            return {'path': full, 'name': os.path.basename(full)}
    return None
