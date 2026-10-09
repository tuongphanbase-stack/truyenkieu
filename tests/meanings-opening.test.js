// Notes for the opening (lines 1-38): js/meanings/01-0001-0038.js adds one
// entry per lục-bát pair to KIEU_READER_INSIGHTS. Checks shape and that the
// glossary only explains words that are really in the pair.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('assert');

const root = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const f of ['js/reader-insights.js', 'js/meanings/01-0001-0038.js', 'js/narrative-layers.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox);
}
const notes = sandbox.window.KIEU_READER_INSIGHTS;
const opening = Array.from({ length: 19 }, (_, i) => 2 * i + 1);
const norm = s => String(s).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

test('one entry for every pair of lines 1-38, keyed by its first line', () => {
  for (const n of opening) assert.ok(notes[n], `line ${n}`);
  for (const n of opening) assert.ok(!notes[n + 1], `pair notes are keyed by the odd line, found ${n + 1}`);
  assert.ok(notes[723], 'the older curated notes are kept');
  assert.strictEqual(sandbox.window.readerInsightForLine(1), notes[1]);
});

test('every entry has the fields the reader shows', () => {
  for (const n of opening) {
    const e = notes[n];
    assert.strictEqual(e.text.length, 2, `line ${n}`);
    for (const k of ['pair', 'plain', 'context', 'grammar']) assert.ok(e[k] && e[k].trim(), `line ${n} ${k}`);
    assert.ok(e.plain.startsWith('Nói nôm na: '), `line ${n} plain`);
    assert.ok(Array.isArray(e.words), `line ${n} words`);
  }
});

test('glossary terms appear in their pair; Hán characters are Hán', () => {
  for (const n of opening) {
    const pairText = ' ' + norm(notes[n].text.join(' ')) + ' ';
    for (const w of notes[n].words) {
      assert.ok(pairText.includes(' ' + norm(w.term) + ' '), `line ${n}: "${w.term}" not in the pair`);
      assert.ok(w.meaning && w.meaning.trim(), `line ${n}: "${w.term}" has no meaning`);
      if (w.han) assert.match(w.han, /^[\p{Script=Han}\s，、]+$/u, `line ${n}: "${w.han}"`);
    }
  }
});

test('the annotated text agrees with the base text of the variant notes', () => {
  const layers = sandbox.window.KIEU_NARRATIVE_LAYERS;
  for (const n of [2, 4, 6, 8]) {
    const base = layers[n] && layers[n].variant && layers[n].variant.base;
    if (!base) continue;
    const pair = notes[n % 2 ? n : n - 1].text;
    assert.strictEqual(norm(pair[(n - 1) % 2]), norm(base), `line ${n}`);
  }
});
