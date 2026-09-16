# Stato della parità funzionale

16 settembre 2026. Il progetto non è ancora certificabile come equivalente al 100% a Web3.career. Questa consegna rende riproducibile l'ambiente locale e introduce i principali flussi commerciali; il collegamento degli account è rimandato per scelta del proprietario.

## Cosa è stato riutilizzato e corretto

Il sorgente privato è stato ottenuto dallo ZIP fornito dal proprietario. Base GitHub verificata: `ce48d627e0aba29b0918c72c1b43cc90d81ad03a`. L'aggiornamento è preparato sul branch `feat/web3-platform-update`, derivato dalla cronologia originale di `main`, per la revisione tramite pull request. La pubblicazione del codice non attiva il deploy.

Riutilizzati Next.js, OpenNext, Cloudflare D1/R2/Queues, autenticazione, sanitizzazione, ricerca SQL/FTS, tassonomia e parte delle pagine SEO. Il modello candidato con quota di sblocchi e abbonamenti non è stato mantenuto come scelta di prodotto: la ricerca e le candidature sono gratuite. Il database locale nuovo non contiene annunci dimostrativi; le fixture restano confinate ai test.

| Area | Implementato nella consegna | Limite ancora aperto |
|---|---|---|
| Ricerca e risultati | Suggerimenti skill/aziende, filtro remoto, 15 risultati, annunci diretti e importati, preferiti, dettaglio, pin e highlight con scadenza | Verifica completa di tutte le combinazioni del search center e della conservazione dei filtri |
| Annunci a pagamento | Configuratore, prezzo server, checkout preparato, webhook firmato, pubblicazione dopo pagamento, 30 giorni, scelta candidatura interna/esterna | Sandbox reale; editor ricco, campi benefit/social/skill principale, modifica e ripubblicazione completa |
| Upsell | Supporto premium, logo R2, pin, highlight e colore, rinnovo, Customer Portal | Prezzi intermedi dei bundle da verificare sul configuratore; distribuzione esterna/social non integrata |
| Bundle | Crediti per proprietario, scadenza a 24 mesi, consumo una volta sola, controllo pagamento | Collaudo acquisto reale in sandbox e ciclo di rimborso completo |
| Candidature | Form interno con consenso e dashboard datore; inoltro alle pagine ATS esterne | Allegato CV per singola candidatura, notifiche al datore e gestione avanzata delle candidature |
| Profili e recruiter | Profilo/CV, skill Web3, visibilità pubblica separata dal consenso recruiter, verifica aziende, prezzo configurabile, accesso pagato con scadenza, download CV privato e audit | Ricerca avanzata, esportazioni commerciali e funzioni dietro login del concorrente da verificare |
| Sponsor | Quattro slot, prenotazione esclusiva, checkout preparato, banner nelle liste, dashboard impression/click | Recupero delle prenotazioni abbandonate e collaudo Stripe; le metriche non sono utenti unici certificati |
| CPM/CPC | Requisito registrato separatamente dagli sponsor diretti | Adapter del network pubblicitario, consenso del provider e configurazione ads.txt ancora da implementare |
| Alert | Creazione/rimozione personale, filtro, consenso, coda giornaliera, link di disiscrizione | Email reali disabilitate; collaudo consegna e retry con provider |
| Aggregazione | Scheduler per fonti configurate; Greenhouse, Lever, Ashby e JobPosting JSON-LD; deduplica, scadenza, tassonomia per titoli ATS | Nessun pool da 500 aziende importato; adattatori per Careers personalizzate e qualità dati su fonti reali |
| Discovery | CLI da elenco siti oppure metadati CoinMarketCap; rilevamento Careers/ATS, report e importazione delle fonti approvate | Verifica massiva, manutenzione della lista; sitemap concorrente non implementata |
| SEO | Recuperate pagine lavori/tag/località, aziende, salari e listicle; ricerca e dati dinamici condivisi | Audit integrale URL/contenuti/indicizzazione e allineamento di tutte le varianti al riferimento |
| Amministrazione | Verifica recruiter, prezzo, risposte supporto, aggiunta fonti, log crawler | Pannello operativo completo per moderazione, riconciliazione pagamenti e gestione catalogo |
| Ambiente | Setup locale idempotente, D1 condiviso, secret casuale, email locali, workflow Linux manuale | Collegamenti, deploy e collaudo end-to-end su Cloudflare reale |

La parità richiesta comprende anche ciò che non è visibile pubblicamente: non è stata dimostrata ispezionando solo pagine pubbliche e non è corretto dichiararla completata in base al numero di test.

## Prezzi osservati sul riferimento

Nel [modulo annunci](https://web3.career/post-web3-job): base $299; assistenza $99; logo $49; highlight standard $99 o personalizzato $149; pin di 1/3/7/14/30 giorni a $49/$99/$149/$199/$299. Configurazione predefinita osservata: $695; senza upsell: $299. Rinnovo predefinito ogni 30 giorni.

Nel [bundle](https://web3.career/post-web3-job/bundle), con le opzioni predefinite: 2 annunci $1.112 e 24 annunci $10.175; durata crediti dichiarata 24 mesi. I punti intermedi della scala sconti restano da confermare e non sono presentati come parità certificata.

Nella [pagina pubblicità](https://web3.career/ads): quattro posizioni a $4.999/$3.999/$2.999/$1.999 al mese, in alto e alle posizioni 4, 8 e 12. L'inventario occupato del concorrente non è stato copiato. Il [catalogo candidati](https://web3.career/hire) espone profili per skill e località; un prezzo di accesso recruiter equivalente non è stato verificato, quindi il prezzo proprio parte non configurato.

Per la ricerca sono stati osservati anche [Solidity](https://web3.career/solidity-jobs), [Remote + Solidity](https://web3.career/remote+solidity-jobs), [salari](https://web3.career/web3-salaries) e [aziende](https://web3.career/web3-companies). Grafica e brand finali restano fuori da questa fase.

## Verifiche

- Installazione con lockfile congelato e migrazioni fino a `0014` su D1 locale: riuscite. Nessun database remoto modificato.
- Typecheck dei workspace: riuscito.
- Build Next.js: riuscita, 136 pagine generate. Questo è il build dell'applicazione, non una certificazione del bundle OpenNext su Workers.
- Suite Node: 528 test web, 143 shared, 18 database e 94 crawler/configurazione, per 783 test. Le prove comprendono transazioni SQLite reali, idempotenza pagamenti, importo/currency, crediti, accesso recruiter e revoca consenso, cancellazione account con record commerciali e arresto dei rinnovi prima della chiusura annunci.
- Workers: 12 asserzioni passate; il runtime Windows ha emesso avvisi filesystem e un errore interno di chiusura. Serve ripetizione pulita nella CI Linux prima del lancio.
- Nove pagine pubbliche hanno risposto HTTP 200. Browser: configuratore $695 → $299, login locale, onboarding, dashboard candidato e accesso amministratore verificati.
- Discovery massiva, pagamenti sandbox, email reali e deployment Cloudflare: non eseguiti. Non ci sono incassi, annunci reali acquisiti o ricavi pubblicitari dimostrati.

## Lavoro successivo già identificato

Prima di un lancio commerciale servono gli interventi nella colonna dei limiti, in particolare riconciliazione dei webhook fuori ordine, prenotazioni sponsor abbandonate, fatture/rimborsi ricorrenti, completamento ATS e configuratore, rete CPM/CPC, audit SEO e verifica delle funzioni riservate del concorrente. Il solo collegamento delle credenziali non chiude questi punti. La guida distingue la configurazione dai lavori di codice ancora necessari.
