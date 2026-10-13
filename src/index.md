---
title: Overview
toc: false
---

```js
import {yearAxis, CATEGORY_ORDER, PALETTE, OTHER, colorMap, foldKey, scaleFor, fmtMoney, fmtPct, axisFormat} from "./components/common.js";
```

```js
const db = DuckDBClient.of({
  budget: FileAttachment("data/budget.parquet"),
  years: FileAttachment("data/years.parquet")
});
```

```js
const totals = (await db.query(`
  SELECT b.year, b.type, SUM(b.amount) AS nominal, SUM(b.amount * y.deflator) AS real,
         SUM(b.amount) / ANY_VALUE(y.dwellings) AS per_dw, SUM(b.amount * y.deflator) / ANY_VALUE(y.dwellings) AS real_per_dw
  FROM budget b JOIN years y USING (year)
  GROUP BY b.year, b.type ORDER BY b.year`)).toArray().map((d) => ({...d}));
const latestYear = Math.max(...totals.map((d) => d.year));
const firstYear = Math.min(...totals.map((d) => d.year));
const exp = (yr) => totals.find((d) => d.year === yr && d.type === "expense");
const byCat = (await db.query(`
  SELECT type, category, SUM(amount) AS amount FROM budget WHERE year = ${latestYear}
  GROUP BY type, category`)).toArray().map((d) => ({...d}));
const propTax = byCat.find((d) => d.type === "revenue" && d.category === "Property tax").amount;
const revTotal = totals.find((d) => d.year === latestYear && d.type === "revenue").nominal;
const growth = exp(latestYear).real_per_dw / exp(firstYear).real_per_dw - 1;
```

<div class="hero">
  <svg class="skyline" viewBox="0 0 340 160" aria-hidden="true" fill="#fff">
    <rect x="10" y="90" width="34" height="70"/><rect x="50" y="60" width="28" height="100"/>
    <rect x="84" y="100" width="40" height="60"/><rect x="132" y="76" width="30" height="84"/>
    <rect x="168" y="10" width="6" height="40"/><path d="M160 80 L171 46 L182 80 Z"/><rect x="164" y="80" width="14" height="80"/>
    <circle cx="171" cy="60" r="11"/>
    <rect x="190" y="50" width="32" height="110"/><rect x="228" y="84" width="38" height="76"/>
    <rect x="272" y="40" width="26" height="120"/><rect x="304" y="96" width="30" height="64"/>
  </svg>
  <h1>Where does Toronto's money go?</h1>
  <p>Explore 16 years of the City of Toronto's approved operating budgets, from 2011 to ${latestYear}. See what the City spends on day-to-day services, where the money comes from, and how both have changed after accounting for inflation and a growing city.</p>
  <div class="hero-links">
    <a href="./explore">Explore the budget →</a>
    <a href="./labour">Labour costs →</a>
    <a href="./about">How to read the data →</a>
  </div>
</div>

<div class="grid grid-cols-4">
  <div class="card stat" style="--accent: var(--tb-blue)">
    <h2>${latestYear} operating spending</h2>
    <div class="big">${fmtMoney(exp(latestYear).nominal)}</div>
    <div class="sub">Approved budget for day-to-day services</div>
  </div>
  <div class="card stat" style="--accent: var(--tb-orange)">
    <h2>Per dwelling, ${latestYear}</h2>
    <div class="big">${fmtMoney(exp(latestYear).per_dw, true)}</div>
    <div class="sub">Spending divided by about ${(exp(latestYear).nominal / exp(latestYear).per_dw / 1e6).toFixed(2)} million homes</div>
  </div>
  <div class="card stat" style="--accent: var(--tb-aqua)">
    <h2>Real growth per dwelling since ${firstYear}</h2>
    <div class="big">${growth >= 0 ? "+" : ""}${fmtPct(growth)}</div>
    <div class="sub">After inflation (2025 dollars)</div>
  </div>
  <div class="card stat" style="--accent: var(--tb-magenta)">
    <h2>Paid for by property tax</h2>
    <div class="big">${fmtPct(propTax / revTotal)}</div>
    <div class="sub">Share of ${latestYear} funding</div>
  </div>
</div>

<h2 id="spending-trend" class="section-title" style="--accent: var(--tb-blue)">Spending has grown, but less after inflation</h2>

<p class="explainer">The solid line shows spending in the dollars of each year (<b>nominal</b>). The dashed line converts every year into <b>2025 dollars</b>, so a dollar buys about the same amount in every year. The gap between the lines is inflation.</p>

```js
const trend = totals.filter((d) => d.type === "expense").flatMap((d) => [
  {year: d.year, series: "Nominal dollars", value: d.nominal},
  {year: d.year, series: "2025 dollars", value: d.real}
]);
const pal = dark ? PALETTE.dark : PALETTE.light;
```

