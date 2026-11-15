#!/usr/bin/env Rscript
# Builds the public aggregates for dashboards/diputados from the member-level file, which stays on your computer.
#   Rscript build_data.R path/to/mexico_nominate_within_term_WORKING_vXX.dta [tmpdir]
# Writes ../data/diputados-agg.js (summaries only: no names, no member scores) and, in tmpdir (default: a temp
# folder), strips.json for render_strips.cjs, which draws the per-term pictures and deletes that file afterwards.
suppressMessages({ library(haven); library(dplyr); library(jsonlite) })
args <- commandArgs(trailingOnly = TRUE); if (!length(args)) stop("give the path to the .dta")
tmp <- if (length(args) > 1) args[2] else tempdir()
here <- dirname(normalizePath(sub("--file=", "", grep("--file=", commandArgs(), value = TRUE)[1])))
d0 <- read_dta(args[1]) %>% mutate(across(where(is.character), ~ ifelse(is.na(.x), "", .x)))
main <- c("PAN", "PRI", "PRD", "MORENA", "PVEM", "PT", "MC")
years <- c(`58` = "2000–2003", `59` = "2003–2006", `60` = "2006–2009", `61` = "2009–2012", `62` = "2012–2015", `63` = "2015–2018", `64` = "2018–2021", `65` = "2021–2024", `66` = "2024–2027")
roman <- c(`58` = "LVIII", `59` = "LIX", `60` = "LX", `61` = "LXI", `62` = "LXII", `63` = "LXIII", `64` = "LXIV", `65` = "LXV", `66` = "LXVI")
cve <- c(Aguascalientes = "01", `Baja California` = "02", `Baja California Sur` = "03", Campeche = "04", Coahuila = "05", Colima = "06", Chiapas = "07", Chihuahua = "08", `Ciudad de México` = "09", `Distrito Federal` = "09", Durango = "10", Guanajuato = "11", Guerrero = "12", Hidalgo = "13", Jalisco = "14", `México` = "15", `Michoacán` = "16", Morelos = "17", Nayarit = "18", `Nuevo León` = "19", Oaxaca = "20", Puebla = "21", `Querétaro` = "22", `Quintana Roo` = "23", `San Luis Potosí` = "24", Sinaloa = "25", Sonora = "26", Tabasco = "27", Tamaulipas = "28", Tlaxcala = "29", Veracruz = "30", `Yucatán` = "31", Zacatecas = "32")
d0 <- d0 %>% mutate(p = ifelse(party %in% main, party, "Other"), supl = ifelse(is.na(is_suplente), 0, is_suplente), cve = unname(cve[state]), votes = suppressWarnings(as.numeric(binary_choices_source_usable)))
d0 <- d0 %>% mutate(recordedTit = coalesce(is_suplente == 0, FALSE), mapEligible = !is.na(score) & !is.na(cve) & recordedTit)
d <- d0 %>% filter(!is.na(score))
# orientation: the sign of each term's axis is arbitrary, so every term is flipped so that the governing party's caucus
# (the president's party) lies to the right: opposition on the left, government on the right.
gov <- c(`58` = "PAN", `59` = "PAN", `60` = "PAN", `61` = "PAN", `62` = "PRI", `63` = "PRI", `64` = "MORENA", `65` = "MORENA", `66` = "MORENA")
sgn <- d %>% group_by(legislature) %>% summarise(s = ifelse(median(score[p == gov[as.character(legislature[1])]]) > median(score[p != gov[as.character(legislature[1])]]), 1, -1), .groups = "drop")
legs_gov <- tibble(legislature = as.integer(names(gov)), gov = unname(gov))
d <- d %>% left_join(sgn, by = "legislature") %>% mutate(x = score * s)
q <- function(v, f) unname(quantile(v, f))
# per term
legs <- d0 %>% group_by(legislature) %>% summarise(
  n = n(), scored = sum(!is.na(score)), scoredTit = sum(!is.na(score) & supl == 0), scoredSupl = sum(!is.na(score) & supl == 1),
  withSe = sum(!is.na(se_conditional)), oneSided = sum(one_sided == 1, na.rm = TRUE), boundary = sum(point_boundary == 1, na.rm = TRUE),
  partial = max(partial_term), cutoff = max(cutoff_date), medVotes = median(votes[!is.na(score)], na.rm = TRUE), medSe = median(se_conditional, na.rm = TRUE),
  nMR = sum(election_type == "MR"), nRP = sum(election_type == "RP"), hasGeo = any(mapEligible),
  geoMapped = sum(mapEligible), geoScoredTit = sum(!is.na(score) & recordedTit),
  geoMissingState = sum(!is.na(score) & recordedTit & is.na(cve)), geoUnknownRole = sum(!is.na(score) & is.na(is_suplente)),
  geoStates = n_distinct(cve[mapEligible]),
  under20 = sum(score_status_reason == "below_20_binary_choices_during_iterative_screen"), dropped = sum(score_status_reason == "not_retained_after_verified_identity_rebuild"),
  pending = sum(score_status_reason == "not_in_scoring_input_vote_review_pending"), noVotes = sum(score_status_reason == "no_binary_choices_on_source_usable_events"), .groups = "drop") %>%
  left_join(sgn, by = "legislature") %>% left_join(legs_gov, by = "legislature") %>% mutate(roman = roman[as.character(legislature)], years = years[as.character(legislature)], medSe = round(medSe, 3))
