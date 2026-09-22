# Cloudflare: ambiente di prova, 22 settembre 2026

Il proprietario ha autorizzato la pubblicazione su workers.dev, con Stripe sandbox, e ha chiarito che design e modifiche al prodotto sono ancora da definire. Questo deployment serve a verificare i collegamenti tecnici; non costituisce il lancio commerciale né il collaudo finale del prodotto.

## Indirizzi e configurazione

- Sito: https://nodework-web.xavier-ff2.workers.dev
- Stato crawler: https://nodework-crawler.xavier-ff2.workers.dev/health
- Amministrazione: `/admin`, disponibile all'email amministratore scelta dal proprietario.
- Mittente e amministratore: `xavier@lcplocalizations.com`.
- Configurazioni riproducibili: `apps/web/wrangler.preview.jsonc` e `apps/crawler/wrangler.preview.jsonc`. Non contengono credenziali. I normali `wrangler.jsonc` conservano la configurazione precedente per non spostare il database di sviluppo locale.
- D1 `nodework-jobs`, migrazioni 0001–0023; R2 `nodework-files` privato; KV `nodework-locks`; code `nodework-crawl-career`, `nodework-crawl-linkedin`, `nodework-crawl-indeed`, più `nodework-crawl-career-failed`.
- Importato soltanto il catalogo pubblico: 1.192 provenienze, 70 aziende collegate e 61 pagine Careers attive. Nessun account, CV, ordine o annuncio fittizio locale è stato trasferito.
- Il crawler esegue le operazioni periodiche ogni 5 minuti e la raccolta ogni 6 ore; la discovery applica il proprio intervallo minimo di 24 ore. La prima raccolta remota è stata avviata e ha già importato annunci reali. Il numero di fonti nel catalogo non equivale al numero di pagine effettivamente monitorate.
- `SITE_INDEXING_ENABLED=true`, abilitato su successiva richiesta esplicita del proprietario. Il proprietario ha poi precisato di rimuovere anche tutte le esclusioni delle API e delle pagine account: `robots.txt` contiene soltanto `User-Agent: *`, `Allow: /` e la sitemap, senza alcuna regola `Disallow`. Rimosso anche il precedente header globale `X-Robots-Tag: noindex, nofollow`. I controlli di autenticazione e i metadati `noindex` delle pagine personali restano attivi: il permesso di scansione non concede accesso ai dati riservati.
- Turnstile è in modalità **invisible**, come richiesto dal proprietario: nessuna casella da spuntare, verifica server mantenuta.

Il dominio email è stato attivato con Cloudflare Email Sending. La posta in ingresso resta su Google e il DMARC esistente `p=none` è stato conservato. Il client Google esistente include origine workers.dev e callback `/api/auth/callback/google`, oltre a localhost; resta un client di test.

## Verifiche essenziali concluse

- CI sul codice applicativo `d00a0dd`: typecheck, 873 test Node e 12 test Workers, build OpenNext, bundling Linux e migrazioni da ambiente locale vuoto. Il test Stripe opzionale non viene eseguito dalla suite ordinaria; è distinto dalle prove sandbox sotto.
- Nove pagine principali rispondono HTTP 200 con contenuto: home, lavori, pubblicazione, bundle, pubblicità, recruiter, salari, aziende e login.
- Google login: ritorno riuscito alla creazione dell'account datore; accesso alla pagina amministrazione verificato con l'email autorizzata.
- Magic link: email consegnata, link verificato e arrivo alla dashboard candidato. Ripetuto l'invio con Turnstile invisibile, senza intervento manuale.
- Aree riservate protette: account, datore, recruiter e amministrazione non accessibili anonimamente; API CV, esportazione dati e chiavi API richiedono una sessione. L'amministrazione restituisce intenzionalmente 404 agli anonimi.
- R2: caricamento e lettura di un oggetto sintetico con hash identico; la rotta pubblica rifiuta il percorso privato CV; oggetto di prova rimosso. Nessun CV personale è stato usato.
- Stripe: endpoint pubblico abilitato in modalità test, chiave `sk_test_`, nuova firma webhook dedicata al deployment. Evento reale sandbox `checkout.session.completed`, pagamento di prova `paid`, nessuna consegna webhook pendente. Richieste non firmate al webhook respinte con HTTP 400. Nessun addebito reale.
- Crawler: risposte health, messaggi della coda elaborati, annunci presenti in D1; esecuzione reale del cron da 5 minuti osservata con esito `ok`.
- Dopo l'apertura ai crawler: richieste pubbliche con User-Agent browser, GPTBot, ClaudeBot e Googlebot ricevono HTTP 200 su home e `robots.txt`, regola `User-Agent: *` con `Allow: /`, sitemap corretta, nessun header globale `noindex`; la home dichiara `index, follow`. Anche `/sitemap.xml` risponde HTTP 200. Sono verifiche delle risposte del sito, non prove di visite effettive da parte dei crawler.

L'evento Stripe di collegamento usa le fixture della CLI: verifica il collegamento pubblico, non sostituisce il percorso completo acquisto→annuncio→dashboard. La prova R2 verifica il servizio e la protezione del percorso; il percorso completo profilo→upload→candidatura→download resta parte del collaudo finale. Le prove locali approfondite già svolte restano documentate nei report precedenti.

## Ripubblicazione

Usare Linux per compilare e fare il bundle OpenNext. La CI conserva `nodework-worker.tgz` e `nodework-crawler.tgz`: contengono `.worker-bundle` e, per il web, `.open-next` con gli asset. Il pacchetto verificato è quello della CI del commit applicativo, non una build locale incompleta.

Su Linux, dopo la build, pubblicare con il file esplicito dell'ambiente di prova:

```sh
pnpm --filter @gaming/crawler exec wrangler deploy --config wrangler.preview.jsonc
pnpm --filter @gaming/web exec wrangler deploy --config wrangler.preview.jsonc
```

Le credenziali sono già installate nel Worker e vanno conservate come secret Cloudflare. Per un nuovo ambiente servono secret auth, Turnstile, Google e Stripe, con una firma webhook propria. Non trasferire mai una chiave live in questo ambiente. Il workflow manuale di produzione richiede ancora le sue variabili e il token dedicato: l'OAuth locale di Wrangler non è stato copiato in GitHub.

La pubblicazione iniziale da Windows usa il bundle Linux con `no_bundle`, regole `CompiledWasm` e `Data`, e un adattatore locale che passa a esbuild il contenuto dell'entrypoint tramite stdin. Serve a evitare un errore di accesso agli antenati del filesystem nel sandbox Windows; non modifica il codice applicativo né disattiva la verifica dei moduli. Configurazioni locali complete e log sono nel checkpoint di lavoro, senza segreti nel repository.

## Dopo design e modifiche al prodotto

Eseguire il collaudo completo dei percorsi candidati, datori, recruiter e pubblicità; acquisti e rimborsi di tutti i servizi; allegati e permessi; desktop/mobile, accessibilità e usabilità; SEO e prestazioni. Completare identità del gestore, informazioni sui fornitori e condizioni commerciali prima del lancio. Gli incassi reali saranno attivati solo nella fase commerciale concordata; l'indicizzazione è già consentita su richiesta del proprietario.
