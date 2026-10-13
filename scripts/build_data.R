# Build the app's parquet data from the raw sources.
#
#   Rscript scripts/download.R     # fetch raw files into data-raw/ (cached)
#   Rscript scripts/build_data.R   # clean, harmonize, validate, write src/data/
#
# Outputs
#   src/data/budget.parquet          one row per year x program x type x category
#   src/data/years.parquet           CPI deflator and dwelling counts by year
#   crosswalk/category_assignments.csv  every distinct source line -> harmonized category
#   reports/validation.csv           harmonized totals vs. raw file totals, by year

suppressPackageStartupMessages({
  library(dplyr)
  library(tidyr)
  library(readr)
  library(stringr)
  library(purrr)
  library(arrow)
})

source("scripts/read_budget.R")

years <- 2011:2026
base_year <- 2025
dir.create("src/data", recursive = TRUE, showWarnings = FALSE)
dir.create("reports", showWarnings = FALSE)

# ---- 1. Read every year's source lines ---------------------------------------

lines <- read_all_budgets(years)
if (!"service_src" %in% names(lines)) lines$service_src <- NA_character_

raw_totals <- lines |>
  group_by(year, type) |>
  summarise(raw = sum(amount), .groups = "drop")

# ---- 2. Derived property tax for 2011-2012 -----------------------------------
# The 2011 and 2012 per-program workbooks omit the property tax levy, which is
# the amount that balances the budget. Add it as total expenses minus all other
# revenue so the revenue side is complete.

derived <- lines |>
  filter(year %in% 2011:2012) |>
  group_by(year) |>
  summarise(amount = -sum(amount), .groups = "drop") |>
  mutate(program_src = "Property Tax (derived)", type = "Revenues",
         category_src = "Property Tax (derived)", subcategory_src = NA_character_,
         item_src = NA_character_, service_src = NA_character_, derived = TRUE)

lines <- lines |>
  mutate(derived = FALSE) |>
  bind_rows(derived)

# ---- 3. Programs -------------------------------------------------------------

programs <- read_csv("crosswalk/programs.csv", show_col_types = FALSE)
unmapped <- setdiff(unique(lines$program_src), programs$source_name)
if (length(unmapped)) stop("Programs missing from crosswalk/programs.csv:\n  ",
                           paste(unmapped, collapse = "\n  "))
lines <- lines |>
  left_join(select(programs, source_name, program, service_area),
            by = c("program_src" = "source_name"))

# ---- 4. Categories: first matching rule wins ---------------------------------

rules <- read_csv("crosswalk/category_rules.csv", show_col_types = FALSE,
                  col_types = cols(.default = "c", year_min = "i", year_max = "i"))

matches <- function(x, pattern) {
  if (is.na(pattern) || pattern == "") return(rep(TRUE, length(x)))
  str_detect(coalesce(x, ""), regex(pattern, ignore_case = TRUE))
}

lines$rule <- NA_character_
for (i in seq_len(nrow(rules))) {
  r <- rules[i, ]
  hit <- is.na(lines$rule) &
    lines$type == r$type &
    lines$year >= r$year_min & lines$year <= r$year_max &
    matches(lines$program_src, r$program) &
    matches(lines$service_src, r$service) &
    matches(lines$category_src, r$category) &
    matches(lines$subcategory_src, r$subcategory) &
    matches(lines$item_src, r$item)
  lines$rule[hit] <- r$rule
}

unassigned <- lines |> filter(is.na(rule)) |> count(year, type, category_src, subcategory_src)
if (nrow(unassigned)) {
  print(unassigned, n = Inf)
  stop("Some source lines match no rule in crosswalk/category_rules.csv")
}
lines <- lines |> left_join(select(rules, rule, category = harmonized), by = "rule")

