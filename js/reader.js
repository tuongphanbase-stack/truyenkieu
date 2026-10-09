// Truyện Kiều reader: paged verses on the left, reading notes on the right.
// Exposes the globals the note add-ons hook into: escapeHtml, readerInsightPieces, renderPage.
'use strict';

const PAGE_SIZE = 24;            // 12 lục-bát pairs per page
const LS_PAGE = 'kieu_last_page';
const LS_MARKS = 'kieu_bookmarks';
// The light/dark theme is handled by js/site.js (shared with the Chinh Phụ Ngâm reader).

const state = { lines: [], page: 0, source: null, selected: null, speaking: false };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const $ = id => document.getElementById(id);
const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* blocked */ } }
};
const pageCount = () => Math.max(1, Math.ceil(state.lines.length / PAGE_SIZE));
const pageOfLine = n => Math.floor((n - 1) / PAGE_SIZE);

/* ---------- Notes for one line (the add-ons append to this list) ---------- */

function verseJump(target, label) {
  return `<a class="verse-jump" data-target-line="${target}" href="#cau-${target}">${escapeHtml(label)}</a>`;
}

const CONNECTION_LABELS = { echo: 'VỌNG LẠI', foreshadow: 'BÁO TRƯỚC', callback: 'GỢI LẠI' };

function readerInsightPieces(line) {
  const pieces = [];
  const insight = window.readerInsightForLine ? window.readerInsightForLine(line.n) : null;
  if (insight) {
    const rows = [['Ý CẶP CÂU', insight.pair], ['NÓI NÔM NA', insight.plain], ['HOÀN CẢNH', insight.context],
      ['CHỮ NGHĨA', insight.grammar], ['ĐIỂN CỐ', insight.allusion], ['ẨN Ý', insight.subtext]];
    const words = (insight.words || []).length ? `<div class="insight-field"><b>TỪ NGỮ</b><dl class="insight-words">${insight.words.map(w =>
      `<dt>${escapeHtml(w.term)}${w.han ? ` <span class="han" lang="zh-Hant">${escapeHtml(w.han)}</span>` : ''}</dt><dd>${escapeHtml(w.meaning)}</dd>`).join('')}</dl></div>` : '';
    pieces.push(`<div class="reader-insight-row insight-layer">${rows.filter(r => r[1]).map(([k, v]) =>
      `<div class="insight-field"><b>${k}</b><p>${escapeHtml(v)}</p></div>`).join('')}${words}</div>`);
  }
  const layer = window.narrativeLayersForLine ? window.narrativeLayersForLine(line.n) : null;
  if (layer) {
    if (layer.voice) pieces.push(`<div class="reader-insight-row narrative-layer"><div class="insight-label-line"><b>GIỌNG KỂ</b><span class="voice-chip">${escapeHtml(layer.voice.kind)}</span></div><p>${escapeHtml(layer.voice.text)}</p></div>`);
    if (layer.knowledge) pieces.push(`<div class="reader-insight-row narrative-layer knowledge-layer"><b>NGƯỜI ĐỌC BIẾT GÌ</b><p>${escapeHtml(layer.knowledge)}</p></div>`);
    if (layer.psychology) pieces.push(`<div class="reader-insight-row narrative-layer psychology-layer"><b>TÂM LÝ KIỀU</b><strong>${escapeHtml(layer.psychology.stage)}</strong><p>${escapeHtml(layer.psychology.text)}</p></div>`);
    if (layer.connections && layer.connections.length) {
      pieces.push(`<div class="reader-insight-row narrative-layer"><b>LIÊN KẾT TRONG TRUYỆN</b><div class="insight-connections">${layer.connections.map(c =>
        `<div class="insight-connection"><div><span>${CONNECTION_LABELS[c.type] || 'LIÊN KẾT'}</span>${verseJump(c.target, `${c.label} · câu ${c.target}`)}</div><p>${escapeHtml(c.text)}</p></div>`).join('')}</div></div>`);
    }
    if (layer.variant) {
      const v = layer.variant;
      const src = v.source && v.source.url ? `<a class="variant-source" href="${escapeHtml(v.source.url)}" target="_blank" rel="noopener">${escapeHtml(v.source.label || 'Nguồn')} ↗</a>` : '';
      pieces.push(`<div class="reader-insight-row narrative-layer variant-layer"><div class="insight-label-line"><b>DỊ BẢN</b>${src}</div><div class="variant-compare"><div><span>BẢN ĐANG ĐỌC</span><p>${escapeHtml(v.base)}</p></div><div><span>BẢN KHÁC</span><p>${escapeHtml(v.alternate)}</p></div></div><p class="variant-effect">${escapeHtml(v.effect)}</p>${v.note ? `<small>${escapeHtml(v.note)}</small>` : ''}</div>`);
    }
  }
  return pieces;
}

