const assert = require('assert');
const path = require('path');
const K = require(path.join(__dirname, '..', 'js', 'text-source.js'));

// Synthetic edition: real first/last verses, filler lục-bát lines in between,
// wrapped in the kind of noise a Wikisource page has (title, headings,
// verse numbers, footnote markers, notes section).
function fakeEdition(total) {
  const lines = ['Trăm năm trong cõi người ta,', 'Chữ tài chữ mệnh khéo là ghét nhau.'];
  for (let n = 3; n < total; n++) {
    lines.push(n % 2 ? `câu thơ sáu chữ số ${n}` : `câu thơ tám chữ thứ tự số ${n} đây`);
  }
  lines.push('Mua vui cũng được một vài trống canh.');
  return ['Truyện Kiều', 'Nguyễn Du', '', '== Phần I ==',
    ...lines.map((l, i) => ((i + 1) % 10 === 0 ? `${l} ${i + 1}` : (i === 4 ? `${l}[3]` : l))),
    '', '== Chú thích ==', '1. Một chú thích dài không phải câu thơ nhé'].join('\n');
}

// 1. Full edition parses to exactly 3254 verses with noise stripped.
const full = K.parseKieuText(fakeEdition(3254));
assert.strictEqual(full.lines.length, 3254);
assert.strictEqual(full.warnings.length, 0);
assert.strictEqual(full.lines[0], 'Trăm năm trong cõi người ta,');
assert.strictEqual(full.lines[3253], 'Mua vui cũng được một vài trống canh.');
assert.ok(!full.lines[9].match(/\d+$/) || full.lines[9].endsWith('số 10'), 'trailing verse number removed');
assert.ok(!full.lines.some(l => l.includes('[3]')), 'footnote markers removed');
assert.ok(!full.lines.some(l => l.includes('Chú thích') || l.includes('==')), 'headings and notes excluded');

// 2. Leading verse numbers ("12. text") are stripped.
const numbered = K.parseKieuText('1. Trăm năm trong cõi người ta,\n2. Chữ tài chữ mệnh khéo là ghét nhau.\n3. Mua vui cũng được một vài trống canh.');
assert.deepStrictEqual(numbered.lines, ['Trăm năm trong cõi người ta,', 'Chữ tài chữ mệnh khéo là ghét nhau.', 'Mua vui cũng được một vài trống canh.']);

// 3. A different line count still parses, with a warning about numbering.
const short = K.parseKieuText(fakeEdition(3250));
assert.strictEqual(short.lines.length, 3250);
assert.strictEqual(short.warnings.length, 1);

// 4. Missing opening or closing verse is an error, not silent garbage.
assert.throws(() => K.parseKieuText('chỉ có vài dòng\nkhông phải Truyện Kiều'), /mở đầu/);
assert.throws(() => K.parseKieuText('Trăm năm trong cõi người ta,\nChữ tài chữ mệnh khéo là ghét nhau.'), /câu kết/);
assert.throws(() => K.parseKieuText(''), /trống/);

// 5. Search ignores diacritics and case.
const hits = K.searchLines(full.lines, 'tram nam');
assert.strictEqual(hits[0].n, 1);
assert.strictEqual(K.searchLines(full.lines, 'CHỮ TÀI')[0].n, 2);
assert.deepStrictEqual(K.searchLines(full.lines, '   '), []);

// 6. loadKieu: Wikisource page -> parsed + cached; second load uses the cache.
const memory = {};
const storage = { getItem: k => (k in memory ? memory[k] : null), setItem: (k, v) => { memory[k] = v; } };
let apiCalls = 0;
const fakeFetch = url => {
  if (url === 'data/truyen-kieu.txt') return Promise.resolve({ ok: false, status: 404 });
  apiCalls++;
  const u = new URL(url);
  const title = u.searchParams.get('titles');
  const body = title === 'Truyện Kiều'
    ? { query: { pages: [{ title: 'Truyện Kiều', extract: fakeEdition(3254) }] } }
    : { query: { pages: [{ title, missing: true }], allpages: [], search: [] } };
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
};
K.loadKieu({ fetch: fakeFetch, storage }).then(data => {
  assert.strictEqual(data.source, 'wikisource');
  assert.strictEqual(data.lines.length, 3254);
  assert.ok(data.sourceUrl.includes('vi.wikisource.org'));
  const callsAfterFirst = apiCalls;
  return K.loadKieu({ fetch: fakeFetch, storage }).then(again => {
    assert.strictEqual(again.lines.length, 3254);
    assert.strictEqual(apiCalls, callsAfterFirst, 'second load must come from the cache');
  });
}).then(() => {
  // 7. A local data/truyen-kieu.txt wins over everything else.
  const localFetch = url => url === 'data/truyen-kieu.txt'
    ? Promise.resolve({ ok: true, text: () => Promise.resolve(fakeEdition(3254)) })
    : Promise.reject(new Error('network should not be used'));
  return K.loadKieu({ fetch: localFetch, storage: null });
}).then(local => {
  assert.strictEqual(local.source, 'local');
  // 8. Poem split across subpages ("Truyện Kiều/1", "/2") is joined in order.
  const text = fakeEdition(3254).split('\n');
  const mid = Math.floor(text.length / 2);
  const parts = { 'Truyện Kiều/1': text.slice(0, mid).join('\n'), 'Truyện Kiều/2': text.slice(mid).join('\n') };
  const splitFetch = url => {
    if (url === 'data/truyen-kieu.txt') return Promise.resolve({ ok: false });
    const u = new URL(url);
    let body;
    if (u.searchParams.get('list') === 'allpages') body = { query: { allpages: [{ title: 'Truyện Kiều/2' }, { title: 'Truyện Kiều/1' }] } };
    else {
      const t = u.searchParams.get('titles');
      body = { query: { pages: [parts[t] ? { title: t, extract: parts[t] } : t === 'Truyện Kiều' ? { title: t, extract: 'Mục lục' } : { title: t, missing: true }] } };
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  };
  return K.loadKieu({ fetch: splitFetch, storage: null });
}).then(joined => {
  assert.strictEqual(joined.lines.length, 3254);
  console.log('text source validation passed: parser, search, cache, local file, subpages');
}).catch(e => { console.error(e); process.exit(1); });
