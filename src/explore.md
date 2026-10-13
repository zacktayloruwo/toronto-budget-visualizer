---
title: Explore the budget
---

```js
import {
  PALETTE, OTHER, OTHER_COLOR, MAX_SLOTS, SERVICE_AREAS, CATEGORY_ORDER, UNITS, MEASURES,
  CATEGORY_HELP, AREA_HELP, yearAxis, pills, dropdown, colorMap, foldKey, scaleFor, fmtMoney, fmtPct, axisFormat,
  q, unitExpr, whereClause, signedAmount, notesFor
} from "./components/common.js";
```

```js
const db = DuckDBClient.of({
  budget: FileAttachment("data/budget.parquet"),
  years: FileAttachment("data/years.parquet")
});
```

```js
// Programs ranked by total spending over all years (stable colour order).
const programList = (await db.query(`
  SELECT program, ANY_VALUE(service_area) AS service_area,
         SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS spend,
         MIN(year) AS first_year, MAX(year) AS last_year
  FROM budget GROUP BY program ORDER BY spend DESC`)).toArray().map((d) => ({...d}));
const yearsList = (await db.query(`SELECT year FROM years ORDER BY year`)).toArray().map((d) => d.year);
const firstYear = yearsList[0], lastYear = yearsList.at(-1);
```

# Explore the budget

<p class="explainer">Work through the three steps below. <b>1</b> picks what to measure and how to count the dollars. <b>2</b> zooms from the whole City to a service area, a single program or one type of spending. <b>3</b> picks how to split the chart into coloured parts. Hover over the chart for exact values. A table of the numbers is at the bottom.</p>

## Choose what to see

```js
const viewInput = pills(["Over time", "Single year"], {label: "View", value: "Over time"});
const view_ = Generators.input(viewInput);
const measureInput = pills(MEASURES, {label: "Measure", format: (d) => d.pill, value: MEASURES[0],
  help: "Spending = what the City pays out. Funding = where the money comes from. Net cost = a program's spending minus its own revenue."});
const measureObj = Generators.input(measureInput);
const unitInput = pills(UNITS, {label: "Count dollars as", format: (d) => d.pill, value: UNITS[1]});
const unit = Generators.input(unitInput);
const areaInput = dropdown(["All", ...SERVICE_AREAS], {label: "Service area", format: (d) => d === "All" ? "All of the City" : d});
const area = Generators.input(areaInput);
const yearInput = dropdown(yearsList.slice().reverse(), {label: "Year", value: lastYear});
const year = Generators.input(yearInput);
```

```js
const measure = measureObj.key;
const programOptions = ["All", ...programList
  .filter((d) => area === "All" || d.service_area === area)
  .sort((a, b) => SERVICE_AREAS.indexOf(a.service_area) - SERVICE_AREAS.indexOf(b.service_area) || b.spend - a.spend)
  .map((d) => d.program)];
const programArea0 = new Map(programList.map((d) => [d.program, d.service_area]));
const programInput = dropdown(programOptions, {
  label: "Program",
  group: (d) => d === "All" ? "Everything" : programArea0.get(d),
  format: (d) => {
    if (d === "All") return area === "All" ? "All programs" : "All programs in this area";
    const p = programList.find((x) => x.program === d);
    return p.first_year > firstYear || p.last_year < lastYear ? `${d} (${p.first_year}–${p.last_year})` : d;
  }
});
const program = Generators.input(programInput);
```

```js
const categoryNoun = measure === "revenue" ? "Source of funding" : "Type of expense";
const categoryInput = dropdown(["All", ...(CATEGORY_ORDER[measure] ?? [])], {
  label: measure === "net" ? "Type of expense / source" : categoryNoun,
  format: (d) => d === "All" ? (measure === "net" ? "Not available for net cost" : measure === "revenue" ? "All sources" : "All types") : d,
  disabled: measure === "net"
});
const category = Generators.input(categoryInput);
```

```js
const breakdownOptions = [
  ...(measure === "net" ? [] : [{key: "category", label: measure === "revenue" ? "Source of funding" : "Type of expense"}]),
  {key: "service_area", label: "Service area"},
  {key: "program", label: "Program"},
  {key: "none", label: "Total only"}
];
const breakdownInput = pills(breakdownOptions, {
  label: "Colour by",
  format: (d) => d.label,
  value: breakdownOptions.find((d) => d.key === (measure === "net" ? "service_area" : "category"))
});
const breakdownObj = Generators.input(breakdownInput);
const styleInput = pills(["Stacked bars", "Lines"], {label: "Chart style", value: measure === "net" ? "Lines" : "Stacked bars"});
const chartStyle = Generators.input(styleInput);
```

