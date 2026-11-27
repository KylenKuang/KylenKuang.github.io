/* The RSRS story chart: the same strategy as realism is added, one step at a time.
   Used on the home page and on the RSRS project page. Needs #story-fig, #story-steps, #story-readout. */
{
  const { pct, num, esc } = Charts;
  fetch("data/rsrs.json").then(r => r.json()).then(d => {
    const fig = document.getElementById("story-fig");
    if (!fig) return;
    const rebase = v => { const b = v.find(x => x != null); return v.map(x => x == null ? null : +(x / b).toFixed(4)); };
    const nav = Object.fromEntries(Object.entries(d.nav).map(([k, v]) => [k, rebase(v)]));
    const csi = { name: "CSI 300 buy and hold", values: nav.csi300, color: "--bench" };
    const sw = d.switches_per_year;
    const steps = [
      { label: "Original backtest", key: "original_no_cost", s: d.steps.original_no_cost, turns: sw.original,
        text: `The version I first built: N = 10, switch at the close, no trading costs. It looks great on paper.` },
      { label: "Add trading costs", key: "original_net", s: d.steps.costs_next_open, turns: sw.original,
        text: `It switches ETFs ${Math.round(sw.original)} times a year. At ${pct(d.cost_per_side, 2)} per side, with each trade done at the next open, costs eat the whole edge and it is no better than the index.` },
      { label: "Pick N in-sample", key: "strategy", s: d.compare.strategy.full, turns: sw.best, oos: d.compare.strategy.out_of_sample,
        text: `A longer window, N = ${d.best_n}, chosen using 2014 to 2021 only, cuts turnover to ${Math.round(sw.best)} a year. It held up on 2022 to 2026 data it had never seen.` },
    ];
    const chart = Charts.line(fig, {
      dates: d.dates, log: true, series: [], yFmt: v => v + "x", tipFmt: v => v.toFixed(2) + "x",
    });
    const box = document.getElementById("story-steps"), out = document.getElementById("story-readout");
    box.innerHTML = steps.map((s, i) => `<button type="button" data-i="${i}" aria-pressed="false">${i + 1}. ${esc(s.label)}</button>`).join("");
    const show = i => {
      const st = steps[i];
      box.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
      const series = [];
      if (i > 0) series.push({ name: "Original backtest", values: nav.original_no_cost, color: "--bench", width: 1.5, dim: true });
      series.push(csi, { name: steps[i].label, values: nav[st.key], color: "--s1", width: 2.5 });
      if (i > 0) series[0].color = "--s4";
      chart.update({ series, markers: i === steps.length - 1 ? [{ date: d.split, label: "Out-of-sample from here" }] : [] });
      document.getElementById("story-legend").innerHTML = series.map(s =>
        `<li><i style="background:var(${s.color})"></i>${esc(s.name)}</li>`).join("");
      out.innerHTML = `<div class="muted small">Annual return, ${d.period[0].slice(0, 4)} to ${d.period[1].slice(0, 4)}</div>
        <div class="big">${pct(st.s.ann_return)}</div>
        <dl><dt>Sharpe ratio</dt><dd>${num(st.s.sharpe)}</dd>
        <dt>Max drawdown</dt><dd>${pct(st.s.max_dd)}</dd>
        <dt>Switches a year</dt><dd>${Math.round(st.turns)}</dd>
        ${st.oos ? `<dt>2022 to 2026 return</dt><dd>${pct(st.oos.ann_return)}</dd><dt>2022 to 2026 Sharpe</dt><dd>${num(st.oos.sharpe)}</dd>` : ""}
        <dt>CSI 300 return</dt><dd>${pct(d.steps.csi300.ann_return)}</dd></dl>
        <p>${esc(st.text)}</p>`;
    };
    box.addEventListener("click", e => { const b = e.target.closest("button"); if (b) show(+b.dataset.i); });
    box.addEventListener("keydown", e => {
      const cur = [...box.children].findIndex(b => b.getAttribute("aria-pressed") === "true");
      const nxt = e.key === "ArrowRight" ? Math.min(steps.length - 1, cur + 1) : e.key === "ArrowLeft" ? Math.max(0, cur - 1) : -1;
      if (nxt >= 0) { show(nxt); box.children[nxt].focus(); }
    });
    show(0);
    window.dispatchEvent(new CustomEvent("rsrs-data", { detail: d }));
  });
}
