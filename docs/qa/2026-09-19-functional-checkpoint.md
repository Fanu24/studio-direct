# PAUSA RICHIESTA DALL'UTENTE — 19 settembre 2026, circa 12:32

L'utente ha chiesto: «Ferma lavoro ho finito l'utilizzo. salva tutto e riprendo in seguito».
NON proseguire sviluppo o test finché non chiede di riprendere. Ultimo obiettivo: completare il sito, senza grafica.

## Stato salvato

Checkout: work/source/studio-direct-main, branch feat/auth-payments-source-discovery, PR https://github.com/Fanu24/studio-direct/pull/2.
Ultimo commit pubblicato prima di questa pausa: 3556a9afe7e0312d07da7860c462db73ffc798e8. Le modifiche di completamento di questa sessione sono salvate in un NUOVO COMMIT LOCALE di checkpoint, NON pubblicato. Nessun deploy o merge. Vedere git log/status al rientro.
Non usare work/publish-studio-direct (vecchia PR1).
Next dev, listener Stripe e test in corso sono stati interrotti. Per riprendere servirà riavviarli. Nessun goal attivo nel tool.
Credenziali in apps/web/.dev.vars ignorato; non stamparle né committarle. Database, CV e log locali ignorati sono conservati. Produzione/dominio/email/Cloudflare ancora rinviati dall'utente.

## Implementato in questa sessione (da completare nel collaudo)

- Migrazioni 0018-0021, già applicate a D1 LOCALE: listing_details, CV/status candidature, notification_outbox, consenso export recruiter, shortlist, periodi fatture, stato rinnovi, moderazione annunci.
- Editor formattato descrizione, skill principale, benefit, link X/Twitter, modifica contenuti e ripubblicazione. Modifica preserva slug/scadenza/placement acquistato. Bozza repost ora separata per annuncio.
- Candidature autenticate con email verificata, PDF privato per candidatura, download solo candidato/datore proprietario, ritiro, filtri/status/note datore, notifiche e retry email.
- Talent directory con filtri, shortlist/note recruiter, CSV paginato con audit e doppio consenso talent pool + export. Configurazione recruiter già esistente e accesso a pagamento.
- Periodi fatture ricorrenti persistenti e riconciliazione: invoice prima/dopo Checkout, rimborsi di periodi vecchi/correnti, scadenza, rinnovo e stato cancellazione. Admin per riconciliare ordini, moderare annunci, riprovare email e recuperare sponsor.
- Adapter AdSense manuale OFF per default, configurazione admin, ads.txt, CMP Google/TCF e controllo GPC/opt-out US. Nessun account publisher o rete ads reale collegato/collaudato.
- Cron notifiche e riconciliazione ogni 5 minuti; crawler originale ogni 6 ore e discovery giornaliera. Non attivi online.
- Careers JSON-LD esteso alle pagine dettaglio dello stesso sito, max25; estrazione incompleta fallisce senza chiudere lavori non raggiunti. QUEST'ULTIMA MODIFICA NON HA ANCORA FINITO I TEST.
- CI validate ora usa cf:build OpenNext invece del solo Next build; NON ANCORA ESEGUITA sul nuovo commit.
- Export account include nuove candidature/notifiche e shortlist. Verificare ancora consistenza privacy/delete/consensi.

## Verifiche ed evidenze

