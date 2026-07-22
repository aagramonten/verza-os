/**
 * Vera embeddable widget.
 *
 * Drop-in launcher for the Vera quote assistant. Add one line to any page:
 *
 *   <script src="https://cotizar.verzagarden.com/widget.js" async></script>
 *
 * It injects a floating "Asistente" button (bottom-right) that opens Vera in a
 * panel (an iframe to the chat). On the visitor's first visit it opens once by
 * itself; after that it only opens on click. All markup and styles live in a
 * shadow root so nothing leaks into — or is broken by — the host page.
 *
 * Config via data-* attributes on the <script> tag (all optional):
 *   data-url      Chat URL to load           (default: script origin)
 *   data-label    Button text                (default: "Asistente")
 *   data-auto     "first" | "always" | "never" auto-open behavior (default: "first")
 *   data-color    Accent color               (default: "#5c6b3a")
 */
(function () {
  'use strict';

  // Guard against double injection if the snippet is added more than once.
  if (window.__veraWidgetLoaded) return;
  window.__veraWidgetLoaded = true;

  var script = document.currentScript;
  var origin = (function () {
    try {
      return new URL(script.src).origin;
    } catch (e) {
      return 'https://cotizar.verzagarden.com';
    }
  })();

  var cfg = {
    url: (script && script.getAttribute('data-url')) || origin + '/cotizar',
    label: (script && script.getAttribute('data-label')) || 'Asistente',
    auto: (script && script.getAttribute('data-auto')) || 'first',
    color: (script && script.getAttribute('data-color')) || '#5c6b3a',
  };

  var STORAGE_KEY = 'vera_widget_opened';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    var host = document.createElement('div');
    host.setAttribute('aria-live', 'polite');
    host.style.cssText = 'position:fixed;z-index:2147483647;';
    document.body.appendChild(host);
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

    var style = document.createElement('style');
    style.textContent = [
      ':host,*{box-sizing:border-box;}',
      '.launcher{position:fixed;right:20px;bottom:20px;display:inline-flex;align-items:center;',
      'gap:8px;padding:12px 18px;border:none;border-radius:999px;background:' + cfg.color + ';',
      'color:#fff;font:600 15px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;',
      'cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.28);transition:transform .15s ease,opacity .15s ease;}',
      '.launcher:hover{transform:translateY(-2px);}',
      '.launcher .leaf{font-size:18px;line-height:1;}',
      '.launcher.hidden{opacity:0;pointer-events:none;transform:scale(.8);}',
      '.panel{position:fixed;right:20px;bottom:20px;width:384px;height:540px;max-width:calc(100vw - 40px);',
      'max-height:calc(100dvh - 40px);background:#fff;border-radius:18px;overflow:hidden;',
      'box-shadow:0 20px 48px rgba(28,44,20,.30),0 2px 6px rgba(28,44,20,.14),0 0 0 1px rgba(40,50,30,.05);',
      'display:flex;flex-direction:column;',
      // visibility:hidden while closed: iOS Safari does not reliably honor
      // pointer-events:none over iframes, which left the closed panel eating
      // every touch and froze page scroll on phones.
      'opacity:0;transform:translateY(16px) scale(.98);pointer-events:none;visibility:hidden;',
      'transition:opacity .2s ease,transform .2s ease,visibility .2s;}',
      '.panel.open{opacity:1;transform:none;pointer-events:auto;visibility:visible;}',
      '.bar{display:flex;align-items:center;justify-content:space-between;padding:13px 14px;',
      'background:linear-gradient(135deg,' + cfg.color + ' 0%,#4a5730 100%);color:#fff;flex:0 0 auto;',
      'box-shadow:0 1px 0 rgba(0,0,0,.06);}',
      '.bar .title{display:flex;align-items:center;gap:10px;font:600 15px/1.15 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;}',
      '.bar .ava{width:30px;height:30px;flex:0 0 auto;border-radius:50%;background:rgba(255,255,255,.18);',
      'display:inline-flex;align-items:center;justify-content:center;font-size:16px;}',
      '.bar .title small{display:block;font-weight:400;font-size:11px;opacity:.88;margin-top:2px;letter-spacing:.01em;}',
      '.bar button{background:transparent;border:none;color:#fff;font-size:22px;line-height:1;',
      'cursor:pointer;padding:2px 6px;border-radius:6px;opacity:.9;}',
      '.bar button:hover{opacity:1;background:rgba(255,255,255,.15);}',
      '.frame{flex:1 1 auto;border:none;width:100%;background:#ede8de;}',
      '@media (max-width:480px){',
      '.panel{right:0;bottom:0;width:100vw;height:100dvh;max-width:100vw;max-height:100dvh;border-radius:0;}',
      '.launcher{right:16px;bottom:16px;}}',
    ].join('');
    root.appendChild(style);

    var launcher = document.createElement('button');
    launcher.className = 'launcher';
    launcher.type = 'button';
    launcher.setAttribute('aria-label', 'Abrir asistente Vera');
    launcher.innerHTML = '<span class="leaf" aria-hidden="true">🌿</span><span></span>';
    launcher.querySelector('span:last-child').textContent = cfg.label;
    root.appendChild(launcher);

    var panel = document.createElement('div');
    panel.className = 'panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Asistente Vera');
    panel.innerHTML =
      '<div class="bar"><span class="title"><span class="ava" aria-hidden="true">🌿</span>' +
      '<span>Vera<small>Cotiza tu jardín · Puerto Rico</small></span></span>' +
      '<button type="button" aria-label="Cerrar">&times;</button></div>';
    var frameHolder = document.createElement('div');
    frameHolder.style.cssText = 'flex:1 1 auto;display:flex;';
    panel.appendChild(frameHolder);
    root.appendChild(panel);

    var frame = null;
    var isOpen = false;

    // On phones the panel is fullscreen, so freeze the host page underneath
    // and restore it exactly on close (the position:fixed trick is the only
    // reliable scroll lock on iOS Safari).
    var fullscreenMq = window.matchMedia ? window.matchMedia('(max-width: 480px)') : null;
    var savedScrollY = 0;
    var savedBodyStyle = null;

    function lockScroll() {
      if (!fullscreenMq || !fullscreenMq.matches || savedBodyStyle !== null) return;
      var b = document.body;
      savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      savedBodyStyle = {
        position: b.style.position,
        top: b.style.top,
        width: b.style.width,
        overflow: b.style.overflow,
      };
      b.style.position = 'fixed';
      b.style.top = -savedScrollY + 'px';
      b.style.width = '100%';
      b.style.overflow = 'hidden';
    }

    function unlockScroll() {
      if (savedBodyStyle === null) return;
      var b = document.body;
      b.style.position = savedBodyStyle.position;
      b.style.top = savedBodyStyle.top;
      b.style.width = savedBodyStyle.width;
      b.style.overflow = savedBodyStyle.overflow;
      savedBodyStyle = null;
      window.scrollTo(0, savedScrollY);
    }

    function ensureFrame() {
      if (frame) return;
      frame = document.createElement('iframe');
      frame.className = 'frame';
      frame.setAttribute('title', 'Chat con Vera');
      frame.setAttribute('allow', 'clipboard-write');
      frame.src = cfg.url;
      frameHolder.appendChild(frame);
    }

    function open() {
      if (isOpen) return;
      isOpen = true;
      ensureFrame();
      lockScroll();
      panel.classList.add('open');
      launcher.classList.add('hidden');
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch (e) {
        /* private mode: ignore */
      }
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      panel.classList.remove('open');
      launcher.classList.remove('hidden');
      unlockScroll();
    }

    launcher.addEventListener('click', open);
    panel.querySelector('.bar button').addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) close();
    });

    // Auto-open policy.
    var seen = false;
    try {
      seen = localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      /* ignore */
    }
    // On phones the panel is fullscreen (see the max-width:480px block
    // above), so auto-opening there would greet the visitor with a chat
    // covering the whole page before they asked for it. Auto-open is
    // desktop-only; mobile always starts as just the bubble.
    var isMobile = fullscreenMq ? fullscreenMq.matches : false;
    if (!isMobile && (cfg.auto === 'always' || (cfg.auto === 'first' && !seen))) {
      // Small delay so the widget doesn't fight the host page's own load.
      setTimeout(open, 1200);
    }
  });
})();
