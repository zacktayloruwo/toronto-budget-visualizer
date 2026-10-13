# Toronto Budget Visualizer

## ROLE

You are a software developer.

## TASK

Build a web application to visualize City of Toronto approved operating budgets
(expenses and revenues) by program and expenditure category. The purpose of the app
is to help users identify large-scale trends over time.

The app will be friendly, colourful, and attractive.

The app should contain descriptive text to help users without sophisticated
financial knowledge to understand what they are seeing (e.g., what a "program" and
an "expenditure category" are, what inflation adjustment means, what inter-divisional
charges/recoveries are, and why some revenue values are negative in the source).

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

-  Program (City total → individual program/division)

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
that exist only from 2015 onward.

Recommended vs. approved comparison is out of scope: recommended budgets are only
published for a few years. Use approved budgets only.

## DATA

### Expenditures

Source: City of Toronto open data,
https://open.toronto.ca/dataset/budget-operating-budget-program-summary-by-expenditure-category/
(CKAN package id `budget-operating-budget-program-summary-by-expenditure-category`).

-  Use the `approved-operating-budget-summary-YYYY` files for 2011–2026. Ignore the
   `recommended-*` and `preliminary-*` files.
-  The formats vary: 2011–2012 are ZIPs, and the files are XLS/XLSX with different
   sheet names and columns. 2011–2014 are Program × Category only. 2015+ files are
   at commitment-item level and must be aggregated up to Program × Category.
-  Use the `Expense/Revenue` column to split expenses from revenues. Revenues are
   stored as negative values, so present them as positive amounts in the app.
-  Category names differ across years (for example, "Salaries And Benefits" in 2014
   vs. separate "Salaries & Wages" / "Benefits" in later years). Build a documented
   crosswalk (a CSV in the repo) that maps every year's category names to one
   consistent set, so the time series stays comparable. Keep program names as
   published, except for pure renames, which are mapped in the same crosswalk.
-  "Other Revenue" (2015+) hides the City's largest revenue sources. In 2025 it is
   $9.9B, of which Taxation sub-category is $8.9B: property tax levy $6.2B, sale of
   water $1.5B, municipal land transfer tax $1.0B, hotel tax $0.1B. The rest is fines,
   investment income, payments in lieu of taxes and miscellaneous items. Before 2015,
   property tax is its own category ("Property Tax", $3.8B in 2014, under a program
   also named "Property Tax"), and Toronto Water's revenue sits in "Sundry and Other
   Revenues". Do not show "Other Revenue" as a single opaque block. Use the crosswalk
   to map revenue in every year to these consistent categories:

   | Harmonized category | 2015+ source | 2011–2014 source |
   |---|---|---|
   | Property tax | Taxation: tax levy, supplementary taxes; payments in lieu of tax | "Property Tax" category |
   | Water & wastewater rates | Taxation: sale of water | Toronto Water's "Sundry and Other Revenues" |
   | Other taxes (municipal land transfer, hotel & lodging, third-party sign) | Taxation: those line items | Not separable; left in Other revenue |
   | Other revenue | Remaining "Other Revenue" (fines, interest & investment income, miscellaneous, other subsidies) | Remaining "Sundry and Other Revenues" |

   Map the remaining revenue categories (provincial subsidies, federal subsidies,
   user fees & donations, contributions from reserves, transfers from capital,
   inter-divisional recoveries, licences & permits, other subsidies, special levies)
   to consistent names across years. Assign each line item explicitly in the crosswalk.
   In the app, show a visible note on Other taxes (and Other revenue) explaining that
   before 2015 these taxes cannot be separated from Other revenue. The apparent jump
   in Other taxes in 2015 is an accounting artifact, not a real change.
-  Validate each year's expense, revenue and net totals against the raw files.

### Inflation adjustment

StatCan Table 18-10-0004-01 (CPI, monthly), https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401

-  Series: Toronto, All-items.
-  Annual value = mean of the 12 monthly values. For 2026, use the year-to-date
   average and say so in the app.
-  Rebase so that 2025 = 1.0 and express values in 2025 dollars.

### Dwellings

5-year census dwelling counts:
https://www.toronto.ca/city-government/data-research-maps/toronto-economy-labour-force-demographics/

-  Measure: total private dwellings (census 2011, 2016, 2021).
-  2026: use the estimate of 1.3 million.
-  Interpolate linearly between census years to create annual values for 2011–2026.

## TECHNOLOGIES

-  Framework: Observable Framework (static site, Observable Plot for charts).
-  Data: store cleaned data as parquet files and query them in the browser with
   DuckDB-wasm (using Framework's built-in DuckDB support).
-  Pipeline: all local data prep code is written in R. An R script (e.g., `scripts/build_data.R`) downloads the sources,
   cleans and harmonizes them, and writes parquet to the repo. The parquet output is
   committed, and the script is re-run manually when new data is released. Cache raw
   downloads outside the committed data. Document how to run the script in the README.
-  Repo: create a public GitHub repo `toronto-budget-visualizer` with `gh`. Deploy to
   GitHub Pages with a GitHub Actions workflow that builds the Framework site.
-  The app must work at phone widths as well as on desktop.
