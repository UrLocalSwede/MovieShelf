"""The JavaScript-facing API bridge (exposed to the webview as ``js_api``).

Every method returns plain JSON-serializable data and never raises across the bridge:
failures are logged and returned as ``{"error": "..."}`` so the frontend can show them.
"""

import functools
import logging
import os

import webview

from .library import find_movies, find_subtitles
from .metadata import get_cover, get_metadata
from .player import play_movie
from .settings import load_folder, load_saved_folders, save_folders

log = logging.getLogger('movieshelf.api')


def _bridge(method):
    """Wrap an API method so exceptions are logged and surfaced as {'error': ...}."""
    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):
        try:
            return method(self, *args, **kwargs)
        except Exception as exc:  # noqa: BLE001 - bridge boundary, must not propagate
            log.exception('API call %s failed', method.__name__)
            return {'error': str(exc)}
    return wrapper


class Api:
    def _movies_payload(self):
        folder = load_folder()
        movies = find_movies(folder)
        if movies:
            save_folders(load_saved_folders(), current_folder=folder)
        return {
            'folder': folder,
            'count': len(movies),
            'movies': [{'title': title, 'path': path} for title, path in movies],
            'folders': load_saved_folders(),
        }

    # -- library ---------------------------------------------------------------
    @_bridge
    def list_state(self):
        return {'folders': load_saved_folders(), 'current': load_folder()}

    @_bridge
    def list_movies(self):
        return self._movies_payload()

    @_bridge
    def set_folder(self, path):
        save_folders([path, *[p for p in load_saved_folders() if p != path]], current_folder=path)
        return self._movies_payload()

    @_bridge
    def choose_folder(self):
        window = webview.active_window()
        if window is None:
            return {'error': 'Window not ready.'}
        result = window.create_file_dialog(webview.FOLDER_DIALOG)
        if not result:
            return {'cancelled': True}
        folder = result[0]
        save_folders([folder, *load_saved_folders()], current_folder=folder)
        return self._movies_payload()

    # -- details & playback ----------------------------------------------------
    @_bridge
    def get_cover(self, path):
        if not path:
            return {}
        return get_cover(path)

    @_bridge
    def get_metadata(self, path):
        if not path:
            return {'error': 'No movie selected.'}
        return get_metadata(path)

    @_bridge
    def refresh_metadata(self, path):
        if not path:
            return {'error': 'No movie selected.'}
        return get_metadata(path, refresh=True)

    @_bridge
    def get_subtitles(self, path):
        return [{'name': os.path.basename(p), 'path': p} for p in find_subtitles(path)]

    @_bridge
    def play(self, path, subtitle_path=''):
        if not path:
            return {'error': 'No movie selected.'}
        player = play_movie(path, subtitle_path or '')
        log.info('Playing %s in %s', path, player)
        return {'player': player}

    @_bridge
    def play_trailer(self, trailer_path):
        if not trailer_path:
            return {'error': 'No trailer available.'}
        player = play_movie(trailer_path)
        log.info('Playing trailer %s in %s', trailer_path, player)
        return {'player': player}