/* ---------- Rendering ---------- */

function renderPsychology(firstLine) {
  const box = $('psychology');
  const ctx = window.psychologyContextForLine ? window.psychologyContextForLine(firstLine) : null;
  if (!ctx || !ctx.current) { box.hidden = true; return; }
  const c = ctx.current;
  box.hidden = false;
  box.innerHTML = `<div class="insight-label-line"><b>DIỄN BIẾN TÂM LÝ</b><span class="psychology-count">${ctx.index + 1}/${ctx.total}</span></div>
    <strong>${escapeHtml(c.stage)}</strong><p>${escapeHtml(c.text)}</p>
    <div class="psychology-context"><span>Câu ${c.range[0]}–${c.range[1]}</span><div>
      ${ctx.previous ? verseJump(ctx.previous.range[0], '← ' + ctx.previous.stage) : '<span></span>'}
      ${ctx.next ? verseJump(ctx.next.range[0], ctx.next.stage + ' →') : ''}</div></div>`;
}

function renderPage(opts) {
  opts = opts || {};
  if (!state.lines.length) return;
  const total = pageCount();
  state.page = Math.min(Math.max(state.page, 0), total - 1);
  store.set(LS_PAGE, state.page);
  const from = state.page * PAGE_SIZE;
  const slice = state.lines.slice(from, from + PAGE_SIZE);
  const marks = new Set(store.get(LS_MARKS, []));

  $('pageLabel').textContent = `Câu ${from + 1}–${from + slice.length}`;
  $('pageSelect').value = String(state.page);
  $('prevPage').disabled = state.page === 0;
  $('nextPage').disabled = state.page === total - 1;
  $('progress').style.width = `${((state.page + 1) / total) * 100}%`;

  const verses = $('verses');
  verses.innerHTML = '';
  const notesList = [];
  for (let i = 0; i < slice.length; i += 2) {
    const pair = document.createElement('div');
    pair.className = 'pair';
    for (const offset of [0, 1]) {
      if (i + offset >= slice.length) break;
      const n = from + i + offset + 1;
      const pieces = readerInsightPieces({ n, text: slice[i + offset] });
      if (pieces.length) notesList.push({ n, pieces });
      const row = document.createElement('div');
      row.className = 'verse' + (offset ? ' bat' : ' luc') + (pieces.length ? ' has-notes' : '') + (state.selected === n ? ' selected' : '');
      row.id = `cau-${n}`;
      row.dataset.line = n;
      row.innerHTML = `<span class="num">${n}</span><span class="text"></span>
        <button class="mark ${marks.has(n) ? 'on' : ''}" data-mark="${n}" title="Đánh dấu câu ${n}" aria-label="Đánh dấu câu ${n}" aria-pressed="${marks.has(n)}">${marks.has(n) ? '★' : '☆'}</button>`;
      row.querySelector('.text').textContent = slice[i + offset];
      pair.appendChild(row);
    }
    const say = document.createElement('button');
    say.className = 'say';
    say.title = 'Nghe đọc cặp câu này';
    say.setAttribute('aria-label', 'Nghe đọc cặp câu này');
    say.textContent = '🔊';
    say.dataset.say = from + i + 1;
    pair.appendChild(say);
    verses.appendChild(pair);
  }

  renderPsychology(from + 1);
  const notes = $('notes');
  notes.innerHTML = notesList.length
    ? notesList.map(({ n, pieces }) => `<section class="line-notes${state.selected === n ? ' selected' : ''}" id="ghi-chu-${n}" data-line="${n}">
        <h3>${verseJump(n, `Câu ${n}`)} <span>${escapeHtml(state.lines[n - 1])}</span></h3>${pieces.join('')}</section>`).join('')
    : `<p class="no-notes">Trang này chưa có chú giải. Các ghi chú hiện có tập trung ở những đoạn quan trọng; dùng mục “Diễn biến tâm lý” phía trên để nhảy tới đoạn có chú giải.</p>`;

  if (opts.scroll !== false) {
    const target = state.selected ? $(`cau-${state.selected}`) : null;
    (target || $('readerTop')).scrollIntoView({ behavior: 'smooth', block: target ? 'center' : 'start' });
  }
}

