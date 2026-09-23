# Ambiente locale e collegamento dei servizi

Aggiornato il 22 settembre 2026. È disponibile un ambiente di prova Cloudflare su https://nodework-web.xavier-ff2.workers.dev, con D1, R2 privato, code e crawler. Google OAuth e invio email sono collegati; Stripe resta esclusivamente sandbox. Su richiesta del proprietario, l'indicizzazione è attiva e tutti i crawler, inclusi quelli AI, possono visitare le pagine pubbliche. Design, differenziazione del prodotto e collaudo completo finale restano successivi. Configurazione e prove: [deploy di prova](qa/2026-09-22-cloudflare-preview.md).

## Avvio

Prerequisiti: Node.js 24 LTS e pnpm 9.15.0. Clonare il repository e selezionare il branch dell'aggiornamento, oppure estrarre lo ZIP del sorgente. Aprire un terminale nella cartella del progetto ed eseguire:

```sh
pnpm install --frozen-lockfile
pnpm setup:local
pnpm dev
```

Aprire http://localhost:3000. `setup:local` crea una chiave di autenticazione casuale, i file `.dev.vars` ignorati da Git e il database locale. Non sovrascrive una configurazione già esistente, non inserisce annunci dimostrativi e non modifica risorse remote. La configurazione del prototipo su Cloudflare resta da verificare prima di utilizzarla.

Il repository e lo ZIP del sorgente non contengono dipendenze installate, credenziali, database locali né l'account fittizio usato nei controlli. Il setup crea questi elementi di sviluppo sul computer di chi avvia il progetto.

## Accesso senza servizio email

1. Aprire `/login` per i candidati oppure `/employer/login` per le aziende e usare un indirizzo fittizio, ad esempio `admin@example.test`.
2. Premere **Send magic link**. In modalità locale il link compare nel terminale, preceduto da `[LOCAL EMAIL]`; non viene inviata una email.
3. Aprire il link nello stesso browser e completare il profilo candidato oppure i dati aziendali, secondo l'ingresso scelto. Per l'indirizzo configurato in `ADMIN_EMAILS` è disponibile `/admin`.

La modalità di test è limitata a `next dev`, origine localhost, `LOCAL_MAIL=true` e chiavi ufficiali di test Turnstile. Il server verifica il token di test con Cloudflare: è quindi necessaria una connessione Internet per il login. In produzione la modalità locale non viene abilitata e i token di accesso non vengono stampati. Riavviare `pnpm dev` dopo modifiche a `.dev.vars`.

Il crawler locale si avvia in un secondo terminale:

```sh
pnpm dev:crawler
```

Sito, migrazioni e crawler condividono `.wrangler/state`. Su Windows fermare il sito durante un'importazione massiva: due processi Miniflare sullo stesso D1 possono produrre lock. Per attivare manualmente il ciclo locale visitare `http://localhost:8787/__scheduled`. Il crawl è configurato ogni sei ore e rinnova il catalogo al massimo una volta al giorno; notifiche e riconciliazione dei periodi vengono eseguite ogni cinque minuti; diventa operativo online dopo il deploy. Le email degli alert sono disattivate finché `EMAIL_ENABLED` non viene configurato su entrambi i worker.

## Controlli disponibili

```sh
pnpm typecheck
pnpm test
pnpm test:portable
pnpm test:node
node scripts/smoke.mjs
pnpm audit:public
```

`test:portable` evita il bundling della configurazione Vitest e comprende Node e Workers; `test:node` esegue solo Node. Sul computer Windows il runtime Workers ha emesso avvisi filesystem ed errori interni di chiusura pur passando 12 asserzioni: usare la workflow Linux `Validate platform` per la verifica completa.

La build dell'applicazione si verifica con `pnpm --filter @gaming/web build`. Il bundle per Cloudflare si costruisce su Linux con `pnpm --filter @gaming/web cf:build`. Evitare di eseguire build e server di sviluppo nella stessa directory `.next`; per un controllo parallelo impostare `NEXT_BUILD_DIR=.next-check` nel terminale della build.