# Audit file: every distinct source line and where it went.
lines |>
  group_by(type, category_src, subcategory_src, item_src, rule, category) |>
  summarise(first_year = min(year), last_year = max(year),
            programs = n_distinct(program_src),
            total_dollars = round(sum(amount)), .groups = "drop") |>
  arrange(type, category, category_src, subcategory_src, item_src) |>
  write_csv("crosswalk/category_assignments.csv", na = "")

# ---- 5. Validate against raw totals ------------------------------------------

validation <- lines |>
  filter(!derived) |>
  group_by(year, type) |>
  summarise(harmonized = sum(amount), .groups = "drop") |>
  full_join(raw_totals, by = c("year", "type")) |>
  mutate(difference = harmonized - raw)
derived_check <- lines |> group_by(year) |> summarise(net_after_derived = sum(amount))
validation <- validation |>
  pivot_wider(names_from = type, values_from = c(raw, harmonized, difference)) |>
  left_join(derived_check, by = "year") |>
  mutate(raw_net = raw_Expenses + raw_Revenues) |>
  arrange(year)
write_csv(validation, "reports/validation.csv")
validation |>
  transmute(year, raw_expenses = raw_Expenses, harmonized_expenses = harmonized_Expenses,
            raw_revenues = -raw_Revenues, harmonized_revenues = -harmonized_Revenues,
            raw_net = raw_net, derived_property_tax = raw_net * (year %in% 2011:2012)) |>
  write_csv("src/data/validation.csv")
if (any(abs(validation$difference_Expenses) > 1 | abs(validation$difference_Revenues) > 1))
  stop("Harmonized totals do not match raw totals; see reports/validation.csv")

# ---- 6. Write the fact table -------------------------------------------------

budget <- lines |>
  group_by(year, service_area, program, type, category, derived) |>
  summarise(amount = sum(amount), .groups = "drop") |>
  mutate(type = recode(type, Expenses = "expense", Revenues = "revenue"),
         # Revenues are negative in the source; store everything as positive dollars.
         amount = if_else(type == "revenue", -amount, amount),
         year = as.integer(year)) |>
  filter(amount != 0) |>
  arrange(year, type, service_area, program, category)

write_parquet(budget, "src/data/budget.parquet")

# ---- 7. Year factors: CPI deflator and dwellings -----------------------------

cpi <- read_csv(unz("data-raw/cpi/18100004-eng.zip", "18100004.csv"),
                show_col_types = FALSE, col_types = cols(.default = "c")) |>
  filter(GEO == "Toronto, Ontario", `Products and product groups` == "All-items") |>
  transmute(year = as.integer(substr(REF_DATE, 1, 4)), month = substr(REF_DATE, 6, 7),
            value = as.numeric(VALUE)) |>
  filter(year %in% years, !is.na(value)) |>
  group_by(year) |>
  summarise(cpi = mean(value), cpi_months = n(), .groups = "drop")
if (!all(years %in% cpi$year)) stop("CPI missing for some years")
base_cpi <- cpi$cpi[cpi$year == base_year]
if (cpi$cpi_months[cpi$year == base_year] != 12) stop("Base-year CPI is incomplete")

census <- read_csv("inputs/dwellings.csv", show_col_types = FALSE)
dwellings <- tibble(year = years,
                    dwellings = approx(census$year, census$total_private_dwellings,
                                       xout = years)$y,
                    dwellings_is_census = years %in% census$year[census$year < 2026])

year_factors <- cpi |>
  mutate(deflator = base_cpi / cpi) |>   # multiply nominal dollars by this
  left_join(dwellings, by = "year") |>
  mutate(year = as.integer(year), cpi_months = as.integer(cpi_months))

write_parquet(year_factors, "src/data/years.parquet")

# ---- Summary -----------------------------------------------------------------

message("\nWrote ", nrow(budget), " rows to src/data/budget.parquet")
print(validation |> transmute(year,
  expenses_M = round(harmonized_Expenses / 1e6), revenues_M = round(-harmonized_Revenues / 1e6),
  raw_net_M = round(raw_net / 1e6)), n = Inf)
print(year_factors, n = Inf)
