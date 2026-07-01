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

Both entry points select their word set via **spaced repetition** (SM-2-style): each word has a `next_review_at` date; a review session pulls whatever is due (folder-scoped or global), oldest-due first. If nothing is due, offer to review ahead anyway.

Review flow:
1. **Card front**: the English word only.
2. Tap the card → **flips** to reveal the definition (and ideally part of speech / example sentence), pulled from the same public dictionary API used when the word was added (or cached from then).
3. Two ways to answer, both do the same thing:
   - Buttons **"I remember"** / **"I don't remember"**.
   - **Swipe** the card — right = "I remember", left = "I don't remember" (buttons stay as the desktop/accessible fallback).
   - *I remember* → increment the word's remembered counter, push `next_review_at` further out per the SRS interval, remove it from the current session's queue.
   - *I don't remember* → increment the not-remembered counter, reset the SRS interval short, and **re-insert the word a few cards later in the same session's queue** (Anki-style "again") so it gets a second look before the session ends.
4. A session ends when its queue is empty (i.e. every word has been answered "I remember" at least once, missed ones possibly several times). Show a short summary at the end (e.g. "8/10 remembered on first try").

### 3. Translate

Despite the name, this section does **not** translate between languages — it's an English word/phrase → English definition lookup, same data source as the rest of the app.

- User types any English word.
- App calls the Free Dictionary API and displays its definition(s), part of speech, example, and pronunciation — same rendering as the definition side of a card.
- Optional: a "add to folder" action from this screen, so a looked-up word can be saved into Vocabulary without re-typing it there.

### Dictionary API for definitions

**Free Dictionary API** (`https://api.dictionaryapi.dev/api/v2/entries/en/<word>`) — free, no API key, no rate-limit signup required. Returns definitions, part of speech, example sentences, phonetic spelling, and pronunciation audio URLs. Used by Vocabulary (on word add), Cards (definition side), and Translate (lookup). English only — no other target languages in scope.

### 4. Stats

- Streaks (consecutive days with at least one review).
- Daily review count.
- Accuracy trend over time (remembered vs. not-remembered), simple chart.
- Per-folder breakdown (optional): which folders have the most/least-remembered words.

## Suggested Data Model (sketch)

- `users` — id, email, password_hash
- `folders` — id, user_id, name, created_at
- `words` — id, user_id, folder_id, text, definition, example, phonetic_audio_url, remembered_count, not_remembered_count, next_review_at, srs_interval, srs_ease, created_at
- `review_logs` — id, word_id, result (`remembered` / `not_remembered`), reviewed_at *(history — powers Stats; also lets you recompute/tune the SRS algorithm later without losing data)*

`words.user_id` is denormalized alongside `folder_id` so "Study All" can query every word for a user in one pass without joining through folders.

## Confirmed Core Features (v1)

- Spaced repetition (SM-2-style) scheduling.
- Swipe gestures on Cards, with tap buttons as fallback.
- Stats section (streaks, daily count, accuracy trend).
- "Study All" — cross-folder review session.
- Translate section — English-only definition lookup via Free Dictionary API.

## Other Suggested Features (not yet confirmed)

**Adding words with less friction**
- **Auto-fill on add**: after fetching the definition, let the user review/edit it before saving (API definitions are sometimes verbose or the wrong sense of the word).
- **Duplicate detection**: warn if a word already exists in a folder.

**Review UX**
- **Keyboard shortcuts on desktop**: space/click to flip, arrow keys or `R` / `N` for remember/don't-remember.
- **Undo last answer**: quick "undo" affordance in case of a mis-tap, since counters/SRS state are otherwise permanent.

**Motivation & retention**
- **Daily goal + reminder notification**: PWA push notification (or local notification) nudging the user to do today's reviews.

**Organization**
- **Search** across all words/folders.
- **Import/export** a folder as CSV/JSON (useful for backup or sharing a word list).

**Other**
- **Dark mode** toggle.
- **Offline review**: cache due words in IndexedDB so review works with no connection, sync results back on reconnect (already noted in `TECH_STACK.md`).
