/* Small SVG chart helpers shared by every page: line, step-area, grouped columns, sparkline.
   Colours come from CSS custom properties so light and dark themes both work. */
window.Charts = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const probe = document.createElement("span");
  probe.style.display = "none";
  document.documentElement.appendChild(probe);
  const color = v => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
  const num = (x, d = 2) => x.toFixed(d);

  function niceTicks(lo, hi, n = 5) {
    const span = hi - lo || 1;
    const step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0);
    const out = [];
    for (let v = Math.floor(lo / step + 1e-9) * step; v < hi + step - 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }

  function observe(fig, draw) {
    const svg = document.createElementNS(NS, "svg");
    fig.appendChild(svg);
    const tip = document.createElement("div");
    tip.className = "tip";
    fig.appendChild(tip);
    const run = () => draw(svg, tip, fig.clientWidth, fig.clientHeight);
    const ro = new ResizeObserver(run);
    ro.observe(fig);
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", run);
    new MutationObserver(run).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return run;
  }

  function placeTip(tip, x, y, W) {
    tip.style.display = "block";
    const w = tip.offsetWidth;
    tip.style.left = Math.min(Math.max(x + 14, 0), W - w) + "px";
    if (x + 14 + w > W) tip.style.left = Math.max(x - w - 14, 0) + "px";
    tip.style.top = Math.max(y - 10, 0) + "px";
  }

  /* Line chart. opts: dates, series[{name,values,color,width,dim}], yFmt, tipFmt, log, area, markers[{date,label}] */
  function line(fig, opts) {
    let o = opts;
    const draw = (svg, tip, W, H) => {
      const narrow = W < 520;
      const m = { t: 12, r: narrow ? 10 : 16, b: 26, l: narrow ? 40 : 50 };
      const n = o.dates.length, live = o.series.filter(s => s.values);
      const tf = o.log ? Math.log : v => v;
      let lo = Infinity, hi = -Infinity;
      live.forEach(s => s.values.forEach(v => { if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
      if (o.area) hi = 0;
      if (o.yMin != null) lo = Math.min(lo, o.yMin);
      const ticks = o.log ? [0.5, 1, 2, 4, 8, 16, 32].filter(t => t >= lo * 0.9 && t <= hi * 1.1) : niceTicks(lo, hi, narrow ? 4 : 5);
      if (!o.log) { lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]); }
      const X = i => m.l + (i / (n - 1)) * (W - m.l - m.r);
      const Y = v => m.t + (1 - (tf(v) - tf(lo)) / (tf(hi) - tf(lo) || 1)) * (H - m.t - m.b);
      const grid = color("--grid"), parts = [];
      ticks.forEach(t => parts.push(`<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="${grid}"/>
        <text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${esc(o.yFmt ? o.yFmt(t) : t)}</text>`));
      let lastYear = "";
      o.dates.forEach((d, i) => {
        const y = d.slice(0, 4);
        if (y !== lastYear) {
          lastYear = y;
          const yr = +y;
          if (i > 0 && (yr % (narrow ? 4 : 2) === 0)) parts.push(`<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${y}</text>`);
        }
      });
      (o.markers || []).forEach(mk => {
        const i = o.dates.findIndex(d => d >= mk.date);
        if (i < 0) return;
        parts.push(`<line x1="${X(i)}" x2="${X(i)}" y1="${m.t}" y2="${H - m.b}" stroke="${color("--muted")}" stroke-width="1"/>
          <text x="${X(i) + 6}" y="${m.t + 12}">${esc(mk.label)}</text>`);
      });
      live.forEach(s => {
        const c = color(s.color);
        const pts = s.values.map((v, i) => v == null ? null : `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).filter(Boolean);
        if (o.area) parts.push(`<path d="M${X(0)},${Y(0)}L${pts.join("L")}L${X(n - 1)},${Y(0)}Z" fill="${c}" fill-opacity=".12"/>`);
        parts.push(`<path d="M${pts.join("L")}" fill="none" stroke="${c}" stroke-width="${s.width || 2}" stroke-linejoin="round" stroke-linecap="round" ${s.dim ? 'stroke-opacity=".55"' : ""}/>`);
      });
      parts.push(`<line class="xh" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" stroke="${color("--ink")}" stroke-width="1" visibility="hidden"/>
        <g class="dots"></g><rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent"/>`);
      svg.innerHTML = parts.join("");
      const xh = svg.querySelector(".xh"), dots = svg.querySelector(".dots"), bg = color("--bg");
      const move = e => {
        const r = svg.getBoundingClientRect();
        const i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - m.l) / (W - m.l - m.r)) * (n - 1))));
        xh.setAttribute("x1", X(i)); xh.setAttribute("x2", X(i)); xh.setAttribute("visibility", "visible");
        dots.innerHTML = live.filter(s => s.values[i] != null).map(s =>
          `<circle cx="${X(i)}" cy="${Y(s.values[i])}" r="4.5" fill="${color(s.color)}" stroke="${bg}" stroke-width="2"/>`).join("");
        const fmt = o.tipFmt || (v => v.toFixed(2));
        tip.innerHTML = `<b>${esc(o.dates[i])}</b>` + live.filter(s => s.values[i] != null).map(s =>
          `<div class="row"><span><span class="k" style="background:${color(s.color)}"></span>${esc(s.name)}</span><strong>${esc(fmt(s.values[i]))}</strong></div>`).join("");
        placeTip(tip, X(i), e.clientY - r.top, W);
      };
      const leave = () => { tip.style.display = "none"; xh.setAttribute("visibility", "hidden"); dots.innerHTML = ""; };
      svg.onpointermove = move; svg.onpointerdown = move; svg.onpointerleave = leave;
    };
    const run = observe(fig, draw);
    return { update(next) { o = { ...o, ...next }; run(); } };
  }

  /* Stacked step area for weights set at rebalance dates. opts: dates, keys, values[row][key], colors */
  function stack(fig, o) {
    observe(fig, (svg, tip, W, H) => {
      const m = { t: 8, r: 10, b: 26, l: 44 }, n = o.dates.length;
      const t0 = Date.parse(o.dates[0]), t1 = Date.parse(o.end);
      const X = d => m.l + (Date.parse(d) - t0) / (t1 - t0) * (W - m.l - m.r);
      const Y = v => m.t + (1 - v) * (H - m.t - m.b);
      const parts = [];
      [0, .25, .5, .75, 1].forEach(t => parts.push(`<text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${t * 100}%</text>`));
      const base = new Array(n).fill(0);
      o.keys.forEach((k, j) => {
        const top = base.map((b, i) => b + o.values[i][j]);
        let d = "";
        for (let i = 0; i < n; i++) {
          const xa = X(o.dates[i]), xb = i + 1 < n ? X(o.dates[i + 1]) : X(o.end);
          d += `${i ? "L" : "M"}${xa},${Y(top[i])}L${xb},${Y(top[i])}`;
        }
        for (let i = n - 1; i >= 0; i--) {
          const xa = X(o.dates[i]), xb = i + 1 < n ? X(o.dates[i + 1]) : X(o.end);
          d += `L${xb},${Y(base[i])}L${xa},${Y(base[i])}`;
        }
        parts.push(`<path d="${d}Z" fill="${color(o.colors[j])}" stroke="${color("--bg")}" stroke-width="1"/>`);
        top.forEach((v, i) => base[i] = v);
      });
      for (let y = +o.dates[0].slice(0, 4) + 1; y <= +o.end.slice(0, 4); y++) {
        if (y % (W < 520 ? 4 : 2)) continue;
        parts.push(`<text x="${X(y + "-01-01")}" y="${H - 6}" text-anchor="middle">${y}</text>`);
      }
      parts.push(`<rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent"/>`);
      svg.innerHTML = parts.join("");
      svg.onpointermove = e => {
        const r = svg.getBoundingClientRect(), x = e.clientX - r.left;
        let i = 0;
        while (i + 1 < n && X(o.dates[i + 1]) <= x) i++;
        tip.innerHTML = `<b>Set on ${esc(o.dates[i])}</b>` + o.keys.map((k, j) =>
          `<div class="row"><span><span class="k" style="background:${color(o.colors[j])}"></span>${esc(k)}</span><strong>${pct(o.values[i][j])}</strong></div>`).join("");
        placeTip(tip, x, e.clientY - r.top, W);
      };
      svg.onpointerleave = () => tip.style.display = "none";
    });
  }

  /* Grouped columns with a zero baseline. opts: cats, series[{name,values,color}], fmt, mark (category to outline) */
  function columns(fig, o) {
    observe(fig, (svg, tip, W, H) => {
      const m = { t: 14, r: 8, b: 28, l: 40 };
      const all = o.series.flatMap(s => s.values);
      const ticks = niceTicks(Math.min(0, ...all), Math.max(...all), 4);
      const lo = ticks[0], hi = ticks[ticks.length - 1];
      const Y = v => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
      const band = (W - m.l - m.r) / o.cats.length;
      const bw = Math.min(14, (band - 8) / o.series.length - 2);
      const mi = o.cats.indexOf(o.mark);
      const parts = mi < 0 ? [] : [`<rect x="${m.l + band * mi + 2}" y="${m.t - 10}" width="${band - 4}" height="${H - m.t - m.b + 10}" fill="${color("--bg")}" rx="4"/>`];
      parts.push(...ticks.map(t => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="${color(t === 0 ? "--muted" : "--grid")}"/>
        <text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${o.fmt(t)}</text>`));
      o.cats.forEach((c, i) => {
        const cx = m.l + band * (i + 0.5);
        o.series.forEach((s, j) => {
          const v = s.values[i], x = cx + (j - o.series.length / 2) * (bw + 2) + 1;
          const y0 = Y(0), y1 = Y(v), r = Math.min(4, Math.abs(y1 - y0));
          const top = Math.min(y0, y1), h = Math.abs(y1 - y0);
          const d = v >= 0
            ? `M${x},${y0}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${y0}Z`
            : `M${x},${y0}V${top + h - r}Q${x},${top + h} ${x + r},${top + h}H${x + bw - r}Q${x + bw},${top + h} ${x + bw},${top + h - r}V${y0}Z`;
          parts.push(`<path d="${d}" fill="${color(s.color)}"/>`);
        });
        parts.push(`<text x="${cx}" y="${H - 8}" text-anchor="middle">${esc(c)}</text>
          <rect class="hit" data-i="${i}" x="${cx - band / 2}" y="0" width="${band}" height="${H}" fill="transparent"/>`);
      });
      svg.innerHTML = parts.join("");
      svg.querySelectorAll(".hit").forEach(h => {
        h.onpointerenter = h.onpointerdown = e => {
          const i = +h.dataset.i, r = svg.getBoundingClientRect();
          tip.innerHTML = `<b>${esc(o.label(o.cats[i]))}</b>` + o.series.map(s =>
            `<div class="row"><span><span class="k" style="background:${color(s.color)}"></span>${esc(s.name)}</span><strong>${esc(o.fmt(s.values[i]))}</strong></div>`).join("") +
            (o.extra ? o.extra(i) : "");
          placeTip(tip, m.l + band * (i + 0.5), e.clientY - r.top, W);
        };
      });
      svg.onpointerleave = () => tip.style.display = "none";
    });
  }


  /* Risk-return plane. opts: lines[{name,pts[{vol,ret}],color,width}], points[{name,vol,ret,color,r,side}], view{x:[a,b],y:[a,b]} */
  function xy(fig, opts) {
    let o = opts;
    const run = observe(fig, (svg, tip, W, H) => {
      const narrow = W < 520, m = { t: 14, r: 14, b: 40, l: 48 };
      const [x0, x1] = o.view.x, [y0, y1] = o.view.y;
      const X = v => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r);
      const Y = v => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
      const parts = [`<defs><clipPath id="xyclip"><rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}"/></clipPath></defs>`];
      niceTicks(y0, y1, 5).filter(t => t >= y0 && t <= y1).forEach(t => parts.push(`<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="${color("--grid")}"/>
        <text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${Math.round(t * 100)}%</text>`));
      niceTicks(x0, x1, narrow ? 4 : 6).filter(t => t >= x0 && t <= x1).forEach(t => parts.push(`<text x="${X(t)}" y="${H - m.b + 18}" text-anchor="middle">${Math.round(t * 100)}%</text>`));
      parts.push(`<text x="${(m.l + W - m.r) / 2}" y="${H - 4}" text-anchor="middle">Annual volatility</text>`);
      parts.push(`<g clip-path="url(#xyclip)">`);
      o.lines.forEach(l => parts.push(`<path d="M${l.pts.map(p => X(p.vol).toFixed(1) + "," + Y(p.ret).toFixed(1)).join("L")}" fill="none" stroke="${color(l.color)}" stroke-width="${l.width || 2}" stroke-linejoin="round"/>`));
      parts.push(`</g>`);
      const bg = color("--bg"), ink = color("--ink");
      o.points.forEach((p, i) => {
        if (p.vol < x0 || p.vol > x1 || p.ret < y0 || p.ret > y1) return;
        const cx = X(p.vol), cy = Y(p.ret), side = p.side || "r";
        const tx = side === "l" ? cx - 10 : cx + 10, anchor = side === "l" ? "end" : "start";
        parts.push(`<circle cx="${cx}" cy="${cy}" r="${p.r || 5}" fill="${color(p.color)}" stroke="${bg}" stroke-width="2"/>`);
        if (!narrow || p.major) parts.push(`<text x="${tx}" y="${cy + (p.dy || 4)}" text-anchor="${anchor}" style="fill:${p.major ? ink : ""}">${esc(p.name)}</text>`);
        parts.push(`<circle class="hit" data-i="${i}" cx="${cx}" cy="${cy}" r="14" fill="transparent"/>`);
      });
      svg.innerHTML = parts.join("");
      svg.querySelectorAll(".hit").forEach(h => {
        h.onpointerenter = h.onpointerdown = () => {
          const p = o.points[+h.dataset.i];
          tip.innerHTML = `<b>${esc(p.name)}</b><div class="row"><span>Return</span><strong>${pct(p.ret)}</strong></div>
            <div class="row"><span>Volatility</span><strong>${pct(p.vol)}</strong></div>` +
            (p.weights ? p.weights.map((w, j) => w >= 0.005 ? `<div class="row"><span>${esc(o.assets[j])}</span><strong>${pct(w)}</strong></div>` : "").join("") : "");
          placeTip(tip, X(p.vol), Y(p.ret), W);
        };
        h.onpointerleave = () => tip.style.display = "none";
      });
    });
    return { update(next) { o = { ...o, ...next }; run(); } };
  }

  function spark(el, values, c = "--red") {
    const svg = document.createElementNS(NS, "svg");
    el.appendChild(svg);
    const draw = () => {
      const W = el.clientWidth, H = el.clientHeight, lo = Math.min(...values), hi = Math.max(...values);
      const pts = values.map((v, i) => `${(i / (values.length - 1) * (W - 6) + 3).toFixed(1)},${(3 + (1 - (v - lo) / (hi - lo)) * (H - 6)).toFixed(1)}`);
      const last = pts[pts.length - 1].split(",");
      svg.innerHTML = `<path d="M${pts.join("L")}" fill="none" stroke="${color(c)}" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${color(c)}" stroke="${color("--bg")}" stroke-width="2"/>`;
    };
    const ro = new ResizeObserver(draw);
    ro.observe(el);
  }

  return { line, stack, columns, xy, spark, pct, num, esc, color };
})();
