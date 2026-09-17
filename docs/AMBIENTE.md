# Ambiente locale e collegamento dei servizi

Aggiornato il 17 settembre 2026. Google OAuth in modalità Testing e Stripe sandbox sono stati collegati e collaudati in locale. Nessun deploy, addebito reale o invio di email reali è stato eseguito. Risultati e limiti: [resoconto QA](qa/2026-09-17-auth-payments-discovery.md).

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

Sito, migrazioni e crawler condividono `.wrangler/state`. Su Windows fermare il sito durante un'importazione massiva: due processi Miniflare sullo stesso D1 possono produrre lock. Per attivare manualmente il ciclo locale visitare `http://localhost:8787/__scheduled`. Il cron è configurato ogni sei ore e rinnova il catalogo al massimo una volta al giorno; diventa operativo online dopo il deploy. Le email degli alert sono disattivate finché `EMAIL_ENABLED` non viene configurato su entrambi i worker.

## Controlli disponibili

```sh
pnpm typecheck
pnpm test
pnpm test:portable
pnpm test:node
node scripts/smoke.mjs
```

`test:portable` evita il bundling della configurazione Vitest e comprende Node e Workers; `test:node` esegue solo Node. Sul computer Windows il runtime Workers ha emesso avvisi filesystem ed errori interni di chiusura pur passando 12 asserzioni: usare la workflow Linux `Validate platform` per la verifica completa.

La build dell'applicazione si verifica con `pnpm --filter @gaming/web build`. Il bundle per Cloudflare si costruisce su Linux con `pnpm --filter @gaming/web cf:build`. Evitare di eseguire build e server di sviluppo nella stessa directory `.next`; per un controllo parallelo impostare `NEXT_BUILD_DIR=.next-check` nel terminale della build.

## Fonti aziendali

Da `/admin` si può aggiungere una pagina Careers o un board Greenhouse, Lever o Ashby. Il crawler importa le offerte, mantiene le fonti e aggiorna la disponibilità. Le pagine generiche devono esporre dati `JobPosting` JSON-LD; pagine solo JavaScript richiedono un adattatore specifico. Un'estrazione HTML vuota viene segnalata invece di cancellare le offerte esistenti.

Il percorso predefinito raccoglie DefiLlama, portfolio a16z crypto e aziende curate senza richiedere CoinMarketCap:

```sh
pnpm sources:discover --resume
pnpm sources:import .wrangler/source-candidates.json --activate-discovered
```

La scansione conserva checkpoint e provenienza. L'importatore verifica gli endpoint ATS prima dell'attivazione locale e segnala associazioni ambigue. `/admin/sources` mostra catalogo, errori e fonti attive. La prima importazione verificata ha prodotto 577 annunci da 53 board; il catalogo analizzato comprende 1.192 voci e 1.175 siti distinti.

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
| Rete pubblicitaria | Provider CPM/CPC da scegliere e integrare; gli spazi sponsor diretti sono un flusso distinto |

Le risorse nei file Wrangler provengono dal prototipo: non ne è stata verificata l'esistenza remota. Verificare account e dati prima del deploy e creare anche la coda di errori `crawl-career-failed` (la workflow non la crea). Migrazioni locali applicate fino a `0016`: account aziendali e registro discovery. `0014` ricostruisce quattro tabelle commerciali per conservare ordini anonimizzati dopo la cancellazione di un account; è stata verificata su SQLite e D1 locale.

La workflow GitHub `Deploy configured platform to Cloudflare` è manuale. Prima del suo utilizzo configurare l'ambiente GitHub `production`, le variabili e i secret elencati nella workflow, creare/verificare i binding e il mittente email. La workflow esegue controlli, configura le variabili pubbliche, costruisce su Linux, applica le migrazioni remote, carica i worker e i secret, poi verifica le pagine pubbliche. Non è stata eseguita in questa sessione. La migrazione deve precedere il codice che usa le nuove tabelle; il ripristino del solo worker non annulla le migrazioni.

Prima del lancio completare anche identità dell'operatore, contatti, condizioni commerciali, configurazione fiscale e documenti privacy. I testi presenti sono bozze tecniche.

## Collegare Google e Stripe in locale

Per Google impostare `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` in `apps/web/.dev.vars`, con callback `http://localhost:3000/api/auth/callback/google` e origine `http://localhost:3000`. In Testing aggiungere gli account autorizzati ai test user di Google Cloud. Per il dominio definitivo occorre configurare origine, callback e audience pertinenti.

Per Stripe inserire una chiave **test** in `STRIPE_SECRET_KEY`, impostare `STRIPE_ENABLED=true`, installare la CLI ufficiale Stripe e avviare:

```sh
pnpm stripe:listen
```

È possibile indicare l'eseguibile tramite `STRIPE_CLI`. Lo script rifiuta chiavi live, inoltra i webhook a localhost e salva il signing secret nel file locale senza stamparlo. Riavviare `pnpm dev` dopo l'avvio del listener. Tenere attivo il listener durante le prove; non occorre registrare un URL localhost nella dashboard Stripe.

Endpoint webhook: `/api/stripe/webhook`. Eventi gestiti per i nuovi ordini: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `invoice.paid`, `charge.refunded`. Configurare anche il Customer Portal per la gestione delle sottoscrizioni. Nessuna chiave Stripe è inclusa nei file consegnati.

Verificati in sandbox: annuncio singolo, annuncio con rinnovo, bundle e consumo credito, sponsor e recruiter, upload logo, recupero bozza, Customer Portal e annullamento del rinnovo. Restano da collaudare coupon, rinnovo effettivo, scadenza, rimborso e pagamento rifiutato. I prezzi vengono calcolati dal server; l'URL di successo non pubblica da solo un annuncio. Restano da completare la riconciliazione degli eventi fuori ordine, i rimborsi delle singole rate e il recupero degli ordini sponsor abbandonati prima della creazione della sessione Stripe: completare questi interventi prima di attivare incassi reali.

Riferimenti tecnici: [Turnstile testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/), [email Workers](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/), [Stripe subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks), [CoinMarketCap API](https://coinmarketcap.com/api/documentation/pro-api-reference/cryptocurrency), [Ashby public postings](https://developers.ashbyhq.com/docs/public-job-posting-api).