# per term x party (titulares, and everyone), oriented
coh1 <- function(dd, who) dd %>% group_by(legislature, p) %>% summarise(n = n(), med = round(median(x), 3), q1 = round(q(x, .25), 3), q3 = round(q(x, .75), 3), iqr = round(q(x, .75) - q(x, .25), 3), sd = round(sd(x), 3), p10 = round(q(x, .1), 3), p90 = round(q(x, .9), 3), medSe = round(median(se_conditional, na.rm = TRUE), 3), .groups = "drop") %>% mutate(who = who)
coh <- bind_rows(coh1(d %>% filter(supl == 0), "tit"), coh1(d, "all"))
# party seats per term (all rows, scored or not) for the composition bar
seats <- d0 %>% filter(supl == 0) %>% count(legislature, p, name = "seats")
# All legislatures, including LVIII. Unknown states and unknown roles are not
# guessed; only explicitly recorded titulares are included in state maps.
st <- d %>% filter(mapEligible) %>% group_by(legislature, cve) %>% summarise(n = n(), mean = ifelse(n() >= 5, round(mean(x), 3), NA), med = ifelse(n() >= 5, round(median(x), 3), NA), parties = list(as.list(table(p))), .groups = "drop")
# member-level rows for the pictures only (no names, no ids, no errors): temp file, deleted by the renderer
strips <- d %>% transmute(legislature, p, supl, x = round(x, 4), one = as.integer(one_sided == 1 | abs(score) >= .999))
write(toJSON(strips, dataframe = "rows", na = "null"), file.path(tmp, "strips.json"))
meta <- list(version = unique(d0$dataset_version)[1], built = format(Sys.Date()), cutoff = max(d0$cutoff_date), parties = c(main, "Other"),
  totals = list(rows = nrow(d0), scored = nrow(d), withSe = sum(!is.na(d0$se_conditional)), medSe = round(median(d0$se_conditional, na.rm = TRUE), 3), legislatures = n_distinct(d0$legislature), suplScored = sum(d$supl == 1),
                under20 = sum(d0$score_status_reason == "below_20_binary_choices_during_iterative_screen"), dropped = sum(d0$score_status_reason == "not_retained_after_verified_identity_rebuild"), pending = sum(d0$score_status_reason == "not_in_scoring_input_vote_review_pending")),
  bootDraws = max(d0$boot_requested, na.rm = TRUE), geographySource = regmatches(basename(args[1]), regexpr("WORKING_v[0-9]+", basename(args[1]))), geographyBuilt = format(Sys.Date()))
out <- list(meta = meta, legs = legs, coh = coh, seats = seats, states = st)
writeLines(paste0("/* Public aggregates for the deputies dashboard: summaries per term, party and state. No member-level values. Built ", meta$built, " by build/build_data.R */\nwindow.DIP = ", toJSON(out, dataframe = "rows", na = "null", auto_unbox = TRUE), ";"), file.path(here, "..", "data", "diputados-agg.js"))
cat("wrote data/diputados-agg.js;", nrow(strips), "picture rows in", file.path(tmp, "strips.json"), "\n")

