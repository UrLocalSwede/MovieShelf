"""Scoring TMDb candidates against the parsed filename + media fingerprint."""

from difflib import SequenceMatcher


def _norm(text) -> str:
    return (text or '').strip().lower()


def _ratio(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, _norm(a), _norm(b)).ratio()


def title_ratio(parsed_title: str, candidate: dict) -> float:
    """Best title similarity across TMDb's localized and original titles."""
    names = [candidate.get('title'), candidate.get('original_title'), candidate.get('name')]
    return max((_ratio(parsed_title, n) for n in names if n), default=0.0)


def candidate_year(candidate: dict):
    date = candidate.get('release_date') or ''
    if len(date) >= 4 and date[:4].isdigit():
        return int(date[:4])
    return None


def _year_score(parsed_year, cand_year) -> float:
    if not parsed_year or not cand_year:
        return 0.5  # neutral when unknown
    diff = abs(parsed_year - cand_year)
    if diff == 0:
        return 1.0
    if diff == 1:
        return 0.6
    return 0.0


def _runtime_score(fp_minutes, cand_runtime) -> float:
    if not fp_minutes or not cand_runtime:
        return 0.5  # neutral when unknown
    diff = abs(fp_minutes - cand_runtime)
    if diff <= 3:
        return 1.0
    if diff <= 8:
        return 0.7
    if diff <= 15:
        return 0.4
    return 0.1


def prescore(candidate: dict, parsed: dict) -> float:
    """Cheap ranking of search hits using only title + year (no extra API calls)."""
    t = title_ratio(parsed.get('title', ''), candidate)
    y = _year_score(parsed.get('year'), candidate_year(candidate))
    pop = min(candidate.get('popularity', 0) / 100.0, 1.0)
    return 0.78 * t + 0.20 * y + 0.02 * pop


def final_score(details: dict, parsed: dict, fp: dict) -> float:
    """Full score for a fetched detail record, including runtime + language signals."""
    t = title_ratio(parsed.get('title', ''), details)
    y = _year_score(parsed.get('year'), candidate_year(details))
    r = _runtime_score(fp.get('duration_min'), details.get('runtime'))

    lang = 0.5
    parsed_lang = _norm(parsed.get('language'))
    if parsed_lang and details.get('original_language'):
        lang = 1.0 if parsed_lang.startswith(_norm(details['original_language'])) else 0.3

    return round(0.60 * t + 0.18 * y + 0.17 * r + 0.05 * lang, 4)
