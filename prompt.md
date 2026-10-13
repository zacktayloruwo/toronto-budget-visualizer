# Toronto Budget Visualizer

## ROLE

You are a software developer.

## TASK

Build a web application to visualize City of Toronto approved operating budgets
(expenses and revenues) by program and expenditure category, 2011–2026. The purpose
of the app is to help users identify large-scale trends over time.

The app will be friendly, colourful, and attractive.

The app should contain descriptive text to help users without sophisticated
financial knowledge to understand what they are seeing (e.g., what a "program" and
an "expenditure category" are, what inflation adjustment means, what inter-divisional
charges/recoveries are, and why some revenue values are negative in the source).
Provide a plain-language description of every category and service area.

Users should be able to look at data for individual years or longitudinally.

In longitudinal view, allow the user to select whether to view dollar values in:

-  Nominal values

-  Inflation adjusted values (2025 dollars)

-  Nominal values per dwelling

-  Inflation adjusted values per dwelling

Show expenses and revenues separately, with net (expenses minus revenues) as a
derived view.

Allow the user to view the data at varying degrees of aggregation using the two
dimensions available in every year:

-  Program: City total → service area → individual program. Service areas are a
   grouping created for this app (7 groups, assigned in the program crosswalk):
   Community & Social Services; Transit; Infrastructure & Development; Emergency &
   Protective Services; Corporate Accounts; Corporate & Governance; Agencies, Boards
   & Corporations. Say in the app that these groupings were made for this site.

-  Expenditure category (all categories → individual category)

Include a labour-cost view: salaries and benefits as a share of gross expenses, by
program and citywide, over time. Treat salaries and benefits as one combined amount:
in years where they are separate categories ("Salaries" and "Benefits"), add them
together. Explain that labour inside other categories (e.g., contracted services in
"Service And Rent") is not counted.

Explain that revenues are recorded per program, not tied to specific expense
categories. Explain that the operating budget must balance, so citywide net is about
zero and net is meaningful only at the program level.

Do NOT use the deeper levels (Service, Activity, Sub-Category, Commitment item)
as display dimensions. They may be used only to assign lines to harmonized
categories.

Recommended vs. approved comparison is out of scope: recommended budgets are only
published for a few years. Use approved budgets only.

### Pages

1. **Overview:** hero introduction, headline stat cards (latest-year spending,
   spending per dwelling, real growth per dwelling since 2011, property tax share of
   funding), spending trend in nominal vs. 2025 dollars, latest-year spending by type
   and funding by source, and an explanation of operating vs. capital budgets.
2. **Explore the budget:** controls are grouped into three numbered step cards with
   plain labels, so options are easy to tell apart and never cut off:
   -  **1 What to measure:** view (over time / single year), year (single-year view
      only), measure (spending / funding / net cost, with a one-line explanation),
      and dollar units.
   -  **2 Zoom in:** service area, program and category.
   -  **3 Split the chart:** "colour by" (category / service area / program / total
      only) and chart style. Over time: stacked bars / lines. Single year: bars /
      treemap.

   Short option lists are pill buttons that show every choice and highlight the
   selected one. Long lists are full-width dropdowns. The program dropdown is
   grouped by service area, and its entries show their year range when a program
   does not span all years. Below the controls, show a plain-language trend
   sentence, the chart, context-sensitive data notes, category or service-area
   definitions, a data table, and download links for the parquet files.
3. **Labour costs:** citywide and service-area labour share over time, a
   program × year heatmap (filter by service area and minimum size, sort by share or
   size), and a one-program vs. City comparison. The heatmap uses a reversed viridis
   scale (0–100%), so darker (purple) means more labour-intensive and yellow means
   less.
4. **About the data:** glossary, category and service-area definitions, sources,
   CPI and dwelling factors table, cleaning method with links to the crosswalk files,
   all known breaks and caveats, and a raw-vs-cleaned totals validation table.

### Charts

-  Use a fixed, colour-blind-validated 8-slot categorical palette, with separate
   light and dark steps. Colour follows the entity and never its rank, so filtering
   does not repaint series.
-  Show at most 7 named series plus a grey "All other". Expense categories (7) and
   service areas (7) all get their own colour. For revenue, the 7 named series are
   Property tax, Provincial funding, User fees & licences, Water & wastewater rates,
   Federal funding, Other taxes and Draws from reserves. Other revenue,
   inter-divisional recoveries and transfers from capital fold into "All other" in
   charts but stay separate in tables and filters.
