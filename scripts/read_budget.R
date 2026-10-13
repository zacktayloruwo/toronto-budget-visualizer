# Readers for the City of Toronto approved operating budget files.
# Every reader returns a long table with one row per source line:
#   year, program_src, type ("Expenses"/"Revenues"), category_src,
#   subcategory_src, item_src, amount (dollars; revenues negative, as published)

suppressPackageStartupMessages({
  library(readxl)
  library(dplyr)
  library(purrr)
  library(stringr)
})

raw_budget_dir <- file.path("data-raw", "budget")

empty_lines <- function() {
  tibble(year = integer(), program_src = character(), type = character(),
         category_src = character(), subcategory_src = character(),
         item_src = character(), amount = numeric())
}

# ---- 2011 and 2012: one workbook per program, values in $000s ----------------
# Each workbook has a sheet titled "... Summary By Expenditure/Expense Category"
# with the program name in the first non-empty cell of row 1.

read_program_sheet <- function(path, sheet, year) {
  d <- suppressMessages(read_excel(path, sheet = sheet, col_names = FALSE,
                                   col_types = "text", .name_repair = "minimal"))
  if (nrow(d) < 10) return(NULL)
  head_txt <- unlist(d[1:4, ])
  if (!any(str_detect(head_txt, regex("Summary By Exp", ignore_case = TRUE)), na.rm = TRUE))
    return(NULL)
  title <- na.omit(unlist(d[1, ]))[1]
  if (is.na(title) || str_detect(title, "^(Appendix|Table)")) return(NULL)

  lab_col <- which(map_lgl(d, ~ any(str_detect(.x, "^Salaries"), na.rm = TRUE)))[1]
  first_row <- which(str_detect(d[[lab_col]], "^Salaries"))[1]
  hdr <- map_chr(d[seq_len(first_row - 1), ], ~ paste(na.omit(.x), collapse = " "))
  val_col <- which(str_detect(hdr, as.character(year)) &
                   str_detect(hdr, "Budget|Approved") &
                   !str_detect(hdr, "Change|Actual|Projected|Request|Rec|Outlook"))
  if (length(val_col) == 0) return(NULL)  # e.g. a prior-year sheet in the same workbook
  if (length(val_col) > 1) stop("Ambiguous value column in ", path, " / ", sheet)

  labels <- d[[lab_col]]
  row_txt <- apply(d[, seq_len(lab_col)], 1, function(r) paste(na.omit(r), collapse = " "))
  gross_row <- which(str_detect(row_txt, regex("TOTAL GROSS", ignore_case = TRUE)))[1]
  rev_row <- which(str_detect(row_txt, regex("TOTAL REVENUE", ignore_case = TRUE)))[1]
  if (is.na(gross_row) || is.na(rev_row)) stop("Total rows not found in ", path, " / ", sheet)
  rows <- seq(first_row, rev_row - 1)
  tibble(
    year = as.integer(year),
    program_src = str_squish(title),
    type = if_else(rows < gross_row, "Expenses", "Revenues"),
    category_src = str_squish(labels[rows]),
    subcategory_src = NA_character_,
    item_src = NA_character_,
    amount = suppressWarnings(as.numeric(d[[val_col]][rows])) * 1000
  ) |>
    filter(!is.na(category_src), !str_detect(category_src, regex("^TOTAL", ignore_case = TRUE)),
           !is.na(amount), amount != 0) |>
    # Revenues are published as positive numbers in these years; store them
    # negative to match the 2013+ files.
    mutate(amount = if_else(type == "Revenues", -amount, amount),
           source_file = basename(path))
}

read_zip_year <- function(year) {
  zip <- file.path(raw_budget_dir, sprintf("approved-%d.zip", year))
  exdir <- file.path(raw_budget_dir, sprintf("x%d", year))
  if (!dir.exists(exdir)) unzip(zip, exdir = exdir)
  files <- list.files(exdir, recursive = TRUE, full.names = TRUE, pattern = "\\.xlsx?$")
  out <- map(files, function(f) {
    sheets <- tryCatch(excel_sheets(f), error = function(e) NULL)
    if (is.null(sheets)) {
      # Some ".xls" files are really xlsx; copy with the right extension.
      f2 <- tempfile(fileext = ".xlsx"); file.copy(f, f2); f <- f2
      sheets <- excel_sheets(f)
    }
    map(sheets, ~ read_program_sheet(f, .x, year)) |> compact() |> bind_rows()
  }) |> bind_rows()
  # TTC workbooks each contain both the Conventional and Wheel-Trans sheets.
  out |> distinct(program_src, type, category_src, amount, .keep_all = TRUE) |>
    select(-source_file)
}

# ---- 2013: the 2013 column of the "recommended 2013-2014" workbook -----------
# In that workbook the 2014 column equals the approved 2014 file exactly; the
# 2013 column is the 2013 approved budget used as the comparison base.

read_2013 <- function() {
  d <- suppressMessages(read_excel(file.path(raw_budget_dir, "rec-2013-2014.xls")))
  names(d) <- c("type", "program_src", "category_src", "code", "y2014", "y2013")
  d |>
    transmute(year = 2013L, program_src = str_squish(program_src),
              type = recode(type, Expenditures = "Expenses", Revenue = "Revenues"),
              category_src = str_squish(category_src), subcategory_src = NA_character_,
              item_src = NA_character_, amount = as.numeric(y2013)) |>
    filter(!is.na(program_src), !is.na(amount), amount != 0) |>
    # This workbook publishes revenues as positive numbers; store them negative.
    mutate(amount = if_else(type == "Revenues", -amount, amount))
}

# ---- 2014 to 2026: one long table per year -----------------------------------

modern_sheets <- c(`2014` = "2014", `2015` = "summary", `2016` = "Open Data Summary",
                   `2017` = "2017", `2018` = "Open Data", `2019` = "2019",
                   `2020` = "open data", `2021` = "2021", `2022` = "Open Data",
                   `2023` = "Open Data", `2024` = "Open Data", `2025` = "Open Data",
                   `2026` = "Open Data")

read_modern_year <- function(year) {
  y <- as.character(year)
  path <- file.path(raw_budget_dir, sprintf("approved-%s.xlsx", y))
  sheet <- modern_sheets[[y]]
  if (is.null(sheet)) stop("No sheet name configured for ", y, "; add it to modern_sheets.")
  d <- suppressMessages(read_excel(path, sheet = sheet))
  col_or_na <- function(nm) if (nm %in% names(d)) str_squish(d[[nm]]) else NA_character_
  tibble(
    year = as.integer(year),
    program_src = str_squish(d$Program),
    type = str_squish(d$`Expense/Revenue`),
    category_src = str_squish(d$`Category Name`),
    subcategory_src = col_or_na("Sub-Category Name"),
    item_src = col_or_na("Commitment item"),
    service_src = col_or_na("Service"),
    amount = suppressWarnings(as.numeric(d[[y]]))
  ) |>
    filter(!is.na(program_src), type %in% c("Expenses", "Revenues"), !is.na(amount), amount != 0)
}

read_all_budgets <- function(years = 2011:2026) {
  map(years, function(y) {
    message("Reading ", y)
    if (y %in% 2011:2012) read_zip_year(y)
    else if (y == 2013) read_2013()
    else read_modern_year(y)
  }) |> bind_rows()
}
