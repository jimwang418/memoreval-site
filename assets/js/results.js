// Results section: small hand-rolled SVG charts driven by data/results.json.
// Every chart has hover/focus tooltips and a table view.
(() => {
  const sec = document.getElementById('results');
  if (!sec) return;
  const NS = 'http://www.w3.org/2000/svg';
  const COND = [
    { k: 'text', label: 'text', v: '--c-text' },
    { k: 'd64', label: 'desc@64', v: '--c-d64' },
    { k: 'd256', label: 'desc@256', v: '--c-d256' },
    { k: 'd1024', label: 'desc@1024', v: '--c-d1024' },
    { k: 'frames', label: 'frames', v: '--c-frames' },
    { k: 'frames+graph', label: 'frames+graph', v: '--c-fg' },
  ];
  const C = Object.fromEntries(COND.map((c) => [c.k, c]));
  const col = (k) => `var(${C[k].v})`;
  const f0 = (x) => Math.round(x).toString();
  const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
  const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
  const sgn = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±') + f1(Math.abs(x));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- tiny SVG toolkit ----------
  const S = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };
  const T = (parent, x, y, text, cls, attrs = {}) => { const t = S('text', { x, y, class: cls, ...attrs }, parent); t.textContent = text; return t; };
  const lin = (d0, d1, r0, r1) => { const f = (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0); f.inv = (p) => d0 + ((p - r0) / (r1 - r0)) * (d1 - d0); return f; };
  const ticks = (a, b, step) => { const out = []; for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(6)); return out; };
  const newSvg = (body, w, h, label) => { body.innerHTML = ''; const s = S('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': label }); body.appendChild(s); return s; };
  // A bar with a 4px rounded data-end, square at the baseline.
  const barPath = (x, y0, w, y1) => {
    const top = Math.min(y0, y1), h = Math.abs(y1 - y0), r = Math.min(4, h, w / 2);
    return `M${x},${y0} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${y0} Z`;
  };

  // ---------- tooltip + table plumbing ----------
  function tip(card) {
    const body = card.querySelector('.cc-body');
    let el = body.querySelector('.tip');
    if (!el) { el = document.createElement('div'); el.className = 'tip'; el.setAttribute('aria-hidden', 'true'); body.appendChild(el); }
    return {
      show(evt, html, anchor) {
        el.innerHTML = html;
        const br = body.getBoundingClientRect();
        let x, y;
        if (evt && evt.clientX != null && evt.type !== 'focus') { x = evt.clientX - br.left; y = evt.clientY - br.top; }
        else { const r = anchor.getBoundingClientRect(); x = r.left + r.width / 2 - br.left; y = r.top - br.top; }
        el.classList.add('on');
        const w = el.offsetWidth, h = el.offsetHeight;
        el.style.left = Math.max(0, Math.min(br.width - w, x + 14)) + 'px';
        el.style.top = Math.max(0, y - h - 10) + 'px';
      },
      hide() { el.classList.remove('on'); },
    };
  }
  function bindTip(g, tp, html) {
    g.classList.add('mk');
    const on = (e) => tp.show(e, html(), g);
    g.addEventListener('pointerenter', on); g.addEventListener('pointermove', on);
    g.addEventListener('focus', on);
    g.addEventListener('pointerleave', () => tp.hide()); g.addEventListener('blur', () => tp.hide());
  }
  function table(caption, head, rows) {
    return `<div class="tbl-wrap"><table class="dtable"><caption>${esc(caption)}</caption><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  // Wires a chart card: segmented tabs, table toggle, re-render on resize.
  function card(id, render) {
    const el = document.getElementById(id);
    const body = el.querySelector('.cc-body');
    const tabs = [...el.querySelectorAll('.cc-ctrl .seg button')];
    const tbtn = el.querySelector('.tbl-btn');
    const st = { v: tabs[0] ? tabs[0].dataset.v : null, table: false, sub: null };
    const draw = () => render(el, body, st);
    tabs.forEach((b) => b.addEventListener('click', () => {
      tabs.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      st.v = b.dataset.v; st.sub = null; draw();
    }));
    if (tbtn) tbtn.addEventListener('click', () => { st.table = !st.table; tbtn.setAttribute('aria-pressed', String(st.table)); el.classList.toggle('tbl', st.table); draw(); });
    let w = 0;
    new ResizeObserver(() => { const nw = Math.round(body.clientWidth); if (Math.abs(nw - w) > 24) { w = nw; draw(); } }).observe(body);
    draw();
    return { el, st, draw };
  }
  const legend = (el, items) => {
    el.innerHTML = items.map((i) => `<span><i class="${i.shape || ''}" style="background:${i.color};${i.shape === 'ring' ? `border-color:${i.color}` : ''}"></i>${esc(i.label)}</span>`).join('');
  };
  const fill = (key, html) => sec.querySelectorAll(`[data-fill="${key}"]`).forEach((e) => { e.innerHTML = html; });

  // Greedy vertical de-overlap for point labels (in pixel space).
  function placeLabels(items, minGap) {
    const sorted = [...items].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1], b = sorted[i];
      if (Math.abs(a.x - b.x) < 120 && b.y - a.y < minGap) b.y = a.y + minGap;
    }
    return items;
  }

  fetch('data/results.json').then((r) => r.json()).then(build).catch((e) => { console.error(e); });

  function build(R) {
    const H = Object.fromEntries(R.headline.rows.map((r) => [r.key, r]));
    const D = R.headline.derived;
    const fr = H.frames, d1 = H.d1024, fg = H['frames+graph'];
    const condLegend = COND.map((c) => ({ label: c.label, color: col(c.k), shape: 'dot' }));
    sec.querySelectorAll('[data-legend="conds"]').forEach((el) => legend(el, condLegend));

    // ---------- lead + stat tiles ----------
    fill('lead', `With Gemini 3.7 Flash as memory writer and agent, archiving the camera frames themselves beats storing generated descriptions of them on task success, on write-time cost, and on read-time cost per successful request. Adding scene-graph snapshots raises success further, at a higher read-time cost.`);
    const ctl = Object.fromEntries((R.controls || []).map((c) => [c.key, c]));
    if (ctl['no-memory'] && ctl.oracle) fill('controls', `For reference, with no memory the agent solves ${ctl['no-memory'].tasks_solved} of ${ctl['no-memory'].tasks} tasks; given hand-written facts sufficient for each task, it solves all ${ctl.oracle.tasks}.`);
    fill('stats', `
      <div class="stat"><div class="v">${f0(fr.task_pct.mean)}% <small>vs. ${f0(d1.task_pct.mean)}%</small></div><div class="l">task success with frames vs. desc@1024; ${f0(fg.task_pct.mean)}% with frames+graph</div></div>
      <div class="stat"><div class="v">${f0(D.frames_write_saving_vs_desc1024_pct)}% <small>lower</small></div><div class="l">write-time cost than desc@1024 (${f0(D.frames_write_saving_vs_desc64_pct)}% lower than desc@64), because frames are stored without a model call</div></div>
      <div class="stat"><div class="v">${f0(D.frames_fewer_tokens_per_info_success_vs_desc1024_pct)}% <small>/ ${f0(D.frames_fewer_tokens_per_action_success_vs_desc1024_pct)}% lower</small></div><div class="l">read-time cost per successful information / action request than desc@1024</div></div>`);
    fill('why-write', `A description takes one extra model call per experience step, while a frame is archived as-is. The writer&rsquo;s own cost is essentially the same in every condition, so frames cost <b>${f2(fr.write_k_per_step.mean)}k</b> weighted tokens per step against <b>${f2(H.d64.write_k_per_step.mean)}&ndash;${f2(d1.write_k_per_step.mean)}k</b> for descriptions.`);
    fill('why-read', `Per attempted request, frames and desc@1024 cost about the same (${f1(fr.read_k_per_info_request.mean)}k vs. ${f1(d1.read_k_per_info_request.mean)}k weighted tokens per information request): agents reading frames make fewer model calls (${f1(fr.calls_per_request)} vs. ${f1(d1.calls_per_request)}) and use fewer reasoning tokens (${f1(fr.reasoning_k_per_request)}k vs. ${f1(d1.reasoning_k_per_request)}k). Because they also succeed more often, frames have the lowest cost per successful request of all six conditions.`);
    fill('ledger-cap', `Gemini 3.7 Flash, 53 tasks &times; 5 backends &times; 3 seeds per condition (write-time cost: the four backends with a writer); whiskers show the range across seeds. Weighted tokens = T<sub>in</sub>&middot;P<sub>in</sub>/P<sub>out</sub> + T<sub>out</sub>. Costs cover model inference only.`);

    // ---------- Fig 2: success vs cost ----------
    const MODES = {
      write: { x: (r) => r.write_k_per_step, y: (r) => r.task_pct, xl: 'Write-time cost (k weighted tokens per experience step)', xs: 'Write cost (k weighted tokens / step)', yl: 'Task success (%)', sub: 'Writing memory: the writer\u2019s input is identical across conditions; descriptions add one model call per step', iso: null, yv: 'task' },
      info: { x: (r) => r.read_k_per_info_request, y: (r) => r.info_pct, xl: 'Read-time cost (k weighted tokens per information request)', xs: 'Read cost (k weighted tokens / request)', yl: 'Information requests answered correctly (%)', sub: 'Answering information requests from memory; diagonals mark equal cost per successful request', iso: R.headline.figure_guides.info, yv: 'info' },
      action: { x: (r) => r.read_k_per_action_request, y: (r) => r.action_pct, xl: 'Read-time cost (k weighted tokens per action request)', xs: 'Read cost (k weighted tokens / request)', yl: 'Action requests completed (%)', sub: 'Planning action requests from memory; diagonals mark equal cost per successful request', iso: R.headline.figure_guides.action, yv: 'action' },
    };
    card('fig-ledger', (el, body, st) => {
      const M = MODES[st.v];
      fill('ledger-sub', M.sub);
      const rows = COND.map((c) => H[c.k]);
      if (st.table) {
        body.innerHTML = table('Gemini 3.7 Flash, per memory condition', ['Condition', 'Task %', 'Info %', 'Action %', 'Write k/step', 'Read k/info req.', 'Read k/action req.', 'k per info success', 'k per action success'],
          rows.map((r) => [C[r.key].label, f1(r.task_pct.mean), f1(r.info_pct.mean), f1(r.action_pct.mean), f2(r.write_k_per_step.mean), f2(r.read_k_per_info_request.mean), f2(r.read_k_per_action_request.mean), f2(r.read_k_per_info_success), f2(r.read_k_per_action_success)]));
        return;
      }
      const W = Math.max(320, body.clientWidth), Hh = Math.round(Math.min(420, Math.max(300, W * 0.42)));
      const m = { l: 52, r: W < 600 ? 18 : 120, t: 14, b: 46 };
      const svg = newSvg(body, W, Hh, M.yl + ' against ' + M.xl);
      const xs = rows.map((r) => M.x(r).mean), ys = rows.map((r) => M.y(r).mean);
      const xpad = (Math.max(...xs) - Math.min(...xs)) * 0.18 || 0.5;
      const x0 = Math.min(...xs) - xpad, x1 = Math.max(...xs) + xpad;
      const y0 = Math.floor((Math.min(...ys) - 6) / 10) * 10, y1 = Math.min(100, Math.ceil((Math.max(...ys) + 6) / 10) * 10);
      const X = lin(x0, x1, m.l, W - m.r), Y = lin(y0, y1, Hh - m.b, m.t);
      const grid = S('g', { class: 'ch-grid' }, svg), ax = S('g', { class: 'ch-axis' }, svg);
      const xstep = (x1 - x0) > 4 ? 1 : (x1 - x0) > 1.6 ? 0.5 : 0.2;
      for (const v of ticks(y0, y1, 10)) { S('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, grid); T(svg, m.l - 8, Y(v) + 4, f0(v), 'ch-tick', { 'text-anchor': 'end' }); }
      for (const v of ticks(x0, x1, xstep)) { T(svg, X(v), Hh - m.b + 16, xstep < 1 ? v.toFixed(1) : f0(v), 'ch-tick', { 'text-anchor': 'middle' }); }
      S('line', { x1: m.l, x2: W - m.r, y1: Hh - m.b, y2: Hh - m.b }, ax);
      T(svg, W < 600 ? W / 2 : (m.l + W - m.r) / 2, Hh - 8, W < 600 ? M.xs : M.xl, 'ch-alabel', { 'text-anchor': 'middle' });
      T(svg, 14, (m.t + Hh - m.b) / 2, M.yl, 'ch-alabel', { 'text-anchor': 'middle', transform: `rotate(-90 14 ${(m.t + Hh - m.b) / 2})` });
      // iso-cost guides: success% = 100 * x / c
      if (M.iso) {
        const clip = S('clipPath', { id: 'ledger-clip' }, S('defs', {}, svg));
        S('rect', { x: m.l, y: m.t, width: W - m.r - m.l, height: Hh - m.b - m.t }, clip);
        const gi = S('g', { 'clip-path': 'url(#ledger-clip)' }, svg);
        for (const c of M.iso) {
          const pts = [x0, x1].map((xv) => [X(xv), Y((100 * xv) / c)]);
          S('line', { x1: pts[0][0], y1: pts[0][1], x2: pts[1][0], y2: pts[1][1], class: 'ch-iso' }, gi);
          // label where the guide leaves the plot at the top
          const xt = Math.min(x1, (y1 * c) / 100);
          if (W >= 600 && (100 * x0) / c < y1) T(svg, Math.min(W - m.r - 4, X(xt) - 2), Math.max(m.t + 10, Y((100 * xt) / c) + 12), `${c}k per success`, 'ch-iso-l', { 'text-anchor': 'end' });
        }
      }
      // descriptions connected in budget order
      const dpts = ['d64', 'd256', 'd1024'].map((k) => [X(M.x(H[k]).mean), Y(M.y(H[k]).mean)]);
      S('polyline', { points: dpts.map((p) => p.join(',')).join(' '), fill: 'none', stroke: col('d256'), 'stroke-width': 2, opacity: 0.45, 'stroke-linejoin': 'round' }, svg);
      const tp = tip(el);
      const labs = [];
      rows.forEach((r) => {
        const cx = X(M.x(r).mean), cy = Y(M.y(r).mean);
        const g = S('g', {}, svg);
        const yr = M.y(r), xr = M.x(r);
        if (yr.lo != null) S('line', { x1: cx, x2: cx, y1: Y(yr.lo), y2: Y(yr.hi), stroke: col(r.key), 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
        if (xr.lo != null && st.v !== 'write') S('line', { x1: X(xr.lo), x2: X(xr.hi), y1: cy, y2: cy, stroke: col(r.key), 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
        S('circle', { cx, cy, r: 6.5, fill: col(r.key), stroke: 'var(--surface)', 'stroke-width': 2, class: 'vis' }, g);
        S('circle', { cx, cy, r: 16, class: 'hit' }, g);
        bindTip(g, tp, () => `<div class="tv">${f1(yr.mean)}%</div><div class="tl"><span class="tk" style="background:${col(r.key)}"></span>${esc(C[r.key].label)}</div>
          <div class="tr">${st.v === 'write' ? 'write k/step' : 'read k/request'} <b>${f2(xr.mean)}</b></div>
          ${st.v === 'write' ? `<div class="tr">seed range <b>${f1(yr.lo)}&ndash;${f1(yr.hi)}%</b></div>` : `<div class="tr">k per success <b>${f2(st.v === 'info' ? r.read_k_per_info_success : r.read_k_per_action_success)}</b></div>`}`);
        labs.push({ x: cx + 9, y: st.v === 'write' ? cy + 4 : cy - 9, text: C[r.key].label });
      });
      for (const l of placeLabels(labs, 15)) {
        const w = l.text.length * 6.8, flip = l.x + w > W - 4;
        T(svg, flip ? l.x - 18 : l.x, l.y, l.text, 'ch-lab', flip ? { 'text-anchor': 'end' } : {});
      }
    });

    // ---------- Fig 3: categories ----------
    const CATS = R.categories.rows;
    const PAIR = { fd: 'frames - d1024', gf: 'frames+graph - frames' };
    const dgf = (k) => sgn(CATS.find((c) => c.key === k).diffs[PAIR.gf].diff_pp);
    fill('cats-lead', `Frames improve mean success over desc@1024 in six of the seven categories; the 95% intervals exclude zero for appearance binding (${sgn(CATS.find((c) => c.key === 'appearance_binding').diffs[PAIR.fd].diff_pp)} points) and object location (${sgn(CATS.find((c) => c.key === 'object_location').diffs[PAIR.fd].diff_pp)}). Adding scene graphs raises overall success by ${dgf('all').replace('+', '')} points; the intervals exclude zero for spatial configuration (${dgf('spatial_configuration')}) and user preference (${dgf('user_preference')}).`);
    card('fig-cats', (el, body, st) => {
      const pk = PAIR[st.v];
      const left = st.v === 'fd' ? 'desc@1024' : 'frames', right = st.v === 'fd' ? 'frames' : 'frames+graph';
      const ck = st.v === 'fd' ? 'frames' : 'frames+graph';
      fill('cats-title', st.v === 'fd' ? 'frames minus desc@1024, task success' : 'frames+graph minus frames, task success');
      const all = CATS.find((c) => c.key === 'all' || /all/i.test(c.label)) || null;
      const rows = all ? [all, ...CATS.filter((c) => c !== all)] : CATS;
      if (st.table) {
        const mn = (x) => (x < 0 ? '\u2212' : '') + f1(Math.abs(x));
        const TC = ['d1024', 'frames', 'frames+graph'];
        body.innerHTML = table('Paired difference in task success (percentage points), 95% interval', ['Category', 'Tasks', 'Difference', '95% interval', ...TC.map((k) => C[k].label + ' %')],
          rows.map((r) => [r.label, String(r.tasks), sgn(r.diffs[pk].diff_pp), `[${mn(r.diffs[pk].ci95_lo)}, ${mn(r.diffs[pk].ci95_hi)}]`, ...TC.map((k) => f0(r.success_pct[k]))]));
        return;
      }
      const W = Math.max(300, body.clientWidth), rowH = 34, m = { l: Math.min(210, W * 0.36), r: 24, t: 30, b: 44 };
      const Hh = m.t + m.b + rows.length * rowH;
      const svg = newSvg(body, W, Hh, `Paired differences: ${right} minus ${left}`);
      const lo = Math.min(-15, ...rows.map((r) => r.diffs[pk].ci95_lo)), hi = Math.max(40, ...rows.map((r) => r.diffs[pk].ci95_hi));
      const X = lin(Math.floor(lo / 10) * 10, Math.ceil(hi / 10) * 10, m.l, W - m.r);
      const grid = S('g', { class: 'ch-grid' }, svg);
      for (const v of ticks(Math.floor(lo / 10) * 10, Math.ceil(hi / 10) * 10, 10)) { S('line', { x1: X(v), x2: X(v), y1: m.t, y2: Hh - m.b }, grid); T(svg, X(v), Hh - m.b + 16, (v > 0 ? '+' : '') + v, 'ch-tick', { 'text-anchor': 'middle' }); }
      S('line', { x1: X(0), x2: X(0), y1: m.t - 6, y2: Hh - m.b, class: 'ch-zero' }, svg);
      T(svg, X(0) - 8, m.t - 12, `← favors ${left}`, 'ch-note', { 'text-anchor': 'end' });
      T(svg, X(0) + 8, m.t - 12, `favors ${right} →`, 'ch-note');
      T(svg, (m.l + W - m.r) / 2, Hh - 6, 'Difference in task success (percentage points)', 'ch-alabel', { 'text-anchor': 'middle' });
      const tp = tip(el);
      rows.forEach((r, i) => {
        const y = m.t + i * rowH + rowH / 2, d = r.diffs[pk];
        T(svg, m.l - 12, y + 4, r.label, i === 0 && all ? 'ch-lab' : 'ch-lab sub', { 'text-anchor': 'end' });
        T(svg, m.l - 12, y + 17, `${r.tasks} tasks`, 'ch-tick', { 'text-anchor': 'end' });
        const g = S('g', {}, svg);
        S('line', { x1: X(d.ci95_lo), x2: X(d.ci95_hi), y1: y, y2: y, stroke: col(ck), 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
        S('circle', { cx: X(d.diff_pp), cy: y, r: i === 0 && all ? 7 : 6, fill: col(ck), stroke: 'var(--surface)', 'stroke-width': 2, class: 'vis' }, g);
        S('rect', { x: X(d.ci95_lo) - 8, y: y - 12, width: Math.max(24, X(d.ci95_hi) - X(d.ci95_lo) + 16), height: 24, class: 'hit' }, g);
        bindTip(g, tp, () => `<div class="tv">${sgn(d.diff_pp)} pts</div><div class="tl">${esc(r.label)}</div><div class="tr">95% interval <b>[${f1(d.ci95_lo)}, ${f1(d.ci95_hi)}]</b></div>
          <div class="tr">${esc(left)} <b>${f0(r.success_pct[st.v === 'fd' ? 'd1024' : 'frames'])}%</b></div><div class="tr">${esc(right)} <b>${f0(r.success_pct[ck])}%</b></div>`);
      });
    });

    // ---------- Fig 4: models ----------
    const MOD = R.models.rows;
    const mg = (k, c) => MOD.find((m) => m.key === k).task_pct[c];
    fill('models-lead', `On one seed and three backends (transcript, wiki, A-MEM), frames+graph is the best condition for all three models. Whether frames beat desc@1024 depends on the model: they do for Gemini 3.7 Flash (${f0(mg('gemini', 'frames'))}% vs. ${f0(mg('gemini', 'd1024'))}%) and GPT 5.6 Sol (${f0(mg('sol', 'frames'))}% vs. ${f0(mg('sol', 'd1024'))}%), but not for GLM 5.3 Flash (${f0(mg('glm', 'frames'))}% vs. ${f0(mg('glm', 'd1024'))}%), suggesting that models differ in how well they use each representation.`);
    card('fig-models', (el, body, st) => {
      if (st.table) {
        body.innerHTML = table('Task success (%) and read-time cost (k weighted tokens per task, at each model’s own prices)', ['Model', ...COND.map((c) => c.label + ' %'), ...COND.map((c) => c.label + ' k')],
          MOD.map((m) => [m.label, ...COND.map((c) => f0(m.task_pct[c.k])), ...COND.map((c) => f1(m.read_k_per_task[c.k]))]));
        return;
      }
      const W = Math.max(320, body.clientWidth), rowH = 62, m = { l: Math.min(150, W * 0.28), r: 30, t: 8, b: 40 };
      const Hh = m.t + m.b + MOD.length * rowH;
      const svg = newSvg(body, W, Hh, 'Task success by memory condition for three models');
      const X = lin(30, 80, m.l, W - m.r);
      const grid = S('g', { class: 'ch-grid' }, svg);
      for (const v of ticks(30, 80, 10)) { S('line', { x1: X(v), x2: X(v), y1: m.t, y2: Hh - m.b }, grid); T(svg, X(v), Hh - m.b + 16, f0(v), 'ch-tick', { 'text-anchor': 'middle' }); }
      T(svg, (m.l + W - m.r) / 2, Hh - 6, 'Task success (%)', 'ch-alabel', { 'text-anchor': 'middle' });
      const tp = tip(el);
      MOD.forEach((mo, i) => {
        const y = m.t + i * rowH + rowH / 2;
        T(svg, m.l - 14, y + 4, mo.label, 'ch-lab', { 'text-anchor': 'end' });
        S('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: 'var(--hair)', 'stroke-width': 1 }, svg);
        // nudge dots that would overlap
        const pts = COND.map((c) => ({ k: c.k, x: X(mo.task_pct[c.k]) })).sort((a, b) => a.x - b.x);
        let lane = 0;
        pts.forEach((p, j) => { lane = j > 0 && p.x - pts[j - 1].x < 13 ? (pts[j - 1].lane === 0 ? 1 : 0) : 0; p.lane = lane; });
        for (const p of pts) {
          const cy = y + (p.lane ? -9 : 0) + (pts.some((q) => q.lane) && !p.lane ? 4 : 0);
          const g = S('g', {}, svg);
          S('circle', { cx: p.x, cy, r: 6.5, fill: col(p.k), stroke: 'var(--surface)', 'stroke-width': 2, class: 'vis' }, g);
          S('circle', { cx: p.x, cy, r: 13, class: 'hit' }, g);
          bindTip(g, tp, () => `<div class="tv">${f1(mo.task_pct[p.k])}%</div><div class="tl"><span class="tk" style="background:${col(p.k)}"></span>${esc(C[p.k].label)} · ${esc(mo.label)}</div><div class="tr">read k/task <b>${f1(mo.read_k_per_task[p.k])}</b></div>`);
        }
        const best = mo.task_pct['frames+graph'];
        const lbl = `frames+graph ${f0(best)}%`, room = W - m.r - X(best) - 11 > lbl.length * 6.2;
        if (W < 600) T(svg, m.l, y - 19, lbl, 'ch-tick');
        else T(svg, room ? X(best) + 11 : X(best) - 11, y - 9, lbl, 'ch-tick', room ? {} : { 'text-anchor': 'end' });
      });
    });

    // ---------- Fig 5: deployment-oriented variants ----------
    const SINGLE = R.backends_single.rows, STACK = R.backends_stacked.rows;
    const SEES = R.writer_sees_images.rows;
    const deploy = card('fig-deploy', (el, body, st) => {
      const ctrl = el.querySelector('[data-fill="deploy-ctrl"]');
      const leg = el.querySelector('[data-legend="deploy"]');
      if (st.v === 'stack') {
        st.sub = st.sub || 'single';
        fill('deploy-title', st.sub === 'single' ? 'Single tasks, by memory backend' : 'Stacked histories, by memory backend');
        fill('deploy-sub', st.sub === 'single' ? 'Task success (%) on the 41 component tasks of the stacked histories, run one at a time; three seeds' : 'Component tasks passed (%) after one long history of 37–100 steps per environment; three seeds');
        fill('deploy-cap', 'Backends respond differently to longer histories. The transcript degrades substantially: its rolling history exceeds the shared memory-context budget, so earlier observations and their retrieval cues are truncated. The other backends respond differently to accumulated experience.');
        ctrl.innerHTML = `<div class="seg" role="group" aria-label="History length"><button type="button" data-s="single" aria-pressed="${st.sub === 'single'}">Single tasks</button><button type="button" data-s="stack" aria-pressed="${st.sub === 'stack'}">Stacked histories</button></div>`;
        ctrl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { st.sub = b.dataset.s; deploy.draw(); }));
        legend(leg, condLegend);
        const src = st.sub === 'single' ? SINGLE.map((r) => ({ label: r.label, v: r.success_pct })) : STACK.map((r) => ({ label: r.label, v: r.components_passed_pct }));
        if (st.table) {
          body.innerHTML = table(st.sub === 'single' ? 'Task success (%), 41 component tasks run one at a time' : 'Component tasks passed (%), stacked histories', ['Backend', ...COND.map((c) => c.label)], src.map((r) => [r.label, ...COND.map((c) => f0(r.v[c.k].mean))]));
          return;
        }
        groupedBars(el, body, src.map((r) => ({ label: r.label, bars: COND.map((c) => ({ k: c.k, label: c.label, color: col(c.k), ...r.v[c.k] })) })), st.sub === 'single' ? 'Task success (%)' : 'Component tasks passed (%)', st.sub === 'stack' ? 'transcript' : null);
      } else if (st.v === 'select') {
        ctrl.innerHTML = '';
        const rows = SINGLE.filter((r) => r.writer_selects_images);
        const kept = rows.map((r) => r.writer_selects_images.frames_kept_pct);
        fill('deploy-title', 'frames, writer selects images');
        fill('deploy-sub', 'The memory writer decides which frames to archive; only those can be retrieved later. Task success (%) on the 41 component tasks');
        fill('deploy-cap', `Under the same selection instruction, writers keep ${f0(Math.min(...kept))}&ndash;${f0(Math.max(...kept))}% of the frames, with lower mean task success than keeping every frame for each backend.`);
        legend(leg, [{ label: 'frames, all kept', color: col('frames') }, { label: 'frames, writer selects images', color: col('frames'), shape: 'ring' }]);
        if (st.table) {
          body.innerHTML = table('Task success (%), 41 component tasks', ['Backend', 'frames, all kept', 'writer selects images', 'frames kept (%)'], rows.map((r) => [r.label, f0(r.success_pct.frames.mean), f0(r.writer_selects_images.success_pct.mean), f0(r.writer_selects_images.frames_kept_pct)]));
          return;
        }
        groupedBars(el, body, rows.map((r) => ({
          label: r.label, note: `${f0(r.writer_selects_images.frames_kept_pct)}% kept`,
          bars: [{ k: 'frames', label: 'frames, all kept', color: col('frames'), ...r.success_pct.frames }, { k: 'sel', label: 'frames, writer selects images', color: col('frames'), outline: true, ...r.writer_selects_images.success_pct, extra: `${f0(r.writer_selects_images.frames_kept_pct)}% of frames kept` }],
        })), 'Task success (%)');
      } else {
        st.sub = st.sub || 'frames';
        fill('deploy-title', `${C[st.sub || 'frames'].label}, writer sees images`);
        fill('deploy-sub', 'The writer also receives the camera frames while building memory. All 53 tasks, three seeds');
        fill('deploy-cap', 'Giving the writer access to camera images does not consistently improve task success. Mem0 and ObsMem incur lower write-time cost with approximately unchanged read-time cost, while wiki and A-MEM incur higher write-time cost.');
        ctrl.innerHTML = `<div class="seg" role="group" aria-label="Condition"><button type="button" data-s="frames" aria-pressed="${st.sub === 'frames'}">frames</button><button type="button" data-s="frames+graph" aria-pressed="${st.sub === 'frames+graph'}">frames+graph</button></div>`;
        ctrl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { st.sub = b.dataset.s; deploy.draw(); }));
        const ck = st.sub;
        legend(leg, [{ label: `${C[ck].label}, default writer`, color: col(ck) }, { label: `${C[ck].label}, writer sees images`, color: col(ck), shape: 'ring' }]);
        const rows = SEES.filter((r) => r.condition === ck);
        if (st.table) {
          body.innerHTML = table(`${C[ck].label}: default writer → writer sees images, 53 tasks`, ['Backend', 'Success %', 'Success % (sees)', 'Write k/step', 'Write k/step (sees)', 'Read k/task', 'Read k/task (sees)'],
            rows.map((r) => [r.backend_label, f0(r.task_pct.default), f0(r.task_pct.writer_sees_images), f2(r.write_k_per_step.default), f2(r.write_k_per_step.writer_sees_images), f1(r.read_k_per_task.default), f1(r.read_k_per_task.writer_sees_images)]));
          return;
        }
        body.innerHTML = '<div class="twin"><div class="tw-a"></div><div class="tw-b"></div></div>';
        const mk = (r, key, fmt) => [
          { k: 'def', label: `${C[ck].label}, default writer`, color: col(ck), mean: r[key].default, fmt },
          { k: 'sees', label: `${C[ck].label}, writer sees images`, color: col(ck), outline: true, mean: r[key].writer_sees_images, fmt },
        ];
        groupedBars(el, body.querySelector('.tw-a'), rows.map((r) => ({ label: r.backend_label, bars: mk(r, 'task_pct', f0) })), 'Task success (%)', null, { max: 100, unit: '%' });
        groupedBars(el, body.querySelector('.tw-b'), rows.map((r) => ({ label: r.backend_label, bars: mk(r, 'write_k_per_step', f2) })), 'Write-time cost (k weighted tokens per step)', null, { max: 4, step: 1, unit: 'k' });
      }
    });

    function groupedBars(cardEl, body, groups, ylabel, highlight, opt = {}) {
      const W = Math.max(280, body.clientWidth), Hh = Math.round(Math.min(340, Math.max(240, W * 0.34)));
      const m = { l: 44, r: 8, t: 14, b: groups.some((g) => g.note) ? 48 : 40 };
      const svg = newSvg(body, W, Hh, ylabel + ' by backend');
      const max = opt.max || 100, step = opt.step || 20;
      const Y = lin(0, max, Hh - m.b, m.t);
      const grid = S('g', { class: 'ch-grid' }, svg);
      for (const v of ticks(0, max, step)) { S('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, grid); T(svg, m.l - 8, Y(v) + 4, f0(v), 'ch-tick', { 'text-anchor': 'end' }); }
      T(svg, 12, (m.t + Hh - m.b) / 2, ylabel, 'ch-alabel', { 'text-anchor': 'middle', transform: `rotate(-90 12 ${(m.t + Hh - m.b) / 2})` });
      const gw = (W - m.l - m.r) / groups.length;
      const tp = tip(cardEl);
      groups.forEach((g, gi) => {
        const n = g.bars.length, bw = Math.min(24, (gw * 0.8 - (n - 1) * 2) / n), span = n * bw + (n - 1) * 2;
        const gx = m.l + gi * gw + (gw - span) / 2;
        if (highlight && g.label === highlight) S('rect', { x: m.l + gi * gw + 4, y: m.t - 4, width: gw - 8, height: Hh - m.b - m.t + 8, rx: 8, fill: 'var(--lime)', opacity: 0.22 }, svg);
        const stag = gw < 72 && !g.note && gi % 2 ? 12 : 0;
        T(svg, m.l + gi * gw + gw / 2, Hh - m.b + 16 + stag, g.label, gw < 72 ? 'ch-tick' : 'ch-lab sub', { 'text-anchor': 'middle' });
        if (g.note) T(svg, m.l + gi * gw + gw / 2, Hh - m.b + 32, g.note, 'ch-tick', { 'text-anchor': 'middle' });
        g.bars.forEach((b, i) => {
          const x = gx + i * (bw + 2);
          const gg = S('g', {}, svg);
          S('path', { d: barPath(x, Y(0), bw, Y(Math.max(0, b.mean))), fill: b.outline ? 'var(--surface)' : b.color, stroke: b.outline ? b.color : 'none', 'stroke-width': b.outline ? 2 : 0, class: 'vis bar' }, gg);
          if (b.lo != null && b.hi != null && b.hi > b.lo) S('line', { x1: x + bw / 2, x2: x + bw / 2, y1: Y(b.lo), y2: Y(b.hi), stroke: 'var(--ink-2)', 'stroke-width': 1.2, opacity: 0.6 }, gg);
          S('rect', { x: x - 1, y: m.t, width: bw + 2, height: Hh - m.b - m.t, class: 'hit' }, gg);
          const fmt = b.fmt || f1;
          bindTip(gg, tp, () => `<div class="tv">${fmt(b.mean)}${opt.unit || (b.fmt ? '' : '%')}</div><div class="tl"><span class="tk" style="background:${b.color}"></span>${esc(b.label)} · ${esc(g.label)}</div>${b.lo != null && b.hi > b.lo ? `<div class="tr">seed range <b>${f0(b.lo)}&ndash;${f0(b.hi)}%</b></div>` : ''}${b.extra ? `<div class="tr">${esc(b.extra)}</div>` : ''}`);
        });
      });
    }

    // ---------- design space ----------
    const AX = [
      { h: 'Memory modality', lv: ['text', 'desc@64', 'desc@256', 'desc@1024', 'frames', 'frames+graph'], you: 'your modality' },
      { h: 'Memory backend', lv: ['transcript', 'wiki', 'A-MEM', 'Mem0', 'ObsMem'], you: 'your backend' },
      { h: 'Model (writer, describer and agent)', lv: ['Gemini 3.7 Flash', 'GPT 5.6 Sol', 'GLM 5.3 Flash'], you: 'any model' },
      { h: 'History length', lv: ['single task', 'stacked: 37–100 steps'] },
      { h: 'Writer input', lv: ['text only', 'text + camera images'] },
      { h: 'Frame retention', lv: ['archive every frame', 'writer selects'] },
      { h: 'Request type', lv: ['information', 'action, open-loop plan'] },
      { h: 'Environment', lv: ['office', 'photography studio', 'home', 'clinic'] },
      { h: 'Metrics', lv: ['success by category', 'write-time cost per step', 'read-time cost per request and per success'] },
    ];
    fill('space', AX.map((a) => `<div class="ax"><h4>${esc(a.h)}</h4><div class="lv">${a.lv.map((l) => `<span class="on">${esc(l)}</span>`).join('')}${a.you ? `<span class="you">+ ${esc(a.you)}</span>` : ''}</div></div>`).join(''));

    // citation copy
    const cbtn = document.querySelector('.cite .copy');
    if (cbtn) cbtn.addEventListener('click', () => { navigator.clipboard?.writeText(document.querySelector('.cite code').textContent).then(() => { cbtn.textContent = 'Copied'; setTimeout(() => { cbtn.textContent = 'Copy'; }, 1500); }); });
  }
})();
