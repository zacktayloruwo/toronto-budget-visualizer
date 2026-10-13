---
title: About the data
---

```js
import {CATEGORY_ORDER, CATEGORY_HELP, AREA_HELP, SERVICE_AREAS, colorMap, fmtMoney} from "./components/common.js";
const validation = await FileAttachment("data/validation.csv").csv({typed: true});
const yearsTable = await FileAttachment("data/years.parquet").parquet();
const expMap = colorMap(CATEGORY_ORDER.expense, dark);
const revMap = colorMap(CATEGORY_ORDER.revenue, dark);
const areaMap = colorMap(SERVICE_AREAS, dark);
const repo = "https://github.com/zacktayloruwo/toronto-budget-visualizer";
```

# About the data

<div class="explainer">

This site shows the City of Toronto's **approved operating budgets** for 2011 to 2026. The figures are the amounts City Council approved at the start of each year. They are not what was actually spent. This app was created by Prof. Zack Taylor, University of Western Ontario, as a demonstration for Civic Tech Toronto, October 13, 2026. The site is an independent project and not an official City of Toronto product.

</div>

## Words you'll see

<dl class="glossary">
  <dt>Operating budget</dt>
  <dd>The yearly plan for day-to-day services: staff, supplies, contracted services, grants and debt payments. The separate <b>capital budget</b> (new infrastructure) is not shown here.</dd>
  <dt>Program</dt>
  <dd>A City division or agency with its own budget, such as Toronto Public Library or Toronto Water. Programs are sometimes renamed, merged or split. When only the name changed, this site uses one name for every year.</dd>
  <dt>Service area</dt>
  <dd>A grouping of related programs made for this site so they are easier to browse. Each is described below.</dd>
  <dt>Type of expense (expenditure category)</dt>
  <dd>What the money is spent on, regardless of which program spends it: salaries, supplies, contracted services and so on.</dd>
  <dt>Source of funding (revenue category)</dt>
  <dd>Where the money comes from: property tax, provincial and federal funding, fees, water bills, reserves and so on. Revenues are recorded <b>by program</b>, not against particular expenses. You can see that Children's Services receives provincial funding, but not which expense line that funding pays for.</dd>
  <dt>Gross spending and net cost</dt>
  <dd><b>Gross</b> spending is everything a program spends. <b>Net cost</b> is gross spending minus the revenue the program brings in itself. The net cost is mostly paid for by property tax. Because the operating budget must balance by law, citywide net comes to about zero. Net cost is only meaningful program by program.</dd>
  <dt>Nominal vs. inflation-adjusted (2025) dollars</dt>
  <dd><b>Nominal</b> dollars are the numbers as written in each year's budget. Prices rise over time, so a dollar in 2011 bought more than a dollar in 2025. <b>Inflation-adjusted</b> values convert every year into 2025 dollars using the Consumer Price Index for Toronto, so that growth reflects real changes in what the City spends, not just higher prices.</dd>
  <dt>Per dwelling</dt>
  <dd>Dividing by the number of homes (dwellings) adjusts for the city getting bigger. If spending grows at the same pace as the number of homes, spending per dwelling stays flat.</dd>
  <dt>Inter-divisional charges and recoveries</dt>
  <dd>When one City division provides a service to another (for example, Fleet Services maintaining another division's vehicles), the user books a <b>charge</b> and the provider books a matching <b>recovery</b>. Citywide these cancel out, but they inflate the gross spending of the divisions involved.</dd>
  <dt>Why are revenues negative in the City's files?</dt>
  <dd>In the City's accounting files, spending is recorded as positive and revenue as negative, so a balanced budget adds up to zero. This site flips the sign of revenues so that every amount reads as a positive number of dollars.</dd>
  <dt>Reserves</dt>
  <dd>The City's savings accounts. Putting money in is a <b>contribution to reserves</b> (an expense). Taking money out is a <b>draw from reserves</b> (a source of funding).</dd>
</dl>

## Types of expense

<dl class="glossary">${CATEGORY_ORDER.expense.map((c) => html`<dt><span class="chip" style="background:${expMap.get(c)}">${c}</span></dt><dd>${CATEGORY_HELP[c]}</dd>`)}</dl>

## Sources of funding

<dl class="glossary">${CATEGORY_ORDER.revenue.map((c) => html`<dt><span class="chip" style="background:${revMap.get(c) ?? "#898781"}">${c}</span></dt><dd>${CATEGORY_HELP[c]}${revMap.has(c) ? "" : " Shown in charts as part of “All other”."}</dd>`)}</dl>

## Service areas

<dl class="glossary">${SERVICE_AREAS.map((a) => html`<dt><span class="chip" style="background:${areaMap.get(a)}">${a}</span></dt><dd>${AREA_HELP[a]}</dd>`)}</dl>

## Sources

- **Budgets:** City of Toronto Open Data, [Budget – Operating Budget Program Summary by Expenditure Category](https://open.toronto.ca/dataset/budget-operating-budget-program-summary-by-expenditure-category/). The approved file for each year 2011–2026 is used. There is no approved file for 2013. Its values come from the "2013" column of the *recommended 2013–2014* workbook, which is the 2013 approved base (that workbook's 2014 column matches the approved 2014 file exactly).
- **Inflation:** Statistics Canada, [Table 18-10-0004-01](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401), Consumer Price Index, Toronto, all-items. Each year uses the average of its 12 months, rebased so 2025 = 1. For 2026 only January–August were available, so the 2026 value is the year-to-date average.
- **Dwellings:** total private dwellings in the City of Toronto from the 2011, 2016 and 2021 censuses ([City of Toronto census backgrounders](https://www.toronto.ca/city-government/data-research-maps/toronto-economy-labour-force-demographics/)). 2026 uses an estimate of 1.3 million homes, because 2026 Census counts have not been released yet. Years between are interpolated in a straight line.

```js
display(Inputs.table(yearsTable.toArray().map((d) => ({...d})), {
  columns: ["year", "cpi", "cpi_months", "deflator", "dwellings"],
  header: {year: "Year", cpi: "Toronto CPI (2002=100)", cpi_months: "Months averaged", deflator: "× to get 2025 $", dwellings: "Dwellings"},
  format: {year: (d) => String(d), cpi: (d) => d.toFixed(1), deflator: (d) => d.toFixed(3), dwellings: (d) => Math.round(d).toLocaleString("en-CA")},
  rows: 16, select: false
}));
```

## How the data were cleaned

<div class="explainer">

The City's files change format several times. 2011–2012 are one spreadsheet per program, 2013–2014 list program × category, 2015–2018 add services and activities, and 2019 onward go down to individual line items. Every year is reduced to the two dimensions available in all years: **program** and **category**. Every source line is mapped to one consistent set of categories using a rule table (<a href="https://github.com/zacktayloruwo/toronto-budget-visualizer/blob/main/crosswalk/category_rules.csv">category_rules.csv</a>). The resulting assignment of every distinct source line is published (<a href="https://github.com/zacktayloruwo/toronto-budget-visualizer/blob/main/crosswalk/category_assignments.csv">category_assignments.csv</a>), and program renames are listed in <a href="https://github.com/zacktayloruwo/toronto-budget-visualizer/blob/main/crosswalk/programs.csv">programs.csv</a>. All cleaning is done in R (<a href="https://github.com/zacktayloruwo/toronto-budget-visualizer/tree/main/scripts">scripts/</a>).

</div>

### Known breaks and caveats

<div class="data-note"><b>Property tax, 2011–2012.</b> The 2011 and 2012 files do not include the property tax levy. It is shown as the amount needed to balance the budget: total spending minus all other funding.</div>

<div class="data-note"><b>Property tax, 2013.</b> The 2013 figures combine the property tax levy with other corporate (non-program) revenue, such as the land transfer tax and investment income. All of it is counted as Property tax, which overstates it by roughly $0.8B and understates Other revenue by the same amount.</div>

<div class="data-note"><b>Other taxes, before 2019.</b> The municipal land transfer tax, hotel tax and billboard tax can only be identified from 2019, when the files add line-item detail. Before 2019 they are part of Other revenue. The jump in Other taxes in 2019 is a change in reporting, not new revenue. Payments in lieu of taxes move from Other revenue to Property tax in 2019 for the same reason (about $0.1B).</div>

<div class="data-note"><b>Toronto Water, 2022–2026.</b> From 2022 the published files omit roughly $1B a year of Toronto Water's contribution to its capital reserves. In 2021 that line was $957M; in 2022 it is $12M. Toronto Water's revenue is still fully reported, so total spending appears about $1B lower than total funding in those years. Toronto Water's spending, the citywide total, and the <i>Contributions to capital &amp; reserves</i> category are all understated from 2022.</div>

<div class="data-note"><b>Contributions to capital and to reserves are combined.</b> Toronto Water's large yearly transfer is labelled a contribution to capital in 2011–2012 and a contribution to reserves from 2013. Other programs also move between the two. Combining them keeps the series comparable.</div>

<div class="data-note"><b>Licences &amp; permits are inside User fees.</b> They are a separate category only in 2013–2020, so they are kept within User fees &amp; licences in every year.</div>

<div class="data-note"><b>Salaries &amp; benefits.</b> One category until 2020; "Salaries" and "Benefits" are added together from 2021.</div>

<div class="data-note"><b>Inter-divisional charges, 2020–2021.</b> These are about half their usual size in the 2020 and 2021 files. That is how the City reported them; it has no effect on the citywide totals because charges and recoveries cancel out.</div>

<div class="data-note"><b>Programs that change.</b> Programs that were split or merged (for example the Shelter, Support &amp; Housing Administration division becoming Toronto Shelter and Support Services and the Housing Secretariat) keep their published names, so their individual lines start and stop. Use the service-area totals for an unbroken series. For 2011–2013, Capital &amp; Corporate Financing and the non-program accounts are reported as one combined program.</div>

### Checking the totals

The cleaned totals match the raw files exactly for every year. The table shows both, along with the raw net (spending minus funding). The net is about zero in every year except 2011–2012, when the property tax levy is missing from the files, and 2022–2026, when part of Toronto Water's spending is missing (see above).

```js
display(Inputs.table(validation, {
  columns: ["year", "raw_expenses", "harmonized_expenses", "raw_revenues", "harmonized_revenues", "raw_net", "derived_property_tax"],
  header: {year: "Year", raw_expenses: "Spending (raw file)", harmonized_expenses: "Spending (this site)", raw_revenues: "Funding (raw file)", harmonized_revenues: "Funding (this site, excl. derived)", raw_net: "Raw net", derived_property_tax: "Derived property tax"},
  format: {year: (d) => String(d), raw_expenses: (d) => fmtMoney(d), harmonized_expenses: (d) => fmtMoney(d), raw_revenues: (d) => fmtMoney(d), harmonized_revenues: (d) => fmtMoney(d), raw_net: (d) => Math.abs(d) < 1e6 ? "≈ $0" : fmtMoney(d), derived_property_tax: (d) => d ? fmtMoney(d) : ""},
  rows: 16, select: false
}));
```

## Get the data

```js
const budgetUrl = await FileAttachment("data/budget.parquet").url();
const yearsUrl = await FileAttachment("data/years.parquet").url();
display(html`<p class="explainer">The cleaned data used by this site can be downloaded as Parquet files: <a href=${budgetUrl} download>budget.parquet</a> (year × service area × program × type × category, in nominal dollars) and <a href=${yearsUrl} download>years.parquet</a> (CPI deflator and dwelling counts). The source code and data-preparation scripts are on <a href=${repo}>GitHub</a>.</p>`);
```
