"""Media fingerprinting via pymediainfo (duration, resolution, embedded title)."""

import logging
import os

log = logging.getLogger('movieshelf.fingerprint')

try:
    from pymediainfo import MediaInfo
    _HAS_MEDIAINFO = MediaInfo.can_parse()
except Exception:  # pragma: no cover - native lib may be missing
    _HAS_MEDIAINFO = False


def _resolution_label(height) -> str:
    if not height:
        return ''
    height = int(height)
    if height >= 2000:
        return '2160p'
    if height >= 1400:
        return '1440p'
    if height >= 1000:
        return '1080p'
    if height >= 700:
        return '720p'
    if height >= 540:
        return '576p'
    return f'{height}p'


def probe(path: str) -> dict:
    """Best-effort media fingerprint. Returns {} if MediaInfo is unavailable or fails."""
    if not _HAS_MEDIAINFO or not os.path.isfile(path):
        return {}
    try:
        info = MediaInfo.parse(path)
    except Exception as exc:
        log.debug('MediaInfo failed for %s: %s', path, exc)
        return {}

    general = next((t for t in info.tracks if t.track_type == 'General'), None)
    video = next((t for t in info.tracks if t.track_type == 'Video'), None)

    duration_min = None
    if general and general.duration:
        try:
            duration_min = round(float(general.duration) / 60000.0, 1)  # ms -> minutes
        except (TypeError, ValueError):
            duration_min = None

    width = getattr(video, 'width', None) if video else None
    height = getattr(video, 'height', None) if video else None

    return {
        'duration_min': duration_min,
        'width': int(width) if width else None,
        'height': int(height) if height else None,
        'resolution': _resolution_label(height),
        'container': (getattr(general, 'format', '') or '') if general else '',
        'embedded_title': (getattr(general, 'title', '') or '') if general else '',
    }
