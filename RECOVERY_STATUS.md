# Recovery status: PARTIAL EXACT + ONE UNPUSHED BATCH

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