## Fonti aziendali

Da `/admin` si può aggiungere una pagina Careers o un board Greenhouse, Lever o Ashby. Il crawler importa le offerte, mantiene le fonti e aggiorna la disponibilità. Le pagine generiche devono esporre dati `JobPosting` JSON-LD nell’indice oppure in non più di 25 dettagli dello stesso sito; pagine solo JavaScript richiedono un adattatore specifico. Un'estrazione HTML vuota viene segnalata invece di cancellare le offerte esistenti.

Il percorso predefinito raccoglie DefiLlama, portfolio a16z crypto e aziende curate senza richiedere CoinMarketCap:

```sh
pnpm sources:discover --resume
pnpm sources:import .wrangler/source-candidates.json --activate-discovered
```

La scansione conserva checkpoint e provenienza. L'importatore verifica gli endpoint ATS prima dell'attivazione locale e segnala associazioni ambigue. `/admin/sources` mostra catalogo, errori e fonti attive. Il collaudo aggiornato del 21 settembre ha prodotto 689 annunci visibili da 61 fonti tutte lette con successo; il catalogo analizzato comprende 1.192 voci e 1.175 siti distinti.

Per cercare fonti da un elenco di siti:

```json
[{"name":"Nome azienda","website":"https://sito-ufficiale.example"}]
```

```sh
pnpm sources:discover --input companies.json --output source-candidates.json
```

Oppure impostare `CMC_API_KEY` nel terminale e usare:

```sh
pnpm sources:discover --from-cmc --limit 500 --output source-candidates.json
```

La CLI cerca link Careers e board ATS e produce un report. Verificare che il progetto corrisponda a un'organizzazione che assume; per una fonte manualmente verificata è disponibile `approved: true`. Senza `--activate-discovered` o approvazione si importa soltanto il registro. L'importazione è locale salvo l'opzione esplicita `--remote`:

```sh
pnpm sources:import source-candidates.json
```

La discovery automatica del worker, controllata da `SOURCE_DISCOVERY_ENABLED`, aggiorna il catalogo e attiva fonti riconosciute; gli annunci passano poi dal crawler. Rispetta robots.txt e non aggira blocchi o pagine protette. Careers proprietarie o soltanto JavaScript richiedono adattatori. Le API di Web3.career e CryptoJobsList sono possibili integrazioni aggiuntive: richiedono credenziali e condizioni di riutilizzo appropriate, e non sono state collegate in questo collaudo.

## Collegamento futuro

| Servizio | Configurazione necessaria |
|---|---|
| Dominio | `SITE_URL` HTTPS e stessa origine in `BETTER_AUTH_URL`; collegamento DNS/route Cloudflare |
| Amministratore | `ADMIN_EMAILS`, elenco separato da virgole; indirizzo verificato tramite accesso |
| Cloudflare | Verificare account, D1 `DB`, bucket R2 `FILES`, namespace KV `LOCKS`, code del crawler e binding email |
| Accesso | `BETTER_AUTH_SECRET` casuale, chiavi Turnstile reali, opzionalmente Google OAuth |
| Email | Mittente verificato in `EMAIL_FROM`, binding `EMAIL`, `EMAIL_ENABLED=true` sui due worker |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; inizialmente sandbox; `STRIPE_ENABLED=true` solo dopo collaudo |
| Recruiter | Prezzo per 30 giorni e verifica delle aziende da `/admin`; il prezzo parte non configurato |
| Crawler | Verificare code `crawl-career`, `crawl-career-failed`, `crawl-linkedin`, `crawl-indeed`; `SOURCE_DISCOVERY_ENABLED=true`; token Web3.career solo se usato |
| Rete pubblicitaria | Adapter AdSense disponibile: configurare da `/admin/advertising` publisher, unità e script Google CMP; approvazione e collaudo sul dominio reale necessari. Default off |

