"""Playback via an embedded, bundled mpv engine (with a VLC / default-player fallback).

mpv (libmpv) plays virtually any container/codec natively with no transcoding, and provides its
own on-screen controls and keybindings. We keep one reusable MPV core and load files into it.
"""

import logging
import os

from .config import libmpv_dir
from .library import normalize_path

log = logging.getLogger('movieshelf.player')

# python-mpv finds the DLL via %PATH%, so prepend our bundled location before importing it.
_dll_dir = str(libmpv_dir())
if _dll_dir not in os.environ.get('PATH', ''):
    os.environ['PATH'] = _dll_dir + os.pathsep + os.environ.get('PATH', '')

try:
    import mpv  # noqa: E402  (must follow the PATH tweak above)
    _HAS_MPV = True
except Exception as exc:  # pragma: no cover - DLL missing / load failure
    log.warning('libmpv unavailable, falling back to external player: %s', exc)
    _HAS_MPV = False

_player = None  # singleton MPV core

_VLC_CANDIDATES = (
    r'C:\Program Files\VideoLAN\VLC\vlc.exe',
    r'C:\Program Files (x86)\VideoLAN\VLC\vlc.exe',
    r'C:\Program Files\VLC\vlc.exe',
    r'C:\Program Files (x86)\VLC\vlc.exe',
)


def find_vlc_executable():
    for candidate in _VLC_CANDIDATES:
        if os.path.exists(candidate):
            return candidate
    return None


def _get_player():
    """Return a live MPV core, (re)creating it if needed (e.g. after the user pressed 'q')."""
    global _player
    if _player is not None:
        try:
            _ = _player.idle_active  # touch a property; raises if the core was shut down
            return _player
        except Exception:
            _player = None

    _player = mpv.MPV(
        osc=True,                      # on-screen controller (seek bar, buttons)
        input_default_bindings=True,   # space/arrows/f/q etc.
        input_vo_keyboard=True,
        force_window='immediate',
        title='MovieShelf Player',
        hwdec='auto-safe',
        ytdl=False,
    )
    return _player


def _play_with_mpv(file_path: str, subtitle_path: str) -> None:
    player = _get_player()
    player.play(normalize_path(file_path))
    if subtitle_path:
        # Load the chosen subtitle once the file is playing.
        try:
            player.sub_add(normalize_path(subtitle_path))
        except Exception as exc:
            log.debug('Could not add subtitle: %s', exc)


def play_movie(file_path: str, subtitle_path: str = '') -> str:
    """Play a file. Prefers bundled mpv; falls back to installed VLC, then the OS default."""
    if _HAS_MPV:
        try:
            _play_with_mpv(file_path, subtitle_path)
            return 'mpv'
        except Exception as exc:
            log.exception('mpv playback failed, falling back: %s', exc)

    fixed_path = normalize_path(file_path)
    vlc_path = find_vlc_executable()
    if vlc_path:
        import subprocess
        command = [vlc_path, fixed_path]
        if subtitle_path:
            command += ['--sub-file', normalize_path(subtitle_path)]
        subprocess.Popen(command, shell=False)
        return 'VLC'
    if os.name == 'nt' and hasattr(os, 'startfile'):
        os.startfile(fixed_path)
        return 'default player'
    raise RuntimeError('No compatible player found.')


def stop() -> None:
    """Stop current playback (leaves the idle mpv window open)."""
    if _player is not None:
        try:
            _player.command('stop')
        except Exception as exc:
            log.debug('mpv stop failed: %s', exc)


def shutdown() -> None:
    """Terminate the mpv core (call on app exit)."""
    global _player
    if _player is not None:
        try:
            _player.terminate()
        except Exception:
            pass
        _player = None


def has_mpv() -> bool:
    return _HAS_MPV
