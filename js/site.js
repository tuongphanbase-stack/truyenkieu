// Shared by the classic-poetry readers (truyenkieu, chinhphungam); each repo
// keeps an identical copy of this file, so edit both together.
//
// Load it in <head> without `defer`: it applies the saved (or the system's)
// light/dark theme before the first paint. It also wires every
// [data-theme-toggle] button and registers the offline service worker (sw.js).
// The page names its storage key in <html data-theme-key="...">.
(function () {
  'use strict';

  var root = document.documentElement;
  var KEY = root.getAttribute('data-theme-key') || 'theme';
  var PAPER = { light: '#ffffff', dark: '#1d1c1a' }; // --paper in css/site.css, for the browser bar
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function savedTheme() {
    try {
      // Older versions stored the value JSON-encoded ("\"dark\""); accept both forms.
      var value = String(localStorage.getItem(KEY) || '').replace(/"/g, '');
      return value === 'dark' || value === 'light' ? value : null;
    } catch (e) { return null; }
  }

  function saveTheme(theme) {
    try { localStorage.setItem(KEY, theme); } catch (e) { /* storage blocked */ }
  }

  function systemTheme() {
    return media && media.matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    var dark = theme === 'dark';
    root.classList.toggle('dark', dark);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? PAPER.dark : PAPER.light);
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].textContent = dark ? '☀' : '☾';
      buttons[i].title = dark ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối';
      buttons[i].setAttribute('aria-label', buttons[i].title);
    }
  }

  applyTheme(savedTheme() || systemTheme());

  // Until the reader picks a theme, follow the system setting as it changes.
  if (media) {
    var follow = function () { if (!savedTheme()) applyTheme(systemTheme()); };
    if (media.addEventListener) media.addEventListener('change', follow);
    else if (media.addListener) media.addListener(follow);
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(root.classList.contains('dark') ? 'dark' : 'light'); // label the buttons
  });

  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-theme-toggle]');
    if (!button) return;
    var next = root.classList.contains('dark') ? 'light' : 'dark';
    saveTheme(next);
    applyTheme(next);
  });

  // Offline support. Service workers need https (GitHub Pages) or localhost.
  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || local)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (error) {
        console.warn('Không bật được chế độ đọc ngoại tuyến:', error);
      });
    });
  }
})();
