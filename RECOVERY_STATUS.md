# Recovery status: READER WORKS, LINE NOTES LOST

**Current state (October 2026):** the site works. The full original text
(3,254 lines) loads from Vietnamese Wikisource on the first visit and is
then kept by the browser (`js/text-source.js`; a local `data/truyen-kieu.txt`
is used first if one is added). The surviving reading notes - psychology
timeline, narrative voice, cross-references, cultural background - are shown
beside the verses.

Still lost: the per-line meanings (`js/meanings/*`), the Hán-Việt notes
(`js/han-viet*.js`) and the vocabulary audits (`js/vocab-*`), listed in
`MISSING_EXACT_FILES.md`. They were written over many sessions and no copy
survived.

## At recovery time

Last GitHub `main` commit confirmed before access failed: `51927daff436c8f7f61958b1b46104b69ada5cf1`.

Exact bytes recovered from the conversation/tool history:
- `index.main-last-confirmed.html` (last confirmed main loader)
- `js/explanation-layout.js`
- `js/reader-insights.js`
- `js/narrative-layers.js`
- `css/narrative-layers.css`
- data regression tests in `tests/`

Exact bytes from the next local batch that was **not pushed** because GitHub began returning 403:
- `js/cultural-layers.js`
- `css/cultural-layers.css`
- `tests/cultural-layers.test.js`

`index.html` in this recovery is the last confirmed main index plus the cultural add-on tags. The repository is **not complete**: core poem data, meanings, Hán-Việt and vocabulary files listed in `MISSING_EXACT_FILES.md` are missing.
