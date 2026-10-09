# Truyện Kiều — Nguyên văn & Giải nghĩa

A reader for Nguyễn Du's *Truyện Kiều*: the original text, paged 24 lines at a
time, with reading notes beside it: Kiều's psychological journey, narrative
voice, cross-references between scenes, textual variants, cultural background
and close readings of key passages.

## Features

- **Original text** of all 3,254 lines, loaded from Vietnamese Wikisource the
  first time, then remembered by the browser so later visits are instant.
- **Search** that ignores diacritics (`tram nam` finds “Trăm năm”), or type a
  line number to jump straight to it.
- **Reading notes** beside the verses. Lines with notes have a dot; click one
  to highlight its notes. Links inside notes jump to related lines.
- **Psychology timeline:** which stage of Kiều's journey the page is in, with
  links to the previous and next stage.
- **Bookmarks** (☆ beside a line) and **resume where you left off**.
- **Read aloud** a pair of lines (🔊) or the whole page, using the browser's
  Vietnamese voice.
- Light/dark theme, works on phones, keyboard shortcuts (← → pages, `/` search).
- Links like `.../#cau-723` open directly at a line.
- **Installable app that works offline** (see below).
- Same look as its sister site, the
  [Chinh Phụ Ngâm reader](https://tuongphanbase.github.io/chinhphungam/);
  the footer links to it and to the
  [project list](https://tuongphanbase.github.io/emailer-dashboard/projects.html).

## Install on a phone

The site is a Progressive Web App, so it can be added to the home screen and
opens full screen like an app:

- **Android (Chrome):** open the site, tap **⋮** → **Install app** /
  **Add to Home screen** (*Cài đặt ứng dụng* / *Thêm vào màn hình chính*).
- **iPhone / iPad (Safari):** tap **Share** → **Add to Home Screen**
  (*Thêm vào MH chính*).
- **Computer (Chrome / Edge):** click the install icon at the right of the
  address bar.

Open it once while online: the app itself is then cached by the service
worker, and the poem text is kept in the browser's storage, so it keeps
working without a connection.

## Where the text comes from

`js/text-source.js` loads the poem in this order:

1. `data/truyen-kieu.txt` in this repo, if it exists (one verse per line;
   headings, verse numbers and notes around it are ignored).
2. The copy saved in this browser from an earlier visit.
3. Vietnamese Wikisource: a few known page titles, then a search for the
   first verse; editions split across subpages are joined in order.

The parser keeps everything from “Trăm năm trong cõi người ta” to “Mua vui
cũng được một vài trống canh”. If an edition has a different number of lines
than the standard 3,254, the page says so, because the notes are keyed by
line number.

> **Tip:** to stop depending on Wikisource, save the text as
> `data/truyen-kieu.txt` in this repo.

## Shared look and the offline app

- `css/site.css` (colour and type tokens, header, footer, light/dark) and
  `js/site.js` (theme before first paint, theme button, service-worker
  registration) are **identical copies** of the files in the `chinhphungam`
  repo. Edit both copies together; each site sets only its own accent colour
  at the top of its stylesheet (`css/reader.css` here).
- `manifest.webmanifest`, `icons/` and `sw.js` make the site installable.
  `sw.js` serves the files listed in `SHELL` from its cache first, so when you
  change any of them, bump their `?v=` in `index.html` and in `SHELL`, and
  bump `VERSION`. `tests/pwa.test.js` fails if a file the page loads is
  missing from `SHELL`. Requests to Wikisource are never cached by the
  service worker; the reader keeps the text in `localStorage` itself.

## Recovery status

The original repository was lost when its GitHub account was suspended. The
reading notes survived (`js/narrative-layers.js`, `js/reader-insights.js`,
`js/cultural-layers.js` and their CSS). The core reader and the per-line
meaning, Hán-Việt and vocabulary files did not; see `MISSING_EXACT_FILES.md`.

`js/reader.js`, `js/text-source.js` and `css/reader.css` are a **new reader**
written to replace the lost one; the surviving note files plug into it
unchanged. `js/explanation-layout.js` and `index.main-last-confirmed.html` are
kept for reference only, since they depend on the lost files.

## Tests

```
for t in tests/*.js; do node "$t"; done
```
