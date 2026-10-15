/* РОСТ-М — общий скрипт сайта. Без фреймворков.
   Страницы собраны заранее (rostm/site.py) и читаются без JS;
   здесь — город, меню, подсказки поиска, фильтры каталога, калькулятор и заявка. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var PAGE = 24;
  // Офлайн-копия (открывается двойным щелчком, без сервера): адреса относительные, данные — из .js
  var ROOT = typeof window.RM_ROOT === 'string' ? window.RM_ROOT : null;
  function U(p) {
    if (ROOT === null) return p;
    var m = /^\/([^?#]*)(.*)$/.exec(p);
    if (!m) return p;
    var path = m[1];
    if (path === '' || path.slice(-1) === '/') path += 'index.html';
    return ROOT + path + m[2];
  }
  function loadScriptData(file, key) {
    return new Promise(function (ok, fail) {
      var sc = document.createElement('script');
      sc.src = ROOT + file + '?v=' + (document.documentElement.dataset.v || '');   // новая версия — без старого кэша
      sc.onload = function () { ok((window.RM_DATA || {})[key]); };
      sc.onerror = fail;
      document.head.appendChild(sc);
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function plural(n, a, b, c) {
    n = Math.abs(n) % 100;
    var m = n % 10;
    if (m === 1 && n !== 11) return a;
    if (m >= 2 && m <= 4 && (n < 10 || n >= 20)) return b;
    return c;
  }
  function numRu(v, d) {
    var s = (+v).toFixed(d == null ? 2 : d).replace(/\.?0+$/, '');
    return s.replace('.', ',');
  }
  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var ss = {
    get: function (k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- прокрутка: позицию восстанавливаем только при «Назад», шапку меняет только пользователь ---------- */
  var nav0 = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
  var IS_BACK = nav0.type ? nav0.type === 'back_forward' : !!(performance.navigation && performance.navigation.type === 2);
  var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var progUntil = 0;
  function progScroll(fn) { progUntil = Date.now() + 150; fn(); }
  function manualScroll() {
    try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
    if (!IS_BACK && !location.hash) progScroll(function () { window.scrollTo(0, 0); });
  }
  /* Блок, который перерисовывается: высоту держим, пока документ не станет короче текущей прокрутки. */
  function relax(block) {
    var r = block.getBoundingClientRect(), bottom = r.top;
    for (var c = block.firstElementChild; c; c = c.nextElementSibling) {
      var b = c.getBoundingClientRect();
      if (b.height) bottom = Math.max(bottom, b.bottom);
    }
    var natural = bottom - r.top, extra = r.height - natural;
    var need = window.scrollY + window.innerHeight - (document.documentElement.scrollHeight - extra);
    block.style.minHeight = need > 1 ? Math.ceil(natural + need) + 'px' : '';
    if (block.style.minHeight && !block.rmRelax) {
      block.rmRelax = function () { relax(block); if (!block.style.minHeight) { window.removeEventListener('scroll', block.rmRelax); block.rmRelax = null; } };
      window.addEventListener('scroll', block.rmRelax, { passive: true });
    }
  }
  /* Смена внутри страницы: элемент, по которому нажали, остаётся на том же месте экрана. */
  function stable(anchor, block, mutate) {
    var top0 = anchor ? anchor.getBoundingClientRect().top : 0;
    if (block) block.style.minHeight = block.getBoundingClientRect().height + 'px';
    mutate(function () {
      if (anchor && document.documentElement.contains(anchor) && anchor.getClientRects().length) {
        var d = anchor.getBoundingClientRect().top - top0;
        if (Math.abs(d) > 0.5) progScroll(function () { window.scrollBy(0, d); });
      }
      if (block) relax(block);
    });
  }
  function fadeImgs(root) {
    $$('img', root).forEach(function (im) {
      if (im.closest('.hdr, .ftr, .hero__mosaic, .fmt__tile') || (im.complete && im.naturalWidth)) return;
      im.classList.add('ld');
      var on = function () { im.classList.add('is-ld'); };
      im.addEventListener('load', on, { once: true });
      im.addEventListener('error', on, { once: true });
    });
  }
  function initMotion() {
    fadeImgs(document);
    var io = 'IntersectionObserver' in window && !REDUCE ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px 240px 0px' }) : null;      // запускаем заранее, до входа в экран
    var vh = window.innerHeight;
    $$('.formats, .facade__fig').forEach(function (el) {
      if (!io || el.getBoundingClientRect().top < vh + 240) el.classList.add('is-in'); else io.observe(el);
    });
    if (!io) return;
    // появление снизу на 12 px, один раз; первый экран не трогаем; задержка 40 мс, не больше шести шагов
    $$('main .sec .wrap > *, .designs > *, .formats > *, .cards > *, .dirs > *, .why > li, .offices > *, .ps-group, .pp-more > *, .sec-in')
      .forEach(function (el) {
        if (el.closest('.hero') || el.matches('.designs, .formats, .cards, .dirs, .why, .offices, .facade') ||
            el.getBoundingClientRect().top < vh + 240 || el.classList.contains('rv')) return;
        var i = 0;
        for (var p = el.previousElementSibling; p && i < 6; p = p.previousElementSibling) i++;
        el.classList.add('rv');
        el.style.setProperty('--i', Math.min(i, 6));
        io.observe(el);
      });
  }
  function initCompact() {
    var hdr = $('[data-hdr]');
    if (!hdr) return;
    var wide = window.matchMedia('(min-width: 981px)'), lastY = window.scrollY;
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      if (!wide.matches || y < 80) { hdr.classList.remove('is-compact'); lastY = y; return; }
      if (Date.now() < progUntil || !$('[data-mega]').hidden) { lastY = y; return; }
      if (Math.abs(y - lastY) < 8) return;
      hdr.classList.toggle('is-compact', y > lastY);
      lastY = y;
    }, { passive: true });
  }

  /* Транслит как в rostm/importers.slug — адреса брендов совпадают с собранными страницами. */
  var TR = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y',
    'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h',
    'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya' };
  function slugify(s) {
    return String(s).toLowerCase().split('').map(function (c) { return TR[c] != null ? TR[c] : c; }).join('')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  /* Поиск: бренды на кириллице и латинице, «х» и «*» между цифрами — это «×». */
  var ALIASES = [
    ['керранова', 'kerranova'], ['керанова', 'kerranova'], ['гресе', 'gresse'], ['грессе', 'gresse'],
    ['идальго', 'idalgo'], ['грасаро', 'grasaro'], ['гранитея', 'granitea'], ['граниtea', 'granitea'],
    ['винчи', 'vinchi'], ['силк стоун', 'silk stone'], ['степпе', 'steppe'], ['степпе', 'steppe'],
    ['ван шенг', 'wan sheng'], ['ваншенг', 'wan sheng'], ['зерде', 'zerde'], ['прайм', 'prime'],
    ['ласселсбергер', 'lb ceramics'], ['lb', 'lb ceramics'], ['лб', 'lb ceramics'], ['lasselsberger', 'lb ceramics'],
    ['ласельсбергер', 'lb ceramics'], ['uralgres', 'уралгрес'], ['таганай', 'грани таганая'], ['ural', 'уралгрес']
  ];
  function norm(s) {
    s = ' ' + String(s || '').toLowerCase().replace(/ё/g, 'е') + ' ';
    s = s.replace(/(\d)\s*[xх×*]\s*(?=\d)/g, '$1×');
    s = s.replace(/[«»"(),.;:!?]/g, ' ').replace(/\s+/g, ' ');
    ALIASES.forEach(function (a) {
      s = s.split(' ' + a[0] + ' ').join(' ' + a[1] + ' ');
    });
    return s.trim();
  }
  function words(q) { return norm(q).split(' ').filter(Boolean); }
  function matchAll(hay, ws) {
    for (var i = 0; i < ws.length; i++) if (hay.indexOf(ws[i]) < 0) return false;
    return true;
  }

  function getJSON(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }
  var cache = {};
  function load(name) {
    if (!cache[name]) cache[name] = ROOT !== null ? loadScriptData('data/' + name + '.js', name) :
      getJSON('/data/' + name + '.json?v=' + (document.documentElement.dataset.v || ''));
    return cache[name];
  }

  /* ---------- шаблоны, те же, что в rostm/site.py ---------- */
  var ST = { stock: 'В наличии', low: 'Мало, уточняйте', ask: 'Наличие уточняйте', order: 'Под заказ' };
  var DESIGNS = { wood: 'Под дерево', marble: 'Под мрамор', stone: 'Под камень', concrete: 'Под бетон',
    terrazzo: 'Терраццо', plain: 'Однотонный и технический' };

  function mm(v) { return String(+v).replace('.', ','); }
  function specLine(x) {
    var s = x.f + (x.t ? '×' + mm(x.t) : '');
    return s + (x.s ? ' · ' + x.s.toLowerCase() : '');
  }
  function tileSvg(x) {
    var w = x.w || 600, h = x.h || 600, s = 140 / Math.max(w, h), rw = w * s, rh = h * s;
    return '<svg class="ph" viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="' +
      esc('Фото нет. Схема формата ' + (x.f || '')) + '"><rect width="200" height="200" fill="#f3f3f0"/>' +
      '<rect x="' + (100 - rw / 2).toFixed(1) + '" y="' + (100 - rh / 2).toFixed(1) + '" width="' + rw.toFixed(1) +
      '" height="' + rh.toFixed(1) + '" fill="' + esc(x.x || '#cfccc5') + '" stroke="rgba(21,25,30,.28)"/></svg>';
  }
  function picture(x, sizes, lazy) {
    if (!x.im) return tileSvg(x);
    var ims = ROOT !== null ? x.im.filter(function (w) { return w <= (window.RM_MAXW || 960); }) : x.im;
    if (!ims.length) ims = x.im.slice(0, 1);
    var set = ims.map(function (w) { return U('/img/p/' + x.i + '-' + w + '.webp') + ' ' + w + 'w'; }).join(', ');
    var src = U('/img/p/' + x.i + '-' + ims[Math.min(1, ims.length - 1)] + '.webp');
    return '<img src="' + src + '" srcset="' + set + '" sizes="' + (sizes || '(max-width: 640px) 50vw, 300px') +
      '" width="' + x.iw + '" height="' + x.ih + '" alt="' + esc(x.b + ' ' + x.n + ', ' + x.f) + '" decoding="async"' +
      (lazy === false ? '' : ' loading="lazy"') + '>';
  }
  function card(x, lazy) {
    var url = U('/p/' + x.i + '/');
    var flag = x.nw ? '<span class="card__flag card__flag--new">Новинка</span>' : (x.fa ? '<span class="card__flag">Для фасада</span>' : '');
    return '<article class="card"><a class="card__pic" href="' + url + '" tabindex="-1" aria-hidden="true">' + picture(x, null, lazy) +
      flag + '</a><div class="card__sku">' + (x.a ? 'Арт. ' + esc(x.a) : '&nbsp;') + '</div><a class="card__name" href="' + url + '">' +
      esc(x.tn || x.n) + '</a><div class="card__foot"><div class="card__row">' +
      '<span class="card__price">Цена по запросу</span><span class="st st--' + x.st + '">' + ST[x.st] + '</span></div>' +
      '<button class="btn btn--line btn--wide" type="button" data-callback data-cb-id="' + esc(x.i) + '">Узнать цену</button></div></article>';
  }
  function psRow(x) {
    return '<article class="card card--ps"><div class="card__sku">' + esc(x.b) + '</div><a class="card__name" href="' + U('/p/' + x.i + '/') + '">' + esc(x.n) + '</a><div class="card__foot"><div class="card__row"><span class="card__price">Цена по запросу</span>' +
      '<span class="st st--' + x.st + '">' + ST[x.st] + '</span></div><button class="btn btn--line btn--wide" type="button" ' +
      'data-callback data-cb-id="' + esc(x.i) + '">Узнать цену</button></div></article>';
  }

  /* ---------- город ---------- */
  var CITIES = {
    chel: { name: 'Челябинск', tel: '+79514818351', phone: '+7 951 481-83-51', sub: 'Челябинск', addr: 'ул. Академика Королёва, 20', hours: 'пн–пт 10:00–17:00' },
    ekb: { name: 'Екатеринбург', tel: '+79961309169', phone: '+7 996 130-91-69', sub: 'Екатеринбург', addr: 'ул. Ленина, 52а', hours: 'пн–пт 10:00–17:00' }
  };
  function currentCity() { var c = ls.get('rm-city'); return CITIES[c] ? c : 'chel'; }
  function applyCity(id) {
    var c = CITIES[id];
    ls.set('rm-city', id);
    $$('[data-city-name]').forEach(function (el) { el.textContent = c.name; });
    $$('[data-city-phone]').forEach(function (el) { el.textContent = c.phone; el.href = 'tel:' + c.tel; });
    $$('[data-city-tel]').forEach(function (el) { el.href = 'tel:' + c.tel; });
    $$('[data-city-phone-sub]').forEach(function (el) { el.textContent = c.sub; });
    $$('[data-city-addr]').forEach(function (el) { el.textContent = c.addr; });
    var tpl = $('template[data-ekb-hours]');
    $$('[data-city-hours]').forEach(function (el) {
      if (c.hours) el.textContent = c.hours;
      else el.innerHTML = tpl ? tpl.innerHTML : '';
    });
    $$('[data-city-id]').forEach(function (el) { el.setAttribute('aria-selected', el.dataset.cityId === id ? 'true' : 'false'); });
    $$('[data-city-set]').forEach(function (el) { el.setAttribute('aria-checked', el.dataset.citySet === id ? 'true' : 'false'); });
  }
  function initCity() {
    var box = $('[data-city]');
    applyCity(currentCity());
    $$('[data-city-set]').forEach(function (b) {
      b.addEventListener('click', function () { applyCity(b.dataset.citySet); });
    });
    var seg = $('.drawer .seg');
    if (seg) seg.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var bs = $$('[data-city-set]', seg), i = bs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length];
      n.focus(); n.click(); e.preventDefault();
    });
    if (!box) return;
    var btn = $('[data-city-btn]', box), list = $('[data-city-list]', box);
    var opts = $$('[role=option]', list);
    function open() {
      list.hidden = false; btn.setAttribute('aria-expanded', 'true');
      var cur = opts.filter(function (o) { return o.dataset.cityId === currentCity(); })[0] || opts[0];
      cur.focus();
    }
    function close(focusBtn) {
      list.hidden = true; btn.setAttribute('aria-expanded', 'false');
      if (focusBtn) btn.focus();
    }
    function pick(o) { applyCity(o.dataset.cityId); close(true); }
    btn.addEventListener('click', function () { list.hidden ? open() : close(); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
    });
    opts.forEach(function (o) {
      o.addEventListener('click', function () { pick(o); });
    });
    list.addEventListener('keydown', function (e) {
      var i = opts.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); opts[(i + 1) % opts.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); opts[(i + opts.length - 1) % opts.length].focus(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (i >= 0) pick(opts[i]); }
      else if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') close();
    });
    document.addEventListener('click', function (e) { if (!list.hidden && !box.contains(e.target)) close(); });
  }

  /* ---------- шапка: мега-меню и мобильное меню ---------- */
  function focusables(root) {
    return $$('a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select, textarea, [tabindex="0"]', root)
      .filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
  }
  function initHeader() {
    var hdr = $('[data-hdr]');
    if (!hdr) return;
    var mb = $('[data-mega-btn]'), mega = $('[data-mega]');
    if (mb && mega) {
      var setMega = function (on, focusBtn) {
        mega.hidden = !on; mb.setAttribute('aria-expanded', on ? 'true' : 'false');
        if (!on && focusBtn) mb.focus();
      };
      mb.addEventListener('click', function () {
        if (window.matchMedia('(max-width: 980px)').matches) { location.href = U('/keramogranit/'); return; }
        setMega(mega.hidden);
        if (!mega.hidden) { var f = $('a', mega); if (f) f.focus(); }
      });
      mega.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); setMega(false, true); } });
      mb.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !mega.hidden) setMega(false); });
      mega.addEventListener('focusout', function (e) {
        if (e.relatedTarget && !mega.contains(e.relatedTarget) && e.relatedTarget !== mb) setMega(false);
      });
      document.addEventListener('click', function (e) {
        if (!mega.hidden && !mega.contains(e.target) && !mb.contains(e.target)) setMega(false);
      });
    }
    var burger = $('[data-burger]'), drawer = $('[data-drawer]');
    if (burger && drawer) {
      var setDrawer = function (on) {
        document.documentElement.style.setProperty('--hdr-h', Math.round(hdr.querySelector('.hdr-main').getBoundingClientRect().bottom) + 'px');
        drawer.hidden = !on;
        burger.setAttribute('aria-expanded', on ? 'true' : 'false');
        burger.setAttribute('aria-label', on ? 'Закрыть меню' : 'Меню');
        document.body.classList.toggle('no-scroll', on);
        if (on) { var f = focusables(drawer)[0]; if (f) f.focus(); }
        else burger.focus();
      };
      burger.addEventListener('click', function () { setDrawer(drawer.hidden); });
      document.addEventListener('keydown', function (e) {
        if (drawer.hidden) return;
        if (e.key === 'Escape') { e.preventDefault(); setDrawer(false); return; }
        if (e.key !== 'Tab') return;
        var f = [burger].concat(focusables(drawer));
        var i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        else if (i < 0) { e.preventDefault(); f[0].focus(); }
      });
    }
  }

  /* ---------- подсказки поиска в шапке ---------- */
  var searchIndex = null;
  function loadSearch() {
    if (!searchIndex) {
      searchIndex = (ROOT !== null ? loadScriptData('assets/search.js', 'search') :
        getJSON('/assets/search.json?v=' + (document.documentElement.dataset.v || ''))).then(function (d) {
        return d.r.map(function (r) {
          var b = d.b[r[2]];
          var x = { i: b[1] + r[0], n: r[1], b: b[0], ps: b[2] === 'p', f: r[3], a: r[4], img: r[5], d: r[6] >= 0 ? d.d[r[6]] : '' };
          x.hay = norm([x.b, x.n, x.f, x.a, x.d, x.ps ? 'подсистема' : 'керамогранит'].join(' '));
          return x;
        });
      });
    }
    return searchIndex;
  }
  function searchRows(rows, q) {
    var ws = words(q);
    if (!ws.length) return [];
    var out = rows.filter(function (x) { return matchAll(x.hay, ws); });
    var nq = norm(q);
    out.sort(function (a, b) {
      var sa = (norm(a.n).indexOf(nq) === 0 ? 0 : 2) + (a.img ? 0 : 1), sb = (norm(b.n).indexOf(nq) === 0 ? 0 : 2) + (b.img ? 0 : 1);
      return sa - sb;
    });
    return out;
  }
  function initSuggest() {
    var form = $('[data-search]');
    if (!form) return;
    var inp = $('[data-search-input]', form), box = $('[data-suggest]', form);
    var hl = -1, timer = null;
    function close() { box.hidden = true; inp.setAttribute('aria-expanded', 'false'); hl = -1; }
    function render(q, rows) {
      var res = searchRows(rows, q);
      if (!q.trim()) { close(); return; }
      if (!res.length) {
        box.innerHTML = '<div class="sg-none">Ничего не нашлось. У поставщиков около 10 000 позиций — <a href="' + U('/poisk/?q=' +
          encodeURIComponent(q)) + '">оставьте запрос</a>, найдём.</div>';
      } else {
        box.innerHTML = res.slice(0, 7).map(function (x, i) {
          var img = x.img ? '<img src="' + U('/img/p/' + esc(x.i) + '-' + x.img + '.webp') + '" alt="" width="44" height="44" loading="lazy">' : '';
          return '<a id="sg-' + i + '" role="option" href="' + U('/p/' + esc(x.i) + '/') + '"><span class="sg-pic">' + img + '</span><span class="sg-t">' +
            esc(x.n) + '<small>' + esc(x.b) + (x.a ? ' · арт. ' + esc(x.a) : '') + '</small></span><span class="sg-f">' + esc(x.f) + '</span></a>';
        }).join('') + '<a class="sg-all" href="' + U('/poisk/?q=' + encodeURIComponent(q)) + '">Все результаты: ' + res.length + '</a>';
      }
      box.setAttribute('role', 'listbox');
      box.hidden = false; inp.setAttribute('aria-expanded', 'true'); hl = -1;
    }
    inp.setAttribute('role', 'combobox');
    inp.setAttribute('aria-expanded', 'false');
    inp.addEventListener('focus', loadSearch, { once: true });
    inp.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var q = inp.value;
        loadSearch().then(function (rows) { if (inp.value === q) render(q, rows); }).catch(close);
      }, 200);
    });
    inp.addEventListener('keydown', function (e) {
      var links = $$('a', box);
      if (box.hidden || !links.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        hl = e.key === 'ArrowDown' ? (hl + 1) % links.length : (hl <= 0 ? links.length - 1 : hl - 1);
        links.forEach(function (a, i) { a.classList.toggle('is-hl', i === hl); });
        inp.setAttribute('aria-activedescendant', links[hl].id || '');
      } else if (e.key === 'Enter' && hl >= 0) {
        e.preventDefault(); location.href = links[hl].href;
      } else if (e.key === 'Escape') { close(); }
    });
    form.addEventListener('submit', function (e) { if (!inp.value.trim()) e.preventDefault(); });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) close(); });
  }

  /* ---------- каталог керамогранита ---------- */
  var GROUPS = ['design', 'fmt', 'color', 'surf', 'brand', 'st'];
  var FIELD = { design: 'd', fmt: 'g', color: 'k', surf: 's', brand: 'b', st: 'st' };
  var CHIP_LABEL = { design: function (v) { return DESIGNS[v] || v; }, st: function (v) { return ST[v] || v; } };

  function encVal(g, v) {
    if (g === 'fmt') return v.replace('×', 'x');
    if (g === 'brand') return slugify(v);
    return v;
  }

  function initCatalog(root) {
    var base = ROOT !== null ? 'index.html' : root.dataset.base;
    var fixed = root.dataset.key ? root.dataset.key.split(':') : null;      // ['design','marble'] на посадочной
    var list = $('[data-cat-list]', root), countEl = $('[data-cat-count]', root);
    var moreBox = $('[data-cat-more]', root), empty = $('[data-cat-empty]', root);
    var qInp = $('[data-cat-q]', root), sortSel = $('[data-cat-sort]', root);
    var chips = $('[data-active-chips]', root), panel = $('[data-filters]', root);
    var applyBtn = $('[data-filters-apply]', root), nBadge = $('[data-filters-n]', root);
    var openBtn = $('[data-filters-open]', root);
    var results = $('.results', root), toolbar = $('.toolbar', root), lastClick = null;
    root.addEventListener('pointerdown', function (e) {
      var t = e.target.closest('label, button, a, select, input');
      lastClick = t && !t.closest('[data-active-chips]') ? t : toolbar;
    }, true);
    root.addEventListener('keydown', function () { lastClick = document.activeElement; }, true);
    var isPageN = /\/page\/\d+\/(index\.html)?$/.test(location.pathname);
    var items = null, state = null, shown = PAGE, brandBySlug = {};

    function readURL() {
      var p = new URLSearchParams(location.search), s = { q: p.get('q') || '', sort: p.get('sort') || '', facade: p.get('facade') === '1' };
      GROUPS.forEach(function (g) { s[g] = p.getAll(g).filter(Boolean); });
      return s;
    }
    function decode(s) {
      s.fmt = s.fmt.map(function (v) { return v.replace(/x/g, '×'); });
      s.brand = s.brand.map(function (v) { return brandBySlug[v] || v; });
      return s;
    }
    function query(s) {
      var p = new URLSearchParams();
      GROUPS.forEach(function (g) { s[g].forEach(function (v) { p.append(g, encVal(g, v)); }); });
      if (s.facade) p.set('facade', '1');
      if (s.q) p.set('q', s.q);
      if (s.sort) p.set('sort', s.sort);
      var str = p.toString();
      return str ? '?' + str : '';
    }
    function hasFilters(s) {
      return s.facade || !!s.q || GROUPS.some(function (g) { return s[g].length; });
    }
    function matches(x, s, skip) {
      if (fixed) {
        if (fixed[0] === 'facade') { if (!x.fa) return false; }
        else if ((x[FIELD[fixed[0]]] || '') !== fixed[1]) return false;
      }
      for (var i = 0; i < GROUPS.length; i++) {
        var g = GROUPS[i];
        if (g === skip || !s[g].length) continue;
        if (s[g].indexOf(x[FIELD[g]]) < 0) return false;
      }
      if (s.facade && skip !== 'facade' && !x.fa) return false;
      if (s.q && !matchAll(x.hay, words(s.q))) return false;
      return true;
    }
    function sorted(arr, how) {
      arr = arr.slice();
      if (how === 'name') arr.sort(function (a, b) { return (a.b + a.n).localeCompare(b.b + b.n, 'ru'); });
      else if (how === 'fmt') arr.sort(function (a, b) { return (b.w * b.h) - (a.w * a.h) || a.r - b.r; });
      else arr.sort(function (a, b) { return a.r - b.r; });
      return arr;
    }
    function counts() {
      $$('[data-f]', root).forEach(function (inp) {
        var g = inp.dataset.f, v = inp.value, n = 0;
        items.forEach(function (x) { if (x[FIELD[g]] === v && matches(x, state, g)) n++; });
        var lab = inp.closest('.fopt');
        $('em', lab).textContent = n;
        var zero = n === 0 && !inp.checked;
        inp.disabled = zero;
        lab.classList.toggle('is-zero', zero);
      });
      var fa = $('[data-facade]', root);
      if (fa) {
        var n = 0;
        items.forEach(function (x) { if (x.fa && matches(x, state, 'facade')) n++; });
        $('em', fa.closest('.fopt')).textContent = n;
        fa.disabled = n === 0 && !fa.checked;
        fa.closest('.fopt').classList.toggle('is-zero', fa.disabled);
      }
    }
    function syncInputs() {
      $$('[data-f]', root).forEach(function (inp) { inp.checked = state[inp.dataset.f].indexOf(inp.value) >= 0; });
      var fa = $('[data-facade]', root);
      if (fa) fa.checked = state.facade;
      if (qInp) qInp.value = state.q;
      if (sortSel) sortSel.value = state.sort;
      // скрытые «Ещё N» раскрываем, если выбранное значение среди них
      $$('.fopt[data-more]', root).forEach(function (l) { if ($('input', l).checked) l.hidden = false; });
    }
    function renderChips() {
      var h = [];
      if (fixed) {
        var t = $('[data-cat-title]', root).textContent;
        h.push('<button class="chip" type="button" data-chip-fixed>' + esc(t.replace(/^Керамогранит\s*/, '') || t) + '</button>');
      }
      if (state.facade) h.push('<button class="chip" type="button" data-chip="facade">Для вентфасада</button>');
      GROUPS.forEach(function (g) {
        state[g].forEach(function (v) {
          var lab = CHIP_LABEL[g] ? CHIP_LABEL[g](v) : v;
          h.push('<button class="chip" type="button" data-chip="' + g + '" data-v="' + esc(v) + '" aria-label="Убрать фильтр ' + esc(lab) + '">' + esc(lab) + '</button>');
        });
      });
      if (state.q) h.push('<button class="chip" type="button" data-chip="q" aria-label="Убрать поиск">«' + esc(state.q) + '»</button>');
      if (h.length > 1 || (h.length && !fixed)) h.push('<button class="chip chip--reset" type="button" data-filters-reset>Сбросить всё</button>');
      chips.innerHTML = h.join('');
      var n = (state.facade ? 1 : 0) + GROUPS.reduce(function (a, g) { return a + state[g].length; }, 0);
      if (nBadge) { nBadge.hidden = !n; nBadge.textContent = n; }
    }
    var swapT = null, instant = true;          // первая отрисовка (и возврат «Назад») — без анимации
    function swap(html, done) {
      // старые карточки гаснут за 120 мс, новые появляются за 200 мс
      if (REDUCE || instant || !list.children.length || list.hidden) { list.innerHTML = html; done(); return; }
      clearTimeout(swapT);
      list.classList.add('is-out');
      swapT = setTimeout(function () {
        list.classList.remove('is-out');
        list.innerHTML = html;
        list.classList.add('is-in');
        done();
        setTimeout(function () { list.classList.remove('is-in'); }, 420);
      }, 200);
    }
    function render(keepCards, anchor, append) {
      var res = sorted(items.filter(function (x) { return matches(x, state); }), state.sort);
      var total = res.length;
      countEl.textContent = total + ' ' + plural(total, 'позиция', 'позиции', 'позиций');
      if (applyBtn) applyBtn.textContent = total ? 'Показать ' + total + ' ' + plural(total, 'позицию', 'позиции', 'позиций') : 'Ничего не нашлось';
      var html = keepCards ? null : res.slice(append ? shown - PAGE : 0, shown).map(function (x, i) { return card(x, append || i >= 6); }).join('');
      stable(anchor || null, anchor ? results : null, function (fin) {
        var after = function () {
          empty.hidden = total > 0;
          list.hidden = total === 0;
          fadeImgs(list);
          fin();
        };
        if (html === null) after();
        else if (append) { list.insertAdjacentHTML('beforeend', html); after(); }
        else swap(html, after);
      });
      var rest = total - shown;
      moreBox.innerHTML = rest > 0 ? '<button class="btn btn--line" type="button" data-more-btn>Показать ещё ' +
        Math.min(PAGE, rest) + '</button>' : '';
      if (total === 0) {
        var s = $('[data-cb-search]', empty);
        if (s) s.dataset.cbTopic = state.q ? 'Поиск: ' + state.q : 'Найдите позицию, которой нет на сайте';
      }
      counts();
      renderChips();
      if (applyBtn) applyBtn.disabled = false;
    }
    // смена фильтра, сортировки, сброс — без прокрутки и без новой записи в истории
    function go(changed, anchor) {
      shown = PAGE;
      var url = base + query(state);
      if (isPageN) { location.assign(url); return; }
      var cur = ROOT !== null ? 'index.html' + location.search : location.pathname + location.search;
      if (url !== cur) {
        try { history.replaceState({ cat: 1 }, '', url); } catch (e) {}
      }
      render(false, anchor || lastClick || toolbar);
    }
    function saveScroll() {
      ss.set('rm-cat:' + location.pathname + location.search, { shown: shown, y: window.scrollY });
    }

    function onChange(t) {
      if (t.matches('[data-f]')) {
        var g = t.dataset.f, arr = state[g], i = arr.indexOf(t.value);
        if (t.checked && i < 0) arr.push(t.value);
        if (!t.checked && i >= 0) arr.splice(i, 1);
        go(g);
      } else if (t.matches('[data-facade]')) {
        state.facade = t.checked; go('facade');
      } else if (t.matches('[data-cat-sort]')) {
        state.sort = t.value; go('sort');
      }
    }
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (!t.matches('[data-f], [data-facade], [data-cat-sort]')) return;
      if (items) { onChange(t); return; }
      // данные ещё грузятся: запоминаем выбор и применяем после загрузки
      var val = t.type === 'checkbox' ? t.checked : t.value;
      start().then(function () {
        if (t.type === 'checkbox') t.checked = val; else t.value = val;
        onChange(t);
      });
    });
    if (qInp) {
      var qt;
      qInp.addEventListener('input', function () {
        clearTimeout(qt);
        qt = setTimeout(function () {
          var v = qInp.value.trim();
          start().then(function () { state.q = v; go('q'); });
        }, 200);
      });
    }
    root.addEventListener('click', function (e) {
      var t = e.target.closest('button, a');
      if (!t) return;
      if (t.matches('[data-more-btn]')) {
        shown += PAGE; render(false, list, true);
        var c = list.children[shown - PAGE];
        if (c) { var a = $('a.card__name', c); if (a) a.focus({ preventScroll: true }); }
        saveScroll();
      } else if (t.matches('[data-cat-more-btn]') && !isPageN) {
        e.preventDefault();
        start().then(function () { shown += PAGE; render(false, list, true); saveScroll(); });
      } else if (t.matches('[data-filters-reset]') && items) {
        state = { q: '', sort: state.sort, facade: false };
        GROUPS.forEach(function (g) { state[g] = []; });
        syncInputs(); go('design');
      } else if (t.matches('[data-chip]')) {
        var g = t.dataset.chip;
        if (g === 'facade') state.facade = false;
        else if (g === 'q') state.q = '';
        else state[g] = state[g].filter(function (v) { return v !== t.dataset.v; });
        syncInputs(); go(g);
      } else if (t.matches('[data-chip-fixed]')) {
        location.href = U('/keramogranit/') + query(state);
      } else if (t.matches('[data-fmore]')) {
        $$('.fopt[data-more]', t.parentNode).forEach(function (l) { l.hidden = false; });
        t.remove();
      } else if (t.matches('[data-ftoggle]')) {
        var on = t.getAttribute('aria-expanded') !== 'false';
        t.setAttribute('aria-expanded', on ? 'false' : 'true');
        t.nextElementSibling.hidden = on;
      } else if (t.matches('[data-view]')) {
        stable(t, results, function (fin) { setView(t.dataset.view); fin(); });
      } else if (t.matches('[data-filters-open]')) {
        openPanel(true);
      } else if (t.matches('[data-filters-close], [data-filters-apply]')) {
        openPanel(false);
      } else if (t.closest('.card') && t.matches('a')) {
        saveScroll();
      }
    });

    function setView(v) {
      list.classList.toggle('cards--list', v === 'list');
      $$('[data-view]', root).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.view === v ? 'true' : 'false'); });
      ls.set('rm-view', v);
    }
    var lastFocus = null;
    function openPanel(on) {
      if (!panel) return;
      panel.classList.toggle('is-open', on);
      document.body.classList.toggle('no-scroll', on);
      if (openBtn) openBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) {
        lastFocus = document.activeElement;
        panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
        var c = $('[data-filters-close]', panel); if (c) c.focus();
      } else {
        panel.removeAttribute('role'); panel.removeAttribute('aria-modal');
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
        // закрыли панель фильтров на телефоне: если начало результатов выше экрана — показываем его
        var tb = toolbar && toolbar.getBoundingClientRect().top;
        if (window.matchMedia('(max-width: 980px)').matches && tb < 0) progScroll(function () { window.scrollBy(0, tb - 8); });
      }
    }
    if (panel) panel.addEventListener('keydown', function (e) {
      if (!panel.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); openPanel(false); return; }
      if (e.key !== 'Tab') return;
      var f = focusables(panel), i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
    if (ls.get('rm-view') === 'list') setView('list');

    window.addEventListener('popstate', function () {
      if (!items) return;
      state = decode(readURL()); shown = PAGE; syncInputs(); render();
    });
    window.addEventListener('pagehide', saveScroll);

    manualScroll();
    var initial = readURL();
    var needData = hasFilters(initial) || initial.sort;
    var saved = IS_BACK ? ss.get('rm-cat:' + location.pathname + location.search) : null;
    var started = null;
    function start() {
      if (started) return started;
      started = load('kg').then(function (data) {
        data.forEach(function (x) {
          x.hay = norm([x.b, x.tn || x.n, x.c, x.f, x.a, DESIGNS[x.d] || '', x.s || '', x.k || ''].join(' '));
          brandBySlug[slugify(x.b)] = x.b;
        });
        items = data;
        state = decode(readURL());
        syncInputs();
        if (saved && saved.shown > PAGE) shown = saved.shown;
        var keep = !hasFilters(state) && !state.sort && shown === PAGE && !isPageN;
        render(keep || isPageN);
        if (isPageN) moreBox.innerHTML = moreBox.dataset.html || moreBox.innerHTML;
        if (saved && saved.y) progScroll(function () { window.scrollTo(0, saved.y); });
        instant = false;
      });
      return started;
    }
    if (isPageN) moreBox.dataset.html = moreBox.innerHTML;
    // данные грузим сразу, если пришли с фильтрами или возвращаемся назад; иначе — при первом действии
    if (needData || saved) start();
    else {
      var lazy = function () {
        if (started) return;
        start();
      };
      root.addEventListener('pointerdown', lazy, true);
      root.addEventListener('focusin', lazy, true);
      // «Показать ещё» до загрузки данных — обычная ссылка на следующую страницу, работает и так
      if ('requestIdleCallback' in window) requestIdleCallback(function () { lazy(); }, { timeout: 3000 });
      else setTimeout(lazy, 1500);
    }
  }

  /* ---------- подсистема: разделы и фильтры без перезагрузки и без прокрутки ---------- */
  function initPS(root) {
    var boxes = $$('[data-psf]', root), tabs = $$('[data-ps-sub]', root), groups = $$('[data-ps-group]', root);
    var countEl = $('[data-ps-count]', root), empty = $('[data-ps-empty]', root), h1 = $('[data-ps-h1]', root);
    var cur = (tabs.filter(function (t) { return t.classList.contains('is-on'); })[0] || {}).dataset;
    var sub = cur ? cur.psSub : '';
    var homeHref = U('/'), upHref = U('/podsistema/');
    function rowOk(tr, sel, skip) {
      var th = (tr.dataset.thick || '').split('|'), co = (tr.dataset.coat || '').split('|');
      return (skip === 'thick' || !sel.thick.length || sel.thick.some(function (v) { return th.indexOf(v) >= 0; })) &&
        (skip === 'coat' || !sel.coat.length || sel.coat.some(function (v) { return co.indexOf(v) >= 0; }));
    }
    function inSub(g) { return !sub || g.dataset.sub === sub; }
    function apply() {
      var rows = [];
      groups.forEach(function (g) { if (inSub(g)) rows = rows.concat($$('tbody tr', g)); });
      // толщины — только те, что есть в разделе; значения, дающие 0 при остальных фильтрах, недоступны
      boxes.forEach(function (b) {
        var f = b.dataset.psf, lab = b.closest('.chipbox');
        var present = rows.some(function (tr) { return (tr.dataset[f] || '').split('|').indexOf(b.value) >= 0; });
        if (f === 'thick') { lab.hidden = !present; if (!present) b.checked = false; }
      });
      var sel = { thick: [], coat: [] };
      boxes.forEach(function (b) { if (b.checked) sel[b.dataset.psf].push(b.value); });
      boxes.forEach(function (b) {
        var f = b.dataset.psf, n = 0;
        rows.forEach(function (tr) { if ((tr.dataset[f] || '').split('|').indexOf(b.value) >= 0 && rowOk(tr, sel, f)) n++; });
        b.disabled = !b.checked && n === 0;
      });
      var total = 0;
      groups.forEach(function (g) {
        var n = 0, vis = inSub(g);
        $$('tbody tr', g).forEach(function (tr) { var ok = vis && rowOk(tr, sel); tr.hidden = !ok; if (ok) n++; });
        g.hidden = n === 0;
        total += n;
      });
      countEl.textContent = total + ' ' + plural(total, 'позиция', 'позиции', 'позиций');
      empty.hidden = total > 0;
    }
    function setSub(t) {
      sub = t.dataset.psSub;
      tabs.forEach(function (x) {
        var on = x === t;
        x.classList.toggle('is-on', on);
        if (on) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current');
      });
      if (h1) h1.textContent = t.dataset.h1;
      document.title = t.dataset.title;
      var cr = $('.crumbs', root);
      if (cr) cr.innerHTML = '<a href="' + homeHref + '">Главная</a>' + (sub ? '<a href="' + upHref +
        '">Подсистема вентфасада</a><span aria-current="page">' + esc(t.dataset.h1) + '</span>' :
        '<span aria-current="page">Подсистема вентфасада</span>');
      try { history.replaceState({ ps: 1 }, '', t.getAttribute('href')); } catch (e) {}
    }
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-ps-sub]');
      if (!t || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      if (t.classList.contains('is-on')) return;
      stable(t, root, function (fin) { setSub(t); apply(); fin(); });
    });
    root.addEventListener('change', function (e) {
      if (!e.target.matches('[data-psf]')) return;
      var lab = e.target.closest('.chipbox');
      stable(lab, root, function (fin) { apply(); fin(); });
    });
    var r = $('[data-ps-reset]', root);
    if (r) r.addEventListener('click', function () {
      stable(r, root, function (fin) { boxes.forEach(function (b) { b.checked = false; }); apply(); fin(); });
    });
    manualScroll();
    var key = 'rm-ps:' + location.pathname;
    window.addEventListener('pagehide', function () { ss.set(key, { y: window.scrollY }); });
    var saved = IS_BACK ? ss.get(key) : null;
    if (boxes.some(function (b) { return b.checked; })) apply();     // форма восстановлена браузером
    if (saved && saved.y) progScroll(function () { window.scrollTo(0, saved.y); });
  }

  /* ---------- страница поиска ---------- */
  function initSearchPage(root) {
    var inp = $('[data-search-page]', root), list = $('[data-cat-list]', root);
    var countEl = $('[data-cat-count]', root), empty = $('[data-cat-empty]', root);
    var title = $('[data-cat-title]', root), lead = $('[data-cat-lead]', root);
    var q = new URLSearchParams(location.search).get('q') || '';
    inp.value = q;
    var hdr = $('[data-search-input]'); if (hdr) hdr.value = q;
    if (!q.trim()) { countEl.textContent = ''; inp.focus(); return; }
    title.textContent = 'Результаты поиска «' + q + '»';
    Promise.all([load('kg'), load('ps')]).then(function (d) {
      var ws = words(q);
      var kg = d[0].filter(function (x) {
        return matchAll(norm([x.b, x.n, x.c, x.f, x.a, DESIGNS[x.d] || '', x.s || '', x.k || '', 'керамогранит'].join(' ')), ws);
      }).sort(function (a, b) { return a.r - b.r; });
      var ps = d[1].filter(function (x) { return matchAll(norm([x.b, x.n, 'подсистема'].join(' ')), ws); });
      var total = kg.length + ps.length;
      countEl.textContent = total ? 'Нашлось ' + total + ' ' + plural(total, 'позиция', 'позиции', 'позиций') : '';
      lead.textContent = total ? 'Название коллекции, бренд, артикул или формат.' :
        'Мы не нашли «' + q + '» среди позиций на сайте.';
      list.innerHTML = kg.slice(0, 96).map(function (x, i) { return card(x, i >= 6); }).join('') + ps.map(psRow).join('');
      empty.hidden = total > 0;
      var b = $('[data-cb-search]', empty);
      if (b) b.dataset.cbTopic = 'Поиск: ' + q;
    }).catch(function () {
      countEl.textContent = 'Не удалось загрузить каталог. Обновите страницу или позвоните нам.';
    });
  }

  /* ---------- карточка товара ---------- */
  function initProduct(root) {
    var mcb = $('.mbar__cb');
    if (mcb && root.dataset.product) { mcb.textContent = 'Узнать цену'; mcb.setAttribute('data-cb-id', root.dataset.product); }
    var calc = $('[data-calc]', root);
    if (calc) {
      var area = $('[data-calc-area]', calc), res = $('[data-calc-reserve]', calc), out = $('[data-calc-out]', calc), note = $('[data-calc-note]', calc);
      var box = parseFloat(calc.dataset.box), pcs = parseFloat(calc.dataset.pcs) || 0, pallet = parseFloat(calc.dataset.pallet) || 0;
      var last = null;
      var run = function () {
        var a = parseFloat(String(area.value).replace(/\s/g, '').replace(',', '.'));
        if (!(a > 0)) {
          out.textContent = 'Введите площадь больше нуля';
          if (note) note.textContent = '';
          out.classList.add('is-err');
          area.setAttribute('aria-invalid', 'true');
          last = null;
          return;
        }
        out.classList.remove('is-err');
        area.removeAttribute('aria-invalid');
        var r = parseFloat(res.value) || 0, need = a * (1 + r / 100);
        var boxes = Math.ceil(need / box - 1e-9), m2 = boxes * box;
        // «Для 20 м² с запасом 10% — 14 коробок, всего 22,68 м², 112 шт.»
        var s = 'Для ' + numRu(a) + ' м² ' + (r ? 'с запасом ' + r + '%' : 'без запаса') + ' — ' +
          boxes + ' ' + plural(boxes, 'коробка', 'коробки', 'коробок') + ', всего ' + numRu(m2) + ' м²' + (pcs ? ', ' + (boxes * pcs) + ' шт.' : '.');
        // pallet — коробок на паллете: от одной полной паллеты подсказываем, сколько это паллет
        if (pallet && boxes >= pallet) {
          var pl = boxes / pallet;
          s += (s.slice(-1) === '.' ? ' ' : '. ') + 'Это ' + (pl % 1 ? 'около ' + numRu(pl, 1) + ' паллеты' : pl + ' ' + plural(pl, 'паллета', 'паллеты', 'паллет')) +
            ' — уточним, как удобнее отгрузить.';
        }
        out.textContent = s;
        if (note) note.textContent = 'Считаем целыми коробками: количество округлено вверх' + (r ? ', запас ' + r + '% уже учтён.' : '.');
        last = { a: a, r: r, boxes: boxes, m2: m2, pcs: pcs ? boxes * pcs : 0 };
      };
      area.addEventListener('input', run);
      res.addEventListener('change', run);
      run();
      var send = $('[data-calc-send]', calc);
      if (send) send.addEventListener('click', function () {
        run();
        if (!last) { area.focus(); return; }
        var msg = 'Расчёт: ' + numRu(last.a) + ' м²' + (last.r ? ' (+' + last.r + '% запас)' : ' (без запаса)') + ', нужно ' +
          last.boxes + ' ' + plural(last.boxes, 'коробка', 'коробки', 'коробок') + ', ' + numRu(last.m2) + ' м²' +
          (last.pcs ? ', ' + last.pcs + ' шт.' : '') + '. ' + root.dataset.name;
        var pim = $('.pp__view img, .pp__main img', root);
        openCallback({ id: root.dataset.product, name: root.dataset.name, url: location.pathname, img: pim ? pim.currentSrc || pim.src : '',
          msg: msg, topic: 'Узнать цену: ' + root.dataset.name });
      });
    }
    var zoom = $('[data-zoom]', root), zoomBtn = $('[data-zoom-open]', root);
    if (zoom && zoomBtn) zoomBtn.addEventListener('click', function (e) {
      zoom.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: e.detail }));
    });
    if (zoom) zoom.addEventListener('click', function (e) {
      e.preventDefault();
      var byKey = e.detail === 0;                        // открыто с клавиатуры — тогда и фокус показываем
      var box = document.createElement('div');
      box.className = 'zoom';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', 'Фото крупно');
      // самый крупный из файлов, что есть на сайте (в srcset только существующие)
      var im = $('img', zoom), best = zoom.getAttribute('href'), bw = 0;
      (im && im.getAttribute('srcset') || '').split(',').forEach(function (part) {
        var m = part.trim().split(/\s+/), w = parseInt(m[1], 10) || 0;
        if (m[0] && w > bw) { bw = w; best = m[0]; }
      });
      box.innerHTML = '<img src="' + best + '" alt="' + (im ? im.alt.replace(/"/g, '&quot;') : '') + '"><button class="zoom__x" type="button" aria-label="Закрыть">×</button>';
      var pic = $('img', box), btn = $('button', box), detail = false, kFit = 1, kDet = 1;
      // одно правило для всех фото: вписать целиком в окно (поля 24 px по бокам, 64 px сверху и снизу под кнопку ×),
      // независимо от разрешения файла; длинную плитку на широком экране кладём горизонтально
      var fit = function () {
        var nw = pic.naturalWidth, nh = pic.naturalHeight;
        if (!nw || !nh) return;
        var vw = document.documentElement.clientWidth, vh = window.innerHeight;
        var rot = nh / nw > 2.2 && vw > vh;
        var aw = vw - (vw < 640 ? 32 : 48), ah = vh - 128, w = rot ? nh : nw, h = rot ? nw : nh, k = Math.min(aw / w, ah / h);
        // приближение: до натурального размера файла, но не меньше ×2 и не больше ×3 от вписанного; повёрнутое не приближаем
        kFit = k; kDet = rot ? k : Math.min(Math.max(1, 2 * k), 3 * k);
        if (kDet < k * 1.25) detail = false;
        box.classList.toggle('can-zoom', kDet >= k * 1.25);
        if (hint) hint.hidden = !(kDet >= k * 1.25) || detail;
        box.classList.toggle('zoom--rot', rot);
        box.classList.toggle('zoom--detail', detail);
        var kk = detail ? kDet : k, pw = Math.round(nw * kk), ph = Math.round(nh * kk);
        pic.style.width = pw + 'px';
        pic.style.height = ph + 'px';
        pic.style.margin = detail ? Math.max(0, Math.round((vh - ph) / 2)) + 'px ' + Math.max(0, Math.round((vw - pw) / 2)) + 'px' : '';
      };
      var hint = document.createElement('p');
      hint.className = 'zoom__hint'; hint.hidden = true; hint.textContent = 'Нажмите на фото, чтобы приблизить';
      box.appendChild(hint);
      pic.addEventListener('click', function (ev) {
        if (!box.classList.contains('can-zoom')) return;
        var r = pic.getBoundingClientRect(), rx = (ev.clientX - r.left) / r.width, ry = (ev.clientY - r.top) / r.height;
        detail = !detail; fit();
        if (detail) {                                    // точка под пальцем остаётся на месте
          box.scrollLeft = rx * pic.offsetWidth + parseFloat(pic.style.marginLeft || 0) - ev.clientX;
          box.scrollTop = ry * pic.offsetHeight + parseFloat(pic.style.marginTop || 0) - ev.clientY;
        }
      });
      pic.addEventListener('load', fit);
      window.addEventListener('resize', fit);
      var html = document.documentElement, padR = html.style.paddingRight, ovf = html.style.overflow;
      var sbw = window.innerWidth - html.clientWidth;    // фон не прокручивается и не сдвигается
      html.style.overflow = 'hidden';
      if (sbw > 0) html.style.paddingRight = sbw + 'px';
      var close = function (viaKey) {
        box.remove();
        document.removeEventListener('keydown', key);
        window.removeEventListener('resize', fit);
        html.style.overflow = ovf; html.style.paddingRight = padR;
        try { zoom.focus({ preventScroll: true, focusVisible: !!viaKey }); } catch (er) { zoom.focus(); }
      };
      var key = function (ev) {
        if (ev.key === 'Escape') { ev.preventDefault(); close(true); }
        else if (ev.key === 'Tab') { ev.preventDefault(); btn.focus(); }   // в окне одна кнопка
      };
      box.addEventListener('click', function (ev) {
        if (ev.target === pic || ev.target === hint) return;
        if (detail && ev.target === box) { detail = false; fit(); return; }   // мимо приближенного фото — обратно к целому
        close(ev.detail === 0);
      });
      document.addEventListener('keydown', key);
      document.body.appendChild(box);
      try { btn.focus({ focusVisible: byKey }); } catch (er) { btn.focus(); }
    });
  }

  /* ---------- заявка ---------- */
  function phoneDigits(v) {
    var d = String(v).replace(/\D/g, '');
    if (d.length === 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1);
    else if (d[0] === '7' && String(v).trim().indexOf('+7') === 0) d = d.slice(1);
    return d.slice(0, 10);
  }
  function fmtPhone(d) {
    var r = '+7 (' + d.slice(0, 3);
    if (d.length >= 3) r += ')';
    if (d.length > 3) r += ' ' + d.slice(3, 6);
    if (d.length > 6) r += '-' + d.slice(6, 8);
    if (d.length > 8) r += '-' + d.slice(8, 10);
    return r;
  }
  /* Маска: каретка остаётся после той же цифры, что и до форматирования. */
  function maskPhone(inp) {
    inp.addEventListener('input', function () {
      var pos = inp.selectionStart || 0, raw = inp.value;
      var prefix = raw.trim().indexOf('+7') === 0;
      var before = raw.slice(0, pos).replace(/\D/g, '').length - (prefix ? 1 : 0);
      var d = phoneDigits(raw);
      if (!prefix && d.length === 10 && raw.replace(/\D/g, '').length === 11) before = Math.max(0, before - 1);
      var v = d.length ? fmtPhone(d) : '+7 (';
      inp.value = v;
      var n = 0, p = 4;
      if (before > 0) {
        for (p = 0; p < v.length; p++) {
          if (p >= 4 && /\d/.test(v[p])) { n++; if (n === before) { p++; break; } }
        }
      }
      try { inp.setSelectionRange(p, p); } catch (e) {}
    });
    inp.addEventListener('focus', function () {
      if (!inp.value) {
        inp.value = '+7 (';
        // курсор в конец префикса — только если пользователь ещё ничего не набрал
        setTimeout(function () { if (inp.value === '+7 (') { try { inp.setSelectionRange(4, 4); } catch (e) {} } }, 0);
      }
    });
    inp.addEventListener('blur', function () { if (!phoneDigits(inp.value).length) inp.value = ''; });
  }
  function setErr(el, bad) {
    if (bad) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  }
  function validate(form) {
    var n = $('[data-cb-name]', form), p = $('[data-cb-phone]', form), a = $('[data-cb-agree]', form);
    var nb = !n.value.trim(), pb = phoneDigits(p.value).length !== 10, ab = !a.checked;
    setErr(n, nb); setErr(p, pb); setErr(a, ab);
    $('#cb-agree-err', form).classList.toggle('is-on', ab);
    var first = nb ? n : pb ? p : ab ? a : null;
    if (first) first.focus();
    return !first;
  }

  var dlg, form, ctx = {};
  function openCallback(c) {
    ctx = c || {};
    if (!dlg) return;
    var body = $('[data-cb-body]', dlg), done = $('[data-cb-done]', dlg), box = $('[data-cb-product]', dlg);
    body.hidden = false; done.hidden = true;
    $('[data-cb-fail]', dlg).hidden = true;
    var title = $('#cb-title', dlg), lead = $('[data-cb-lead]', dlg), more = $('[data-cb-more]', dlg);
    if (lead) {
      lead.dataset.base = lead.dataset.base || lead.textContent;
      lead.textContent = ctx.id ? 'Товар уже указан в заявке — оставьте имя и телефон. Менеджер перезвонит и назовёт цену в течение рабочего дня.' : lead.dataset.base;
    }
    if (more) more.open = !!(ctx.msg || $('[data-cb-msg]', dlg).value.trim());   // дополнительные поля — свёрнуты, если не нужны
    if (ctx.id) {
      title.textContent = 'Узнать цену';
      box.hidden = false;
      box.classList.toggle('cb__product--text', !ctx.img);       // подсистема: без картинки
      box.innerHTML = (ctx.img ? '<span class="sg-pic"><img src="' + esc(ctx.img) + '" alt="" width="52" height="52"></span>' : '') +
        '<span>' + esc(ctx.name) + (ctx.sub ? '<small>' + esc(ctx.sub) + '</small>' : '') + '</span>';
    } else if (ctx.topic) {
      title.textContent = /^Посчитать/.test(ctx.topic) ? 'Посчитать фасад' : /^(Найдите|Поиск)/.test(ctx.topic) ? 'Найдём позицию' : 'Заказать звонок';
      box.hidden = false;
      box.classList.add('cb__product--text');
      box.innerHTML = '<span>' + esc(ctx.topic) + '</span>';
    } else {
      title.textContent = 'Заказать звонок';
      box.hidden = true;
    }
    if (ctx.msg) $('[data-cb-msg]', dlg).value = ctx.msg;
    if (!dlg.open) {
      ctx.opener = document.activeElement;
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    }
    setTimeout(function () { var n = $('[data-cb-name]', dlg); if (n && !n.value) n.focus(); }, 30);
  }
  function closeCallback() {
    if (!dlg) return;
    if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
  }
  function ctxFrom(btn) {
    var id = btn.getAttribute('data-cb-id'), topic = btn.getAttribute('data-cb-topic');
    if (id) {
      var c = { id: id };
      var cardEl = btn.closest('.card'), row = btn.closest('tr'), pp = btn.closest('[data-product]') || $('[data-product="' + id + '"]');
      if (cardEl) {
        var nm = $('.card__name', cardEl), top = $('.card__sku', cardEl), sp = $('.card__spec', cardEl), im = $('img', cardEl);
        var topT = top ? top.textContent.trim() : '';
        c.name = sp && topT ? topT + ' ' + nm.textContent : nm.textContent;      // подсистема: «Кронштейн КН» + «КН 90×50×50»
        c.sub = sp ? sp.textContent : topT;
        c.url = nm.getAttribute('href');
        c.img = im ? im.currentSrc || im.src : '';
      } else if (row) {
        var a = $('a', row), grp = btn.closest('[data-ps-group]');
        c.name = (grp ? $('h2', grp).textContent + ': ' : '') + a.textContent;
        c.url = a.getAttribute('href');
      } else if (pp) {
        c.name = pp.dataset.name;
        c.url = location.pathname;
        var pim = $('.pp__view img, .pp__main img', pp);
        c.img = pim ? pim.currentSrc || pim.src : '';
      }
      c.name = c.name || id;
      c.topic = 'Узнать цену: ' + c.name;
      return c;
    }
    return topic ? { topic: topic } : {};
  }
  function initCallback() {
    dlg = $('[data-modal]');
    if (!dlg) return;
    form = $('[data-cb-form]', dlg);
    $$('[data-cb-phone]', dlg).forEach(maskPhone);
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-callback]');
      if (!b) return;
      e.preventDefault();
      openCallback(ctxFrom(b));
    });
    $$('[data-modal-close]', dlg).forEach(function (b) { b.addEventListener('click', closeCallback); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closeCallback(); });
    dlg.addEventListener('close', function () {
      if (ctx.opener && ctx.opener.focus) ctx.opener.focus();
      if (!$('[data-cb-done]', dlg).hidden) { form.reset(); $('[data-cb-msg]', dlg).value = ''; }
    });
    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true') {
        var t = e.target;
        var ok = t.matches('[data-cb-phone]') ? phoneDigits(t.value).length === 10 : t.type === 'checkbox' ? t.checked : !!t.value.trim();
        if (ok) { setErr(t, false); if (t.type === 'checkbox') $('#cb-agree-err', form).classList.remove('is-on'); }
      }
    });
    form.addEventListener('change', function (e) {
      if (e.target.matches('[data-cb-agree]') && e.target.checked) { setErr(e.target, false); $('#cb-agree-err', form).classList.remove('is-on'); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(form)) return;
      var btn = $('[data-cb-submit]', form), fail = $('[data-cb-fail]', form);
      var label = btn.textContent;
      btn.textContent = 'Отправляем…'; btn.disabled = true; btn.setAttribute('aria-busy', 'true');
      fail.hidden = true;
      var city = currentCity();
      var payload = {
        name: $('[data-cb-name]', form).value.trim(),
        phone: '+7' + phoneDigits($('[data-cb-phone]', form).value),
        time: $('[data-cb-time]', form).value,
        msg: $('[data-cb-msg]', form).value.trim(),
        topic: ctx.topic || 'Заказать звонок',
        product: ctx.id ? { id: ctx.id, name: ctx.name, url: ctx.url || '' } : null,
        page: location.pathname + location.search,
        city: CITIES[city].name,
        agree: true,
        website: $('[data-cb-hp]', form).value,
        at: new Date().toISOString()
      };
      var ctrl = 'AbortController' in window ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 10000);
      fetch('/api/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined, credentials: 'same-origin'
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; });
      }).then(function (r) {
        if (r.status === 422 && r.j.field) {           // сервер не принял поле — показываем у поля
          var map = { name: '[data-cb-name]', phone: '[data-cb-phone]', agree: '[data-cb-agree]' };
          var el = map[r.j.field] && $(map[r.j.field], form);
          if (el) { setErr(el, true); el.focus(); return; }
        }
        if (!r.ok && !(r.status === 409 && r.j.duplicate)) throw new Error(r.status);
        $('[data-cb-body]', dlg).hidden = true;
        var done = $('[data-cb-done]', dlg);
        done.hidden = false;
        $('[data-cb-done-title]', dlg).textContent = r.status === 409 ? 'Заявка уже у нас' : 'Заявка принята';
        $('[data-cb-done-text]', dlg).textContent = r.status === 409 ?
          'Вы недавно отправляли заявку с этого номера — менеджер уже её видит и перезвонит.' :
          'Перезвоним в рабочее время' + (ctx.id ? ' и назовём цену.' : '.');
        $('[data-cb-done-title]', dlg).focus();
      }).catch(function () {
        if (ROOT !== null) fail.textContent = 'Это версия сайта для просмотра без сервера — заявки из неё не отправляются. ' +
          'Позвоните: +7 951 481-83-51 (Челябинск), +7 996 130-91-69 (Екатеринбург).';
        fail.hidden = false;           // введённое остаётся в полях
      }).then(function () {
        clearTimeout(timer);
        btn.textContent = label; btn.disabled = false; btn.removeAttribute('aria-busy');
      });
    });
  }

  /* ---------- прочее ---------- */
  function initMisc() {
    var cp = $('[data-copy-req]');
    if (cp) cp.addEventListener('click', function () {
      var src = document.getElementById(cp.getAttribute('aria-controls') || 'req') || cp.closest('section');
      var text = src ? src.innerText.replace(/Скопировать реквизиты\s*/, '').trim() : '';
      var label = cp.textContent;
      var ok = function () { cp.textContent = 'Скопировано'; setTimeout(function () { cp.textContent = label; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () {});
      else {
        var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); ok(); } catch (e) {}
        ta.remove();
      }
    });
    // 404 на месте карточки товара: снятая позиция
    if (document.body.dataset.page === '404' && /^\/p\//.test(location.pathname)) {
      var t = $('[data-404-title]'), l = $('[data-404-lead]'), b = $('[data-404-cta]');
      if (t) t.textContent = 'Позиция не найдена или снята с продажи';
      if (l) l.textContent = 'Её могли убрать из каталога, когда закончились остатки у поставщика. Подберём похожую: по рисунку, формату и цене.';
      if (b) b.dataset.cbTopic = 'Найдите аналог: ' + decodeURIComponent(location.pathname.split('/')[2] || '');
      document.title = 'Позиция не найдена — РОСТ-М';
    }
  }

  function init() {
    initCity();
    initHeader();
    initCompact();
    initSuggest();
    initCallback();
    initMisc();
    var cat = $('[data-catalog]');
    if (cat) {
      if (cat.dataset.catalog === 'kg') initCatalog(cat);
      else if (cat.dataset.catalog === 'ps') initPS(cat);
      else if (cat.dataset.catalog === 'search') initSearchPage(cat);
    }
    var pp = $('[data-product]');
    if (pp) initProduct(pp);
    initMotion();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
