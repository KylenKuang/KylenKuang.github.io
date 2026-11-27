# Yuchen Kuang's website

Static site for GitHub Pages: plain HTML, CSS and JavaScript, no build step.

- `index.html`, `rsrs.html`, `risk-parity.html`: the pages
- `js/charts.js`: small SVG chart helpers; `js/story.js`: the step-by-step RSRS chart
- `data/*.json`: chart data, produced by the scripts in the research repository with `--json`

To preview locally: `python -m http.server` in this folder, then open http://localhost:8000.