<div class="controls">
  <fieldset class="tb-step" style="--accent: var(--tb-blue)">
    <legend><span class="tb-step-num">1</span> What to measure</legend>
    ${viewInput}
    ${view_ === "Single year" ? yearInput : ""}
    ${measureInput}
    ${unitInput}
  </fieldset>
  <fieldset class="tb-step" style="--accent: var(--tb-orange)">
    <legend><span class="tb-step-num">2</span> Zoom in</legend>
    ${areaInput}
    ${programInput}
    ${categoryInput}
  </fieldset>
  <fieldset class="tb-step" style="--accent: var(--tb-aqua)">
    <legend><span class="tb-step-num">3</span> Split the chart</legend>
    ${breakdownInput}
    ${view_ === "Over time" ? styleInput : ""}
  </fieldset>
</div>

```js
const breakdown = breakdownObj.key;
const state = {view: view_, measure, unit, area, program, category: measure === "net" ? "All" : category, breakdown};

// Colour maps keyed to entities, independent of the other filters.
const keyRanking =
  breakdown === "category" ? CATEGORY_ORDER[measure]
  : breakdown === "service_area" ? SERVICE_AREAS
  : breakdown === "program" ? programList.filter((d) => area === "All" || d.service_area === area).map((d) => d.program)
  : ["Total"];
const cmap = colorMap(keyRanking, dark);

const keyExpr = {category: "b.category", service_area: "b.service_area", program: "b.program", none: "'Total'"}[breakdown];
const where = whereClause(state);
const valueExpr = unitExpr(unit, signedAmount(measure));
```

```js
const rows = (await db.query(`
  SELECT b.year, ${keyExpr} AS key, SUM(${valueExpr}) AS value
  FROM budget b JOIN years y USING (year)
  ${where}
  GROUP BY 1, 2 ORDER BY 1, 2`)).toArray().map((d) => ({...d}));
const totalsByYear = d3.rollups(rows, (v) => d3.sum(v, (d) => d.value), (d) => d.year)
  .map(([year, value]) => ({year, value})).sort((a, b) => a.year - b.year);
```

```js
// Fold minor series into "All other" for the over-time chart.
const folded = d3.flatRollup(rows, (v) => d3.sum(v, (d) => d.value), (d) => d.year, (d) => foldKey(d.key, cmap))
  .map(([year, key, value]) => ({year, key, value}));
const present = new Set(folded.map((d) => d.key));
const colorScale = scaleFor(cmap, present, dark);
const order = colorScale.domain;
const perDw = unit.perDwelling;
const subjectLabel = [
  program !== "All" ? program : area !== "All" ? area : "City of Toronto",
  measure !== "net" && category !== "All" ? category.toLowerCase() : null
].filter(Boolean).join(": ");
const measureWord = {expense: "spending", revenue: "funding", net: "net cost"}[measure];
```

```js
function describeTrend() {
  if (!totalsByYear.length) return html`<p>No data for this selection.</p>`;
  const a = totalsByYear[0], b = totalsByYear.at(-1);
  const change = measure !== "net" && a.value > 0 && b.value > 0 ? b.value / a.value - 1 : NaN;
  const dir = !isFinite(change) ? "" : change >= 0 ? `up ${fmtPct(change)}` : `down ${fmtPct(-change)}`;
  return html`<p class="explainer"><b>${subjectLabel}</b>, ${measureWord} in ${unit.label.toLowerCase()}:
    ${fmtMoney(a.value, perDw)} in ${a.year} and ${fmtMoney(b.value, perDw)} in ${b.year}${dir ? html` (<b>${dir}</b>)` : ""}.
    ${b.year - a.year < lastYear - firstYear ? html`This program only appears in the budget from ${a.year} to ${b.year}.` : ""}</p>`;
}
```

