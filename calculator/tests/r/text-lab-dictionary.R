# Independent R count of the dictionary used in the text analysis browser test (accents ignored except ñ, globs, phrases).
# Usage: LC_ALL=C.UTF-8 Rscript calculator/tests/r/text-lab-dictionary.R <file.csv|file.xlsx>
a <- commandArgs(trailingOnly = TRUE); f <- a[1]
d <- if (grepl("\\.xlsx$", f)) as.data.frame(readxl::read_excel(f)) else read.csv(f, stringsAsFactors = FALSE, check.names = FALSE, encoding = "UTF-8")
chr <- names(d)[sapply(d, is.character)]
col <- chr[which.max(sapply(chr, function(k) mean(nchar(d[[k]]), na.rm = TRUE)))]
tx <- d[[col]]; tx <- tx[!is.na(tx) & trimws(tx) != ""]
cat(f, "\ntext column:", col, "·", length(tx), "texts\n")
fold <- function(s) { s <- tolower(s); s <- chartr("áàâäãéèêëíìîïóòôöõúùûüçÁÀÂÄÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜ", "aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuu", s); s }
# rules of the calculator (as quanteda): links removed; hyphenated words stay whole; a hashtag counts as its word (#covid19 for covid*)
tok <- function(s) { s <- gsub("https?://\\S+|www\\.\\S+", " ", s, perl = TRUE); w <- unlist(strsplit(fold(s), "[^\\p{L}\\p{N}@#_-]+", perl = TRUE)); w <- gsub("^-+|-+$", "", w); w <- sub("^#", "", w); w[w != ""] }
toks <- lapply(tx, tok)
cats <- list("economía" = c("econom*", "empleo*", "salario*", "inversion*"), salud = c("salud", "covid*", "vacuna*", "hospital*", "medic*"),
             seguridad = c("seguridad", "violen*", "delito*", "homicidio*", "guardia nacional"), "corrupción" = c("corrup*"))
match1 <- function(w, p) if (endsWith(p, "*")) startsWith(w, substr(p, 1, nchar(p) - 1)) else w == p
count_doc <- function(w, pats) {
  hit <- rep(FALSE, length(w)); n <- 0
  for (p in pats[grepl(" ", pats)]) { ps <- strsplit(p, " ")[[1]]; L <- length(ps); if (length(w) >= L) for (i in seq_len(length(w) - L + 1)) if (!any(hit[i:(i + L - 1)]) && all(mapply(match1, w[i:(i + L - 1)], ps))) { hit[i:(i + L - 1)] <- TRUE; n <- n + 1 } }
  single <- pats[!grepl(" ", pats)]; for (i in seq_along(w)) if (!hit[i] && any(vapply(single, function(p) match1(w[i], p), TRUE))) n <- n + 1
  n }
for (k in names(cats)) { cnt <- vapply(toks, count_doc, 1, pats = cats[[k]]); cat(sprintf("%-11s mentions %6d   texts >= 1 %6d\n", k, sum(cnt), sum(cnt > 0))) }
