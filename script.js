/* ==========================================================================
   Logbook — application script
   No frameworks, no build step, no external runtime dependencies besides
   two Google Fonts. Data lives in localStorage as one JSON blob; charts are
   drawn by hand with SVG. Everything below is organised top to bottom:

     1. Icons            5. Aggregation & streaks
     2. Utilities         6. Chart primitives
     3. Storage           7. Forms / side panel
     4. App state          8. Page renderers + boot
   ========================================================================== */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ========================================================================
     1. ICONS — a small hand-built line-icon set (24x24, stroke = currentColor)
     ====================================================================== */
  const ICONS = {
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    'moon-solid': '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    book: '<path d="M4 5.3C4 4.6 4.6 4 5.3 4H12v16H5.3A1.3 1.3 0 0 1 4 18.7z"/><path d="M20 5.3c0-.7-.6-1.3-1.3-1.3H12v16h6.7a1.3 1.3 0 0 0 1.3-1.3z"/>',
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2.2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    gear: '<path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="7" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    sun: '<circle cx="12" cy="12" r="4.3"/><path d="M12 2.5v3M12 18.5v3M4.4 4.4l2.1 2.1M17.5 17.5l2.1 2.1M2.5 12h3M18.5 12h3M4.4 19.6l2.1-2.1M17.5 6.5l2.1-2.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M10 11v6M14 11v6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>',
    upload: '<path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M5 4h14"/>',
    'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
    'chevron-right': '<path d="M9 6l6 6-6 6"/>',
    check: '<path d="M5 12.5l5 5L20 7"/>',
    flame: '<path d="M12 2.3c1 4-4 5-4 9.3a4 4 0 0 0 8 0c0-2-1-3-1-3s2 1 2 4a6 6 0 1 1-12 0c0-5.3 4-7.3 7-10.3z"/>',
    target: '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>',
    'arrow-up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
    'arrow-down': '<path d="M12 5v14M18 13l-6 6-6-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 10.7v5.3"/><circle cx="12" cy="7.6" r=".9" fill="currentColor" stroke="none"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2.2"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>'
  };
  function paintIcons(root) {
    $$('[data-icon]', root || document).forEach((el) => {
      const name = el.getAttribute('data-icon');
      if (ICONS[name] && !el.dataset.painted) {
        el.innerHTML = '<svg viewBox="0 0 24 24">' + ICONS[name] + '</svg>';
        el.classList.add('icon');
        el.dataset.painted = '1';
      }
    });
  }
  function iconHTML(name, extraClass) {
    return '<span class="icon' + (extraClass ? ' ' + extraClass : '') + '" data-icon="' + name + '"></span>';
  }

  /* ========================================================================
     2. UTILITIES — dates, numbers, formatting
     ====================================================================== */
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const pad2 = (n) => String(n).padStart(2, '0');
  function parseISO(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function toISO(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }
  function todayISO() { return toISO(new Date()); }
  function addDays(iso, n) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  function datesRange(n, endISO) {
    const end = endISO || todayISO();
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
    return out;
  }
  function weekdayShort(iso) { return WD[parseISO(iso).getDay()]; }
  function dayNum(iso) { return parseISO(iso).getDate(); }
  function niceDate(iso) {
    const d = parseISO(iso);
    return WD[d.getDay()] + ', ' + d.getDate() + ' ' + MO[d.getMonth()] + ' ' + d.getFullYear();
  }
  function round(v, step) { return Math.round(v / step) * step; }
  function round2(v) { return Math.round(v * 100) / 100; }
  function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function timeToMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }
  function to12h(mins) {
    const m = ((mins % 1440) + 1440) % 1440;
    let h = Math.floor(m / 60);
    const mm = m % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return h + ':' + pad2(mm) + ' ' + ap;
  }
  function computeSleepHours(bed, wake) {
    let diff = timeToMinutes(wake) - timeToMinutes(bed);
    if (diff <= 0) diff += 1440;
    return diff / 60;
  }
  function formatHoursMinutes(hoursFloat) {
    const total = Math.round(hoursFloat * 60);
    const h = Math.floor(total / 60), m = total % 60;
    return m ? h + 'h ' + m + 'm' : h + 'h';
  }
  function formatMinutesShort(totalMin) {
    const t = Math.round(totalMin);
    const h = Math.floor(t / 60), m = t % 60;
    if (h && m) return h + 'h ' + m + 'm';
    if (h) return h + 'h';
    return m + 'm';
  }
  function debounce(fn, ms) {
    let t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }
  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const CATEGORY_COLORS = ['var(--study)', 'var(--sleep)', 'var(--distraction)', '#C9A227', '#7A6FB0', '#4FA9A2', '#C1748A'];

  /* ========================================================================
     3. STORAGE
     ====================================================================== */
  const STORAGE_KEY = 'logbook.v1';
  let storageOK = true;
  (function detectStorage() {
    try {
      const k = '__logbook_probe__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
    } catch (e) { storageOK = false; }
  })();

  function defaultState() {
    return {
      sleep: [], study: [], distractions: [], notes: {},
      settings: { sleepGoal: 8, studyGoal: 4, distractionLimit: 60, theme: null }
    };
  }

  function seedState() {
    const s = defaultState();
    const subjects = ['Math', 'Physics', 'Coding', 'Reading', 'Spanish'];
    const distTypes = ['Phone', 'Social media', 'TV', 'Browsing', 'Chatting'];
    const days = 56;
    for (let i = days - 1; i >= 0; i--) {
      const date = addDays(todayISO(), -i);
      const bedH = 22 + Math.floor(Math.random() * 3);
      const bedM = Math.random() < 0.5 ? 0 : 30;
      const bed = pad2(bedH % 24) + ':' + pad2(bedM);
      const wakeH = 6 + Math.floor(Math.random() * 3);
      const wakeM = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
      const wake = pad2(wakeH) + ':' + pad2(wakeM);
      s.sleep.push({ id: uid(), date, bed, wake, hours: round2(computeSleepHours(bed, wake)), quality: 2 + Math.floor(Math.random() * 4) });

      if (Math.random() < 0.78) {
        const n = Math.random() < 0.3 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          s.study.push({ id: uid(), date, subject: subjects[Math.floor(Math.random() * subjects.length)], hours: round(0.5 + Math.random() * 2.5, 0.25), note: '' });
        }
      }
      const dn = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < dn; k++) {
        s.distractions.push({ id: uid(), date, type: distTypes[Math.floor(Math.random() * distTypes.length)], minutes: 5 + Math.floor(Math.random() * 50), note: '' });
      }
    }
    s.notes[addDays(todayISO(), -3)] = 'Mock test in the morning — felt steady.';
    s.notes[addDays(todayISO(), -10)] = 'Late film night, paid for it the next day.';
    s.notes[addDays(todayISO(), -21)] = 'Essay deadline. Long one.';
    s.notes[addDays(todayISO(), -34)] = 'Started the new study plan.';
    return s;
  }

  const Store = {
    load() {
      if (storageOK) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            const base = defaultState();
            return Object.assign(base, parsed, { settings: Object.assign(base.settings, parsed.settings || {}) });
          }
        } catch (e) { /* fall through to seed */ }
      }
      const seeded = seedState();
      this.save(seeded);
      return seeded;
    },
    save(state) {
      if (!storageOK) return false;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch (e) { storageOK = false; return false; }
    },
    exportFile(state) {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'logbook-backup-' + todayISO() + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  };

  /* ========================================================================
     4. APP STATE
     ====================================================================== */
  const App = {
    state: Store.load(),
    ui: {
      tab: 'dashboard',
      range: { sleep: 14, study: 14, distraction: 14 },
      journal: (() => { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth() }; })()
    }
  };
  function persist() { Store.save(App.state); }

  /* ========================================================================
     5. AGGREGATION & STREAKS
     ====================================================================== */
  const LOOKBACK = 120;

  function denseMap(entries, valueKey) {
    const dates = datesRange(LOOKBACK);
    const map = {};
    dates.forEach((d) => { map[d] = 0; });
    entries.forEach((e) => { if (map[e.date] !== undefined) map[e.date] += (e[valueKey] || 0); });
    return { map, dates };
  }
  function computeStreak(map, meetsGoal, skipTodayIfEmpty) {
    let d = todayISO();
    if (skipTodayIfEmpty && map[d] === 0) d = addDays(d, -1);
    let count = 0;
    while (map[d] !== undefined && meetsGoal(map[d])) { count++; d = addDays(d, -1); }
    return count;
  }

  function movingAverage(values, windowSize) {
    return values.map((_, i) => {
      const start = Math.max(0, i - windowSize + 1);
      const slice = values.slice(start, i + 1);
      return mean(slice);
    });
  }

  function maWindowFor(range) { return range <= 7 ? 3 : range <= 30 ? 7 : 14; }

  /* ========================================================================
     6. CHART PRIMITIVES — plain SVG, no dependencies
     ====================================================================== */
  const NS = 'http://www.w3.org/2000/svg';
  function svgTag(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function renderChartEmpty(container, opts) {
    container.innerHTML =
      '<div class="chart-empty">' +
      iconHTML(opts.icon || 'sparkle') +
      '<strong>' + escapeHTML(opts.title || 'Nothing logged yet') + '</strong>' +
      '<span>' + escapeHTML(opts.hint || 'Add an entry to see it charted here.') + '</span>' +
      '</div>';
    paintIcons(container);
  }

  /**
   * A combined bar + optional line chart. Bars share one y-scale (with an
   * optional dashed goal/limit line); the line can share that scale or use
   * its own independent one (e.g. a time-of-day line next to hour bars).
   */
  function comboBarLine(container, opts) {
    const {
      dates, barValues, barColor, barLabel, barFormat,
      lineValues, lineColor, lineLabel, lineFormat, lineDomain,
      goalValue, goalLabel
    } = opts;

    const hasAnyBar = barValues.some((v) => v > 0);
    const hasAnyLine = lineValues && lineValues.some((v) => v !== null && v !== undefined);
    if (!hasAnyBar && !hasAnyLine) { renderChartEmpty(container, opts.emptyState || {}); return; }

    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'chart-wrap';
    container.appendChild(wrap);

    const width = Math.max(container.clientWidth || 640, 280);
    const height = 260;
    const padLeft = 40, padRight = lineValues ? (opts.sharedScale ? 20 : 46) : 16, padTop = 16, padBottom = 26;
    const innerW = width - padLeft - padRight, innerH = height - padTop - padBottom;
    const n = dates.length;
    const slot = innerW / n;
    const barW = Math.max(3, Math.min(slot * 0.52, 30));

    const maxBar = Math.max(Math.max(...barValues, 0) * 1.15, goalValue ? goalValue * 1.15 : 0, 1);

    let lineMin = 0, lineMax = 1;
    if (hasAnyLine) {
      const present = lineValues.filter((v) => v !== null && v !== undefined);
      if (lineDomain) { lineMin = lineDomain[0]; lineMax = lineDomain[1]; }
      else if (opts.sharedScale) { lineMin = 0; lineMax = maxBar; }
      else {
        lineMin = Math.min(...present); lineMax = Math.max(...present);
        const pad = (lineMax - lineMin) * 0.2 || 1;
        lineMin -= pad; lineMax += pad;
      }
    }
    const yBar = (v) => padTop + innerH - (v / maxBar) * innerH;
    const yLine = (v) => padTop + innerH - ((v - lineMin) / ((lineMax - lineMin) || 1)) * innerH;

    const svg = svgTag('svg', { class: 'chart', viewBox: '0 0 ' + width + ' ' + height, width: '100%', height: 'auto', preserveAspectRatio: 'xMidYMid meet' });

    // gridlines + left axis labels
    for (let i = 0; i <= 3; i++) {
      const y = padTop + (innerH * i) / 3;
      svg.appendChild(svgTag('line', { class: 'gridline', x1: padLeft, x2: width - padRight, y1: y, y2: y, opacity: i === 3 ? 0.9 : 0.45 }));
      const val = maxBar * (1 - i / 3);
      const t = svgTag('text', { class: 'axis-label', x: padLeft - 8, y: y + 3, 'text-anchor': 'end' });
      t.textContent = barFormat ? barFormat(val, true) : Math.round(val);
      svg.appendChild(t);
    }

    // goal / limit dashed line
    if (goalValue && goalValue > 0 && goalValue <= maxBar) {
      const gy = yBar(goalValue);
      svg.appendChild(svgTag('line', { class: 'goal-line', x1: padLeft, x2: width - padRight, y1: gy, y2: gy }));
      const gt = svgTag('text', { class: 'axis-label', x: width - padRight, y: gy - 5, 'text-anchor': 'end', fill: 'var(--rule-red)' });
      gt.textContent = goalLabel || 'Goal';
      svg.appendChild(gt);
    }

    // bars
    barValues.forEach((v, i) => {
      const x = padLeft + i * slot + (slot - barW) / 2;
      const y = yBar(v);
      const h = padTop + innerH - y;
      if (h > 0) {
        svg.appendChild(svgTag('rect', { class: 'bar', x, y, width: barW, height: h, rx: Math.min(4, barW / 2), fill: barColor }));
      }
    });

    // line
    if (hasAnyLine) {
      let d = ''; let open = false;
      const pts = [];
      lineValues.forEach((v, i) => {
        const x = padLeft + i * slot + slot / 2;
        if (v === null || v === undefined) { open = false; return; }
        const y = yLine(v);
        pts.push({ x, y, v, i });
        d += (open ? 'L ' : 'M ') + x + ' ' + y + ' ';
        open = true;
      });
      svg.appendChild(svgTag('path', { class: 'line-path', d, stroke: lineColor }));
      pts.forEach((p) => {
        svg.appendChild(svgTag('circle', { class: 'line-dot', cx: p.x, cy: p.y, r: 3.4, fill: lineColor }));
      });
      // right axis (independent line scale only) — top & bottom labels, to stay quiet.
      // When the line shares the bar scale (e.g. a moving average of the same metric)
      // the left axis already covers it, so a second axis would just be noise.
      if (!opts.sharedScale) {
        [0, 1].forEach((frac) => {
          const val = lineMin + (lineMax - lineMin) * frac;
          const y = padTop + innerH - frac * innerH;
          const t = svgTag('text', { class: 'axis-label', x: width - padRight + 8, y: y + 3, 'text-anchor': 'start', fill: lineColor });
          t.textContent = lineFormat ? lineFormat(val) : Math.round(val);
          svg.appendChild(t);
        });
      }
    }

    // x-axis labels (subset)
    const step = n <= 8 ? 1 : n <= 16 ? 2 : n <= 40 ? Math.ceil(n / 10) : Math.ceil(n / 8);
    dates.forEach((date, i) => {
      if (i % step !== 0 && i !== n - 1) return;
      const x = padLeft + i * slot + slot / 2;
      const t = svgTag('text', { class: 'axis-label', x, y: height - 6, 'text-anchor': 'middle' });
      t.textContent = n <= 9 ? weekdayShort(date) : String(dayNum(date));
      svg.appendChild(t);
    });

    // hit areas + tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    wrap.style.position = 'relative';
    dates.forEach((date, i) => {
      const x = padLeft + i * slot;
      const hit = svgTag('rect', { class: 'hit', x, y: padTop, width: slot, height: innerH });
      hit.addEventListener('pointerenter', showTip);
      hit.addEventListener('pointermove', showTip);
      hit.addEventListener('pointerleave', () => tooltip.classList.remove('is-visible'));
      hit.addEventListener('click', showTip);
      svg.appendChild(hit);

      function showTip(evt) {
        const rect = wrap.getBoundingClientRect();
        let html = '<b>' + niceDate(date) + '</b><br>';
        if (barLabel) html += barLabel + ': ' + (barFormat ? barFormat(barValues[i]) : barValues[i]) + '<br>';
        if (hasAnyLine && lineValues[i] !== null && lineValues[i] !== undefined) {
          html += lineLabel + ': ' + (lineFormat ? lineFormat(lineValues[i]) : lineValues[i]);
        }
        tooltip.innerHTML = html;
        tooltip.style.left = (evt.clientX - rect.left) + 'px';
        tooltip.style.top = (evt.clientY - rect.top) + 'px';
        tooltip.classList.add('is-visible');
      }
    });

    wrap.appendChild(svg);
    wrap.appendChild(tooltip);

    // legend
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    if (barLabel) legend.innerHTML += '<span class="legend-item"><span class="legend-swatch" style="background:' + barColor + '"></span>' + escapeHTML(barLabel) + '</span>';
    if (hasAnyLine) legend.innerHTML += '<span class="legend-item"><span class="legend-swatch line" style="background:' + lineColor + '"></span>' + escapeHTML(lineLabel) + '</span>';
    if (goalValue) legend.innerHTML += '<span class="legend-item">' + iconHTML('target') + ' ' + escapeHTML(goalLabel || 'Goal') + '</span>';
    container.appendChild(legend);
    paintIcons(legend);
  }

  function donutChart(container, opts) {
    const segments = (opts.segments || []).filter((s) => s.value > 0);
    const total = segments.reduce((a, s) => a + s.value, 0);
    if (!total) { renderChartEmpty(container, opts.emptyState || {}); return; }

    container.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'donutwrap';

    const size = 176, r = 68, sw = 22, c = 2 * Math.PI * r;
    const svgWrap = document.createElement('div');
    svgWrap.style.cssText = 'position:relative;width:' + size + 'px;height:' + size + 'px;flex:none;';
    const svg = svgTag('svg', { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size });
    svg.appendChild(svgTag('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'var(--rule)', 'stroke-width': sw }));
    let acc = 0;
    segments.forEach((s) => {
      const frac = s.value / total;
      const circle = svgTag('circle', {
        cx: size / 2, cy: size / 2, r, fill: 'none', stroke: s.color, 'stroke-width': sw,
        'stroke-opacity': s.opacity != null ? s.opacity : 1,
        'stroke-dasharray': (frac * c) + ' ' + c,
        'stroke-dashoffset': -(acc * c),
        transform: 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'
      });
      svg.appendChild(circle);
      acc += frac;
    });
    svgWrap.appendChild(svg);
    const center = document.createElement('div');
    center.className = 'donut-center';
    center.innerHTML = '<b>' + (opts.centerValue || total) + '</b><span>' + escapeHTML(opts.centerLabel || 'total') + '</span>';
    svgWrap.appendChild(center);

    const legend = document.createElement('div');
    legend.className = 'donut-legend';
    segments.sort((a, b) => b.value - a.value).forEach((s) => {
      const pct = Math.round((s.value / total) * 100);
      legend.innerHTML +=
        '<div class="row"><span class="legend-swatch" style="background:' + s.color + ';opacity:' + (s.opacity != null ? s.opacity : 1) + '"></span>' +
        '<span class="name">' + escapeHTML(s.label) + '</span>' +
        '<span class="val">' + (opts.valueFormat ? opts.valueFormat(s.value) : s.value) + '</span>' +
        '<span style="color:var(--ink-faint);font-size:12px;">' + pct + '%</span></div>';
    });

    row.appendChild(svgWrap);
    row.appendChild(legend);
    container.appendChild(row);
  }

  function dayMeta(dateISO) {
    const s = App.state;
    return {
      sleep: s.sleep.some((e) => e.date === dateISO),
      study: s.study.some((e) => e.date === dateISO),
      distraction: s.distractions.some((e) => e.date === dateISO),
      note: !!s.notes[dateISO]
    };
  }
  function buildHeatCell(dateISO, isToday, small) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'heatcell' + (isToday ? ' is-today' : '');
    if (small) btn.style.flex = '0 0 42px';
    const meta = dayMeta(dateISO);
    let dots = '';
    if (meta.sleep) dots += '<span style="background:var(--sleep)"></span>';
    if (meta.study) dots += '<span style="background:var(--study)"></span>';
    if (meta.distraction) dots += '<span style="background:var(--distraction)"></span>';
    btn.innerHTML =
      (meta.note ? '<span class="note-flag"></span>' : '') +
      String(dayNum(dateISO)) +
      (dots ? '<span class="dot">' + dots + '</span>' : '');
    btn.addEventListener('click', () => openDayPanel(dateISO));
    return btn;
  }
  function monthHeatmap(container, year, month) {
    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'heatmap';
    WD.forEach((w) => { const d = document.createElement('div'); d.className = 'dow'; d.textContent = w; grid.appendChild(d); });
    const first = new Date(year, month, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = todayISO();
    for (let i = 0; i < startDow; i++) { const e = document.createElement('div'); e.className = 'heatcell is-empty'; grid.appendChild(e); }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = year + '-' + pad2(month + 1) + '-' + pad2(d);
      grid.appendChild(buildHeatCell(iso, iso === today, false));
    }
    const total = startDow + daysInMonth;
    const trailing = (7 - (total % 7)) % 7;
    for (let i = 0; i < trailing; i++) { const e = document.createElement('div'); e.className = 'heatcell is-empty'; grid.appendChild(e); }
    container.appendChild(grid);
  }
  function dayStrip(container, n) {
    container.innerHTML = '';
    const strip = document.createElement('div');
    strip.className = 'daystrip';
    const today = todayISO();
    datesRange(n).forEach((iso) => strip.appendChild(buildHeatCell(iso, iso === today, true)));
    container.appendChild(strip);
  }

  /* ========================================================================
     7. SIDE PANEL — forms for adding/editing entries and day notes
     ====================================================================== */
  const scrim = $('#scrim'), panel = $('#panel'), panelInner = $('#panelInner');
  function openPanel(html) {
    panelInner.innerHTML = html;
    paintIcons(panelInner);
    scrim.classList.add('is-open');
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    const first = panelInner.querySelector('input, textarea, select');
    if (first) setTimeout(() => first.focus(), 260);
  }
  function closePanel() {
    scrim.classList.remove('is-open');
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
  }
  scrim.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

  function toast(msg, icon) {
    const t = $('#toast');
    t.innerHTML = iconHTML(icon || 'check') + '<span>' + escapeHTML(msg) + '</span>';
    paintIcons(t);
    t.classList.add('is-visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => t.classList.remove('is-visible'), 2600);
  }

  function fieldRow(labelHtml, inputHtml) {
    return '<div class="field"><label>' + labelHtml + '</label>' + inputHtml + '</div>';
  }

  /* ---- Sleep form ---- */
  function openSleepForm(existing, presetDate) {
    const e = existing || { date: presetDate || todayISO(), bed: '23:00', wake: '07:00', quality: 3 };
    const isEdit = !!existing;
    const html =
      '<div class="panel__header"><span class="panel__title" style="color:var(--sleep)">' + (isEdit ? 'Edit night' : 'Log a night') + '</span>' +
      '<button class="btn-icon" id="panelClose" type="button">' + iconHTML('x') + '</button></div>' +
      '<form id="entryForm">' +
      fieldRow('Date', '<input type="date" name="date" value="' + e.date + '" max="' + todayISO() + '" required>') +
      '<div class="field-row">' +
      fieldRow('Bedtime', '<input type="time" name="bed" value="' + e.bed + '" required>') +
      fieldRow('Wake time', '<input type="time" name="wake" value="' + e.wake + '" required>') +
      '</div>' +
      '<div class="field-hint" id="hoursPreview">Sleep duration: ' + formatHoursMinutes(computeSleepHours(e.bed, e.wake)) + '</div>' +
      '<div class="field" style="margin-top:16px"><label>How rested did you feel?</label>' +
      '<div class="chiprow" id="qualityChips">' +
      [1, 2, 3, 4, 5].map((q) => '<button type="button" class="chip' + (q === e.quality ? ' is-active' : '') + '" data-q="' + q + '">' + ['Rough', 'Meh', 'OK', 'Good', 'Great'][q - 1] + '</button>').join('') +
      '</div><input type="hidden" name="quality" value="' + e.quality + '"></div>' +
      '<div class="panel__footer">' +
      (isEdit ? '<button type="button" class="btn btn-danger" id="deleteBtn">' + iconHTML('trash') + ' Delete</button>' : '') +
      '<button type="submit" class="btn btn-primary" style="background:var(--sleep)">' + iconHTML('check') + (isEdit ? ' Save changes' : ' Add entry') + '</button>' +
      '</div></form>';
    openPanel(html);
    const form = $('#entryForm', panelInner);
    $('#panelClose', panelInner).addEventListener('click', closePanel);
    const bed = form.bed, wake = form.wake, prev = $('#hoursPreview', panelInner);
    function updatePreview() { prev.textContent = 'Sleep duration: ' + formatHoursMinutes(computeSleepHours(bed.value, wake.value)); }
    bed.addEventListener('input', updatePreview);
    wake.addEventListener('input', updatePreview);
    $$('.chip', $('#qualityChips', panelInner)).forEach((chip) => {
      chip.addEventListener('click', () => {
        $$('.chip', chip.parentElement).forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        form.quality.value = chip.dataset.q;
      });
    });
    if (isEdit) $('#deleteBtn', panelInner).addEventListener('click', () => {
      if (confirm('Delete this sleep entry?')) {
        App.state.sleep = App.state.sleep.filter((x) => x.id !== existing.id);
        persist(); closePanel(); renderTab(App.ui.tab); toast('Entry deleted', 'trash');
      }
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const bedV = fd.get('bed'), wakeV = fd.get('wake');
      const rec = { id: isEdit ? existing.id : uid(), date: fd.get('date'), bed: bedV, wake: wakeV, hours: round2(computeSleepHours(bedV, wakeV)), quality: Number(fd.get('quality')) };
      if (isEdit) { const i = App.state.sleep.findIndex((x) => x.id === existing.id); App.state.sleep[i] = rec; }
      else App.state.sleep.push(rec);
      persist(); closePanel(); renderTab(App.ui.tab); toast(isEdit ? 'Night updated' : 'Night logged', 'moon');
    });
  }

  /* ---- Study form ---- */
  function openStudyForm(existing, presetDate) {
    const e = existing || { date: presetDate || todayISO(), subject: '', hours: 1, note: '' };
    const isEdit = !!existing;
    const subjects = Array.from(new Set(App.state.study.map((s) => s.subject).filter(Boolean)));
    const presets = ['Math', 'Reading', 'Coding', 'Language', 'Science'];
    const html =
      '<div class="panel__header"><span class="panel__title" style="color:var(--study)">' + (isEdit ? 'Edit session' : 'Log study time') + '</span>' +
      '<button class="btn-icon" id="panelClose" type="button">' + iconHTML('x') + '</button></div>' +
      '<form id="entryForm">' +
      fieldRow('Date', '<input type="date" name="date" value="' + e.date + '" max="' + todayISO() + '" required>') +
      fieldRow('Subject', '<input type="text" name="subject" list="subjectList" value="' + escapeHTML(e.subject) + '" placeholder="e.g. Physics" required>' +
        '<datalist id="subjectList">' + Array.from(new Set([...presets, ...subjects])).map((s) => '<option value="' + escapeHTML(s) + '">').join('') + '</datalist>') +
      fieldRow('Hours', '<input type="number" name="hours" value="' + e.hours + '" min="0.25" max="16" step="0.25" required>') +
      fieldRow('Note (optional)', '<input type="text" name="note" value="' + escapeHTML(e.note || '') + '" placeholder="What did you cover?">') +
      '<div class="panel__footer">' +
      (isEdit ? '<button type="button" class="btn btn-danger" id="deleteBtn">' + iconHTML('trash') + ' Delete</button>' : '') +
      '<button type="submit" class="btn btn-primary" style="background:var(--study)">' + iconHTML('check') + (isEdit ? ' Save changes' : ' Add entry') + '</button>' +
      '</div></form>';
    openPanel(html);
    const form = $('#entryForm', panelInner);
    $('#panelClose', panelInner).addEventListener('click', closePanel);
    if (isEdit) $('#deleteBtn', panelInner).addEventListener('click', () => {
      if (confirm('Delete this study session?')) {
        App.state.study = App.state.study.filter((x) => x.id !== existing.id);
        persist(); closePanel(); renderTab(App.ui.tab); toast('Entry deleted', 'trash');
      }
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const rec = { id: isEdit ? existing.id : uid(), date: fd.get('date'), subject: fd.get('subject').trim() || 'Study', hours: Number(fd.get('hours')), note: fd.get('note').trim() };
      if (isEdit) { const i = App.state.study.findIndex((x) => x.id === existing.id); App.state.study[i] = rec; }
      else App.state.study.push(rec);
      persist(); closePanel(); renderTab(App.ui.tab); toast(isEdit ? 'Session updated' : 'Session logged', 'book');
    });
  }

  /* ---- Distraction form ---- */
  function openDistractionForm(existing, presetDate) {
    const e = existing || { date: presetDate || todayISO(), type: '', minutes: 15, note: '' };
    const isEdit = !!existing;
    const types = Array.from(new Set(App.state.distractions.map((s) => s.type).filter(Boolean)));
    const presets = ['Phone', 'Social media', 'TV', 'Browsing', 'Chatting'];
    const html =
      '<div class="panel__header"><span class="panel__title" style="color:var(--distraction)">' + (isEdit ? 'Edit distraction' : 'Log a distraction') + '</span>' +
      '<button class="btn-icon" id="panelClose" type="button">' + iconHTML('x') + '</button></div>' +
      '<form id="entryForm">' +
      fieldRow('Date', '<input type="date" name="date" value="' + e.date + '" max="' + todayISO() + '" required>') +
      fieldRow('What pulled your focus?', '<input type="text" name="type" list="typeList" value="' + escapeHTML(e.type) + '" placeholder="e.g. Phone" required>' +
        '<datalist id="typeList">' + Array.from(new Set([...presets, ...types])).map((s) => '<option value="' + escapeHTML(s) + '">').join('') + '</datalist>') +
      fieldRow('Minutes', '<input type="number" name="minutes" value="' + e.minutes + '" min="1" max="600" step="1" required>') +
      fieldRow('Note (optional)', '<input type="text" name="note" value="' + escapeHTML(e.note || '') + '" placeholder="Any trigger worth remembering?">') +
      '<div class="panel__footer">' +
      (isEdit ? '<button type="button" class="btn btn-danger" id="deleteBtn">' + iconHTML('trash') + ' Delete</button>' : '') +
      '<button type="submit" class="btn btn-primary" style="background:var(--distraction)">' + iconHTML('check') + (isEdit ? ' Save changes' : ' Add entry') + '</button>' +
      '</div></form>';
    openPanel(html);
    const form = $('#entryForm', panelInner);
    $('#panelClose', panelInner).addEventListener('click', closePanel);
    if (isEdit) $('#deleteBtn', panelInner).addEventListener('click', () => {
      if (confirm('Delete this entry?')) {
        App.state.distractions = App.state.distractions.filter((x) => x.id !== existing.id);
        persist(); closePanel(); renderTab(App.ui.tab); toast('Entry deleted', 'trash');
      }
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const rec = { id: isEdit ? existing.id : uid(), date: fd.get('date'), type: fd.get('type').trim() || 'Other', minutes: Number(fd.get('minutes')), note: fd.get('note').trim() };
      if (isEdit) { const i = App.state.distractions.findIndex((x) => x.id === existing.id); App.state.distractions[i] = rec; }
      else App.state.distractions.push(rec);
      persist(); closePanel(); renderTab(App.ui.tab); toast(isEdit ? 'Entry updated' : 'Distraction logged', 'bolt');
    });
  }

  /* ---- Day detail panel (from Journal calendar) ---- */
  function openDayPanel(dateISO) {
    const s = App.state;
    const sleep = s.sleep.filter((e) => e.date === dateISO);
    const study = s.study.filter((e) => e.date === dateISO);
    const dist = s.distractions.filter((e) => e.date === dateISO);
    const note = s.notes[dateISO] || '';

    function rows(list, kind) {
      if (!list.length) return '<div class="field-hint">Nothing logged.</div>';
      return list.map((e) => {
        let title, value;
        if (kind === 'sleep') { title = e.bed + ' → ' + e.wake; value = formatHoursMinutes(e.hours); }
        if (kind === 'study') { title = e.subject; value = e.hours + 'h'; }
        if (kind === 'dist') { title = e.type; value = formatMinutesShort(e.minutes); }
        return '<div class="entryrow"><span class="entryrow__main"><span class="entryrow__title">' + escapeHTML(title) + '</span></span>' +
          '<span class="entryrow__value">' + value + '</span>' +
          '<span class="entryrow__actions"><button class="btn-icon edit-' + kind + '" data-id="' + e.id + '">' + iconHTML('pencil') + '</button></span></div>';
      }).join('');
    }

    const html =
      '<div class="panel__header"><span class="panel__title">' + niceDate(dateISO) + '</span>' +
      '<button class="btn-icon" id="panelClose" type="button">' + iconHTML('x') + '</button></div>' +

      '<div class="section-title" style="font-size:16px;color:var(--sleep)">' + iconHTML('moon') + ' Sleep' +
      '<button class="btn btn-ghost" id="addSleepDay" style="padding:6px 12px;font-size:12px">' + iconHTML('plus') + ' Add</button></div>' +
      rows(sleep, 'sleep') +

      '<div class="section-title" style="font-size:16px;color:var(--study);margin-top:20px">' + iconHTML('book') + ' Study' +
      '<button class="btn btn-ghost" id="addStudyDay" style="padding:6px 12px;font-size:12px">' + iconHTML('plus') + ' Add</button></div>' +
      rows(study, 'study') +

      '<div class="section-title" style="font-size:16px;color:var(--distraction);margin-top:20px">' + iconHTML('bolt') + ' Focus' +
      '<button class="btn btn-ghost" id="addDistDay" style="padding:6px 12px;font-size:12px">' + iconHTML('plus') + ' Add</button></div>' +
      rows(dist, 'dist') +

      '<div class="field" style="margin-top:24px"><label>Journal note</label>' +
      '<textarea id="dayNote" placeholder="Anything worth remembering about today?">' + escapeHTML(note) + '</textarea></div>' +
      '<div class="panel__footer"><button class="btn btn-primary" id="saveNote">' + iconHTML('check') + ' Save note</button></div>';

    openPanel(html);
    $('#panelClose', panelInner).addEventListener('click', closePanel);
    $('#addSleepDay', panelInner).addEventListener('click', () => openSleepForm(null, dateISO));
    $('#addStudyDay', panelInner).addEventListener('click', () => openStudyForm(null, dateISO));
    $('#addDistDay', panelInner).addEventListener('click', () => openDistractionForm(null, dateISO));
    $$('.edit-sleep', panelInner).forEach((b) => b.addEventListener('click', () => openSleepForm(sleep.find((x) => x.id === b.dataset.id))));
    $$('.edit-study', panelInner).forEach((b) => b.addEventListener('click', () => openStudyForm(study.find((x) => x.id === b.dataset.id))));
    $$('.edit-dist', panelInner).forEach((b) => b.addEventListener('click', () => openDistractionForm(dist.find((x) => x.id === b.dataset.id))));
    $('#saveNote', panelInner).addEventListener('click', () => {
      const val = $('#dayNote', panelInner).value.trim();
      if (val) App.state.notes[dateISO] = val; else delete App.state.notes[dateISO];
      persist(); closePanel(); renderTab(App.ui.tab); toast('Note saved', 'check');
    });
  }

  /* ========================================================================
     8. PAGE RENDERERS
     ====================================================================== */
  const page = $('#page');

  function pageHeader(eyebrow, title, sub, accentVar, actionsHtml) {
    return '<div class="page__header"><div style="--accent:var(' + accentVar + ')"><div class="page__eyebrow">' + escapeHTML(eyebrow) + '</div>' +
      '<h1 class="page__title">' + title + '</h1>' +
      (sub ? '<p class="page__sub">' + escapeHTML(sub) + '</p>' : '') + '</div>' +
      '<div class="page__actions">' + (actionsHtml || '') + '</div></div>';
  }
  function rangeSwitchHtml(tracker) {
    const cur = App.ui.range[tracker];
    return '<div class="rangeswitch" data-tracker="' + tracker + '">' +
      [7, 14, 30, 90].map((r) => '<button data-range="' + r + '" class="' + (r === cur ? 'is-active' : '') + '">' + r + 'd</button>').join('') + '</div>';
  }
  function wireRangeSwitch(tracker) {
    $$('.rangeswitch[data-tracker="' + tracker + '"] button').forEach((btn) => {
      btn.addEventListener('click', () => {
        App.ui.range[tracker] = Number(btn.dataset.range);
        renderTab(App.ui.tab);
      });
    });
  }

  /* ---- Dashboard ---- */
  function renderDashboard() {
    const today = todayISO();
    const { map: sleepMap } = denseMap(App.state.sleep, 'hours');
    const { map: studyMap } = denseMap(App.state.study, 'hours');
    const { map: distMap } = denseMap(App.state.distractions, 'minutes');
    const g = App.state.settings;

    const sevenDates = datesRange(7);
    const sleepStreak = computeStreak(sleepMap, (v) => v >= g.sleepGoal, true);
    const studyStreak = computeStreak(studyMap, (v) => v > 0, true);
    const focusStreak = computeStreak(distMap, (v) => v <= g.distractionLimit, false);

    const lastNight = sleepMap[today] || sleepMap[addDays(today, -1)] || 0;
    page.innerHTML =
      pageHeader('Today · ' + niceDate(today), 'Your day so far', 'A quick look at last night, today\u2019s hours and the week behind you.', '--rule-red',
        '<button class="btn btn-ghost" id="qaSleep">' + iconHTML('moon') + ' Sleep</button>' +
        '<button class="btn btn-ghost" id="qaStudy">' + iconHTML('book') + ' Study</button>' +
        '<button class="btn btn-ghost" id="qaDist">' + iconHTML('bolt') + ' Focus</button>') +

      '<div class="grid grid-stats grid-3">' +
        statCard('moon', '--sleep', 'Last night', lastNight ? formatHoursMinutes(lastNight) : '—', null,
          'Goal ' + g.sleepGoal + 'h') +
        statCard('book', '--study', 'Studied today', formatHoursMinutes(studyMap[today] || 0), null, 'Goal ' + g.studyGoal + 'h') +
        statCard('bolt', '--distraction', 'Distracted today', formatMinutesShort(distMap[today] || 0), null, 'Limit ' + formatMinutesShort(g.distractionLimit)) +
      '</div>' +

      '<div class="streakrow" style="margin-bottom:28px">' +
        streakChip('flame', '--sleep', sleepStreak, 'night streak') +
        streakChip('flame', '--study', studyStreak, 'day study streak') +
        streakChip('target', '--distraction', focusStreak, 'day focus streak') +
      '</div>' +

      '<div class="grid grid-3" style="margin-bottom:28px">' +
        miniChartCard('Sleep', '--sleep', 'dashSleepChart') +
        miniChartCard('Study', '--study', 'dashStudyChart') +
        miniChartCard('Focus', '--distraction', 'dashDistChart') +
      '</div>' +

      '<div class="section-title">Last 14 days <small>tap a day to open it in your journal</small></div>' +
      '<div class="card" id="dashStrip"></div>';

    paintIcons(page);
    $('#qaSleep').addEventListener('click', () => openSleepForm());
    $('#qaStudy').addEventListener('click', () => openStudyForm());
    $('#qaDist').addEventListener('click', () => openDistractionForm());

    comboBarLine($('#dashSleepChart'), {
      dates: sevenDates, barValues: sevenDates.map((d) => sleepMap[d]), barColor: 'var(--sleep)',
      barFormat: (v) => v.toFixed(1) + 'h', goalValue: g.sleepGoal,
      emptyState: { icon: 'moon', title: 'No sleep logged', hint: 'Log tonight to start the chart.' }
    });
    comboBarLine($('#dashStudyChart'), {
      dates: sevenDates, barValues: sevenDates.map((d) => studyMap[d]), barColor: 'var(--study)',
      barFormat: (v) => v.toFixed(1) + 'h', goalValue: g.studyGoal,
      emptyState: { icon: 'book', title: 'No study logged', hint: 'Log a session to start the chart.' }
    });
    comboBarLine($('#dashDistChart'), {
      dates: sevenDates, barValues: sevenDates.map((d) => distMap[d]), barColor: 'var(--distraction)',
      barFormat: (v) => formatMinutesShort(v), goalValue: g.distractionLimit,
      emptyState: { icon: 'bolt', title: 'Nothing logged', hint: 'Even better — or just not tracked yet.' }
    });
    dayStrip($('#dashStrip'), 14);
  }
  function statCard(icon, accentVar, label, value, sub, hint) {
    return '<div class="statcard" style="--accent:var(' + accentVar + ')">' +
      '<div class="statcard__label">' + iconHTML(icon) + escapeHTML(label) + '</div>' +
      '<div class="statcard__value">' + value + '</div>' +
      '<div class="statcard__delta" style="color:var(--ink-soft)">' + escapeHTML(hint || '') + '</div></div>';
  }
  function streakChip(icon, accentVar, n, label) {
    return '<div class="streakchip" style="--accent:var(' + accentVar + ')">' + iconHTML(icon) + '<b>' + n + '</b> ' + escapeHTML(label) + '</div>';
  }
  function miniChartCard(title, accentVar, id) {
    return '<div class="card chartcard" style="--accent:var(' + accentVar + ')"><div class="section-title" style="font-size:15px;color:var(' + accentVar + ')">' + escapeHTML(title) + '</div><div id="' + id + '"></div></div>';
  }

  /* ---- Sleep tab ---- */
  function renderSleep() {
    const range = App.ui.range.sleep;
    const g = App.state.settings;
    const { map, dates: allDates } = denseMap(App.state.sleep, 'hours');
    const rangeDates = allDates.slice(-range);
    const barValues = rangeDates.map((d) => map[d]);

    const wakeSparse = {};
    App.state.sleep.forEach((e) => { wakeSparse[e.date] = timeToMinutes(e.wake); });
    const lineValues = rangeDates.map((d) => (wakeSparse[d] !== undefined ? wakeSparse[d] : null));

    const loggedDates = rangeDates.filter((d) => wakeSparse[d] !== undefined);
    const avg = mean(loggedDates.map((d) => map[d]));
    const avgWake = loggedDates.length ? mean(loggedDates.map((d) => wakeSparse[d])) : null;
    const streak = computeStreak(map, (v) => v >= g.sleepGoal, true);

    const qualityCounts = [0, 0, 0, 0, 0];
    App.state.sleep.filter((e) => rangeDates.includes(e.date)).forEach((e) => { qualityCounts[(e.quality || 3) - 1]++; });

    const recent = App.state.sleep.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

    page.innerHTML =
      pageHeader('Sleep', 'Sleep log', 'Bedtimes, wake times and how rested each morning felt.', '--sleep',
        rangeSwitchHtml('sleep') + '<button class="btn btn-primary" id="addSleep" style="background:var(--sleep)">' + iconHTML('plus') + ' Add night</button>') +

      '<div class="grid grid-stats grid-3">' +
        statCard('moon', '--sleep', 'Average', loggedDates.length ? formatHoursMinutes(avg) : '—', null, 'Goal ' + g.sleepGoal + 'h · last ' + range + 'd') +
        statCard('clock', '--sleep', 'Average wake time', avgWake !== null ? to12h(Math.round(avgWake)) : '—', null, 'last ' + range + 'd') +
        statCard('flame', '--sleep', 'Current streak', String(streak), null, streak === 1 ? 'night at goal' : 'nights at goal') +
      '</div>' +

      '<div class="grid grid-2">' +
        '<div class="card chartcard"><div class="section-title">Hours &amp; wake time <small>bars = hours slept · line = wake time</small></div><div id="sleepChart"></div></div>' +
        '<div class="card"><div class="section-title">How rested you felt</div><div id="sleepDonut"></div></div>' +
      '</div>' +

      '<div class="card" style="margin-top:20px"><div class="section-title">Recent nights</div><div class="entrylist" id="sleepList"></div></div>';

    paintIcons(page);
    wireRangeSwitch('sleep');
    $('#addSleep').addEventListener('click', () => openSleepForm());

    comboBarLine($('#sleepChart'), {
      dates: rangeDates, barValues, barColor: 'var(--sleep)', barLabel: 'Hours slept', barFormat: (v) => v.toFixed(1) + 'h',
      lineValues, lineColor: 'var(--rule-red)', lineLabel: 'Wake time', lineFormat: (v) => to12h(Math.round(v)), lineDomain: [300, 720],
      goalValue: g.sleepGoal, goalLabel: 'Goal ' + g.sleepGoal + 'h',
      emptyState: { icon: 'moon', title: 'No nights logged yet', hint: 'Add your first night to see it charted.' }
    });

    donutChart($('#sleepDonut'), {
      // one hue, low→high opacity by rating, so the ring reads as a single gradient rather than arbitrary categories
      segments: [1, 2, 3, 4, 5].map((q, i) => ({
        label: ['Rough', 'Meh', 'OK', 'Good', 'Great'][i], value: qualityCounts[i],
        color: 'var(--sleep)', opacity: [0.35, 0.5, 0.65, 0.8, 1][i]
      })),
      centerValue: qualityCounts.reduce((a, b) => a + b, 0), centerLabel: 'nights',
      emptyState: { icon: 'sparkle', title: 'No ratings yet', hint: 'Rate how rested you feel when you log a night.' }
    });

    renderEntryList($('#sleepList'), recent, 'sleep');
  }

  /* ---- Study tab ---- */
  function renderStudy() {
    const range = App.ui.range.study;
    const g = App.state.settings;
    const { map, dates: allDates } = denseMap(App.state.study, 'hours');
    const rangeDates = allDates.slice(-range);
    const barValues = rangeDates.map((d) => map[d]);
    const ma = movingAverage(barValues, maWindowFor(range));

    const activeDates = rangeDates.filter((d) => map[d] > 0);
    const total = barValues.reduce((a, b) => a + b, 0);
    const avgActive = mean(activeDates.map((d) => map[d]));
    const streak = computeStreak(map, (v) => v > 0, true);

    const bySubject = {};
    App.state.study.filter((e) => rangeDates.includes(e.date)).forEach((e) => { bySubject[e.subject] = (bySubject[e.subject] || 0) + e.hours; });
    const subjectSegments = Object.keys(bySubject).map((k, i) => ({ label: k, value: round2(bySubject[k]), color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }));

    const recent = App.state.study.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

    page.innerHTML =
      pageHeader('Study', 'Study log', 'Focused hours by subject, and the trend behind the daily grind.', '--study',
        rangeSwitchHtml('study') + '<button class="btn btn-primary" id="addStudy" style="background:var(--study)">' + iconHTML('plus') + ' Add session</button>') +

      '<div class="grid grid-stats grid-3">' +
        statCard('book', '--study', 'Total logged', formatHoursMinutes(total), null, 'last ' + range + 'd') +
        statCard('target', '--study', 'Daily average', activeDates.length ? formatHoursMinutes(avgActive) : '—', null, 'on active days') +
        statCard('flame', '--study', 'Current streak', String(streak), null, streak === 1 ? 'day studied' : 'days studied') +
      '</div>' +

      '<div class="grid grid-2">' +
        '<div class="card chartcard"><div class="section-title">Hours per day <small>line = ' + maWindowFor(range) + '-day average</small></div><div id="studyChart"></div></div>' +
        '<div class="card"><div class="section-title">By subject</div><div id="studyDonut"></div></div>' +
      '</div>' +

      '<div class="card" style="margin-top:20px"><div class="section-title">Recent sessions</div><div class="entrylist" id="studyList"></div></div>';

    paintIcons(page);
    wireRangeSwitch('study');
    $('#addStudy').addEventListener('click', () => openStudyForm());

    comboBarLine($('#studyChart'), {
      dates: rangeDates, barValues, barColor: 'var(--study)', barLabel: 'Hours studied', barFormat: (v) => v.toFixed(1) + 'h',
      lineValues: ma, lineColor: 'var(--sleep)', lineLabel: maWindowFor(range) + '-day average', lineFormat: (v) => v.toFixed(1) + 'h', sharedScale: true,
      goalValue: g.studyGoal, goalLabel: 'Goal ' + g.studyGoal + 'h',
      emptyState: { icon: 'book', title: 'No sessions yet', hint: 'Log your first study session to see it charted.' }
    });
    donutChart($('#studyDonut'), {
      segments: subjectSegments, valueFormat: (v) => v.toFixed(1) + 'h',
      centerValue: total.toFixed(0), centerLabel: 'hours',
      emptyState: { icon: 'book', title: 'Nothing yet', hint: 'Sessions you log will break down here by subject.' }
    });
    renderEntryList($('#studyList'), recent, 'study');
  }

  /* ---- Distraction tab ---- */
  function renderDistraction() {
    const range = App.ui.range.distraction;
    const g = App.state.settings;
    const { map, dates: allDates } = denseMap(App.state.distractions, 'minutes');
    const rangeDates = allDates.slice(-range);
    const barValues = rangeDates.map((d) => map[d]);
    const ma = movingAverage(barValues, maWindowFor(range));

    const avg = mean(barValues);
    const total = barValues.reduce((a, b) => a + b, 0);
    const streak = computeStreak(map, (v) => v <= g.distractionLimit, false);

    const byType = {};
    App.state.distractions.filter((e) => rangeDates.includes(e.date)).forEach((e) => { byType[e.type] = (byType[e.type] || 0) + e.minutes; });
    const typeSegments = Object.keys(byType).map((k, i) => ({ label: k, value: byType[k], color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }));

    const recent = App.state.distractions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

    page.innerHTML =
      pageHeader('Focus', 'Distraction log', 'What pulled your attention, and for how long — smaller bars are the goal.', '--distraction',
        rangeSwitchHtml('distraction') + '<button class="btn btn-primary" id="addDist" style="background:var(--distraction)">' + iconHTML('plus') + ' Add entry</button>') +

      '<div class="grid grid-stats grid-3">' +
        statCard('bolt', '--distraction', 'Daily average', formatMinutesShort(avg), null, 'limit ' + formatMinutesShort(g.distractionLimit)) +
        statCard('clock', '--distraction', 'Total logged', formatMinutesShort(total), null, 'last ' + range + 'd') +
        statCard('target', '--distraction', 'Focus streak', String(streak), null, streak === 1 ? 'day under limit' : 'days under limit') +
      '</div>' +

      '<div class="grid grid-2">' +
        '<div class="card chartcard"><div class="section-title">Minutes per day <small>line = ' + maWindowFor(range) + '-day average</small></div><div id="distChart"></div></div>' +
        '<div class="card"><div class="section-title">By source</div><div id="distDonut"></div></div>' +
      '</div>' +

      '<div class="card" style="margin-top:20px"><div class="section-title">Recent entries</div><div class="entrylist" id="distList"></div></div>';

    paintIcons(page);
    wireRangeSwitch('distraction');
    $('#addDist').addEventListener('click', () => openDistractionForm());

    comboBarLine($('#distChart'), {
      dates: rangeDates, barValues, barColor: 'var(--distraction)', barLabel: 'Minutes distracted', barFormat: (v) => formatMinutesShort(v),
      lineValues: ma, lineColor: 'var(--sleep)', lineLabel: maWindowFor(range) + '-day average', lineFormat: (v) => formatMinutesShort(v), sharedScale: true,
      goalValue: g.distractionLimit, goalLabel: 'Limit ' + formatMinutesShort(g.distractionLimit),
      emptyState: { icon: 'bolt', title: 'Nothing logged', hint: 'Log a distraction to start spotting patterns.' }
    });
    donutChart($('#distDonut'), {
      segments: typeSegments, valueFormat: (v) => formatMinutesShort(v),
      centerValue: formatMinutesShort(total), centerLabel: 'total',
      emptyState: { icon: 'bolt', title: 'Nothing yet', hint: 'Entries you log will break down here by source.' }
    });
    renderEntryList($('#distList'), recent, 'dist');
  }

  function renderEntryList(container, list, kind) {
    if (!list.length) {
      container.innerHTML = '<div class="empty-state">' + iconHTML(kind === 'sleep' ? 'moon' : kind === 'study' ? 'book' : 'bolt') +
        '<strong>No entries yet</strong><span>Add one to get started.</span></div>';
      paintIcons(container);
      return;
    }
    container.innerHTML = list.map((e) => {
      let title, meta, value, accent;
      if (kind === 'sleep') { title = e.bed + ' → ' + e.wake; meta = niceDate(e.date) + ' · ' + ['Rough', 'Meh', 'OK', 'Good', 'Great'][(e.quality || 3) - 1]; value = formatHoursMinutes(e.hours); accent = 'var(--sleep)'; }
      if (kind === 'study') { title = e.subject; meta = niceDate(e.date) + (e.note ? ' · ' + escapeHTML(e.note) : ''); value = e.hours + 'h'; accent = 'var(--study)'; }
      if (kind === 'dist') { title = e.type; meta = niceDate(e.date) + (e.note ? ' · ' + escapeHTML(e.note) : ''); value = formatMinutesShort(e.minutes); accent = 'var(--distraction)'; }
      return '<div class="entryrow"><span class="entryrow__dot" style="background:' + accent + '"></span>' +
        '<span class="entryrow__main"><span class="entryrow__title">' + escapeHTML(title) + '</span><div class="entryrow__meta">' + meta + '</div></span>' +
        '<span class="entryrow__value">' + value + '</span>' +
        '<span class="entryrow__actions"><button class="btn-icon js-edit" data-id="' + e.id + '">' + iconHTML('pencil') + '</button></span></div>';
    }).join('');
    paintIcons(container);
    $$('.js-edit', container).forEach((btn) => btn.addEventListener('click', () => {
      const item = list.find((x) => x.id === btn.dataset.id);
      if (kind === 'sleep') openSleepForm(item);
      if (kind === 'study') openStudyForm(item);
      if (kind === 'dist') openDistractionForm(item);
    }));
  }

  /* ---- Journal tab ---- */
  function renderJournal() {
    const { y, m } = App.ui.journal;
    const monthName = MO[m] + ' ' + y;
    page.innerHTML =
      pageHeader('Journal', 'A month at a glance', 'Every logged day, plus room for a note of your own.', '--rule-red',
        '<div class="rangeswitch"><button class="btn-icon" id="prevMonth">' + iconHTML('chevron-left') + '</button>' +
        '<span style="padding:6px 10px;font-weight:600;font-family:var(--font-display);font-size:18px">' + monthName + '</span>' +
        '<button class="btn-icon" id="nextMonth">' + iconHTML('chevron-right') + '</button></div>') +
      '<div class="card"><div id="journalGrid"></div>' +
      '<div class="chart-legend" style="margin-top:18px">' +
      '<span class="legend-item"><span class="legend-swatch" style="background:var(--sleep)"></span>Sleep logged</span>' +
      '<span class="legend-item"><span class="legend-swatch" style="background:var(--study)"></span>Study logged</span>' +
      '<span class="legend-item"><span class="legend-swatch" style="background:var(--distraction)"></span>Distraction logged</span>' +
      '<span class="legend-item"><span class="legend-swatch" style="background:var(--rule-red)"></span>Has a note</span>' +
      '</div></div>';
    paintIcons(page);
    monthHeatmap($('#journalGrid'), y, m);
    $('#prevMonth').addEventListener('click', () => {
      App.ui.journal.m--; if (App.ui.journal.m < 0) { App.ui.journal.m = 11; App.ui.journal.y--; }
      renderJournal();
    });
    $('#nextMonth').addEventListener('click', () => {
      App.ui.journal.m++; if (App.ui.journal.m > 11) { App.ui.journal.m = 0; App.ui.journal.y++; }
      renderJournal();
    });
  }

  /* ---- Settings tab ---- */
  function renderSettings() {
    const g = App.state.settings;
    const effectiveTheme = document.documentElement.getAttribute('data-theme') || 'light';
    page.innerHTML =
      pageHeader('Settings', 'Settings', 'Set your goals, pick a theme, and manage your data.', '--rule-red') +

      '<div class="card"><div class="section-title">Daily goals</div>' +
      '<div class="field-row">' +
      fieldRow('Sleep goal (hours)', '<input type="number" id="gSleep" min="4" max="12" step="0.5" value="' + g.sleepGoal + '">') +
      fieldRow('Study goal (hours)', '<input type="number" id="gStudy" min="0.5" max="12" step="0.5" value="' + g.studyGoal + '">') +
      '</div>' +
      fieldRow('Distraction limit (minutes / day)', '<input type="number" id="gLimit" min="10" max="480" step="5" value="' + g.distractionLimit + '">') +
      '</div>' +

      '<div class="card"><div class="section-title">Appearance</div>' +
      '<div class="chiprow">' +
      ['light', 'dark', 'system'].map((t) => '<button class="chip theme-opt' + ((g.theme || 'system') === t ? ' is-active' : '') + '" data-theme-opt="' + t + '">' + t[0].toUpperCase() + t.slice(1) + '</button>').join('') +
      '</div><div class="field-hint">Currently showing ' + effectiveTheme + '.</div></div>' +

      '<div class="card"><div class="section-title">Your data</div>' +
      '<div class="settingsrow"><div><div class="settingsrow__label">Export backup</div><div class="settingsrow__hint">Download everything as a JSON file you can keep or move to another browser.</div></div>' +
      '<button class="btn btn-ghost" id="exportBtn">' + iconHTML('download') + ' Export</button></div>' +
      '<div class="settingsrow"><div><div class="settingsrow__label">Import backup</div><div class="settingsrow__hint">Replace everything currently stored with a previously exported file.</div></div>' +
      '<button class="btn btn-ghost" id="importBtn">' + iconHTML('upload') + ' Import</button></div>' +
      '<div class="settingsrow"><div><div class="settingsrow__label">Load sample data</div><div class="settingsrow__hint">Fill the tracker with a few weeks of example entries to explore the charts.</div></div>' +
      '<button class="btn btn-ghost" id="demoBtn">' + iconHTML('sparkle') + ' Load sample</button></div>' +
      '<div class="settingsrow"><div><div class="settingsrow__label">Clear all data</div><div class="settingsrow__hint">Removes every entry and note. This can\u2019t be undone.</div></div>' +
      '<button class="btn btn-danger" id="clearBtn">' + iconHTML('trash') + ' Clear</button></div>' +
      '</div>' +

      '<p class="field-hint">Your data lives only in this browser\u2019s storage — nothing is sent anywhere. Export a backup before clearing your browser data.</p>';

    paintIcons(page);
    $('#gSleep').addEventListener('change', (e) => { g.sleepGoal = Number(e.target.value); persist(); });
    $('#gStudy').addEventListener('change', (e) => { g.studyGoal = Number(e.target.value); persist(); });
    $('#gLimit').addEventListener('change', (e) => { g.distractionLimit = Number(e.target.value); persist(); });

    $$('.theme-opt', page).forEach((btn) => btn.addEventListener('click', () => {
      const v = btn.dataset.themeOpt;
      g.theme = v === 'system' ? null : v;
      persist(); applyTheme(); renderSettings();
    }));

    $('#exportBtn').addEventListener('click', () => { Store.exportFile(App.state); toast('Backup downloaded', 'download'); });
    $('#importBtn').addEventListener('click', () => $('#importInput').click());
    $('#demoBtn').addEventListener('click', () => {
      if (confirm('This adds sample entries alongside anything already logged. Continue?')) {
        const seeded = seedState();
        App.state.sleep = App.state.sleep.concat(seeded.sleep);
        App.state.study = App.state.study.concat(seeded.study);
        App.state.distractions = App.state.distractions.concat(seeded.distractions);
        App.state.notes = Object.assign({}, seeded.notes, App.state.notes);
        persist(); renderTab(App.ui.tab); toast('Sample data added', 'sparkle');
      }
    });
    $('#clearBtn').addEventListener('click', () => {
      if (confirm('Delete every entry and note? This cannot be undone.')) {
        App.state = Object.assign(defaultState(), { settings: App.state.settings });
        persist(); renderTab(App.ui.tab); toast('All data cleared', 'trash');
      }
    });
  }

  $('#importInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.sleep)) throw new Error('bad shape');
        if (confirm('Replace all current data with this backup?')) {
          App.state = Object.assign(defaultState(), parsed, { settings: Object.assign(defaultState().settings, parsed.settings || {}) });
          persist(); renderTab(App.ui.tab); toast('Backup imported', 'upload');
        }
      } catch (err) { toast('That file doesn\u2019t look like a Logbook backup', 'x'); }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  /* ---- Tab router ---- */
  const RENDERERS = { dashboard: renderDashboard, sleep: renderSleep, study: renderStudy, distraction: renderDistraction, journal: renderJournal, settings: renderSettings };
  function renderTab(tab) {
    App.ui.tab = tab;
    (RENDERERS[tab] || renderDashboard)();
  }
  $$('.tabrail__item').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.tabrail__item').forEach((b) => b.setAttribute('aria-selected', 'false'));
      btn.setAttribute('aria-selected', 'true');
      document.getElementById('app').dataset.tab = btn.dataset.tab;
      location.hash = btn.dataset.tab;
      renderTab(btn.dataset.tab);
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    });
  });

  /* ---- Theme ---- */
  function applyTheme() {
    const pref = App.state.settings.theme;
    const effective = pref || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', effective);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', effective === 'dark' ? '#14181A' : '#F6F3EC');
    $('#themeLabel').textContent = effective === 'dark' ? 'Dark' : 'Light';
    $('#themeToggle').setAttribute('aria-label', 'Switch to ' + (effective === 'dark' ? 'light' : 'dark') + ' mode');
  }
  $('#themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    App.state.settings.theme = current === 'dark' ? 'light' : 'dark';
    persist(); applyTheme();
    if (App.ui.tab === 'settings') renderSettings();
  });
  if (matchMedia) {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (App.state.settings.theme === null) applyTheme();
    });
  }

  /* ---- Boot ---- */
  applyTheme();
  paintIcons(document);
  const initialTab = (location.hash || '').replace('#', '');
  const startTab = RENDERERS[initialTab] ? initialTab : 'dashboard';
  $$('.tabrail__item').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === startTab ? 'true' : 'false'));
  document.getElementById('app').dataset.tab = startTab;
  renderTab(startTab);

  // charts bake in a pixel width at render time (for crisp, legible axis
  // text) rather than scaling continuously, so re-render on resize/rotate
  window.addEventListener('resize', debounce(() => renderTab(App.ui.tab), 200));

  if (!storageOK) {
    const banner = $('#storageBanner');
    banner.hidden = false;
    paintIcons(banner);
    $('#bannerClose').addEventListener('click', () => { banner.hidden = true; });
  }
})();
