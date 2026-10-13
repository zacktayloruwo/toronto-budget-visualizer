---
title: Labour costs
---

```js
import {yearAxis, pills, dropdown, PALETTE, SERVICE_AREAS, colorMap, fmtMoney, fmtPct} from "./components/common.js";
```

```js
const db = DuckDBClient.of({budget: FileAttachment("data/budget.parquet")});
```

```js
const progYear = (await db.query(`
  SELECT year, program, ANY_VALUE(service_area) AS service_area,
         SUM(CASE WHEN category = 'Salaries & benefits' THEN amount ELSE 0 END) AS labour,
         SUM(amount) AS gross
  FROM budget WHERE type = 'expense'
  GROUP BY year, program HAVING SUM(amount) > 0`)).toArray().map((d) => ({...d, share: d.labour / d.gross}));
const years = [...new Set(progYear.map((d) => d.year))].sort();
const lastYear = years.at(-1), firstYear = years[0];
const city = d3.rollups(progYear, (v) => ({labour: d3.sum(v, (d) => d.labour), gross: d3.sum(v, (d) => d.gross)}), (d) => d.year)
  .map(([year, s]) => ({year, series: "Whole City", ...s, share: s.labour / s.gross})).sort((a, b) => a.year - b.year);
const byArea = d3.flatRollup(progYear, (v) => ({labour: d3.sum(v, (d) => d.labour), gross: d3.sum(v, (d) => d.gross)}), (d) => d.year, (d) => d.service_area)
  .map(([year, series, s]) => ({year, series, ...s, share: s.labour / s.gross}));
const areaMap = colorMap(SERVICE_AREAS, dark);
const cityNow = city.at(-1), cityThen = city[0];
```

# How much of the budget pays for staff?

<p class="explainer">The biggest single type of City spending is <b>salaries and benefits</b>: wages, pensions, health benefits and payroll taxes for the people who drive buses, answer 911 calls, run shelters, inspect buildings and clean parks. This page shows that labour cost as a <b>share of each program's spending</b> (its gross expenses). A high share means a program mostly delivers services with its own staff. A low share means its money mostly goes to payments to others (for example social assistance or child-care subsidies), to contractors, or to debt payments.</p>

<div class="grid grid-cols-3">
  <div class="card stat" style="--accent: var(--tb-blue)">
    <h2>Citywide labour share, ${lastYear}</h2>
    <div class="big">${fmtPct(cityNow.share)}</div>
    <div class="sub">${fmtMoney(cityNow.labour)} of ${fmtMoney(cityNow.gross)} in spending</div>
  </div>
  <div class="card stat" style="--accent: var(--tb-orange)">
    <h2>In ${firstYear}</h2>
    <div class="big">${fmtPct(cityThen.share)}</div>
    <div class="sub">${fmtMoney(cityThen.labour)} of ${fmtMoney(cityThen.gross)}</div>
  </div>
  <div class="card stat" style="--accent: var(--tb-aqua)">
    <h2>Change in share</h2>
    <div class="big">${cityNow.share >= cityThen.share ? "+" : "−"}${Math.abs((cityNow.share - cityThen.share) * 100).toFixed(1)} pts</div>
    <div class="sub">Percentage points, ${firstYear}–${lastYear}</div>
  </div>
</div>

<div class="data-note"><b>What is not counted:</b> only staff on the City's own payroll are counted. Many services are delivered by people working for contractors or community agencies, such as shelter operators, snow-clearing contractors and child-care centres. Their wages are paid through <i>Services &amp; rents</i> or <i>Other expenditures</i>, so they are not included here. Programs that contract out more will show a lower labour share even if the service is just as labour-intensive. Salaries and benefits are combined because the City reports them as one category until 2020 and as two from 2021.</div>

## Labour share by service area over time

```js
const areaSeries = [...city, ...byArea];
const pal = dark ? PALETTE.dark : PALETTE.light;
```

<div class="card">

```js
resize((width) => Plot.plot({
  width,
  height: 380,
  marginLeft: 48,
  marginRight: 16,
  marginBottom: yearAxis(width).marginBottom,
  x: yearAxis(width).axis,
  y: {label: "Salaries & benefits as share of spending", grid: true, domain: [0, 1], tickFormat: (d) => `${d * 100}%`},
  color: {domain: ["Whole City", ...SERVICE_AREAS], range: [dark ? "#ffffff" : "#0b0b0b", ...SERVICE_AREAS.map((a) => areaMap.get(a))], legend: true},
  marks: [
    Plot.ruleY([0]),
    Plot.lineY(byArea, {x: "year", y: "share", stroke: "series", strokeWidth: 2}),
    Plot.lineY(city, {x: "year", y: "share", stroke: "series", strokeWidth: 3.5, strokeDasharray: "2,3"}),
    Plot.tip(areaSeries, Plot.pointer({x: "year", y: "share", stroke: "series", title: (d) => `${d.series}, ${d.year}\n${fmtPct(d.share, 1)} labour\n${fmtMoney(d.labour)} of ${fmtMoney(d.gross)}`}))
  ]
}))
```

</div>

<p class="explainer">The dotted black (or white) line is the whole City. Emergency services (police, fire, paramedics) are mostly staff. Community &amp; Social Services and Corporate Accounts have low shares because much of their money is passed on to others: benefit payments, subsidies and debt charges.</p>

## Labour share by program

