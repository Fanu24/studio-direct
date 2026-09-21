# Preparazione al collegamento online — 21 settembre 2026

Ambito richiesto: completare e collaudare le funzioni prima di collegare dominio e servizi di produzione. Design, offerta distintiva e configurazione commerciale sono rinviati dal proprietario. Nessun deploy, merge, pagamento reale o invio email reale.

## Correzioni e verifiche

- Ricerca: testo, città/paese, remoto, azienda, skill, benefit e stipendio conservano gli altri filtri quando si cerca, si seleziona un suggerimento o si rimuove un filtro. Cambiare filtri azzera la pagina e l'annuncio selezionato. Rimossa la barra del prototipo basata su presunta esclusività LinkedIn. Browser: Berlino + remoto + CTO, rimozione della sola città, suggerimento Kraken con remoto mantenuto.
- Moderazione: una nuova importazione non riattiva gli annunci nascosti. Il ripristino non riapre annunci scaduti, rimborsati o chiusi dalla fonte; il crawler continua a verificare la disponibilità anche durante la moderazione. Migrazione 0023 applicata localmente. Verificati SQLite/D1 e UI admin con il solo annuncio QA.
- Salari: statistiche pubbliche e intervalli delle landing calcolati sulle offerte attualmente visibili del tenant; esclusione immediata di annunci chiusi, aziende nascoste e rimborsi. Sitemap salari limitata alle dimensioni supportate.
- Sitemap: indice XML con `sitemapindex`, figli con `urlset`, URL assoluti anche in locale. Robot esclude le aree private. Verifica delle risposte pubbliche descritta sotto.
- Configurazione: generatore dei due Worker con account, D1, R2, KV, nomi Worker e prefisso code espliciti; gestione dei messaggi compatibile con code rinominate. Verifiche di dominio, email, autenticazione, Turnstile, coppie OAuth e chiavi Stripe; modalità `--check` senza scritture; generazione ripetibile senza modificare i nomi delle code una seconda volta. Credenziali escluse dai file generati.

## Flussi con dati sintetici

Accessi Google e magic link già collaudati nella sandbox; account candidato, datore e amministratore distinti. Questa sessione ha verificato la gestione chiavi API nella UI (chiave poi revocata), moderazione e riconciliazione di un ordine rimborsato dalla UI admin.

Ripubblicazione completa partendo da un vecchio annuncio chiuso: dati precompilati, nuovo titolo e candidature interne, Checkout Stripe sandbox da $299, webhook ricevuto, nuovo annuncio pubblicato con durata 30 giorni e vecchio annuncio ancora chiuso. Ordine `9c9abf5e-7be5-48e0-ac5c-309a10d0fbf1`, infine rimborsato integralmente: stato `refunded` e annuncio non elencato. Nessun addebito reale.

Sul nuovo annuncio: candidatura PDF sintetica, email dell'account non alterabile dal form, download consentito solo a candidato e datore, estraneo 404, stato colloquio e note private datore, notifica, richiesta cross-origin 403, export recruiter senza acquisto 403, ritiro con rimozione del PDF e account export aggiornato. Rimossa la candidatura attiva di prova; il ritiro non può richiamare copie già scaricate.

Pagamenti di annuncio singolo, rinnovo, bundle/credito, sponsor e recruiter sono documentati nei report precedenti. Il test Stripe Test Clock del 19 settembre copre fatture, rinnovi, rimborsi delle rate e cancellazione/scadenza; non va confuso con il Checkout browser di questa sessione.

## Fonti Careers

Catalogo locale: 1.192 provenienze e 1.175 siti. Riesaminate 118 fonti che richiedevano un adattatore: 6 JSON-LD e 3 riferimenti ATS (due aziende uniche) riconosciuti; 107 ancora da adattare, 2 da revisionare. Totale fonti attivate: **61**, tutte lette con successo dopo la correzione di `fetch` nel runtime Cloudflare. **689 annunci importati visibili**. Non è una nuova scansione completa di tutti i 1.175 siti.

Stati globali del registro: 71 ATS, 6 JSON-LD, 107 da adattare, 14 da revisionare, 83 bloccati, 39 errori, 872 senza link Careers. Più provenienze possono riferirsi alla stessa azienda. Un progetto crypto nel catalogo non equivale automaticamente a un datore con offerte accessibili.

Verificata nel runtime locale Workers la lettura delle sei nuove fonti JSON-LD. Corretto il binding del metodo `fetch` che in Cloudflare generava `Illegal invocation`. Discovery giornaliera e crawl ogni sei ore sono configurati; diventano automatici online dopo deploy. Una discordanza accertata sull'identità sospende una fonte scoperta automaticamente, salvo verifica indipendente da altra provenienza; un errore di rete temporaneo conserva la fonte.

## Risultato delle verifiche automatiche

- Suite locale finale: **872 tests Node** (160 shared, 18 database, 587 web, 107 crawler) e **12 tests Workers** passati. Un test Stripe opt-in escluso dalla suite ordinaria, già eseguito con Test Clock il 19 settembre. Typecheck workspace passato.
- Audit HTTP di **1.024 pagine** e nove file sitemap (indice più otto figli): nessun errore di risposta/contenuto/JSON-LD. L'audit ha rilevato alias canonical e noindex impropri nelle sitemap: corretti generazione canonica e soglie per le combinazioni remote e gli hub. Il login aziendale aggiunto al controllo resta correttamente noindex e fuori dalle sitemap.
- Il ricontrollo HTTP mirato dopo queste correzioni è registrato nel checkpoint finale locale. Il comando `pnpm audit:public` ora considera errore anche canonical alternativi, noindex in sitemap e URL non assoluti.
- La CI Linux verifica typecheck, suite, build OpenNext per Cloudflare e setup/migrazioni da ambiente pulito. La CI del commit precedente `5d90e12` è passata; consultare i [controlli della PR](https://github.com/Fanu24/studio-direct/pull/2/checks) per la revisione corrente. Questo collegamento evita di confondere un risultato precedente con il codice aggiornato.

## Collegamento futuro, fuori dal collaudo locale

Restano intenzionalmente successivi: risorse e dominio Cloudflare, mittente email reale, callback OAuth sul dominio finale, endpoint webhook online, configurazione Stripe commerciale/fiscale e prezzi recruiter, publisher/CMP/approvazione ads, documenti e contatti dell'operatore. Dopo questi collegamenti occorre una prova sul dominio vero prima di incassare. Il software non può certificare oggi servizi ancora non collegati.

Distribuzione su social o aggregatori esterni richiede canali e accordi del nuovo business; non è inclusa automaticamente nell'acquisto. Il supporto premium ha ticket e priorità in amministrazione, con risposta dell'operatore. Le pagine riservate e le condizioni commerciali interne del concorrente non sono state certificate: questo report non dichiara parità assoluta al 100%.

Tutti i log contenenti magic link, credenziali, database e file privati restano fuori da Git.
