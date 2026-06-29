"""Metadata orchestration: parse -> fingerprint -> match -> enrich -> cache.

Runs only when a movie is selected. Results (and artwork) are cached under
``%APPDATA%\\MovieShelf\\cache`` so repeat selections are instant and work offline.
"""

import logging

from . import cache, fingerprint, matching, parsing, trailers
from .config import (
    TMDB_BACKDROP_SIZE,
    TMDB_COLLECTION_POSTER_SIZE,
    TMDB_COVER_SIZE,
    TMDB_POSTER_SIZE,
    load_keys,
)
from .providers import omdb, tmdb

log = logging.getLogger('movieshelf.metadata')

_TOP_N = 3            # candidates we fetch full details for
_MAX_COLLECTION = 24  # collection parts to cache/show


def get_metadata(path: str, refresh: bool = False) -> dict:
    if not refresh:
        cached = cache.load(path)
        if cached:
            return _attach_images(path, cached)

    keys = load_keys()
    parsed = parsing.parse(path)
    fp = fingerprint.probe(path)

    if not keys['tmdb']:
        return {
            'needs_key': True,
            'message': 'Add your free TMDb API key to enable online matching '
                       '(set TMDB_API_KEY, or tmdb_api_key in config.json).',
            'parsed': parsed,
            'fingerprint': fp,
        }

    meta = _match_and_build(path, parsed, fp, keys['tmdb'])
    cache.save(path, meta)
    return _attach_images(path, meta)


def get_cover(path: str) -> dict:
    """Lightweight grid cover: cached poster if present, else one TMDb search + poster download.

    Cheaper than full matching (no details/OMDb/collection). Only returns a poster when the title
    match is confident enough, so the grid shows a placeholder rather than a wrong cover.
    """
    cached = cache.image_data_uri(path, 'poster.jpg')
    if cached:
        return {'poster': cached}

    keys = load_keys()
    if not keys['tmdb']:
        return {}
    parsed = parsing.parse(path)
    try:
        results = tmdb.search(parsed['title'], keys['tmdb'], year=parsed['year'])
        if not results and parsed['year']:
            results = tmdb.search(parsed['title'], keys['tmdb'])
    except Exception as exc:
        log.debug('Cover search failed for %r: %s', parsed['title'], exc)
        return {}
    if not results:
        return {}

    best = max(results, key=lambda r: matching.prescore(r, parsed))
    if matching.title_ratio(parsed['title'], best) < 0.6 or not best.get('poster_path'):
        return {}
    try:
        data = tmdb.download(tmdb.image_url(best['poster_path'], TMDB_COVER_SIZE))
        cache.save_image(path, 'poster.jpg', data)
    except Exception as exc:
        log.debug('Cover download failed: %s', exc)
        return {}
    return {'poster': cache.image_data_uri(path, 'poster.jpg')}


def _match_and_build(path, parsed, fp, tmdb_key) -> dict:
    base = {'matched': False, 'confidence': 0.0, 'parsed': parsed, 'fingerprint': fp,
            'title': parsed['title'], 'year': parsed['year'], 'trailer': trailers.find_trailer(path)}

    try:
        results = tmdb.search(parsed['title'], tmdb_key, year=parsed['year'])
        if not results and parsed['year']:
            results = tmdb.search(parsed['title'], tmdb_key)
    except Exception as exc:
        log.warning('TMDb search failed for %r: %s', parsed['title'], exc)
        return base
    if not results:
        return base

    ranked = sorted(results, key=lambda r: matching.prescore(r, parsed), reverse=True)[:_TOP_N]
    best, best_score = None, -1.0
    for candidate in ranked:
        try:
            detail = tmdb.details(candidate['id'], tmdb_key)
        except Exception as exc:
            log.debug('TMDb details failed for %s: %s', candidate.get('id'), exc)
            continue
        score = matching.final_score(detail, parsed, fp)
        if score > best_score:
            best, best_score = detail, score

    if not best:
        return base

    return _build_meta(path, parsed, fp, best, best_score, tmdb_key)


def _build_meta(path, parsed, fp, d, confidence, tmdb_key) -> dict:
    imdb_id = (d.get('external_ids') or {}).get('imdb_id', '') or ''
    ratings = {}
    countries = [c['name'] for c in d.get('production_countries', []) if c.get('name')]

    enrich = omdb.fetch_by_imdb(imdb_id) if imdb_id else {}
    ratings.update(enrich.get('ratings', {}))
    if enrich.get('country') and not countries:
        countries = [enrich['country']]
    if d.get('vote_average'):
        ratings['tmdb'] = f"{round(d['vote_average'], 1)}/10"

    meta = {
        'matched': True,
        'confidence': round(confidence, 3),
        'title': d.get('title') or parsed['title'],
        'year': matching.candidate_year(d) or parsed['year'],
        'tagline': d.get('tagline', ''),
        'overview': d.get('overview', ''),
        'genres': [g['name'] for g in d.get('genres', []) if g.get('name')],
        'runtime': d.get('runtime'),
        'countries': countries,
        'ratings': ratings,
        'ids': {'tmdb': d.get('id'), 'imdb': imdb_id},
        'parsed': parsed,
        'fingerprint': fp,
        'poster_file': _cache_image(path, d.get('poster_path'), TMDB_POSTER_SIZE, 'poster.jpg', tmdb_key),
        'backdrop_file': _cache_image(path, d.get('backdrop_path'), TMDB_BACKDROP_SIZE, 'backdrop.jpg', tmdb_key),
        'collection': _build_collection(path, d.get('belongs_to_collection'), tmdb_key),
        'trailer': trailers.find_trailer(path),
    }
    return meta


def _build_collection(path, collection_ref, tmdb_key):
    if not collection_ref:
        return None
    try:
        data = tmdb.collection(collection_ref['id'], tmdb_key)
    except Exception as exc:
        log.debug('Collection fetch failed: %s', exc)
        return {'name': collection_ref.get('name', ''), 'parts': []}

    parts = []
    items = sorted(data.get('parts', []), key=lambda p: p.get('release_date') or '')
    for i, part in enumerate(items[:_MAX_COLLECTION]):
        year = matching.candidate_year(part)
        poster_file = _cache_image(
            path, part.get('poster_path'), TMDB_COLLECTION_POSTER_SIZE, f'coll_{i}.jpg', tmdb_key,
        )
        parts.append({'title': part.get('title', ''), 'year': year, 'poster_file': poster_file})
    return {'name': data.get('name', collection_ref.get('name', '')), 'parts': parts}


def _cache_image(path, tmdb_path, size, filename, tmdb_key) -> str:
    if not tmdb_path:
        return ''
    try:
        data = tmdb.download(tmdb.image_url(tmdb_path, size))
        return cache.save_image(path, filename, data)
    except Exception as exc:
        log.debug('Image download failed (%s): %s', filename, exc)
        return ''


def _attach_images(path, meta) -> dict:
    """Return a copy with base64 data URIs for cached images (for the frontend)."""
    out = dict(meta)
    out['poster'] = cache.image_data_uri(path, meta.get('poster_file', ''))
    out['backdrop'] = cache.image_data_uri(path, meta.get('backdrop_file', ''))
    collection = meta.get('collection')
    if collection and collection.get('parts'):
        parts = []
        for part in collection['parts']:
            p = dict(part)
            p['poster'] = cache.image_data_uri(path, part.get('poster_file', ''))
            parts.append(p)
        out['collection'] = {**collection, 'parts': parts}
    return out
