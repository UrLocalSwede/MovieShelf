"""OMDb client — used to enrich a TMDb match with IMDb / Rotten Tomatoes / Metacritic ratings."""

import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from ..config import load_keys

log = logging.getLogger('movieshelf.omdb')

_OMDB_URL = 'https://www.omdbapi.com/'


def _get(**params) -> dict:
    params['apikey'] = load_keys()['omdb']
    url = _OMDB_URL + '?' + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=20) as response:
        return json.loads(response.read().decode('utf-8'))


def _ratings(payload: dict) -> dict:
    out = {}
    for entry in payload.get('Ratings', []):
        source, value = entry.get('Source'), entry.get('Value')
        if source == 'Internet Movie Database':
            out['imdb'] = value
        elif source == 'Rotten Tomatoes':
            out['rotten_tomatoes'] = value
        elif source == 'Metacritic':
            out['metacritic'] = value
    return out


def fetch_by_imdb(imdb_id: str) -> dict:
    """Return {ratings, country, runtime, imdb_votes} for an IMDb id, or {} on failure."""
    if not imdb_id:
        return {}
    try:
        payload = _get(i=imdb_id)
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, OSError) as exc:
        log.debug('OMDb lookup failed for %s: %s', imdb_id, exc)
        return {}
    if payload.get('Response') != 'True':
        return {}
    return {
        'ratings': _ratings(payload),
        'country': payload.get('Country', ''),
        'runtime': payload.get('Runtime', ''),
        'imdb_votes': payload.get('imdbVotes', ''),
    }