```js
function timeChart(width) {
  const stacked = chartStyle === "Stacked bars";
  const tipFmt = (d) => `${d.year} · ${d.key}\n${fmtMoney(d.value, perDw)}`;
  const marks = stacked
    ? [
        Plot.barY(folded, Plot.stackY({order}, {x: "year", y: "value", fill: "key", inset: 0.5, tip: false})),
        Plot.tip(folded, Plot.pointer(Plot.stackY({order}, {x: "year", y: "value", fill: "key", title: tipFmt}))),
        breakdown !== "none" && measure !== "net"
          ? Plot.text(totalsByYear, {x: "year", y: "value", text: (d) => (d.year === firstYear || d.year === lastYear) ? fmtMoney(d.value, perDw) : "", dy: -8, fill: "currentColor", fontWeight: 600})
          : null
      ]
    : [
        Plot.lineY(folded, {x: "year", y: "value", stroke: "key", strokeWidth: 2.5, z: "key"}),
        Plot.dot(folded, {x: "year", y: "value", fill: "key", r: 3.5, stroke: "var(--theme-background)", strokeWidth: 1.5}),
        Plot.tip(folded, Plot.pointer({x: "year", y: "value", title: tipFmt}))
      ];
  const ya = yearAxis(width, firstYear, lastYear);
  return Plot.plot({
    width,
    height: Math.max(340, Math.min(520, width * 0.55)),
    marginLeft: 64,
    marginTop: 24,
    marginBottom: ya.marginBottom,
    x: stacked ? {...ya.axis, type: "band", padding: 0.12} : {...ya.axis, domain: [firstYear, lastYear]},
    y: {label: `${measureWord[0].toUpperCase() + measureWord.slice(1)} (${unit.short})`, grid: true, tickFormat: axisFormat(perDw), nice: true},
    color: {...colorScale, legend: breakdown !== "none"},
    marks: [Plot.ruleY([0]), ...marks.filter(Boolean)]
  });
}
```

```js
// Single-year view: ranked bars. Programs are coloured by service area.
const yearRows = rows.filter((d) => d.year === year);
const showProgramBars = breakdown === "program";
const areaMap = colorMap(SERVICE_AREAS, dark);
const programArea = new Map(programList.map((d) => [d.program, d.service_area]));
let barRows = yearRows.map((d) => ({...d}));
const TOP_BARS = 20;
if (showProgramBars && barRows.length > TOP_BARS + 1) {
  barRows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const rest = barRows.slice(TOP_BARS);
  barRows = [...barRows.slice(0, TOP_BARS), {year, key: `All other programs (${rest.length})`, value: d3.sum(rest, (d) => d.value), other: true}];
} else if (!showProgramBars) {
  barRows = d3.rollups(barRows, (v) => d3.sum(v, (d) => d.value), (d) => foldKey(d.key, cmap)).map(([key, value]) => ({year, key, value}));
}
barRows.sort((a, b) => (a.other || a.key === OTHER) - (b.other || b.key === OTHER) || b.value - a.value);
const yearTotal = d3.sum(yearRows, (d) => d.value);
```

```js
function yearChart(width) {
  const fillOf = (d) => showProgramBars ? (d.other ? OTHER : programArea.get(d.key)) : d.key;
  const colorDomain = showProgramBars ? [...SERVICE_AREAS, OTHER] : colorScale.domain;
  const colorRange = showProgramBars
    ? [...SERVICE_AREAS.map((a) => areaMap.get(a)), dark ? OTHER_COLOR.dark : OTHER_COLOR.light]
    : colorScale.range;
  const labelWidth = Math.min(260, width * 0.42);
  const share = measure !== "net" && yearTotal > 0;
  return Plot.plot({
    width,
    height: 30 * barRows.length + 50,
    marginLeft: labelWidth,
    marginRight: width < 500 ? 70 : 110,
    x: {label: `${measureWord} (${unit.short})`, grid: true, tickFormat: axisFormat(perDw), ticks: width < 600 ? 3 : 6, axis: "top"},
    y: {label: null, domain: barRows.map((d) => d.key), tickSize: 0, tickFormat: (k) => k.length > labelWidth / 6.5 ? k.slice(0, Math.floor(labelWidth / 6.5) - 1) + "…" : k},
    color: {domain: colorDomain, range: colorRange, legend: showProgramBars},
    marks: [
      Plot.barX(barRows, {y: "key", x: "value", fill: fillOf, rx: 4, insetTop: 3, insetBottom: 3}),
      Plot.ruleX([0]),
      Plot.text(barRows, {y: "key", x: "value", text: (d) => fmtMoney(d.value, perDw) + (share && width >= 500 ? ` · ${fmtPct(d.value / yearTotal)}` : ""),
        dx: 6, textAnchor: "start", fill: "currentColor", filter: (d) => d.value >= 0}),
      Plot.text(barRows, {y: "key", x: "value", text: (d) => fmtMoney(d.value, perDw), dx: -6, textAnchor: "end", fill: "currentColor", filter: (d) => d.value < 0}),
      Plot.tip(barRows, Plot.pointerY({y: "key", x: "value", title: (d) =>
        `${d.key}${showProgramBars && !d.other ? `\n${programArea.get(d.key)}` : ""}\n${fmtMoney(d.value, perDw)}${share ? ` (${fmtPct(d.value / yearTotal, 1)} of total)` : ""}`}))
    ]
  });
}
```