-  In single-year view by program, show the top 20 programs plus an "All other
   programs" row, with bars coloured by service area.
-  Single-year treemap (spending or funding; not net cost, which can be negative):
   a two-level treemap built with d3. Programs are the rectangles, sized by value.
   They are grouped and coloured by category when "colour by" is the category, and
   by service area otherwise. Group headers show name, value and share. Leaves are
   labelled when large enough, with a hover tooltip and a legend.
-  Every chart has hover tooltips. Every chart with 2 or more series has a legend.
-  Longitudinal charts label every year on the x axis. On narrow charts (under
   760px) the labels rotate vertically.

## DATA

### Expenditures

Source: City of Toronto open data,
https://open.toronto.ca/dataset/budget-operating-budget-program-summary-by-expenditure-category/
(CKAN package id `budget-operating-budget-program-summary-by-expenditure-category`).

-  Use the `approved-operating-budget-summary-YYYY` files for 2011–2026, except
   2013, which has no approved file. For 2013, use the "2013" column of
   `recommended-operating-budget-summary-2013-2014`. That column is the 2013 approved
   base; the workbook's 2014 column matches the approved 2014 file exactly. Ignore
   all other `recommended-*` and `preliminary-*` files.
-  The formats vary:
   -  **2011–2012:** ZIPs with one workbook per program. Values are in $000s and
      revenues are positive. Find the sheet titled "... Summary By
      Expenditure/Expense Category", read the approved-budget column for the year,
      and stop at "TOTAL REVENUE". The TTC workbooks each contain both the
      Conventional and Wheel-Trans sheets, so deduplicate them.
   -  **2013:** program × category. Revenues are positive.
   -  **2014:** program × category.
   -  **2015–2018:** add service and activity.
   -  **2019+:** commitment-item level, aggregated up to program × category.
   -  Sheet names differ by year; keep a per-year sheet map.
-  Use the `Expense/Revenue` column to split expenses from revenues. Store revenues
   negative internally, as in the 2013+ source, and present them as positive amounts
   in the app.
-  Program names: keep them as published, except for pure renames and spelling
   variants, which go in `crosswalk/programs.csv` (source name → program, service
   area, note). Programs that were split or merged keep their published names. In
   2011–2013, Capital & Corporate Financing and Non-Program are reported together as
   one combined program.
-  Categories: map every source line to one consistent set using ordered,
   first-match-wins regex rules in `crosswalk/category_rules.csv`. Rules can match on
   type, year range, program, service, category, sub-category and item. The build
   writes `crosswalk/category_assignments.csv`, listing every distinct source line
   and its harmonized category.

   **Expense categories (7):**
   -  Salaries & benefits
   -  Other expenditures
   -  Services & rents
   -  Contributions to capital & reserves: capital and reserve contributions merged,
      because Toronto Water's transfer is labelled capital in 2011–12 and reserves
      from 2013. Includes the Scarborough subway levy reserve contribution.
   -  Materials & supplies
   -  Inter-divisional charges: in 2021 these sit under the Other Expenditures
      sub-category.
   -  Equipment

   **Revenue categories (10):**

   | Harmonized category | Source |
   |---|---|
   | Property tax | 2011–12: derived (see below). 2013: Non-Program sundry, which also contains other corporate revenue (about $0.8B). 2014–15: "Property Tax" category. 2016–17: Non-Program Revenues services Property Tax / Scarborough Subway levy / City Building Fund levy. 2018: Non-Program Taxation Tax Levy program. 2019+: Taxation items Tax Levy and supplementary taxes, plus payments in lieu of tax. The Scarborough subway levy counts as property tax in all years. |
   | Water & wastewater rates | Toronto Water's sale of water / sundry / other revenue. In 2011 this is reported as user fees. |
   | Other taxes (municipal land transfer, hotel & lodging, third-party sign) | Remaining Taxation items. Separable only from 2019; before 2019 they are in Other revenue. |
   | Provincial funding | Provincial Subsidies |
   | Federal funding | Federal Subsidies |
   | User fees & licences | User fees, donations, and licences & permits. Licences & permits are a separate category only in 2013–2020, so merge them every year. |
   | Draws from reserves | Contributions from reserves / reserve funds |
   | Transfers from capital | Includes "xTransfers From Capital" (2025) |
   | Inter-divisional recoveries | In 2021 these sit under an Other Revenue sub-category. |
   | Other revenue | Remaining sundry/other revenue: fines, investment income, other subsidies, miscellaneous. Before 2019 this also includes other taxes and payments in lieu. |

