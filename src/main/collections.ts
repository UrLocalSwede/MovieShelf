// Browsable franchise/collection grouping for the library grid's banner strip.
//
// Two sources are combined:
//  1. A curated table of famous franchises (MCU, DCEU, Wizarding World, …) matched to the user's
//     local files by canonical title. Works fully offline — no TMDb/network needed — and can
//     represent umbrella franchises (the MCU spans many TMDb collections, so it can't come from
//     belongs_to_collection alone).
//  2. Auto-detected TMDb collections, read from each movie's cached belongs_to_collection name, for
//     movies not already claimed by a curated franchise. Only as complete as what's been cached.
//
// Every group is themed (a two-stop gradient) so the renderer stays purely presentational. Curated
// groups carry hand-picked colors; auto groups derive a stable color pair from their name.

import type { CollectionGroup, Movie } from '../../shared/types'
import { currentMovies } from './view'
import { canonicalTitle } from './matching'
import * as parsing from './parsing'
import * as cache from './cache'

interface CuratedDef {
  key: string
  title: string
  colors: [string, string]
  titles: string[]
}

// Famous franchises. `titles` are human-readable; matching is punctuation/article/'&'-insensitive
// via canonicalTitle(), so "Avengers: Endgame" in a filename matches "Avengers Endgame" here.
const CURATED: CuratedDef[] = [
  {
    key: 'mcu',
    title: 'Marvel Cinematic Universe',
    colors: ['#b0060f', '#f5a623'],
    titles: [
      'Iron Man',
      'The Incredible Hulk',
      'Iron Man 2',
      'Thor',
      'Captain America: The First Avenger',
      'The Avengers',
      'Iron Man 3',
      'Thor: The Dark World',
      'Captain America: The Winter Soldier',
      'Guardians of the Galaxy',
      'Avengers: Age of Ultron',
      'Ant-Man',
      'Captain America: Civil War',
      'Doctor Strange',
      'Guardians of the Galaxy Vol. 2',
      'Spider-Man: Homecoming',
      'Thor: Ragnarok',
      'Black Panther',
      'Avengers: Infinity War',
      'Ant-Man and the Wasp',
      'Captain Marvel',
      'Avengers: Endgame',
      'Spider-Man: Far From Home',
      'Black Widow',
      'Shang-Chi and the Legend of the Ten Rings',
      'Eternals',
      'Spider-Man: No Way Home',
      'Doctor Strange in the Multiverse of Madness',
      'Thor: Love and Thunder',
      'Black Panther: Wakanda Forever',
      'Ant-Man and the Wasp: Quantumania',
      'Guardians of the Galaxy Vol. 3',
      'The Marvels',
      'Deadpool & Wolverine',
      'Captain America: Brave New World'
    ]
  },
  {
    key: 'dceu',
    title: 'DC Universe',
    colors: ['#0b3d91', '#1f2937'],
    titles: [
      'Man of Steel',
      'Batman v Superman: Dawn of Justice',
      'Suicide Squad',
      'Wonder Woman',
      'Justice League',
      'Aquaman',
      'Shazam!',
      'Birds of Prey',
      'Wonder Woman 1984',
      'Zack Snyder’s Justice League',
      'The Suicide Squad',
      'Black Adam',
      'Shazam! Fury of the Gods',
      'The Flash',
      'Blue Beetle',
      'Aquaman and the Lost Kingdom',
      'The Batman',
      'Joker',
      'Joker: Folie à Deux',
      'Superman'
    ]
  },
  {
    key: 'wizarding-world',
    title: 'Wizarding World',
    colors: ['#3a2410', '#c9a227'],
    titles: [
      "Harry Potter and the Philosopher's Stone",
      "Harry Potter and the Sorcerer's Stone",
      'Harry Potter and the Chamber of Secrets',
      'Harry Potter and the Prisoner of Azkaban',
      'Harry Potter and the Goblet of Fire',
      'Harry Potter and the Order of the Phoenix',
      'Harry Potter and the Half-Blood Prince',
      'Harry Potter and the Deathly Hallows: Part 1',
      'Harry Potter and the Deathly Hallows: Part 2',
      'Fantastic Beasts and Where to Find Them',
      'Fantastic Beasts: The Crimes of Grindelwald',
      'Fantastic Beasts: The Secrets of Dumbledore'
    ]
  },
  {
    key: 'star-wars',
    title: 'Star Wars',
    colors: ['#0a0a0a', '#f5c518'],
    titles: [
      'Star Wars',
      'Star Wars: Episode I - The Phantom Menace',
      'Star Wars: Episode II - Attack of the Clones',
      'Star Wars: Episode III - Revenge of the Sith',
      'Star Wars: Episode IV - A New Hope',
      'Star Wars: Episode V - The Empire Strikes Back',
      'Star Wars: Episode VI - Return of the Jedi',
      'Star Wars: Episode VII - The Force Awakens',
      'Star Wars: Episode VIII - The Last Jedi',
      'Star Wars: Episode IX - The Rise of Skywalker',
      'The Empire Strikes Back',
      'Return of the Jedi',
      'The Phantom Menace',
      'Attack of the Clones',
      'Revenge of the Sith',
      'The Force Awakens',
      'The Last Jedi',
      'The Rise of Skywalker',
      'Rogue One: A Star Wars Story',
      'Solo: A Star Wars Story'
    ]
  },
  {
    key: 'middle-earth',
    title: 'Middle-earth',
    colors: ['#1f3d2b', '#b8912e'],
    titles: [
      'The Lord of the Rings: The Fellowship of the Ring',
      'The Lord of the Rings: The Two Towers',
      'The Lord of the Rings: The Return of the King',
      'The Hobbit: An Unexpected Journey',
      'The Hobbit: The Desolation of Smaug',
      'The Hobbit: The Battle of the Five Armies'
    ]
  },
  {
    key: 'fast-furious',
    title: 'The Fast Saga',
    colors: ['#101418', '#2e8bff'],
    titles: [
      'The Fast and the Furious',
      '2 Fast 2 Furious',
      'The Fast and the Furious: Tokyo Drift',
      'Fast & Furious',
      'Fast Five',
      'Fast & Furious 6',
      'Furious 7',
      'The Fate of the Furious',
      'F9',
      'Fast X'
    ]
  },
  {
    key: 'john-wick',
    title: 'John Wick',
    colors: ['#111827', '#7c3aed'],
    titles: ['John Wick', 'John Wick: Chapter 2', 'John Wick: Chapter 3 - Parabellum', 'John Wick: Chapter 4']
  },
  {
    key: 'jurassic',
    title: 'Jurassic Park',
    colors: ['#14361f', '#e0a11a'],
    titles: [
      'Jurassic Park',
      'The Lost World: Jurassic Park',
      'Jurassic Park III',
      'Jurassic World',
      'Jurassic World: Fallen Kingdom',
      'Jurassic World Dominion'
    ]
  },
  {
    key: 'mission-impossible',
    title: 'Mission: Impossible',
    colors: ['#0b0b0b', '#d11f2d'],
    titles: [
      'Mission: Impossible',
      'Mission: Impossible II',
      'Mission: Impossible III',
      'Mission: Impossible - Ghost Protocol',
      'Mission: Impossible - Rogue Nation',
      'Mission: Impossible - Fallout',
      'Mission: Impossible - Dead Reckoning Part One',
      'Mission: Impossible - The Final Reckoning'
    ]
  },
  {
    key: 'pirates',
    title: 'Pirates of the Caribbean',
    colors: ['#0e2a33', '#c9a227'],
    titles: [
      'Pirates of the Caribbean: The Curse of the Black Pearl',
      "Pirates of the Caribbean: Dead Man's Chest",
      "Pirates of the Caribbean: At World's End",
      'Pirates of the Caribbean: On Stranger Tides',
      'Pirates of the Caribbean: Dead Men Tell No Tales'
    ]
  },
  {
    key: 'matrix',
    title: 'The Matrix',
    colors: ['#04140a', '#22c55e'],
    titles: ['The Matrix', 'The Matrix Reloaded', 'The Matrix Revolutions', 'The Matrix Resurrections']
  }
]