Le risorse nei file Wrangler provengono dal prototipo: non ne è stata verificata l'esistenza remota. Verificare account e dati prima del deploy e creare anche la coda di errori `crawl-career-failed` (la workflow non la crea). Migrazioni locali applicate fino a `0023`: comprendono dettagli annunci, candidature/CV/outbox, consensi export e shortlist, periodi fatture, rinnovi, moderazione, ripristino sicuro degli annunci e chiavi API. Applicarle tutte prima di distribuire il nuovo codice. `0014` ricostruisce quattro tabelle commerciali per conservare ordini anonimizzati dopo la cancellazione di un account; è stata verificata su SQLite e D1 locale.

La configurazione futura è descritta in `.env.example`. Oltre alle credenziali, impostare esplicitamente `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`, `D1_DATABASE_NAME`, `R2_BUCKET_NAME`, `LOCKS_KV_ID`, `WEB_WORKER_NAME`, `CRAWLER_WORKER_NAME`, `QUEUE_PREFIX`. Il generatore sostituisce gli identificativi del prototipo, nomina coerentemente tutte le code (compresa quella di errore) ed esclude i secret dai file Wrangler. Non crea né modifica risorse remote. Eseguire prima:

```sh
node scripts/configure-deployment.mjs --check
```

Senza `--check` genera la configurazione dai valori del terminale. Il controllo rifiuta origini locali, chiavi Turnstile di test, assenza del mittente email e coppie OAuth incomplete. Stripe può restare disattivato mentre si prepara il sito. In CI usare le variabili e i secret dell'ambiente `production`, non committare file con credenziali.

La workflow GitHub `Deploy configured platform to Cloudflare` è manuale. Prima del suo utilizzo configurare l'ambiente GitHub `production`, le variabili e i secret elencati nella workflow, creare/verificare i binding e il mittente email. La workflow esegue controlli, configura le variabili pubbliche, costruisce su Linux, applica le migrazioni remote, carica i worker e i secret, poi verifica le pagine pubbliche. Non è stata eseguita in questa sessione. La migrazione deve precedere il codice che usa le nuove tabelle; il ripristino del solo worker non annulla le migrazioni.

Prima del lancio completare anche identità dell'operatore, contatti, condizioni commerciali, configurazione fiscale e documenti privacy. I testi presenti sono bozze tecniche.

## Collegare Google e Stripe in locale

Per Google impostare `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` in `apps/web/.dev.vars`, con callback `http://localhost:3000/api/auth/callback/google` e origine `http://localhost:3000`. In Testing aggiungere gli account autorizzati ai test user di Google Cloud. Per il dominio definitivo occorre configurare origine, callback e audience pertinenti.

Per Stripe inserire una chiave **test** in `STRIPE_SECRET_KEY`, impostare `STRIPE_ENABLED=true`, installare la CLI ufficiale Stripe e avviare:

```sh
pnpm stripe:listen
```

È possibile indicare l'eseguibile tramite `STRIPE_CLI`. Lo script rifiuta chiavi live, inoltra i webhook a localhost e salva il signing secret nel file locale senza stamparlo. Riavviare `pnpm dev` dopo l'avvio del listener. Tenere attivo il listener durante le prove; non occorre registrare un URL localhost nella dashboard Stripe.

Endpoint webhook: `/api/stripe/webhook`. Eventi gestiti per i nuovi ordini: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `invoice.paid`, `invoice.upcoming`, `invoice.payment_failed`, `charge.refunded`, `customer.subscription.updated`, `customer.subscription.deleted`. Configurare anche il Customer Portal per la gestione delle sottoscrizioni. Nessuna chiave Stripe è inclusa nei file consegnati.