```js
const areaInput = dropdown(["All", ...SERVICE_AREAS], {label: "Service area", format: (d) => d === "All" ? "All of the City" : d});
const area = Generators.input(areaInput);
const minInput = pills([0, 10e6, 50e6, 100e6], {label: "Hide programs smaller than", value: 10e6, format: (d) => d ? `${fmtMoney(d)} a year` : "Show all"});
const minSize = Generators.input(minInput);
const sortInput = pills(["Labour share", "Size"], {label: "Sort by", value: "Labour share"});
const sortBy = Generators.input(sortInput);
```

<div class="controls">
  <fieldset class="tb-step" style="--accent: var(--tb-blue)"><legend><span class="tb-step-num">1</span> Which programs</legend>${areaInput}${minInput}</fieldset>
  <fieldset class="tb-step" style="--accent: var(--tb-orange)"><legend><span class="tb-step-num">2</span> Order</legend>${sortInput}</fieldset>
</div>

```js
const progStats = d3.rollups(progYear.filter((d) => area === "All" || d.service_area === area), (v) => {
    const last = v.reduce((a, b) => (b.year > a.year ? b : a));
    return {service_area: last.service_area, lastYear: last.year, lastShare: last.share, avgGross: d3.mean(v, (d) => d.gross)};
  }, (d) => d.program)
  .map(([program, s]) => ({program, ...s}))
  .filter((d) => d.avgGross >= minSize)
  .sort((a, b) => sortBy === "Size" ? b.avgGross - a.avgGross : b.lastShare - a.lastShare);
const shown = new Set(progStats.map((d) => d.program));
const cells = progYear.filter((d) => shown.has(d.program));
```

<div class="card">
  <h2>Salaries &amp; benefits as a share of each program's spending</h2>
  <h3>Each square is one program in one year. Darker (purple) means more of the program's money goes to its own staff; yellow means little does. Blank squares mean the program did not exist under that name that year.</h3>
  ${resize((width) => {
    const labelW = Math.min(250, width * 0.4);
    return Plot.plot({
      width,
      height: 22 * progStats.length + 60,
      marginLeft: labelW,
      marginTop: 30,
      padding: 0.08,
      x: {label: null, tickFormat: (d) => width < 640 ? `'${String(d).slice(2)}` : String(d), axis: "top", domain: years},
      y: {label: null, domain: progStats.map((d) => d.program), tickSize: 0, tickFormat: (k) => k.length > labelW / 6.3 ? k.slice(0, Math.floor(labelW / 6.3) - 1) + "…" : k},
      color: {type: "linear", scheme: "viridis", reverse: true, domain: [0, 1], legend: true, label: "Labour share of spending (darker = more labour-intensive)", tickFormat: (d) => `${Math.round(d * 100)}%`, width: Math.min(360, width - 20)},
      marks: [
        Plot.cell(cells, {x: "year", y: "program", fill: (d) => Math.max(0, Math.min(1, d.share)), rx: 3}),
        width >= 900 ? Plot.text(cells, {x: "year", y: "program", text: (d) => Math.round(d.share * 100), fontSize: 9, fill: (d) => (d.share > 0.55) !== dark ? "white" : "black"}) : null,
        Plot.tip(cells, Plot.pointer({x: "year", y: "program", title: (d) => `${d.program} (${d.service_area}), ${d.year}\nLabour share: ${fmtPct(d.share, 1)}\nSalaries & benefits: ${fmtMoney(d.labour)}\nTotal spending: ${fmtMoney(d.gross)}`}))
      ]
    });
  })}
</div>

## Compare one program with the City

```js
const programChoices = [...new Set(progYear.filter((d) => d.gross >= 10e6).map((d) => d.program))].sort();
const pickInput = dropdown(programChoices, {label: "Program", value: "Toronto Police Service"});
const pick = Generators.input(pickInput);
```

<div class="controls"><fieldset class="tb-step" style="--accent: var(--tb-orange)"><legend>Pick a program</legend>${pickInput}</fieldset></div>

```js
const pickRows = progYear.filter((d) => d.program === pick).map((d) => ({...d, series: pick})).sort((a, b) => a.year - b.year);
const compare = [...city, ...pickRows];
```

<div class="card">
  <h2>${pick} vs. the whole City</h2>
  <h3>Salaries &amp; benefits as a share of spending</h3>
  ${resize((width) => Plot.plot({
    width,
    height: 300,
    marginLeft: 48,
    marginBottom: yearAxis(width).marginBottom,
    x: {...yearAxis(width).axis, domain: [firstYear, lastYear]},
    y: {label: null, grid: true, domain: [0, 1], tickFormat: (d) => `${d * 100}%`},
    color: {domain: ["Whole City", pick], range: [dark ? "#c3c2b7" : "#52514e", pal[1]], legend: true},
    marks: [
      Plot.ruleY([0]),
      Plot.lineY(compare, {x: "year", y: "share", stroke: "series", strokeWidth: 2.5}),
      Plot.dot(compare, {x: "year", y: "share", fill: "series", r: 3.5, stroke: "var(--theme-background)", strokeWidth: 1.5}),
      Plot.tip(compare, Plot.pointer({x: "year", y: "share", title: (d) => `${d.series}, ${d.year}\n${fmtPct(d.share, 1)} labour (${fmtMoney(d.labour)} of ${fmtMoney(d.gross)})`}))
    ]
  }))}
</div>

<div class="data-note"><b>Toronto Water from 2022:</b> the published files are missing about $1B a year of Toronto Water's transfer to its capital reserves. Its spending is understated from 2022, so its labour share looks higher than in earlier years.</div>
