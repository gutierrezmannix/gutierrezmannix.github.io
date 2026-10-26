# Reference outputs for the built-in engine: runs the original R engine (src/analysis-methods.R) on every packet
# in a directory and writes <name>.expected.json next to it, using the same JSON settings as the browser did.
# Usage: LC_ALL=C.UTF-8 Rscript tools/engine/ref.R tests/engine-cases
args <- commandArgs(TRUE); dir <- args[1]; only <- if (length(args) > 1) args[-1] else character()
Sys.setlocale('LC_COLLATE', 'C')
src <- readLines(file.path(dirname(sub('--file=', '', grep('--file=', commandArgs(FALSE), value = TRUE))), '..', '..', 'src', 'analysis-methods.R'), warn = FALSE)
eval(parse(text = src))
files <- list.files(dir, pattern = '\\.packet\\.json$', full.names = TRUE)
if (length(only)) files <- files[sub('\\.packet\\.json$', '', basename(files)) %in% only]
for (f in files) {
  out <- sub('\\.packet\\.json$', '.expected.json', f)
  packet <- jsonlite::fromJSON(f, simplifyVector = FALSE); packet[["__compare"]] <- NULL
  res <- tryCatch(gm_run(packet), error = function(e) list(id = packet$id, error = paste('R failure:', conditionMessage(e))))
  res$packages <- NULL; res$runtime <- NULL
  writeLines(jsonlite::toJSON(res, auto_unbox = TRUE, null = 'null', na = 'null', digits = NA, pretty = TRUE), out)
  cat(basename(f), if (is.null(res$error)) 'ok' else paste('ERROR:', res$error), '\n')
}
