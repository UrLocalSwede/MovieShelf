'use strict';

const $ = (id) => document.getElementById(id);

const state = {
  movies: [],
  current: '',
  selected: null,
  subtitles: [],
  meta: null,
  detailToken: 0,
};

const FILM_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="14" rx="3"/>' +
  '<path d="M10 11.5 L15 14 L10 16.5 Z"/></svg>';

const RATING_LABELS = { imdb: 'IMDb', rotten_tomatoes: 'RT', metacritic: 'Metacritic', tmdb: 'TMDb' };

const coverCache = new Map();     // path -> data URI
const coverAttempted = new Set(); // paths we've already tried (avoid refetch on filter)
let coverGen = 0;                 // bumped on folder change to cancel in-flight loads

function api() { return window.pywebview.api; }
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/* ---------- sidebar + grid ---------- */
function renderSidebar(folders, current) {
  $('current-folder').textContent = current || '—';
  const list = $('library-list');
  list.innerHTML = '';
  (folders || []).forEach((folder) => {
    const li = el('li', folder === current ? 'active' : '', folder);
    li.addEventListener('click', () => switchFolder(folder));
    list.appendChild(li);
  });
}

function renderGrid() {
  const query = $('search').value.trim().toLowerCase();
  const filtered = state.movies.filter((m) => m.title.toLowerCase().includes(query));
  const grid = $('grid');
  grid.innerHTML = '';
  $('stat-count').textContent = state.movies.length;
  $('empty').classList.toggle('hidden', state.movies.length !== 0);

  state.cardByPath = new Map();
  filtered.forEach((movie) => {
    const card = el('div', 'movie');
    if (state.selected && state.selected.path === movie.path) card.classList.add('active');
    card.innerHTML = `<div class="movie-art">${FILM_SVG}</div><div class="movie-title"></div>`;
    card.querySelector('.movie-title').textContent = movie.title;
    card.addEventListener('click', () => selectMovie(movie, card));
    if (coverCache.has(movie.path)) setCardCover(card, coverCache.get(movie.path));
    state.cardByPath.set(movie.path, card);
    grid.appendChild(card);
  });
  ensureCovers(filtered);
}

function setCardCover(card, uri) {
  const art = card.querySelector('.movie-art');
  art.innerHTML = '';
  const img = el('img', 'movie-cover');
  img.src = uri;
  img.alt = '';
  art.appendChild(img);
}

