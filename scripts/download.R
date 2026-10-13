# Download raw source files into data-raw/ (git-ignored cache).
# Run from the repo root: Rscript scripts/download.R
# Pass --force to re-download files that are already cached.

suppressPackageStartupMessages({
  library(httr2)
  library(jsonlite)
})

force <- "--force" %in% commandArgs(trailingOnly = TRUE)
raw_dir <- "data-raw"
dir.create(file.path(raw_dir, "budget"), recursive = TRUE, showWarnings = FALSE)
dir.create(file.path(raw_dir, "cpi"), recursive = TRUE, showWarnings = FALSE)

fetch <- function(url, dest) {
  if (file.exists(dest) && !force) return(invisible(dest))
  message("Downloading ", basename(dest))
  request(url) |>
    req_retry(max_tries = 3) |>
    req_perform(path = dest)
  invisible(dest)
}

# ---- City of Toronto approved operating budgets (CKAN) ----------------------
pkg <- "budget-operating-budget-program-summary-by-expenditure-category"
meta <- request("https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show") |>
  req_url_query(id = pkg) |>
  req_perform() |>
  resp_body_json()

for (r in meta$result$resources) {
  name <- trimws(r$name)
  m <- regmatches(name, regexec("^approved-operating-budget-summary-(\\d{4})$", name))[[1]]
  if (length(m) == 0) next
  ext <- tolower(tools::file_ext(r$url))
  fetch(r$url, file.path(raw_dir, "budget", sprintf("approved-%s.%s", m[2], ext)))
}

# ---- Statistics Canada CPI, table 18-10-0004-01 ------------------------------
fetch("https://www150.statcan.gc.ca/n1/tbl/csv/18100004-eng.zip",
      file.path(raw_dir, "cpi", "18100004-eng.zip"))

message("Done.")