## The chart

<div class="card">
  <h2>${subjectLabel} · ${measureWord}${view_ === "Single year" ? `, ${year}` : `, ${firstYear}–${lastYear}`}</h2>
  <h3>${unit.label}${measure === "net" ? " · net cost = spending minus the program's own revenue" : ""}</h3>
  ${view_ === "Over time" ? describeTrend() : html`<p class="explainer">Total: <b>${fmtMoney(yearTotal, perDw)}</b>${showProgramBars ? html`. Bars are coloured by service area.` : ""}</p>`}
  ${rows.length ? resize((width) => view_ === "Over time" ? timeChart(width) : yearChart(width)) : html`<p>No data for this selection.</p>`}
</div>

```js
const notes = notesFor(state);
```

${notes.map((n) => html`<div class="data-note"><b>Note:</b> ${n.text}</div>`)}

${measure === "net" ? html`<div class="data-note"><b>Reading net cost:</b> net cost is a program's spending minus the revenue it brings in itself (fees, grants, recoveries). What is left is mostly paid for by property tax, which appears as a large negative number under the <i>Property Tax Levy</i> program in Corporate Accounts. Citywide, net cost adds up to about zero because the budget must balance.</div>` : ""}

## What the colours mean

<details open>
<summary><b>What do these ${breakdown === "service_area" ? "service areas" : breakdown === "program" ? "programs" : measure === "revenue" ? "sources of funding" : "types of expense"} mean?</b></summary>

```js
display(breakdown === "category"
  ? html`<dl class="glossary">${CATEGORY_ORDER[measure].map((c) => html`<dt><span class="chip" style="background:${cmap.get(c) ?? (dark ? OTHER_COLOR.dark : OTHER_COLOR.light)}">${cmap.has(c) ? c : `${c} (in “${OTHER}”)`}</span></dt><dd>${CATEGORY_HELP[c]}</dd>`)}</dl>`
  : breakdown === "service_area" || breakdown === "program"
  ? html`<dl class="glossary">${SERVICE_AREAS.map((a) => html`<dt><span class="chip" style="background:${areaMap.get(a)}">${a}</span></dt><dd>${AREA_HELP[a]}</dd>`)}</dl>
    <p class="explainer">Service areas are groupings made for this site to make the 60-odd City programs easier to browse. They roughly follow the City's own organization.</p>`
  : html`<p class="explainer">Choose “Colour by” to split the total into parts.</p>`);
```

</details>

## The numbers

```js
const tableRows = view_ === "Over time"
  ? (() => {
      const keys = [...new Set(rows.map((d) => d.key))].sort((a, b) => keyRanking.indexOf(a) - keyRanking.indexOf(b));
      return {
        data: d3.groups(rows, (d) => d.year).map(([y, v]) => Object.fromEntries([["Year", String(y)], ...keys.map((k) => [k, v.find((d) => d.key === k)?.value ?? null]), ["Total", d3.sum(v, (d) => d.value)]])),
        columns: ["Year", ...keys, ...(keys.length > 1 ? ["Total"] : [])]
      };
    })()
  : {
      data: yearRows.slice().sort((a, b) => b.value - a.value).map((d) => ({Name: d.key, Value: d.value, Share: measure !== "net" && yearTotal ? d.value / yearTotal : null})),
      columns: ["Name", "Value", ...(measure !== "net" ? ["Share"] : [])]
    };
const money = (v) => v == null ? "" : fmtMoney(v, perDw);
```

```js
display(Inputs.table(tableRows.data, {
  columns: tableRows.columns,
  format: Object.fromEntries(tableRows.columns.filter((c) => !["Year", "Name"].includes(c)).map((c) => [c, c === "Share" ? (v) => fmtPct(v, 1) : money])),
  rows: 18,
  select: false,
  layout: "auto"
}));
```

```js
const budgetUrl = await FileAttachment("data/budget.parquet").url();
const yearsUrl = await FileAttachment("data/years.parquet").url();
display(html`<p class="explainer" style="font-size:0.85rem">Values are in ${unit.label.toLowerCase()}. Download the full cleaned dataset: <a href=${budgetUrl} download>budget.parquet</a> · <a href=${yearsUrl} download>years.parquet</a> (inflation and dwelling factors).</p>`);
```
