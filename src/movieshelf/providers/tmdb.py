"""TheMovieDB (TMDb) client — search, details, collections, images."""

import json
import urllib.error
import urllib.parse
import urllib.request

from ..config import TMDB_API_BASE, TMDB_IMAGE_BASE


def _get(endpoint: str, key: str, **params) -> dict:
    params['api_key'] = key
    url = f'{TMDB_API_BASE}{endpoint}?' + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=20) as response:
        return json.loads(response.read().decode('utf-8'))


def search(title: str, key: str, year=None):
    params = {'query': title, 'include_adult': 'false'}
    if year:
        params['year'] = year
    return _get('/search/movie', key, **params).get('results', [])


def details(movie_id, key: str) -> dict:
    return _get(
        f'/movie/{movie_id}', key,
        append_to_response='images,release_dates,external_ids',
        include_image_language='en,null',
    )


def collection(collection_id, key: str) -> dict:
    return _get(f'/collection/{collection_id}', key)


def image_url(path: str, size: str) -> str:
    if not path:
        return ''
    return f'{TMDB_IMAGE_BASE}/{size}{path}'


def download(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=20) as response:
        return response.read()