-  **2011–2012 property tax:** the files omit the levy. Add it as a derived
   "Property Tax (derived)" line: total expenses minus all other revenue. Flag it as
   derived.
-  **Known source gap:** from 2022 the published files omit roughly $1B a year of
   Toronto Water's contribution to capital reserves ($957M in 2021, $12M in 2022).
   Expenses therefore fall about $1B short of revenues in 2022–2026. Keep the data as
   published and flag the gap in the app.
-  Show a visible, context-sensitive note in the app for each of the following:
   -  the derived 2011–12 property tax
   -  the combined 2013 property tax
   -  the 2019 break in Other taxes, Other revenue and payments in lieu
   -  the 2022+ Toronto Water gap
   -  the 2021 salaries/benefits split
   -  the CPI and dwelling methods
-  Validate each year's expense and revenue totals against the raw files. The build
   must stop on any mismatch, unmapped program or unmatched line. Write
   `reports/validation.csv` and `src/data/validation.csv`.

### Inflation adjustment

StatCan Table 18-10-0004-01 (CPI, monthly), https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401
(full-table CSV: `https://www150.statcan.gc.ca/n1/tbl/csv/18100004-eng.zip`).

-  Series: Toronto, Ontario, All-items.
-  Annual value = mean of the 12 monthly values. For 2026, use the year-to-date
   average (January–August at build time) and say so in the app.
-  Deflator = CPI(2025) / CPI(year); multiply nominal values by it to get 2025
   dollars.

### Dwellings

Total private dwellings, City of Toronto (`inputs/dwellings.csv`):

| Year | Dwellings | Source |
|---|---|---|
| 2011 | 1,107,851 | 2011 Census |
| 2016 | 1,179,057 | City 2021 Census Backgrounder (1,112,929 occupied + 66,128 not occupied by usual residents) |
| 2021 | 1,253,238 | City 2021 Census Backgrounder (1,160,892 + 92,346) |
| 2026 | 1,300,000 | Estimate (2026 Census counts not yet released) |

Interpolate linearly between these years to create annual values for 2011–2026.

### Outputs

-  `src/data/budget.parquet`: year, service_area, program, type
   (expense/revenue), category, derived, amount (nominal dollars, positive).
-  `src/data/years.parquet`: year, cpi, cpi_months, deflator, dwellings,
   dwellings_is_census.

## TECHNOLOGIES

-  Framework: Observable Framework 1.13.x (static site, Observable Plot for charts,
   custom pill and dropdown controls that work with `Generators.input`).
-  Light/dark mode toggle:
   -  A button at the bottom of the left sidebar switches between the "air" (light) and
      "near-midnight" (dark) themes.
   -  The choice is saved in localStorage. The first visit follows the system
      setting.
   -  The theme is applied by a `data-theme` attribute on `<html>`, set before the
      first paint. Charts re-render in the matching palette through Framework's
      reactive `dark` value.
-  Navigation: no separate "Contents" panel. Each page's section headings are listed
   under that page's link in the left sidebar (the page entry, not the site-title link), which highlights the current section
   while scrolling. Overview is listed as a page in the sidebar.
-  Data: store cleaned data as parquet files and query them in the browser with
   DuckDB-wasm, using Framework's built-in `DuckDBClient`.
-  Pipeline: all local data prep code is written in R:
   -  `scripts/download.R` caches the raw files in git-ignored `data-raw/`.
   -  `scripts/read_budget.R` holds the per-format readers.
   -  `scripts/build_data.R` harmonizes, validates and writes the parquet output.

   The parquet output is committed. The scripts are re-run manually when new data is
   released. Document how to run them, and how to add a new year, in the README.
-  Repo: public GitHub repo `toronto-budget-visualizer` (created with `gh`). Deploy
   to GitHub Pages with a GitHub Actions workflow that builds the Framework site on
   every push to `main`.
-  The app must work at phone widths as well as on desktop.
