# Stato della parità funzionale

19 settembre 2026. Il progetto non è ancora certificabile come equivalente al 100% a Web3.career. Google OAuth e Stripe sandbox sono ora collegati e collaudati; accessi candidati/aziende e discovery massiva sono descritti nel [resoconto QA](qa/2026-09-17-auth-payments-discovery.md). Il [collaudo aggiuntivo](qa/2026-09-19-payment-recovery.md) verifica rimborsi, coupon, carta rifiutata e correzioni di riconciliazione.

## Cosa è stato riutilizzato e corretto

Il sorgente privato è stato ottenuto dallo ZIP fornito dal proprietario. La prima consegna è stata integrata in `main` con PR #1. Questo aggiornamento è sul branch `feat/auth-payments-source-discovery`, a partire da `02be6b2`, per revisione tramite pull request. La pubblicazione del codice non attiva il deploy.

Riutilizzati Next.js, OpenNext, Cloudflare D1/R2/Queues, autenticazione, sanitizzazione, ricerca SQL/FTS, tassonomia e parte delle pagine SEO. Il modello candidato con quota di sblocchi e abbonamenti non è stato mantenuto come scelta di prodotto: la ricerca e le candidature sono gratuite. Il database locale nuovo non contiene annunci dimostrativi; le fixture restano confinate ai test.

| Area | Implementato nella consegna | Limite ancora aperto |
|---|---|---|
| Ricerca e risultati | Suggerimenti skill/aziende, filtro remoto, 15 risultati, annunci diretti e importati, preferiti, dettaglio, pin e highlight con scadenza | Verifica completa di tutte le combinazioni del search center e della conservazione dei filtri |
| Annunci a pagamento | Configuratore, prezzo server, checkout sandbox verificato, webhook firmato, pubblicazione dopo pagamento, 30 giorni, candidatura interna/esterna, recupero bozza | Editor ricco, campi benefit/social/skill principale, modifica e ripubblicazione completa |
| Upsell | Supporto premium, logo R2, pin, highlight e colore, rinnovo, Customer Portal | Prezzi intermedi dei bundle da verificare sul configuratore; distribuzione esterna/social non integrata |
| Bundle | Acquisto, consumo e rimborso completo sandbox verificati; proprietà, scadenza a 24 mesi e idempotenza | Politica dei rimborsi parziali |
| Candidature | Form interno con consenso e dashboard datore; inoltro alle pagine ATS esterne | Allegato CV per singola candidatura, notifiche al datore e gestione avanzata delle candidature |
| Profili e recruiter | Profilo/CV, skill Web3, visibilità pubblica separata dal consenso recruiter, verifica aziende, prezzo configurabile, accesso pagato con scadenza, download CV privato e audit | Ricerca avanzata, esportazioni commerciali e funzioni dietro login del concorrente da verificare |
| Sponsor | Quattro slot, prenotazione esclusiva, pagamento e rimborso sandbox, banner, dashboard impression/click, recupero prenotazioni pendenti | Recupero limitato e attivato dalle richieste; metriche non certificate come utenti unici |
| CPM/CPC | Requisito registrato separatamente dagli sponsor diretti | Adapter del network pubblicitario, consenso del provider e configurazione ads.txt ancora da implementare |
| Alert | Creazione/rimozione personale, filtro, consenso, coda giornaliera, link di disiscrizione | Email reali disabilitate; collaudo consegna e retry con provider |
| Aggregazione | Greenhouse, Lever, Ashby e JSON-LD; 53 portali verificati e 577 annunci importati, deduplica e scadenza | Altri adattatori Careers e controllo editoriale dei dati |
| Discovery | DefiLlama, a16z crypto e 70 aziende curate; 1.192 voci/1.175 siti analizzati; registro, controllo identità ATS, rinnovo giornaliero configurato | 118 pagine richiedono adattatori, 12 associazioni revisione; cron remoto da attivare; aggregatori opzionali |
| SEO | Recuperate pagine lavori/tag/località, aziende, salari e listicle; ricerca e dati dinamici condivisi | Audit integrale URL/contenuti/indicizzazione e allineamento di tutte le varianti al riferimento |
| Amministrazione | Verifica recruiter, prezzo, supporto, aggiunta fonti, registro discovery e salute crawler | Pannello operativo completo per moderazione e riconciliazione pagamenti |
| Ambiente e accessi | Setup locale, Google e magic link, onboarding e dashboard separati per candidati/aziende, CI Linux | Email reali, deploy e collaudo su Cloudflare reale |