function renderBookmarks() {
  const marks = store.get(LS_MARKS, []).filter(n => n >= 1 && n <= state.lines.length).sort((a, b) => a - b);
  const list = $('bookmarkList');
  list.innerHTML = marks.length
    ? marks.map(n => `<li>${verseJump(n, `Câu ${n}`)}<span>${escapeHtml(state.lines[n - 1])}</span></li>`).join('')
    : '<li class="empty">Chưa có câu nào. Bấm ☆ cạnh một câu thơ để lưu.</li>';
  $('bookmarkCount').textContent = marks.length ? String(marks.length) : '';
}

function populatePageSelect() {
  const sel = $('pageSelect');
  sel.innerHTML = '';
  for (let p = 0; p < pageCount(); p++) {
    const o = document.createElement('option');
    const a = p * PAGE_SIZE + 1, b = Math.min((p + 1) * PAGE_SIZE, state.lines.length);
    o.value = String(p);
    o.textContent = `Trang ${p + 1} · câu ${a}–${b}`;
    sel.appendChild(o);
  }
}

/* ---------- Navigation ---------- */

function jumpToLine(n) {
  n = Number(n);
  if (!Number.isInteger(n) || n < 1 || n > state.lines.length) return;
  state.selected = n;
  state.page = pageOfLine(n);
  renderPage();
  if (location.hash !== `#cau-${n}`) history.replaceState(null, '', `#cau-${n}`);
}

function goPage(p) {
  state.selected = null;
  state.page = p;
  renderPage();
  history.replaceState(null, '', location.pathname + location.search);
}

/* ---------- Search ---------- */

function runSearch(query) {
  const box = $('searchResults');
  const q = query.trim();
  if (!q) { box.hidden = true; return; }
  if (/^\d+$/.test(q)) {
    box.innerHTML = `<li>${verseJump(q, `Đi tới câu ${q}`)}</li>`;
    box.hidden = false;
    return;
  }
  const hits = window.KieuText.searchLines(state.lines, q, 60);
  box.innerHTML = hits.length
    ? hits.map(h => `<li>${verseJump(h.n, String(h.n))}<span>${escapeHtml(h.text)}</span></li>`).join('') +
      (hits.length === 60 ? '<li class="empty">Chỉ hiện 60 kết quả đầu, hãy gõ cụ thể hơn.</li>' : '')
    : '<li class="empty">Không tìm thấy. Có thể gõ không dấu, ví dụ “tram nam”.</li>';
  box.hidden = false;
}

/* ---------- Read aloud ---------- */

function vietnameseVoice() {
  const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  return voices.find(v => /^vi/i.test(v.lang)) || null;
}

function speak(lines, onDone) {
  if (!window.speechSynthesis) { alert('Trình duyệt này không hỗ trợ đọc to.'); return; }
  speechSynthesis.cancel();
  const voice = vietnameseVoice();
  if (!voice) {
    const note = $('speechNote');
    note.hidden = false;
    note.textContent = 'Máy của bạn chưa có giọng đọc tiếng Việt, nên giọng đọc có thể không chuẩn. Có thể cài thêm giọng tiếng Việt trong cài đặt ngôn ngữ của máy.';
  }
  state.speaking = true;
  $('readPage').textContent = '⏹ Dừng đọc';
  lines.forEach((text, i) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'vi-VN';
    if (voice) u.voice = voice;
    u.rate = 0.9;
    if (i === lines.length - 1) u.onend = () => { stopSpeaking(); if (onDone) onDone(); };
    speechSynthesis.speak(u);
  });
}

function stopSpeaking() {
  if (window.speechSynthesis) speechSynthesis.cancel();
  state.speaking = false;
  $('readPage').textContent = '🔊 Đọc trang này';
}

