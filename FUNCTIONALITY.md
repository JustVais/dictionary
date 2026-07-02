# App Functionality

## Layout & Responsive Design

- **Mobile-first**, adaptive breakpoints (Tailwind defaults: `sm` 640px, `md` 768px, `lg` 1024px+).
- **Centered content column** on all screen sizes — a max-width container (e.g. `max-w-2xl`, centered with `mx-auto`), full width with side padding on mobile.
- **Navigation**:
  - **Desktop (`md` and up)**: header bar with section links (Vocabulary, Cards, Translate, Stats).
  - **Mobile**: fixed bottom tab bar (`position: fixed; bottom: 0`), with `env(safe-area-inset-bottom)` padding for iPhone home-indicator area. Same sections as desktop header, icon + label per tab.
- Content area scrolls independently between header/bottom bar; bottom bar always visible (common pattern: Duolingo, Instagram).

## Sections

### 1. Vocabulary

Manage folders (decks) of words.

- **Folders**: user can create, rename, delete a folder.
- **Add word to folder**: user enters an English word; app fetches its definition from a public dictionary API (see below) and stores it alongside the word.
- **Word list view** (per folder): shows each word with:
  - Remembered count (times marked "I remember")
  - Not-remembered count (times marked "I don't remember")
  - Optionally: accuracy (`remembered / total attempts`)
- **Edit / delete** a word from the folder.

### 2. Cards (Review)

Flashcard review flow. Two entry points into the same review UI:

- **Study a folder** — review the words in one chosen folder.
- **Study All** — review words due today across *every* folder, in one session (button on the Cards screen, alongside/above the folder list).

Both entry points select their word set via **FSRS spaced repetition** (`ts-fsrs`, the algorithm modern Anki uses): each word has a `next_review_at` date; a review session pulls whatever is due (folder-scoped or global), oldest-due first, **capped at 20 cards** (the end-of-session summary links to the remaining backlog). The Cards screen shows per-folder due counts and the total on Study All. If nothing is due, the session screen *offers* to review ahead instead of starting automatically.

Review flow:
1. **Card front**: the English word only.
2. Tap the card (or Space/Enter, or the "Show answer" button) → **flips** to reveal the definition, part of speech, example, phonetic text, and inflected word forms.
3. Grade the recall with four FSRS grades, Anki-style:
   - Buttons **Again / Hard / Good / Easy**, each showing its projected next interval (e.g. `10m · 1d · 3d · 7d`). Keyboard: `1–4`, `←` = Again, `→` = Good.
   - **Swipe** the card — right = Good, left = Again.
   - New and lapsed words go through short intra-day **learning steps** (~1m/10m); cards scheduled less than an hour out are re-inserted a few cards later in the same session.
   - An **Undo** control reverts the last answer (scheduling, counters, and review log).
4. A session ends when its queue is empty. Show a short summary at the end (e.g. "8/10 remembered on first try") plus a "review N more due" link when the session was capped.

### 3. Translate

English **or Russian** input → English definition.

- User types a word in English or Russian (Cyrillic is auto-detected).
- Russian input is first translated ru→en via **MyMemory** (free, no key), shown as "слово → word".
- The English word is then defined via the dictionary chain and displayed with part of speech, example, phonetic text, and **inflected word forms** (conjugations / plural / comparative, generated locally with `compromise`). No pronunciation audio — by design.
- "Add to folder" saves the looked-up (English) word into Vocabulary, with the same duplicate checks as the add-word dialog.

### Dictionary & translation APIs

- **Free Dictionary API** (`https://api.dictionaryapi.dev/api/v2/entries/en/<word>`) — primary definition source; free, no key. Returns definitions (up to 3 senses are offered), part of speech, examples, phonetic spelling.
- **Datamuse** (`https://api.datamuse.com/words`) — definition fallback when Free Dictionary has no entry.
- **MyMemory** (`https://api.mymemory.translated.net/get`) — ru→en translation for Russian input in Translate; free, no key.
- **compromise** (local npm library) — inflected word forms; no network calls.

### 4. Stats

- Streaks (consecutive days with at least one review).
- Daily review count.
- Accuracy trend over time (remembered vs. not-remembered), simple chart.
- Per-folder breakdown (optional): which folders have the most/least-remembered words.

## Data Model (sketch)

- `users` — id, email, password_hash
- `folders` — id, user_id, name, created_at
- `words` — id, user_id, folder_id, text, definition, part_of_speech, example, phonetic_text, remembered_count, not_remembered_count, next_review_at, fsrs_stability, fsrs_difficulty, fsrs_state, fsrs_learning_steps, last_reviewed_at, created_at
- `review_logs` — id, word_id, user_id, result (`remembered` / `not_remembered`), grade (`again`/`hard`/`good`/`easy`), reviewed_at *(history — powers Stats; also lets you recompute/tune the SRS algorithm later without losing data)*

`words.user_id` is denormalized alongside `folder_id` so "Study All" can query every word for a user in one pass without joining through folders.

## Implemented Features

**v1**
- Swipe gestures on Cards, with tap buttons as fallback.
- Stats section (streaks, daily count, accuracy trend) — now timezone-aware.
- "Study All" — cross-folder review session.

**v2**
- FSRS scheduling (replaced SM-2): 4 grades, learning steps, interval previews, fuzz.
- Due counts per folder; review-ahead offered, not forced; sessions capped at 20.
- Keyboard shortcuts (Space/Enter flip, `1–4`/arrows to grade) and undo last answer.
- Add-word preview: pick among up to 3 senses, edit definition/example before saving.
- Duplicate detection (blocks same-folder, warns cross-folder).
- Search across all words/folders.
- Russian → English lookup in Translate; inflected word forms everywhere; audio removed.
- Dark mode toggle; dialogs stay centered when the mobile keyboard opens.

## Suggested Features (not yet confirmed)

- **Daily goal + reminder notification**: PWA push notification nudging the user to do today's reviews.
- **Import/export** a folder as CSV/JSON (useful for backup or sharing a word list).
- **Offline review**: cache due words in IndexedDB so review works with no connection, sync results back on reconnect (already noted in `TECH_STACK.md`).
