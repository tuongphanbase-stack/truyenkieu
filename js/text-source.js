// Loads the original text of Truyện Kiều.
// Order: a local copy (data/truyen-kieu.txt, if someone adds one) -> the copy
// cached in this browser -> Vietnamese Wikisource (vi.wikisource.org).
// The parser keeps only the verses between the first and last lines of the
// poem, so headings, notes and numbering around the text don't matter.
(function (root) {
  'use strict';

  var OPENING = 'tram nam trong coi nguoi ta';
  var CLOSING = 'mua vui cung duoc mot vai trong canh';
  var EXPECTED_LINES = 3254;
  var LOCAL_FILE = 'data/truyen-kieu.txt';
  var CACHE_KEY = 'kieu_text_v1';
  var API = 'https://vi.wikisource.org/w/api.php';
  // Page titles tried first; a full-text search for the opening verse is the fallback.
  var CANDIDATE_TITLES = ['Truyện Kiều', 'Đoạn trường tân thanh', 'Truyện Kiều (Nguyễn Du)', 'Kim Vân Kiều'];

  function normalizeText(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function cleanVerseLine(line) {
    return String(line)
      .normalize('NFC')
      .replace(/\[\s*\d+\s*\]/g, '')        // footnote markers [12]
      .replace(/^\s*\d{1,4}\s*[.):]?\s+/, '') // leading verse numbers
      .replace(/\s+\d{1,4}\s*$/, '')          // trailing verse numbers
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isVerse(line) {
    if (!line || /^=+/.test(line)) return false;
    if (/^(hồi|phần|chương|đoạn|quyển)\s+[\divxlc]+\b/i.test(line)) return false;
    var words = normalizeText(line).split(' ').filter(Boolean);
    // Lục bát: 6- and 8-word lines. Allow a little slack for punctuation quirks.
    return words.length >= 5 && words.length <= 10 && /[a-z]/.test(words.join(''));
  }

  // Returns {lines, warnings}. Throws if the poem's first or last verse can't be found.
  function parseKieuText(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('Nguồn văn bản trống');
    var raw = text.replace(/\r\n?/g, '\n').split('\n').map(cleanVerseLine);
    var start = -1, end = -1;
    for (var i = 0; i < raw.length; i++) {
      var n = normalizeText(raw[i]);
      if (start < 0 && n.indexOf(OPENING) === 0) start = i;
      if (start >= 0 && n.indexOf(CLOSING) === 0) end = i; // keep the last match
    }
    if (start < 0) throw new Error('Không tìm thấy câu mở đầu “Trăm năm trong cõi người ta”');
    if (end < 0) throw new Error('Không tìm thấy câu kết “Mua vui cũng được một vài trống canh”');
    var lines = raw.slice(start, end + 1).filter(isVerse);
    var warnings = [];
    if (lines.length !== EXPECTED_LINES) {
      warnings.push('Nguồn có ' + lines.length + ' câu (bản chuẩn có ' + EXPECTED_LINES +
        ' câu), nên số thứ tự câu có thể lệch so với chú giải.');
    }
    return { lines: lines, warnings: warnings };
  }

  function searchLines(lines, query, limit) {
    var needle = normalizeText(query);
    if (!needle) return [];
    var out = [];
    for (var i = 0; i < lines.length && out.length < (limit || 200); i++) {
      if (normalizeText(lines[i]).indexOf(needle) >= 0) out.push({ n: i + 1, text: lines[i] });
    }
    return out;
  }

  // ---- Network (browser only) ------------------------------------------------

  function apiGet(params, fetchImpl) {
    var qs = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    return fetchImpl(API + '?origin=*&format=json&formatversion=2&' + qs, { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('Wikisource trả về HTTP ' + r.status);
        return r.json();
      });
  }

  function pageExtract(title, fetchImpl) {
    return apiGet({ action: 'query', prop: 'extracts', explaintext: 1, redirects: 1, titles: title }, fetchImpl)
      .then(function (d) {
        var page = d && d.query && d.query.pages && d.query.pages[0];
        return page && !page.missing && page.extract ? { title: page.title, extract: page.extract } : null;
      });
  }

  // Some editions split the poem into subpages ("Truyện Kiều/1", ...).
  function subpageExtracts(title, fetchImpl) {
    return apiGet({ action: 'query', list: 'allpages', apprefix: title + '/', aplimit: 100 }, fetchImpl)
      .then(function (d) {
        var titles = ((d.query && d.query.allpages) || []).map(function (p) { return p.title; });
        titles.sort(function (a, b) { return a.localeCompare(b, 'vi', { numeric: true }); });
        return titles.reduce(function (chain, t) {
          return chain.then(function (acc) {
            return pageExtract(t, fetchImpl).then(function (p) { return p ? acc.concat(p.extract) : acc; });
          });
        }, Promise.resolve([]));
      })
      .then(function (parts) { return parts.join('\n'); });
  }

  function tryTitle(title, fetchImpl) {
    return pageExtract(title, fetchImpl).then(function (page) {
      var resolved = page ? page.title : title;
      var attempt = function (text) {
        try { return parseKieuText(text); } catch (e) { return null; }
      };
      var direct = page ? attempt(page.extract) : null;
      if (direct && direct.lines.length >= 3000) return { result: direct, title: resolved };
      return subpageExtracts(resolved, fetchImpl).then(function (joined) {
        var split = joined ? attempt(joined) : null;
        var best = [direct, split].filter(Boolean).sort(function (a, b) { return b.lines.length - a.lines.length; })[0];
        return best ? { result: best, title: resolved } : null;
      });
    }).catch(function () { return null; });
  }

  function searchTitles(fetchImpl) {
    return apiGet({ action: 'query', list: 'search', srsearch: '"Trăm năm trong cõi người ta"', srnamespace: 0, srlimit: 8 }, fetchImpl)
      .then(function (d) { return ((d.query && d.query.search) || []).map(function (s) { return s.title; }); })
      .catch(function () { return []; });
  }

  function fromWikisource(fetchImpl) {
    var best = null;
    var consider = function (found) {
      if (found && (!best || found.result.lines.length > best.result.lines.length)) best = found;
      return best && best.result.lines.length >= 3000;
    };
    var tryList = function (titles) {
      return titles.reduce(function (chain, t) {
        return chain.then(function (done) { return done ? true : tryTitle(t, fetchImpl).then(consider); });
      }, Promise.resolve(false));
    };
    return tryList(CANDIDATE_TITLES)
      .then(function (done) {
        return done ? true : searchTitles(fetchImpl).then(function (ts) {
          return tryList(ts.filter(function (t) { return CANDIDATE_TITLES.indexOf(t) < 0; }));
        });
      })
      .then(function () {
        if (!best) throw new Error('Không tìm thấy văn bản Truyện Kiều trên Wikisource');
        return {
          lines: best.result.lines, warnings: best.result.warnings, source: 'wikisource',
          sourceUrl: 'https://vi.wikisource.org/wiki/' + encodeURIComponent(best.title.replace(/ /g, '_')),
          sourceTitle: best.title
        };
      });
  }

  function readCache(storage) {
    try {
      var c = JSON.parse(storage.getItem(CACHE_KEY) || 'null');
      return c && Array.isArray(c.lines) && c.lines.length > 100 ? c : null;
    } catch (e) { return null; }
  }

  function writeCache(storage, data) {
    try { storage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* storage full or blocked */ }
  }

  // Resolves {lines, warnings, source, sourceUrl?, sourceTitle?}.
  function loadKieu(opts) {
    opts = opts || {};
    var fetchImpl = opts.fetch || root.fetch.bind(root);
    var storage = opts.storage || (function () { try { return root.localStorage; } catch (e) { return null; } })();
    return fetchImpl(LOCAL_FILE, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : null; })
      .catch(function () { return null; })
      .then(function (text) {
        if (text) {
          try {
            var parsed = parseKieuText(text);
            return { lines: parsed.lines, warnings: parsed.warnings, source: 'local' };
          } catch (e) { /* fall through to the other sources */ }
        }
        if (!opts.refresh && storage) {
          var cached = readCache(storage);
          if (cached) return cached;
        }
        return fromWikisource(fetchImpl).then(function (data) {
          if (storage) writeCache(storage, Object.assign({ savedAt: new Date().toISOString() }, data));
          return data;
        });
      });
  }

  var api = {
    parseKieuText: parseKieuText, searchLines: searchLines, normalizeText: normalizeText,
    loadKieu: loadKieu, EXPECTED_LINES: EXPECTED_LINES, CACHE_KEY: CACHE_KEY
  };
  root.KieuText = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