La parità richiesta comprende anche ciò che non è visibile pubblicamente: non è stata dimostrata ispezionando solo pagine pubbliche e non è corretto dichiararla completata in base al numero di test.

## Prezzi osservati sul riferimento

Nel [modulo annunci](https://web3.career/post-web3-job): base $299; assistenza $99; logo $49; highlight standard $99 o personalizzato $149; pin di 1/3/7/14/30 giorni a $49/$99/$149/$199/$299. Configurazione predefinita osservata: $695; senza upsell: $299. Rinnovo predefinito ogni 30 giorni.

Nel [bundle](https://web3.career/post-web3-job/bundle), con le opzioni predefinite: 2 annunci $1.112 e 24 annunci $10.175; durata crediti dichiarata 24 mesi. I punti intermedi della scala sconti restano da confermare e non sono presentati come parità certificata.

Nella [pagina pubblicità](https://web3.career/ads): quattro posizioni a $4.999/$3.999/$2.999/$1.999 al mese, in alto e alle posizioni 4, 8 e 12. L'inventario occupato del concorrente non è stato copiato. Il [catalogo candidati](https://web3.career/hire) espone profili per skill e località; un prezzo di accesso recruiter equivalente non è stato verificato, quindi il prezzo proprio parte non configurato.

Per la ricerca sono stati osservati anche [Solidity](https://web3.career/solidity-jobs), [Remote + Solidity](https://web3.career/remote+solidity-jobs), [salari](https://web3.career/web3-salaries) e [aziende](https://web3.career/web3-companies). Grafica e brand finali restano fuori da questa fase.

## Verifiche

- Migrazioni fino a `0017` su D1 locale: riuscite. Nessun database remoto modificato.
- Typecheck dei workspace: riuscito.
- Build Next.js: riuscita. Questo è il build dell'applicazione, non una certificazione del bundle OpenNext su Workers.
- Suite Node: 559 test web, 156 shared, 18 database e 100 crawler/configurazione, per 833 test riusciti. Coprono anche tenant OAuth, separazione ingressi, proprietà ordini, discovery e code paginate, oltre ai controlli commerciali della prima consegna.
- Workers: 12 asserzioni passate. CI Linux del fix build completata; Windows continua a emettere avvisi filesystem. Verificare anche la CI sull’ultimo commit della PR.
- Browser: magic link candidato/datore, Google candidato/datore, onboarding distinti, pubblicazione annunci, bundle e credito, sponsor, recruiter, logo, bozza checkout e Customer Portal verificati.
- Sei pagamenti Stripe sandbox completati con webhook e attivazione dei servizi, incluso coupon; annullamento rinnovo, carta rifiutata e quattro rimborsi completi verificati. Nessun incasso reale.
- Crawler reale con code Miniflare: 53 fonti completate, 577 annunci Careers importati, zero errori al termine. La scansione più ampia mantiene visibili fonti bloccate o non supportate.
- Email reali e deployment Cloudflare non eseguiti. Il cron configurato non è ancora operativo online.

## Lavoro successivo già identificato

Prima di un lancio commerciale servono gli interventi nella colonna dei limiti, in particolare fatture/rimborsi ricorrenti e riconciliazione operativa oltre i limiti del recupero automatico, completamento ATS e configuratore, rete CPM/CPC, audit SEO e verifica delle funzioni riservate del concorrente. Il solo collegamento delle credenziali non chiude questi punti. La guida distingue la configurazione dai lavori di codice ancora necessari.