<div class="card">

```js
resize((width) => Plot.plot({
  width,
  height: 320,
  marginLeft: 56,
  marginBottom: yearAxis(width).marginBottom,
  x: yearAxis(width).axis,
  y: {label: "Total operating spending", grid: true, tickFormat: axisFormat(false), zero: true},
  color: {domain: ["Nominal dollars", "2025 dollars"], range: [pal[0], pal[1]], legend: true},
  marks: [
    Plot.ruleY([0]),
    Plot.line(trend, {x: "year", y: "value", stroke: "series", strokeWidth: 2.5, strokeDasharray: (d) => d.series === "2025 dollars" ? "6,4" : null}),
    Plot.dot(trend, {x: "year", y: "value", fill: "series", r: 3.5, stroke: "var(--theme-background)", strokeWidth: 1.5}),
    Plot.text(trend.filter((d) => d.year === latestYear), {x: "year", y: "value", text: (d) => fmtMoney(d.value), dx: 8, textAnchor: "start", fill: "currentColor"}),
    Plot.tip(trend, Plot.pointerX({x: "year", y: "value", title: (d) => `${d.year} · ${d.series}\n${fmtMoney(d.value)}`}))
  ],
  marginRight: 60
}))
```

</div>

<h2 id="money-in-out">Where the money goes and comes from</h2>

<div class="grid grid-cols-2">
  <div class="card">
    <h2 class="section-title" style="--accent: var(--tb-blue)">Where the money goes, ${latestYear}</h2>
    <h3>Spending by type of expense</h3>
    ${resize((width) => barList(byCat.filter((d) => d.type === "expense"), "expense", width))}
  </div>
  <div class="card">
    <h2 class="section-title" style="--accent: var(--tb-orange)">Where the money comes from, ${latestYear}</h2>
    <h3>Funding by source</h3>
    ${resize((width) => barList(byCat.filter((d) => d.type === "revenue"), "revenue", width))}
  </div>
</div>

```js
function barList(rows, type, width) {
  const cmap = colorMap(CATEGORY_ORDER[type], dark);
  const folded = d3.rollups(rows, (v) => d3.sum(v, (d) => d.amount), (d) => foldKey(d.category, cmap))
    .map(([key, amount]) => ({key, amount}));
  const total = d3.sum(folded, (d) => d.amount);
  const present = new Set(folded.map((d) => d.key));
  const {domain, range} = scaleFor(cmap, present, dark);
  return Plot.plot({
    width,
    height: 34 * folded.length + 30,
    marginLeft: Math.min(210, width * 0.42),
    marginRight: 70,
    x: {axis: null},
    y: {label: null, domain, tickSize: 0},
    color: {domain, range},
    marks: [
      Plot.barX(folded, {y: "key", x: "amount", fill: "key", rx: 4, insetTop: 3, insetBottom: 3}),
      Plot.text(folded, {y: "key", x: "amount", text: (d) => `${fmtMoney(d.amount)} · ${fmtPct(d.amount / total)}`, dx: 6, textAnchor: "start", fill: "currentColor"}),
      Plot.tip(folded, Plot.pointerY({y: "key", x: "amount", title: (d) => `${d.key}\n${fmtMoney(d.amount)} (${fmtPct(d.amount / total, 1)} of total)`}))
    ]
  });
}
```

<div class="data-note"><b>Why are the two sides almost equal?</b> Ontario law requires the City's operating budget to balance: every dollar of planned spending must have a planned source of funding. Property tax is set last, to cover whatever other sources don't. (From 2022 on, the published files are missing about $1B of Toronto Water's spending, so spending looks a little smaller than funding. See <a href="./about">About the data</a>.)</div>

<h2 id="operating-budget" class="section-title" style="--accent: var(--tb-aqua)">What is the operating budget?</h2>

<div class="explainer">

The City has two budgets. The **operating budget**, shown on this site, pays for day-to-day services: staff salaries, running buses and subways, picking up garbage, keeping libraries and recreation centres open, paying interest on debt, and grants to people and community groups. The **capital budget** pays for long-lived assets like new transit lines, roads and buildings. It is not included here, except where the operating budget sends money to it.

Each year's numbers are the **approved** budget: what City Council voted to spend and collect at the start of the year. They are plans, not final spending.

Spending is organized by **program** (a City division or agency, such as Toronto Public Library) and by **type of expense** (salaries, supplies, contracted services and so on). On the [Explore](./explore) page you can zoom from the whole City down to a single program or type of spending. You can view any single year, or watch trends over time in nominal dollars, inflation-adjusted dollars, or per home.

</div>