- Typecheck passato prima delle ultime modifiche (log typecheck-final.log). Da ripetere dopo ripresa.
- Suite precedente di questa sessione: 848 Node passati (prima di ads e ultime correzioni).
- Ultimo pnpm test:portable INTERROTTO per richiesta pausa: packages/shared e db completati, web 576 passati +1 test sandbox saltato; crawler era appena iniziato. Log tests-final.log nella radice workspace. Non dichiarare suite completa o CI verde per questo checkpoint.
- TEST STRIPE REALE SANDBOX RICORRENTE PASSATO: apps/web/qa/stripe-recurring.sandbox.test.ts, opt-in STRIPE_SANDBOX_QA=true, database isolato in memoria. Test clock Stripe con cliente fittizio, prima fattura in_1UHLVYV053SIaLCwpIgD2NSi, rinnovo in_1UHLVeV053SIaLCwnJx9L7Tc. Verificati periodi, rinnovo, rimborso vecchio che non revoca nuovo, rimborso corrente, cancellazione a fine periodo e scadenza. Clock/cliente eliminati, prodotto/prezzo disattivati nel finally. Log work/sandbox-recurring.log. Nessun addebito reale.
- Questo test usa vere fatture/subscription API ma una fixture Checkout per collegarle al DB isolato: non confonderlo con nuovo pagamento Checkout browser. Checkout/webhook erano stati collaudati realmente nelle sessioni precedenti.
- Prezzi BUNDLE verificati TUTTI sul browser Web3.career: quantità pari 2..50, 2=20%,4=29%,6=30%, poi +1% ogni 2 fino48=51%,50=55%. Corretto vecchio ladder errato oltre30 (prima arrivava40). Es.:32=$12.677,40=$14.734,50=$15.638 con upsell default695. Formula arrotondamento dollari confermata. Aggiornare test/prezzi/docs.
- Browser edit annuncio vecchio inizialmente404: Next params passava paid%3A...; corretto decodeURIComponent nel page edit. Ora editor si apre e precompila. Trovato anche primarySkill vecchio assente: ownedListing ora fallback primo tag.
- Ultima azione browser: selezionata skill solidity e salvati benefit Learning budget/PTO + https://x.com/example sull'annuncio locale sandbox ricorrente. Al momento pausa UI mostrava invio in corso; salvataggio NON ANCORA VERIFICATO. Server interrotto dopo: controllare DB e pagina al rientro. Nessun lavoro reale modificato.

## Da fare subito alla ripresa

1. Leggere questo checkpoint e git diff/log. Riavviare Next e Stripe listener senza stampare segreti; Typecheck + suite completa (Node/Workers), poi cf:build Linux/CI. Non assumere valide le ultime modifiche non collaudate.
2. Browser QA edit/repost e rich editor, candidature con PDF/autenticazione, dashboard datore/status/ritiro, notifiche, shortlist/export con soli account fittizi. Fix legacy main-skill appena applicato da verificare. Nuovo form candidatura richiede login prima di compilare e email readonly.
3. Verificare admin reconcile con ordine ricorrente locale già esistente e stato rinnovo. Nuova route Checkout aggiorna stato subscription dopo fulfillment per recuperare eventi arrivati prima; aggiungere test mirati. ReconcileOrder non aggiorna ancora renewal_status da subscription (miglioria da valutare).
4. Controllare adapter pubblicitario privacy opt-out dinamico US/GPP, configurazione CMP reale resta esterna. Nessuna promessa ricavi o piena validazione network.
5. Completare aggregazione:53ATS verificati/577annunci esistenti,1192provenienze1175siti;118necessitano adapter, pagine JS/bloccate non vanno dichiarate monitorate. Nuovo crawl dettaglio da verificare e integrare discovery. Non serve CoinMarketCap (utente ha chiesto catalogo generale).
6. Audit search center/SEO e flussi riservati ancora non certificati al100%; aggiornare docs/PARITA.md e docs/AMBIENTE.md (attualmente descrivono il commit pubblicato precedente e sono STALE rispetto al checkpoint).
7. Revisionare diff, aggiornare report QA, pubblicare branch/PR2 e attendere CI solo quando il lavoro riprende. NON dichiarare completo al100%: collaudo UI, audit e servizi produzione sono ancora aperti. No grafica finale.

## Runtime / comandi

Node: C:/Users/Xavier/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe
Python: stesso runtime dependencies/python/python.exe. pnpm wrapper: work/tooling/pnpm.cmd. Aggiungere Node bin e work/tooling al PATH.
Test portabili: pnpm test:portable. Sandbox opt-in: dalla cartella apps/web, STRIPE_SANDBOX_QA=true node node_modules/vitest/vitest.mjs run qa/stripe-recurring.sandbox.test.ts --maxWorkers=1 --minWorkers=1. NON eseguirlo per default in CI (salta senza flag).
Dev: pnpm dev. Migrazioni: pnpm setup:local con Next fermo (non due owner Miniflare contemporanei).
GH: work/tooling/gh/bin/gh.exe, GH_CONFIG_DIR=work/github-auth. Il helper git interattivo si blocca: vedere promemoria storico per push con header temporaneo e senza output token.
D1 locale: .wrangler/state/v3/d1/miniflare-D1DatabaseObject/20cdb5b1cc2a06741d22acdcd2974169c623a1f55c92a3dd6b33b32c838cec17.sqlite
Tab QA locale creata id4; al termine non è stata mantenuta (server spento). Tab riferimento id3 bundle non necessaria per riprendere; verificare inventario, non assumere handle validi.