/* ---------- Wiring ---------- */

function bindEvents() {
  document.addEventListener('click', e => {
    const jump = e.target.closest('.verse-jump');
    if (jump && jump.dataset.targetLine) {
      e.preventDefault();
      $('searchResults').hidden = true;
      $('bookmarks').hidden = true;
      jumpToLine(jump.dataset.targetLine);
      return;
    }
    const mark = e.target.closest('[data-mark]');
    if (mark) {
      const n = Number(mark.dataset.mark);
      const marks = new Set(store.get(LS_MARKS, []));
      marks.has(n) ? marks.delete(n) : marks.add(n);
      store.set(LS_MARKS, [...marks]);
      renderPage({ scroll: false });
      renderBookmarks();
      return;
    }
    const say = e.target.closest('[data-say]');
    if (say) {
      const n = Number(say.dataset.say);
      speak(state.lines.slice(n - 1, n + 1));
      return;
    }
    const verse = e.target.closest('.verse.has-notes');
    if (verse) {
      state.selected = Number(verse.dataset.line);
      renderPage({ scroll: false });
      const note = $(`ghi-chu-${state.selected}`);
      if (note) note.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  $('prevPage').addEventListener('click', () => goPage(state.page - 1));
  $('nextPage').addEventListener('click', () => goPage(state.page + 1));
  $('pageSelect').addEventListener('change', e => goPage(Number(e.target.value)));
  $('search').addEventListener('input', e => runSearch(e.target.value));
  $('search').addEventListener('keydown', e => {
    if (e.key === 'Enter' && /^\d+$/.test(e.target.value.trim())) { jumpToLine(e.target.value.trim()); $('searchResults').hidden = true; }
    if (e.key === 'Escape') { e.target.value = ''; $('searchResults').hidden = true; }
  });
  $('bookmarkToggle').addEventListener('click', () => { renderBookmarks(); $('bookmarks').hidden = !$('bookmarks').hidden; });
  $('readPage').addEventListener('click', () => {
    if (state.speaking) { stopSpeaking(); return; }
    const from = state.page * PAGE_SIZE;
    speak(state.lines.slice(from, from + PAGE_SIZE));
  });
  $('retry').addEventListener('click', () => load(true));
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === 'ArrowLeft' && state.page > 0) goPage(state.page - 1);
    if (e.key === 'ArrowRight' && state.page < pageCount() - 1) goPage(state.page + 1);
    if (e.key === '/') { e.preventDefault(); $('search').focus(); }
  });
  window.addEventListener('hashchange', () => {
    const m = location.hash.match(/^#cau-(\d+)$/);
    if (m) jumpToLine(m[1]);
  });
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};
}

function load(refresh) {
  $('status').hidden = false;
  $('statusText').textContent = 'Đang tải văn bản Truyện Kiều…';
  $('retry').hidden = true;
  window.KieuText.loadKieu({ refresh }).then(data => {
    state.lines = data.lines;
    state.source = data;
    populatePageSelect();
    const m = location.hash.match(/^#cau-(\d+)$/);
    if (m) { state.selected = Number(m[1]); state.page = pageOfLine(state.selected); }
    else state.page = store.get(LS_PAGE, 0);
    $('status').hidden = true;
    $('reader').hidden = false;
    const src = data.source === 'local' ? 'bản lưu trong repo (data/truyen-kieu.txt)'
      : `<a href="${escapeHtml(data.sourceUrl || 'https://vi.wikisource.org')}" target="_blank" rel="noopener">Wikisource${data.sourceTitle ? ' · ' + escapeHtml(data.sourceTitle) : ''} ↗</a>`;
    $('sourceNote').innerHTML = `${state.lines.length} câu · Nguồn văn bản: ${src}` +
      (data.warnings && data.warnings.length ? `<br><span class="warn">${escapeHtml(data.warnings.join(' '))}</span>` : '');
    renderPage({ scroll: !!m });
    renderBookmarks();
  }).catch(err => {
    $('statusText').textContent = `Không tải được văn bản: ${err.message}. Hãy kiểm tra kết nối mạng rồi thử lại.`;
    $('retry').hidden = false;
  });
}

bindEvents();
load(false);
