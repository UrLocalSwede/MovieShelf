"""Locating VLC and launching playback."""

import os
import subprocess

from .library import normalize_path

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


def play_movie(file_path: str, subtitle_path: str = '') -> str:
    vlc_path = find_vlc_executable()
    fixed_path = normalize_path(file_path)
    if vlc_path:
        command = [vlc_path, fixed_path]
        if subtitle_path:
            command += ['--sub-file', normalize_path(subtitle_path)]
        subprocess.Popen(command, shell=False)
        return 'VLC'
    if os.name == 'nt' and hasattr(os, 'startfile'):
        os.startfile(fixed_path)
        return 'default player'
    raise RuntimeError('No compatible player found.')
