# Ambiente locale e collegamento dei servizi

Aggiornato il 16 settembre 2026. Il collegamento degli account è rimandato su richiesta del proprietario. Nessun deploy, addebito o invio di email reali è stato eseguito.

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

1. Aprire `/login` e usare un indirizzo fittizio, ad esempio `admin@example.test`.
2. Premere **Send magic link**. In modalità locale il link compare nel terminale, preceduto da `[LOCAL EMAIL]`; non viene inviata una email.
3. Aprire il link nello stesso browser e completare il profilo. Per l'indirizzo configurato in `ADMIN_EMAILS` è disponibile `/admin`.

La modalità di test è limitata a `next dev`, origine localhost, `LOCAL_MAIL=true` e chiavi ufficiali di test Turnstile. Il server verifica il token di test con Cloudflare: è quindi necessaria una connessione Internet per il login. In produzione la modalità locale non viene abilitata e i token di accesso non vengono stampati. Riavviare `pnpm dev` dopo modifiche a `.dev.vars`.

Il crawler locale si avvia in un secondo terminale:

```sh
pnpm dev:crawler
```

Sito, migrazioni e crawler condividono `.wrangler/state`. Per attivare manualmente il ciclo locale visitare `http://localhost:8787/__scheduled`. In produzione il ciclo è previsto ogni sei ore. Le email degli alert sono disattivate finché `EMAIL_ENABLED` non viene configurato su entrambi i worker.

## Controlli disponibili

```sh
pnpm typecheck
pnpm test
pnpm test:portable
node scripts/smoke.mjs
```

`test:portable` è l'alternativa per Windows quando il caricamento della configurazione Vitest incontra restrizioni sulle directory. Comprende i test Node e i test Workers. In questa sessione il runtime Workers ha emesso avvisi di accesso al filesystem e un errore interno in chiusura: le 12 asserzioni di integrazione sono passate, ma questo non sostituisce un'esecuzione pulita in CI Linux.

La build dell'applicazione si verifica con `pnpm --filter @gaming/web build`. Il bundle per Cloudflare si costruisce su Linux con `pnpm --filter @gaming/web cf:build`. Evitare di eseguire build e server di sviluppo nella stessa directory `.next`; per un controllo parallelo impostare `NEXT_BUILD_DIR=.next-check` nel terminale della build.

## Fonti aziendali

Da `/admin` si può aggiungere una pagina Careers o un board Greenhouse, Lever o Ashby. Il crawler importa le offerte, mantiene le fonti e aggiorna la disponibilità. Le pagine generiche devono esporre dati `JobPosting` JSON-LD; pagine solo JavaScript richiedono un adattatore specifico. Un'estrazione HTML vuota viene segnalata invece di cancellare le offerte esistenti.

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

Il programma cerca link Careers e board ATS, produce un report e non pubblica annunci. Verificare che il progetto/token corrisponda a un'organizzazione che assume e impostare `approved: true` per le fonti da importare. L'importazione è locale salvo l'opzione esplicita `--remote`:

```sh
pnpm sources:import source-candidates.json
```

La scoperta massiva dei 500 progetti non è stata eseguita. L'importazione attraverso sitemap del concorrente non è implementata; sono disponibili le fonti dirette e l'alternativa CoinMarketCap. L'API di Web3.career è opzionale e richiede un token utilizzabile per il proprio servizio.

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
| Crawler | Fonti approvate, eventuale `CMC_API_KEY` per discovery; token Web3.career solo se usato |
| Rete pubblicitaria | Provider CPM/CPC da scegliere e integrare; gli spazi sponsor diretti sono un flusso distinto |

Le risorse nei file Wrangler provengono dal prototipo: non ne è stata verificata l'esistenza remota. Non creare o riutilizzare risorse in produzione senza controllare account e dati presenti. Le nuove migrazioni sono additive salvo `0014`, che ricostruisce quattro tabelle commerciali per conservare ordini anonimizzati dopo la cancellazione di un account; è stata verificata su SQLite e D1 locale.

La workflow GitHub `Deploy configured platform to Cloudflare` è manuale. Prima del suo utilizzo configurare l'ambiente GitHub `production`, le variabili e i secret elencati nella workflow, creare/verificare i binding e il mittente email. La workflow esegue controlli, configura le variabili pubbliche, costruisce su Linux, applica le migrazioni remote, carica i worker e i secret, poi verifica le pagine pubbliche. Non è stata eseguita in questa sessione. La migrazione deve precedere il codice che usa le nuove tabelle; il ripristino del solo worker non annulla le migrazioni.

Prima del lancio completare anche identità dell'operatore, contatti, condizioni commerciali, configurazione fiscale e documenti privacy. I testi presenti sono bozze tecniche.

## Stripe: prova da fare quando sarà collegato

Endpoint webhook: `/api/stripe/webhook`. Eventi gestiti per i nuovi ordini: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `invoice.paid`, `charge.refunded`. Configurare anche il Customer Portal per la gestione delle sottoscrizioni. Nessuna chiave Stripe è inclusa nei file consegnati.

Verificare in sandbox: pagamento singolo, bundle e consumo credito, coupon, rinnovo, annullamento del rinnovo, sponsorizzazione, accesso recruiter, scadenza e rimborso. I prezzi vengono calcolati dal server; l'URL di successo non pubblica da solo un annuncio. I rimborsi completi già associati a un pagamento revocano l'accesso. Restano da completare la riconciliazione degli eventi fuori ordine, i casi di rimborso delle singole rate e il recupero degli ordini sponsor abbandonati prima della creazione della sessione Stripe: non attivare incassi reali prima di questi interventi.

Riferimenti tecnici: [Turnstile testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/), [email Workers](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/), [Stripe subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks), [CoinMarketCap API](https://coinmarketcap.com/api/documentation/pro-api-reference/cryptocurrency), [Ashby public postings](https://developers.ashbyhq.com/docs/public-job-posting-api).