async function ensureCovers(movies) {
  const gen = coverGen;
  const todo = movies.filter((m) => !coverCache.has(m.path) && !coverAttempted.has(m.path));
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      if (gen !== coverGen) return;
      const movie = todo[i++];
      coverAttempted.add(movie.path);
      let res;
      try { res = await api().get_cover(movie.path); } catch (e) { continue; }
      if (gen !== coverGen) return;
      if (res && res.poster) {
        coverCache.set(movie.path, res.poster);
        const card = state.cardByPath.get(movie.path);
        if (card) setCardCover(card, res.poster);
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}

/* ---------- data loading ---------- */
async function loadMovies(payload) {
  coverGen++; // cancel cover loads from a previous folder
  if (!payload) {
    $('grid').innerHTML = '<div class="grid-loading"><span class="spin-inline"></span>Scanning library…</div>';
  }
  const data = payload || (await api().list_movies());
  if (data.error) { console.error(data.error); $('grid').innerHTML = ''; return; }
  state.movies = data.movies || [];
  state.current = data.folder || '';
  renderSidebar(data.folders, data.current || data.folder);
  renderGrid();
}

async function refresh() { await loadMovies(); }

async function switchFolder(folder) {
  closeDetail();
  await loadMovies(await api().set_folder(folder));
}

async function addFolder() {
  const data = await api().choose_folder();
  if (data && data.cancelled) return;
  if (data && data.error) { console.error(data.error); return; }
  closeDetail();
  await loadMovies(data);
}

/* ---------- selection + detail ---------- */
async function selectMovie(movie, card) {
  state.selected = movie;
  document.querySelectorAll('.movie.active').forEach((e) => e.classList.remove('active'));
  if (card) card.classList.add('active');
  openDetail();

  const token = ++state.detailToken;
  showLoading('Identifying movie & searching databases…');
  resetDetail(movie);

  const [subs, meta] = await Promise.all([
    api().get_subtitles(movie.path),
    api().get_metadata(movie.path),
  ]);
  if (token !== state.detailToken) return;

  populateSubtitles(Array.isArray(subs) ? subs : []);
  state.meta = meta;
  renderDetail(meta);
  hideLoading();
}

async function rematch() {
  if (!state.selected) return;
  const token = ++state.detailToken;
  showLoading('Re-matching…');
  const meta = await api().refresh_metadata(state.selected.path);
  if (token !== state.detailToken) return;
  state.meta = meta;
  renderDetail(meta);
  hideLoading();
}

function resetDetail(movie) {
  $('backdrop').style.backgroundImage = '';
  showPoster(null);
  $('d-title').textContent = movie.title;
  $('d-tagline').textContent = '';
  $('d-facts').innerHTML = '';
  $('d-ratings').innerHTML = '';
  $('d-genres').innerHTML = '';
  $('d-overview').textContent = '';
  $('collection').classList.add('hidden');
  $('play-status').textContent = '';
  $('play-status').classList.remove('error');
}

function renderDetail(meta) {
  if (!meta || meta.error) {
    $('d-overview').textContent = (meta && meta.error) || 'Something went wrong.';
    return;
  }
  if (meta.needs_key) {
    $('d-title').textContent = (meta.parsed && meta.parsed.title) || $('d-title').textContent;
    $('d-overview').textContent = meta.message;
    return;
  }

  $('backdrop').style.backgroundImage = meta.backdrop ? `url("${meta.backdrop}")` : '';
  showPoster(meta.poster);

  const year = meta.year ? ` (${meta.year})` : '';
  $('d-title').textContent = (meta.title || '') + year;
  $('d-tagline').textContent = meta.tagline || '';

  // Facts row: runtime, country, match confidence.
  const facts = $('d-facts');
  facts.innerHTML = '';
  if (meta.runtime) facts.appendChild(el('span', '', `${meta.runtime} min`));
  if (meta.countries && meta.countries.length) facts.appendChild(el('span', '', meta.countries.join(', ')));
  if (meta.fingerprint && meta.fingerprint.resolution) facts.appendChild(el('span', '', meta.fingerprint.resolution));
  facts.appendChild(matchNote(meta));

  // Ratings.
  const ratings = $('d-ratings');
  ratings.innerHTML = '';
  const r = meta.ratings || {};
  ['imdb', 'rotten_tomatoes', 'metacritic', 'tmdb'].forEach((k) => {
    if (!r[k]) return;
    const badge = el('div', 'rating');
    badge.appendChild(el('span', 'src', RATING_LABELS[k]));
    badge.appendChild(el('span', 'val', r[k]));
    ratings.appendChild(badge);
  });

  // Genres.
  const genres = $('d-genres');
  genres.innerHTML = '';
  (meta.genres || []).forEach((g) => genres.appendChild(el('span', 'chip', g)));

  $('d-overview').textContent = meta.overview || 'No description available.';

  renderCollection(meta);
  renderTrailerButton(meta);
}

function matchNote(meta) {
  if (!meta.matched) return el('span', 'warn', 'No online match — Re-match?');
  const pct = Math.round((meta.confidence || 0) * 100);
  const label = pct >= 85 ? 'Strong match' : pct >= 60 ? 'Likely match' : 'Low confidence';
  const span = el('span', pct >= 60 ? 'confidence' : 'warn', `${label} · ${pct}%`);
  return span;
}

function renderCollection(meta) {
  const wrap = $('collection');
  const c = meta.collection;
  if (!c || !c.parts || !c.parts.length) { wrap.classList.add('hidden'); return; }
  $('collection-name').textContent = c.name || 'Collection';
  const row = $('collection-row');
  row.innerHTML = '';
  c.parts.forEach((part) => {
    const item = el('div', 'coll-item');
    if (meta.title && part.title === meta.title) item.classList.add('current');
    const art = el('div', 'coll-art');
    if (part.poster) {
      const img = el('img');
      img.src = part.poster;
      img.alt = part.title || '';
      art.appendChild(img);
    } else {
      art.appendChild(el('div', 'ph', part.title || '?'));
    }
    item.appendChild(art);
    item.appendChild(el('div', 'coll-title', part.title || ''));
    if (part.year) item.appendChild(el('div', 'coll-year', String(part.year)));
    row.appendChild(item);
  });
  wrap.classList.remove('hidden');
}

function renderTrailerButton(meta) {
  const btn = $('trailer');
  if (meta.trailer && meta.trailer.path) {
    btn.disabled = false;
    btn.textContent = 'Watch trailer';
    btn.title = meta.trailer.name || '';
  } else {
    btn.disabled = true;
    btn.textContent = 'No trailer available';
    btn.title = '';
  }
}

function populateSubtitles(subs) {
  state.subtitles = subs;
  const select = $('subtitle');
  select.innerHTML = '<option value="">Auto</option>';
  subs.forEach((s) => {
    const opt = el('option', '', s.name);
    opt.value = s.path;
    select.appendChild(opt);
  });
}

function showPoster(url) {
  const img = $('poster');
  const fb = $('poster-fallback');
  if (url) {
    img.src = url;
    img.classList.remove('hidden');
    fb.classList.add('hidden');
    img.onerror = () => { img.classList.add('hidden'); fb.classList.remove('hidden'); };
  } else {
    img.classList.add('hidden');
    img.removeAttribute('src');
    fb.classList.remove('hidden');
  }
}

/* ---------- playback ---------- */
async function play() {
  if (!state.selected) return;
  const subtitle = $('subtitle').value || (state.subtitles[0] ? state.subtitles[0].path : '');
  const status = $('play-status');
  status.classList.remove('error');
  status.innerHTML = '<span class="spin-inline"></span>Launching…';
  const result = await api().play(state.selected.path, subtitle);
  if (result && result.player) status.textContent = `Playing in ${result.player}.`;
  else { status.classList.add('error'); status.textContent = (result && result.error) || 'Unable to open the movie.'; }
}

async function stopPlayback() {
  await api().stop_playback();
  const status = $('play-status');
  status.classList.remove('error');
  status.textContent = 'Stopped.';
}

async function playTrailer() {
  if (!state.meta || !state.meta.trailer) return;
  const status = $('play-status');
  status.classList.remove('error');
  status.innerHTML = '<span class="spin-inline"></span>Launching trailer…';
  const result = await api().play_trailer(state.meta.trailer.path);
  if (result && result.player) status.textContent = `Playing trailer in ${result.player}.`;
  else { status.classList.add('error'); status.textContent = (result && result.error) || 'Unable to open the trailer.'; }
}

/* ---------- detail overlay ---------- */
function showLoading(text) { $('loading-text').textContent = text; $('detail-loading').classList.add('show'); }
function hideLoading() { $('detail-loading').classList.remove('show'); }

function openDetail() {
  $('detail').classList.add('open');
  $('detail').setAttribute('aria-hidden', 'false');
  $('scrim').classList.remove('hidden');
}
function closeDetail() {
  state.detailToken++; // cancel any in-flight render
  $('detail').classList.remove('open');
  $('detail').setAttribute('aria-hidden', 'true');
  $('scrim').classList.add('hidden');
  hideLoading();
  state.selected = null;
  state.meta = null;
  document.querySelectorAll('.movie.active').forEach((e) => e.classList.remove('active'));
}

/* ---------- wiring ---------- */
function init() {
  $('search').addEventListener('input', renderGrid);
  $('refresh').addEventListener('click', refresh);
  $('add-folder').addEventListener('click', addFolder);
  $('play').addEventListener('click', play);
  $('stop').addEventListener('click', stopPlayback);
  $('trailer').addEventListener('click', playTrailer);
  $('rematch').addEventListener('click', rematch);
  $('detail-close').addEventListener('click', closeDetail);
  $('scrim').addEventListener('click', closeDetail);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });
  loadMovies();
}

if (window.pywebview && window.pywebview.api) init();
else window.addEventListener('pywebviewready', init);
