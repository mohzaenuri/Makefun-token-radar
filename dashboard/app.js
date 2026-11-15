/* Launch Radar: sorts, filters and details the board from window.RADAR (data.js). No network. */
(function () {
  var D = window.RADAR;
  if (!D) { document.getElementById('rows').innerHTML = '<tr><td colspan="8">No data loaded.</td></tr>'; return; }
  var $ = function (id) { return document.getElementById(id); };
  var rows = D.rows, live = D.live, mults = D.multiples;

  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) { return n === null || n === undefined ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%'; }
  function age(n) { return n === null || n === undefined ? '—' : (n >= 365 ? (n / 365).toFixed(1) + 'y' : n + 'd'); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---- header stats ---- */
  var top = rows[0], med = rows.length ? rows[Math.floor(rows.length / 2)] : null;
  $('stats').innerHTML =
    '<div><dt>Board rows</dt><dd>' + rows.length + '</dd></div>' +
    '<div><dt>Watchlist</dt><dd>' + D.watchlist_size + '</dd></div>' +
    '<div><dt>Early finds</dt><dd>' + D.early_size + '</dd></div>' +
    '<div><dt>Top implied</dt><dd>' + money(top ? top.implied_value_usd : 0) + '</dd></div>' +
    '<div><dt>Median row</dt><dd>' + money(med ? med.implied_value_usd : 0) + '</dd></div>' +
    '<div><dt>Snapshot</dt><dd><small>' + esc(D.as_of) + '</small></dd></div>';
  $('gmed').textContent = D.global_median;
  $('src').textContent = D.source + ' · as of ' + D.as_of + ' · floor ' + money(D.floor_usd);

  /* ---- filter controls ---- */
  var cats = [], chains = [];
  rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  $('cat').innerHTML = '<option value="">All categories</option>' + cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  $('chain').innerHTML = '<option value="">All chains</option>' + chains.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');

  var sortKey = 'rank', sortDir = 1;
  function filtered() {
    var q = $('q').value.trim().toLowerCase(), cat = $('cat').value, ch = $('chain').value, w = $('watch').checked;
    var out = rows.filter(function (r) {
      if (w && !r.watchlist) return false;
      if (cat && r.category !== cat) return false;
      if (ch && r.chains.indexOf(ch) < 0) return false;
      if (q && (r.name + ' ' + r.slug).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var k = sortKey;
    out.sort(function (a, b) {
      var x = a[k], y = b[k];
      if (x === null || x === undefined) x = k === 'change_7d' ? -1e9 : '';
      if (y === null || y === undefined) y = k === 'change_7d' ? -1e9 : '';
      var d = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y));
      if (d === 0) d = a.slug < b.slug ? -1 : 1;
      return d * sortDir;
    });
    return out;
  }

  function renderBoard() {
    var list = filtered();
    $('count').textContent = list.length + ' of ' + rows.length + ' rows';
    $('rows').innerHTML = list.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><b>' + esc(r.name) + '</b>' + (r.watchlist ? '<span class="badge">watchlist</span>' : '') + '<br><span style="color:var(--faint);font-size:12px">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num ' + (r.change_7d > 0 ? 'pos' : r.change_7d < 0 ? 'neg' : '') + '">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td>' +
        '<td class="num val">' + money(r.implied_value_usd) + '</td>' +
        '<td>' + esc(r.chains.slice(0, 3).join(', ') || '—') + '</td></tr>';
    }).join('');
  }

  /* ---- sorting ---- */
  document.querySelectorAll('#board thead th[data-k]').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-k');
      if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'name' || k === 'category' ? 1 : -1; }
      document.querySelectorAll('#board thead th').forEach(function (h) { h.textContent = h.textContent.replace(/ [▲▼]$/, ''); });
      th.textContent = th.textContent + (sortDir === 1 ? ' ▲' : ' ▼');
      renderBoard();
    });
  });
  ['q', 'cat', 'chain', 'watch'].forEach(function (id) { $(id).addEventListener('input', renderBoard); });
  $('reset').addEventListener('click', function () {
    $('q').value = ''; $('cat').value = ''; $('chain').value = ''; $('watch').checked = false;
    sortKey = 'rank'; sortDir = 1; renderBoard();
  });

  /* ---- detail view ---- */
  function multOf(r) { for (var i = 0; i < mults.length; i++) if (mults[i].category === r.category) return mults[i]; return null; }
  function showDetail(slug) {
    var r = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].slug === slug) { r = rows[i]; break; }
    var box = $('detail');
    if (!r) { box.hidden = true; return; }
    var m = multOf(r);
    var comps = m ? m.comparables.map(function (c) {
      return '<b>' + esc(c.name) + '</b> ' + money(c.tvl_usd) + ' TVL &times; ' + c.ratio + ' = ' + money(c.mcap_usd);
    }).join(' &middot; ') : 'No live peers in this category; the global median is used.';
    box.innerHTML =
      '<h2>#' + r.rank + ' ' + esc(r.name) + (r.watchlist ? '<span class="badge">watchlist</span>' : '') + '</h2>' +
      '<p class="meta">' + esc(r.slug) + ' &middot; ' + esc(r.category || 'uncategorised') + ' &middot; ' + esc(r.chains.join(', ') || 'no chains listed') + ' &middot; listed ' + esc(r.listed_at || 'unknown') + ' &middot; records no token</p>' +
      '<dl class="math">' +
      '<div><dt>Implied value</dt><dd>' + money(r.implied_value_usd) + '</dd></div>' +
      '<div><dt>Base = TVL &times; multiple</dt><dd>' + money(r.base_usd) + '<small>' + money(r.tvl_usd) + ' &times; ' + r.category_multiple + '</small></dd></div>' +
      '<div><dt>Growth &times;</dt><dd>' + r.growth_multiplier + '<small>7d ' + pct(r.change_7d) + '</small></dd></div>' +
      '<div><dt>Maturity &times;</dt><dd>' + r.maturity_multiplier + '<small>' + age(r.age_days) + ' old</small></dd></div>' +
      '<div><dt>Breadth &times;</dt><dd>' + r.breadth_multiplier + '<small>' + r.chains.length + ' chain(s)</small></dd></div>' +
      '</dl>' +
      '<h3>Farm plan &mdash; six steps</h3><ol>' +
      r.farm_steps.map(function (s, i) {
        var parts = s.split(' Cost: ');
        return '<li><b>Step ' + (i + 1) + '.</b> ' + esc(parts[0]) + (parts[1] ? '<br>Cost: ' + esc(parts[1]) : '') + '</li>';
      }).join('') + '</ol>' +
      '<h3>Comparables: live ' + esc(r.category || 'uncategorised') + ' protocols</h3>' +
      '<p class="comps">' + comps + '</p>' +
      '<p class="comps">Category multiple ' + r.category_multiple + (m ? ' from ' + m.peers + ' live peer(s), median ' + m.median_ratio + (m.from_global ? ' &mdash; thin category, global median ' + D.global_median + ' used' : '') : ' &mdash; no live peers, global median ' + D.global_median + ' used') + '.</p>';
    box.hidden = false;
    document.querySelectorAll('#rows tr').forEach(function (tr) { tr.classList.toggle('sel', tr.getAttribute('data-slug') === slug); });
  }
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr');
    if (tr) location.hash = 'detail=' + tr.getAttribute('data-slug');
  });

  /* ---- methodology + live tables ---- */
  $('mults').querySelector('tbody').innerHTML = mults.map(function (m) {
    return '<tr><td>' + esc(m.category) + '</td><td class="num">' + m.peers + '</td><td class="num">' + m.median_ratio + '</td><td class="num"><b>' + m.multiple + '</b></td><td>' + (m.from_global ? 'global median' : 'category median') + '</td></tr>';
  }).join('');
  $('live').querySelector('tbody').innerHTML = live.map(function (p) {
    return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(p.category || '—') + '</td><td class="num">' + money(p.tvl_usd) + '</td><td class="num">' + money(p.mcap_usd) + '</td><td class="num">' + (p.ratio === null ? '—' : p.ratio) + '</td><td class="num ' + (p.change_7d > 0 ? 'pos' : p.change_7d < 0 ? 'neg' : '') + '">' + pct(p.change_7d) + '</td></tr>';
  }).join('');

  /* ---- hash routing: #detail=<slug>, #cat=<category>, #watch=1 ---- */
  function applyHash() {
    var h = location.hash.replace(/^#/, '');
    var params = {};
    h.split('&').forEach(function (part) { var kv = part.split('='); if (kv[0]) params[kv[0]] = decodeURIComponent(kv[1] || ''); });
    if (params.cat) { $('cat').value = params.cat; }
    if (params.watch) { $('watch').checked = true; }
    renderBoard();
    if (params.detail) { showDetail(params.detail); var el = $('detail'); if (el.scrollIntoView) el.scrollIntoView({ behavior: 'instant', block: 'start' }); }
    else { $('detail').hidden = true; }
  }
  window.addEventListener('hashchange', applyHash);
  applyHash();
})();
