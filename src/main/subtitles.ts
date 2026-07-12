// Subtitle filename analysis: language + forced/SDH detection and a "clean" stem for fuzzy
// matching. Purely local and dependency-free — no network, no external subtitle providers.
//
// Language/flag tags on subtitle files are (near-)universally SUFFIXES: "Movie.2020.en.forced.srt",
// "Movie.eng.sdh.srt". So we only strip tags from the trailing run of tokens and stop at the first
// content token. This avoids eating title words that happen to be ISO codes — e.g. the film "It"
// (code "it" = Italian) in "It.2017.it.srt" keeps "It 2017" as its clean stem.

// code = ISO 639-1 (or a stable short id); name = display; aliases = tokens that map here.
interface Lang {
  code: string
  name: string
  aliases: string[]
}

// Compact but broad table covering the languages a home library realistically carries.
const LANGUAGES: Lang[] = [
  { code: 'en', name: 'English', aliases: ['en', 'eng', 'english'] },
  { code: 'sv', name: 'Swedish', aliases: ['sv', 'swe', 'swedish', 'svenska'] },
  { code: 'no', name: 'Norwegian', aliases: ['no', 'nor', 'norwegian', 'norsk'] },
  { code: 'da', name: 'Danish', aliases: ['da', 'dan', 'danish', 'dansk'] },
  { code: 'fi', name: 'Finnish', aliases: ['fi', 'fin', 'finnish', 'suomi'] },
  { code: 'is', name: 'Icelandic', aliases: ['is', 'isl', 'ice', 'icelandic'] },
  { code: 'de', name: 'German', aliases: ['de', 'deu', 'ger', 'german', 'deutsch'] },
  { code: 'fr', name: 'French', aliases: ['fr', 'fra', 'fre', 'french', 'francais', 'français'] },
  { code: 'es', name: 'Spanish', aliases: ['es', 'spa', 'esp', 'spanish', 'espanol', 'español', 'castellano'] },
  { code: 'it', name: 'Italian', aliases: ['it', 'ita', 'italian', 'italiano'] },
  { code: 'pt', name: 'Portuguese', aliases: ['pt', 'por', 'portuguese', 'portugues', 'português'] },
  { code: 'nl', name: 'Dutch', aliases: ['nl', 'nld', 'dut', 'dutch', 'nederlands'] },
  { code: 'pl', name: 'Polish', aliases: ['pl', 'pol', 'polish', 'polski'] },
  { code: 'ru', name: 'Russian', aliases: ['ru', 'rus', 'russian'] },
  { code: 'uk', name: 'Ukrainian', aliases: ['uk', 'ukr', 'ukrainian'] },
  { code: 'cs', name: 'Czech', aliases: ['cs', 'cze', 'ces', 'czech'] },
  { code: 'sk', name: 'Slovak', aliases: ['sk', 'slo', 'slk', 'slovak'] },
  { code: 'hu', name: 'Hungarian', aliases: ['hu', 'hun', 'hungarian', 'magyar'] },
  { code: 'ro', name: 'Romanian', aliases: ['ro', 'ron', 'rum', 'romanian'] },
  { code: 'bg', name: 'Bulgarian', aliases: ['bg', 'bul', 'bulgarian'] },
  { code: 'el', name: 'Greek', aliases: ['el', 'ell', 'gre', 'greek'] },
  { code: 'tr', name: 'Turkish', aliases: ['tr', 'tur', 'turkish', 'turkce', 'türkçe'] },
  { code: 'hr', name: 'Croatian', aliases: ['hr', 'hrv', 'croatian'] },
  { code: 'sr', name: 'Serbian', aliases: ['sr', 'srp', 'serbian'] },
  { code: 'sl', name: 'Slovenian', aliases: ['sl', 'slv', 'slovenian'] },
  { code: 'ar', name: 'Arabic', aliases: ['ar', 'ara', 'arabic'] },
  { code: 'he', name: 'Hebrew', aliases: ['he', 'heb', 'hebrew'] },
  { code: 'fa', name: 'Persian', aliases: ['fa', 'per', 'fas', 'persian', 'farsi'] },
  { code: 'hi', name: 'Hindi', aliases: ['hin', 'hindi'] }, // note: bare "hi" omitted (SDH ambiguity)
  { code: 'th', name: 'Thai', aliases: ['th', 'tha', 'thai'] },
  { code: 'vi', name: 'Vietnamese', aliases: ['vi', 'vie', 'vietnamese'] },
  { code: 'id', name: 'Indonesian', aliases: ['id', 'ind', 'indonesian'] },
  { code: 'ms', name: 'Malay', aliases: ['ms', 'may', 'msa', 'malay'] },
  { code: 'ja', name: 'Japanese', aliases: ['ja', 'jpn', 'jap', 'japanese'] },
  { code: 'ko', name: 'Korean', aliases: ['ko', 'kor', 'korean'] },
  { code: 'zh', name: 'Chinese', aliases: ['zh', 'chi', 'zho', 'chinese', 'mandarin', 'cantonese'] }
]