// canonical member title -> curated key (built once at module load).
const CURATED_INDEX = new Map<string, string>()
const CURATED_BY_KEY = new Map<string, CuratedDef>()
for (const def of CURATED) {
  CURATED_BY_KEY.set(def.key, def)
  for (const t of def.titles) {
    const canon = canonicalTitle(t)
    if (canon && !CURATED_INDEX.has(canon)) CURATED_INDEX.set(canon, def.key)
  }
}

const MIN_MEMBERS = 2

/** Deterministic two-stop gradient for an auto-detected collection, derived from its name. */
function autoColors(name: string): [string, string] {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const hue = h % 360
  return [`hsl(${hue} 55% 22%)`, `hsl(${(hue + 40) % 360} 60% 42%)`]
}

/**
 * Group the current library's movies into themed collections (curated franchises first, then
 * auto-detected TMDb collections). Only groups with at least MIN_MEMBERS owned movies are returned.
 * Read-only: no network, no cache writes.
 */
export function listCollections(): CollectionGroup[] {
  const movies = currentMovies()

  const curatedBuckets = new Map<string, Movie[]>()
  const autoBuckets = new Map<string, { title: string; movies: Movie[] }>()

  for (const m of movies) {
    const movie: Movie = { title: m.title, path: m.path }

    // Curated: match the parsed (year-less) title against the famous-franchise index.
    const canon = canonicalTitle(parsing.parse(m.path).title)
    const curatedKey = canon ? CURATED_INDEX.get(canon) : undefined
    if (curatedKey) {
      const arr = curatedBuckets.get(curatedKey) ?? []
      arr.push(movie)
      curatedBuckets.set(curatedKey, arr)
      continue
    }

    // Auto: fall back to the cached TMDb collection name (present only for fetched movies).
    const name = cache.load(m.path)?.collection?.name
    if (name) {
      const canonName = canonicalTitle(name)
      if (!canonName) continue
      const bucket = autoBuckets.get(canonName) ?? { title: name, movies: [] }
      bucket.movies.push(movie)
      autoBuckets.set(canonName, bucket)
    }
  }

  const byTitle = (a: Movie, b: Movie): number =>
    a.title.toLowerCase().localeCompare(b.title.toLowerCase())

  const curated: CollectionGroup[] = []
  for (const def of CURATED) {
    const owned = curatedBuckets.get(def.key)
    if (!owned || owned.length < MIN_MEMBERS) continue
    curated.push({
      key: def.key,
      title: def.title,
      kind: 'curated',
      colors: def.colors,
      movies: owned.sort(byTitle)
    })
  }

  const auto: CollectionGroup[] = []
  for (const [canonName, bucket] of autoBuckets) {
    if (bucket.movies.length < MIN_MEMBERS) continue
    auto.push({
      key: `auto:${canonName}`,
      title: bucket.title,
      kind: 'auto',
      colors: autoColors(canonName),
      movies: bucket.movies.sort(byTitle)
    })
  }

  curated.sort((a, b) => b.movies.length - a.movies.length)
  auto.sort((a, b) => b.movies.length - a.movies.length)
  return [...curated, ...auto]
}
