# Collaudo funzionale — 21 settembre 2026

Ambiente: Next.js localhost:3000, D1/R2 locali, Stripe sandbox con listener webhook. Google OAuth già collaudato il 17; non ripetuto in questa sessione. Account sintetici `candidate-qa@example.test`, `employer-qa@example.test`, `outsider-qa@example.test`. Nessun CV o dato reale usato nei nuovi test.

## Annunci e candidature

- Modifica del job QA ricorrente: descrizione formattata, skill Solidity, benefit Learning budget/PTO, link X. Slug, periodo e placement pagato conservati.
- Sede New York, United States: annuncio presente nelle pagine città, paese, continente e benefit. Lo stesso resolver geografico è usato dal crawler.
- Modulo repost precompilato verificato; non acquistato un nuovo repost in questa sessione.
- Login richiesto prima del form; email del candidato verificata e non modificabile.
- PDF sintetico inviato, candidatura visibile al datore. Download permesso a candidato e datore proprietario; account estraneo riceve 404. Modifica stato estranea negata, cross-origin negato.
- Datore cambia stato a interview e scrive nota privata. Nota assente dall'export candidato. Notifica presente nella dashboard datore.
- Ritiro elimina PDF e testo, rimuove accesso datore e mantiene lo storico candidato. Export account contiene stato withdrawn e nessun riferimento CV.
- Corretto reinvio della stessa candidatura ritirata: non può mostrare ricevuta positiva; presenta lo stato ritirato e il collegamento alla cronologia.

## Recruiter e Stripe

Nuovo ordine sandbox `438992a4-d893-442b-81c8-04a8baf51722`: $199, accesso recruiter 30 giorni, pagamento con carta di prova e webhook reale.

Verificati export CSV con entrambi i consensi, shortlist e nota privata, audit degli export. Revoca del solo consenso export esclude il candidato. Revoca del talent pool lo esclude anche mantenendo il consenso export. Ripristinati entrambi a off e rimossa la shortlist di test.

Rimborso sandbox `re_1UI8RlV053SIaLCwu5CVG7T6` riuscito: ordine refunded ed export 403. Nessun addebito reale. L'importo recruiter è configurazione locale di prova, non un prezzo verificato sul concorrente.

## Aggregazione e indicizzazione

- Careers JSON-LD: discovery visita dettagli dello stesso sito; crawler importa fino a 25 dettagli. Robots, errori e snapshot incompleti sono gestiti conservando gli annunci preesistenti. CLI di importazione aggiornata per attivare anche fonti JSON-LD riconfermate dalla discovery.
- Contatori dell'ultima scansione massiva restano 1.192 provenienze, 1.175 siti, 53 board verificati, 577 annunci importati. Non sono risultati di una nuova scansione completa del 21 settembre.
- Filtri benefit e località verificati su D1 locale; i vecchi import aggiorneranno i collegamenti geografici al prossimo crawl.
- Smoke: 20 pagine pubbliche, 8 sitemap, robots.txt e sitemap principale. Nessun errore nelle risposte controllate. Escluse le dimensioni company dalla sitemap salari, che altrimenti generavano URL non supportati.

## Automazione e limiti

Suite completa: 858 Node e 12 Workers passati; typecheck passato. CI `35612920901` su `2c29dd7` riuscita, inclusa build OpenNext. Ulteriori test mirati per ritiro/SEO passati; consultare PR per la CI dell'ultimo commit.

Non collaudati qui: nuovo client Google, invio email reale, account publisher/CMP reale, moderazione e riconciliazione dalla UI admin (account QA non amministratore), Cloudflare remoto. Questi limiti non sono nascosti dietro il numero di test. Bozze privacy aggiornate al comportamento di export, candidature e ads; identità dell'operatore e documentazione commerciale finale restano da configurare.

Le prove HTTP riutilizzabili, i log, il database e le credenziali restano nel workspace locale e fuori dal repository. Non pubblicare log di sviluppo: contengono magic link di test.
