# Toronto Budget Visualizer

An interactive site for exploring the City of Toronto's approved operating budgets, 2011–2026: spending by program and type of expense, funding by source, trends in nominal dollars, 2025 dollars and per dwelling, and labour costs as a share of each program's spending.

**Live site:** https://zacktayloruwo.github.io/toronto-budget-visualizer/

Built with [Observable Framework](https://observablehq.com/framework/). The data are stored as Parquet files and queried in the browser with DuckDB-wasm. All data preparation is in R.

## Repository layout

| Path | What it is |
|---|---|
| `src/` | Site pages (`index.md`, `explore.md`, `labour.md`, `about.md`), shared JS in `src/components/`, styles |
| `src/data/budget.parquet` | Cleaned fact table: year × service area × program × type (expense/revenue) × category, nominal dollars (revenues positive) |
| `src/data/years.parquet` | Per-year Toronto CPI, deflator to 2025 dollars, and interpolated dwelling counts |
| `src/data/validation.csv` | Raw-file vs. cleaned totals by year |
| `scripts/download.R` | Downloads raw sources into `data-raw/` (git-ignored cache) |
| `scripts/read_budget.R` | Readers for every year's file format |
| `scripts/build_data.R` | Harmonizes, validates and writes the Parquet files |
| `crosswalk/programs.csv` | Program name → consistent program name and service area |
| `crosswalk/category_rules.csv` | Ordered rules mapping source category/sub-category/line item → consistent category |
| `crosswalk/category_assignments.csv` | Generated audit: every distinct source line and the category it was assigned |
| `inputs/dwellings.csv` | Census dwelling counts and the 2026 estimate |
| `reports/validation.csv` | Full validation output |

## Updating the data

Requires R (≥ 4.1) with `httr2`, `jsonlite`, `readxl`, `dplyr`, `tidyr`, `readr`, `stringr`, `purrr` and `arrow`.

```bash
Rscript scripts/download.R          # add --force to re-download cached files
Rscript scripts/build_data.R
```

When a new year is published:

1. Run `scripts/download.R`. It picks up any `approved-operating-budget-summary-YYYY` file.
2. Add the year's sheet name to `modern_sheets` in `scripts/read_budget.R` and extend `years` in `scripts/build_data.R`.
3. Run `scripts/build_data.R`. It stops if a program name is missing from `crosswalk/programs.csv`, if a source line matches no rule in `crosswalk/category_rules.csv`, or if cleaned totals differ from the raw totals. Add the new names or rules and re-run.
4. Commit the updated `src/data/` and `crosswalk/` files. Pushing to `main` redeploys the site.

The CPI base year (2025) and the 2026 dwelling estimate are set in `scripts/build_data.R` and `inputs/dwellings.csv`.

## Running the site locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static site in dist/
```

## Data caveats

These are documented on the site's *About the data* page. In brief:

- 2011–2012 files omit the property tax levy, so it is derived as the balancing amount.
- In 2013, property tax is combined with other non-program revenue.
- Other taxes (land transfer, hotel, billboard) are separable only from 2019.
- From 2022, about $1B a year of Toronto Water's reserve contribution is missing from the published files.
- No approved file exists for 2013; its figures come from the 2013 column of the recommended 2013–2014 workbook.

Data sources: City of Toronto Open Data (Open Government Licence – Toronto), Statistics Canada Table 18-10-0004-01, and Census of Population dwelling counts. This is not an official City of Toronto product.
