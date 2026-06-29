"""Scanning the filesystem for movies and their subtitles."""

import os

from . import parsing
from .config import SUBTITLE_EXTENSIONS, SUPPORTED_EXTENSIONS


def normalize_path(path: str) -> str:
    normalized = os.path.normpath(path)
    if normalized.startswith('\\') or normalized.startswith('//'):
        normalized = normalized.replace('/', '\\')
    return normalized


def find_movies(folder: str):
    movies = []
    if not os.path.isdir(folder):
        return movies
    for root, _, files in os.walk(folder):
        for file_name in files:
            if file_name.lower().endswith(SUPPORTED_EXTENSIONS):
                full = os.path.join(root, file_name)
                movies.append((parsing.display_title(full), full))
    return sorted(movies, key=lambda item: item[0].lower())


def find_subtitles(file_path: str):
    """Subtitles whose name matches the movie. Returns [] when none match
    (so 'Auto' lets the player auto-detect rather than attaching an unrelated file)."""
    folder = os.path.dirname(file_path)
    movie_base = os.path.splitext(os.path.basename(file_path))[0].lower()
    candidates = []
    try:
        entries = os.listdir(folder)
    except OSError:
        return []
    for entry in entries:
        if os.path.splitext(entry)[1].lower() not in SUBTITLE_EXTENSIONS:
            continue
        subtitle_base = os.path.splitext(entry)[0].lower()
        if subtitle_base == movie_base or subtitle_base.startswith(movie_base + ' ') or movie_base.startswith(subtitle_base + ' '):
            candidates.append(os.path.join(folder, entry))
    return sorted(candidates)