Verificati in sandbox: annuncio singolo, annuncio con rinnovo, bundle e consumo credito, sponsor e recruiter, upload logo, recupero bozza, Customer Portal e annullamento del rinnovo. Il collaudo aggiuntivo del 19 settembre verifica coupon, pagamento rifiutato e rimborso completo di annuncio singolo, bundle, sponsor e recruiter. Rinnovo effettivo, rimborsi delle rate e scadenza sono stati verificati anche tramite Stripe Test Clock e database isolato. I prezzi vengono calcolati dal server; l'URL di successo non pubblica da solo un annuncio. Il registro rimborsi impedisce la riattivazione da checkout fuori ordine per i pagamenti una tantum. `/ads` e il checkout attivano il recupero limitato delle prenotazioni sponsor pendenti; nessun cron separato esegue tale recupero. La riconciliazione delle fatture e i rimborsi delle rate sono implementati; `/admin/operations` offre riconciliazione manuale e controlli operativi. Verificare questi flussi anche sul deployment prima di attivare incassi reali. Dettagli e limiti nel [report del 19 settembre](qa/2026-09-19-payment-recovery.md).

Riferimenti tecnici: [Turnstile testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/), [email Workers](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/), [Stripe subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks), [CoinMarketCap API](https://coinmarketcap.com/api/documentation/pro-api-reference/cryptocurrency), [Ashby public postings](https://developers.ashbyhq.com/docs/public-job-posting-api).


## Funzioni operative aggiunte

- `/applications`: storico candidato, PDF privati e ritiro. `/employer/applications`: filtri, stato e note interne.
- `/notifications`: avvisi interni. Il worker consegna le email dall’outbox con lease e retry quando il binding email è attivo.
- `/employer/jobs/[id]/edit`: modifica i contenuti senza estendere il periodo acquistato. La dashboard apre anche la ripubblicazione come nuovo acquisto.
- `/recruiter`: accesso e CSV paginato, solo dopo verifica e pagamento. `/recruiter/shortlist`: candidati salvati e note. Consenso export distinto dal talent pool in `/profile/visibility`.
- `/admin/operations`: riconciliazione pagamenti, moderazione, recupero sponsor e retry notifiche. Il ruolo admin è richiesto anche dalle API.
- `/admin/advertising`: rete CPM/CPC; mantenere off finché publisher, dominio e CMP non sono pronti. `/ads.txt` riflette la configurazione. Test di consensi simulati non sostituiscono il collaudo con il provider.

Resoconto aggiornato: [collaudo del 21 settembre](qa/2026-09-21-functional-workflows.md). La CI Linux costruisce anche il bundle OpenNext; passare la build non significa che siano già verificate risorse e binding remoti.


## API del catalogo

`/web3-jobs-api` documenta il servizio; `/api-access` permette a un account verificato di generare fino a cinque chiavi attive e revocarle. Sono salvati solo hash SHA-256, prefisso e metadati. Le chiavi vengono eliminate con l’account; l’export personale non include hash o token.

`GET /api/v1` e `/api/v1/jobs` restituiscono JSON; `/api/v1.xml` restituisce RSS. Usare `Authorization: Bearer ...`; il parametro `token` è disponibile per feed reader ma l’URL va mantenuto privato. Filtri: tag, country/location, remote, q, seniority, salary_min/max, page, limit/page_size (1–100), show_description. Limite atomico: 60 richieste al minuto per chiave, 429 e Retry-After se superato. Il servizio espone solo annunci pubblici e attivi. Non espone profili o CV.

Il riferimento pubblico supporta API gratuite JSON/RSS con token, filtri e descrizioni: [documentazione ufficiale](https://docs.bondex.app/api-reference/web3-career-jobs-api/api-overview). Nodework documenta il proprio schema JSON e i propri limiti.

## Collaudo prima e dopo il collegamento

`pnpm audit:public`, con il sito avviato, legge tutte le sitemap e controlla ogni pagina pubblicata: risposta, contenuto principale, JSON-LD, canonical e noindex. Scrive `.wrangler/public-audit.json`, escluso da Git. `SITE_URL` permette di puntare al futuro dominio. Questo audit non verifica le pagine autenticate e non sostituisce i test dei pagamenti.

Il [report conclusivo](qa/2026-09-21-readiness.md) documenta la fase locale. Al collegamento futuro verificare accesso/email, callback Google, un acquisto sandbox e relativo webhook, upload/download privato e un'esecuzione del crawler. Solo dopo attivare le impostazioni commerciali. Design e personalizzazione del prodotto sono una fase separata richiesta dal proprietario.