const ALIAS_TO_LANG = new Map<string, Lang>()
for (const lang of LANGUAGES) {
  for (const alias of lang.aliases) ALIAS_TO_LANG.set(alias, lang)
}

// "forced" = only translations of foreign/on-screen text. SDH/CC = for the deaf/hard-of-hearing.
const FORCED_TOKENS = new Set(['forced', 'foreign'])
const SDH_TOKENS = new Set(['sdh', 'cc', 'hoh'])

export interface SubtitleInfo {
  language: string // display name, or 'Unknown'
  code: string // ISO code, or ''
  forced: boolean
  sdh: boolean
  cleanStem: string // stem with the trailing tag run removed, for fuzzy matching
  label: string // e.g. "English", "Swedish (forced)", "Portuguese (BR) [SDH]"
}

// Split on separators but KEEP hyphens inside tokens, so "pt-br"/"en-US" survive as one token
// (a hyphen is checked for a language-region split) while "spider-man" stays intact as content.
function tokenize(stem: string): string[] {
  return stem.split(/[.\s_()[\]]+/).filter(Boolean)
}

// Resolve a single token to a language (+ optional region), or null. Handles "en", "eng",
// "english", and region forms like "pt-br" / "en-US".
function matchLanguageToken(token: string): { lang: Lang; region: string } | null {
  const lower = token.toLowerCase()
  const direct = ALIAS_TO_LANG.get(lower)
  if (direct) return { lang: direct, region: '' }
  const dash = lower.indexOf('-')
  if (dash > 0) {
    const base = ALIAS_TO_LANG.get(lower.slice(0, dash))
    const region = lower.slice(dash + 1)
    // Region must look like a 2-letter/short region or script tag, not another word.
    if (base && region.length >= 2 && region.length <= 4) return { lang: base, region }
  }
  return null
}

/** Analyze a subtitle basename (with extension) into language/flags + a clean stem. */
export function detectSubtitle(fileName: string): SubtitleInfo {
  const dot = fileName.lastIndexOf('.')
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName
  const tokens = tokenize(stem)

  let forced = false
  let sdh = false
  let lang: Lang | null = null
  let region = ''

  // Walk the trailing run: consume language/flag tags from the end until a content token.
  let end = tokens.length
  while (end > 0) {
    const tok = tokens[end - 1]
    const lower = tok.toLowerCase()
    if (FORCED_TOKENS.has(lower)) {
      forced = true
      end--
      continue
    }
    if (SDH_TOKENS.has(lower)) {
      sdh = true
      end--
      continue
    }
    const langMatch = matchLanguageToken(tok)
    if (langMatch) {
      // Keep the first language we hit scanning backwards (closest to the extension wins).
      if (!lang) {
        lang = langMatch.lang
        region = langMatch.region
      }
      end--
      continue
    }
    break
  }

  const cleanStem = tokens.slice(0, end).join(' ')
  return finalize(lang, region, forced, sdh, cleanStem)
}

/** Language from a folder name alone (e.g. a "Subs/English" directory), else null. */
export function languageFromFolder(folderName: string): Lang | null {
  return ALIAS_TO_LANG.get(folderName.trim().toLowerCase()) ?? null
}

/** Build a SubtitleInfo when the language comes from context (folder hint) rather than the name. */
export function withFolderLanguage(info: SubtitleInfo, folderLang: Lang): SubtitleInfo {
  if (info.code) return info // filename already told us the language
  return finalize(folderLang, '', info.forced, info.sdh, info.cleanStem)
}

function finalize(
  lang: Lang | null,
  region: string,
  forced: boolean,
  sdh: boolean,
  cleanStem: string
): SubtitleInfo {
  const language = lang ? lang.name : 'Unknown'
  const code = lang ? lang.code : ''
  let label = language
  if (region) label += ` (${region.toUpperCase()})`
  const flags: string[] = []
  if (forced) flags.push('forced')
  if (sdh) flags.push('SDH')
  if (flags.length) label += ` [${flags.join(', ')}]`
  return { language, code, forced, sdh, cleanStem, label }
}
