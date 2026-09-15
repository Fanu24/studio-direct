# Nodework (repo `studio-direct`)

Job board per il settore web3, in produzione su Cloudflare Workers all'indirizzo
https://gaming-web.xavier-ff2.workers.dev. Il marchio pubblico è **Nodework**; il nome del
repo, del database e dei worker è ancora `studio-direct` / `gaming-*` per motivi storici
(il progetto è nato come board per il gaming e poi è stato riorientato al web3). Questa
discrepanza è normale e non va "corretta" al volo: i nomi dei worker e del database sono
legati alle risorse Cloudflare esistenti.

Questo file spiega cosa fa il progetto, com'è strutturato, come si lavora in locale e come
si porta in produzione. È il punto di partenza per chiunque entri nel progetto.

---

## 1. Cosa fa il prodotto

- **Aggrega annunci di lavoro web3** da più fonti (API di web3.career, career page aziendali,
  ATS come Greenhouse e Lever, annunci JSON-LD) e li normalizza in un unico catalogo.
- **Li pubblica su centinaia di pagine SEO programmatiche:** listing per tag, città, paese,
  seniority, remote; directory aziende; classifiche stipendi; hub tematici.
- **Mostra il badge "Not on LinkedIn":** per ogni annuncio viene calcolata una esclusività
  (l'annuncio è sulla career page ma non sui grandi aggregatori). È la proposta di valore.
- **Candidatura on-site:** il candidato si candida su Nodework, mai reindirizzato altrove.
- **Account candidato** (login Google o magic link): profilo, CV su R2, export dati,
  cancellazione account, opt-in al talent pool.
- **Monetizzazione (in transizione):** finora il modello era un abbonamento candidato
  (mai attivato: `STRIPE_ENABLED` è `"false"` in produzione). Dal 14 settembre 2026 la
  decisione è **far pagare il datore di lavoro per l'inserzione**, con il listino di
  web3.career in USD. La spec è scritta, l'implementazione non è ancora iniziata
  (vedi sezione 10).

---

## 2. Stack

| Livello | Tecnologia |
|---|---|
| Frontend + SSR | Next.js 15 (App Router), React 19, TypeScript strict |
| Runtime | Cloudflare Workers tramite `@opennextjs/cloudflare` |
| Database | Cloudflare D1 (SQLite), schema in SQL + Drizzle solo per i tipi |
| Storage file | Cloudflare R2 (CV dei candidati) |
| Code | Cloudflare Queues (crawler), KV (lock per host), Cron Trigger ogni 6 ore |
| Auth | Better Auth (Google OAuth + magic link via email) |
| Anti-bot | Cloudflare Turnstile sul form di candidatura |
| Pagamenti | Stripe via REST (nessun SDK: `fetch` + HMAC per il webhook) |
| CSS | CSS puro con custom properties. Niente Tailwind, niente librerie UI |
| Test | Vitest. D1 è simulato con `node:sqlite` in memoria; il crawler usa anche il pool Workers di Miniflare |
| QA visiva | Playwright (Chromium, WebKit, Firefox) con script in `apps/web/qa/` |
| Package manager | pnpm 9 (workspace), Node 22 |

---

## 3. Struttura del monorepo

```
apps/
  web/        Il sito. Next.js su Workers. Deploy automatico da CI.
  crawler/    Worker separato: cron + code. Riempie il database.
packages/
  shared/     Logica di dominio condivisa da web e crawler (tassonomia, slug, esclusività, mapper API).
  db/         Migrazioni SQL (la verità sullo schema) + schema Drizzle per i tipi + seed.
  sharp-workers-stub/   Stub di `sharp` per far compilare il bundle Workers. Non toccare.
docs/
  superpowers/specs/    Le decisioni di design, una per iniziativa, con la data nel nome.
  superpowers/plans/    I piani di implementazione corrispondenti, task per task.
  qa/                   Report QA datati.
  handoff/              Note di passaggio consegne e transcript di sessioni precedenti.
.github/workflows/deploy.yml   L'unico modo per andare in produzione.
```

### 3.1 `apps/web`

- `app/` contiene le route. Le pagine pubbliche sono la stragrande maggioranza:
  homepage, `/jobs`, dettaglio annuncio (`/[slug]/[id]`), landing programmatiche
  (`/[slug]` gestisce `/remote-solidity-jobs` e simili), `/web3-companies/*`,
  `/web3-salaries/*`, hub e classifiche (`/top-web3-jobs`, `/hire/*`, ecc.),
  pagine legali e `/about`, `/faq`, `/pricing`, `/post-web3-job`, `/ads`.
- Pagine che richiedono login: `/dashboard`, `/profile`, `/settings`, `/onboarding`.
  Controllano la sessione lato server e reindirizzano a `/login?next=...`.
- `app/api/`: `auth/[...all]` (Better Auth), `apply`, `profile/cv`, `account/*`,
  `unlock`, `stripe/checkout`, `stripe/webhook`.
- `lib/` è la logica applicativa, per dominio: `auth/`, `jobs/` (query, apply, JSON-LD,
  landing, sanificazione HTML), `companies/`, `billing/`, `profile/`, `unlocks/`,
  `email/`, `legal/`, `tenant.ts`, `cache.ts`.
- `app/styles/*.css`: tutti i fogli di stile. Vengono importati **solo** da
  `app/layout.tsx`, in un ordine preciso. `globals.css` è l'unico posto dove si definiscono
  i token in `:root`; `motion.css` l'unico con i `@keyframes`. Nessun componente importa
  CSS direttamente: l'ordine dei chunk del bundler cambierebbe la cascata dei token.
- `qa/`: harness Playwright, script di verifica e `templates.mjs` che elenca i 21 template
  visivi distinti del sito. `qa/README.md` li documenta.
- `middleware.ts` + `lib/cache.ts`: politica di `Cache-Control` per le pagine pubbliche.
- `wrangler.jsonc`: binding (`DB`, `FILES`, `EMAIL`, `ASSETS`), variabili pubbliche, elenco
  dei secret richiesti. `wrangler.test.ts` verifica che questo file non cambi per sbaglio.

Accesso al database: non c'è un helper centrale. Ogni file server chiama
`getCloudflareContext()` e usa `env.DB`. Ogni query riceve `tenantId` esplicito, ottenuto
da `requireTenantId(db)` in `lib/tenant.ts` (cerca il tenant con slug `nodework`). Il
multi-tenant è un'astrazione ereditata: oggi esiste un solo tenant.

### 3.2 `apps/crawler`

Worker `gaming-crawler`. Cron `0 */6 * * *`. Tre code (`crawl-career`,
`crawl-linkedin`, `crawl-indeed`) con batch di 1.

- `src/sources/`: fetch grezzo per origine (`web3-career-api.ts` è la fonte principale;
  poi `career.ts`, `greenhouse.ts`, `lever.ts`, `jsonld.ts`, `linkedin.ts`, `indeed.ts`).
- `src/consumers/`: gli handler delle code, uno per fonte.
- `src/pipeline/`: `ingest.ts` (dedupe e scrittura su D1), `exclusivity.ts`,
  `close-stale.ts` (delista gli annunci spariti), `rollups.ts` (aggregati stipendi).
- `src/locks/kv-lock.ts`: lock per host su KV, così due crawl non colpiscono lo stesso sito.
- `src/repo/d1.ts`: accesso dati.
- `scripts/bootstrap-local.mjs`: riempie il D1 locale interrogando l'API di web3.career
  (serve il token in `.dev.vars`). `scripts/rollups-local.mjs`: ricalcola gli aggregati.

### 3.3 `packages/db`

- `migrations/0001..0009_*.sql`: **lo schema vero è qui.** Tabelle principali: `tenants`,
  `companies`, `jobs` (+ `jobs_fts` per la ricerca full-text), `job_sightings`,
  `job_tags`, `job_locations`, `job_benefits`, `salary_rollups`, `crawl_runs`,
  `users`/`session`/`account`/`verification` (Better Auth), `profiles`,
  `job_applications`, `unlocks`, `subscriptions`.
- `src/schema.ts`: la stessa struttura in Drizzle, usata solo per i tipi. Va tenuta
  allineata a mano quando si aggiunge una migrazione.
- `src/seed.ts` e `seed/studio-direct.sql`: dati di partenza (tenant e aziende).

Regola: ogni migrazione nuova deve essere idempotente (`CREATE TABLE IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`). `ALTER TABLE ADD COLUMN` non ha `IF NOT EXISTS` e si
documenta nell'header del file, come in `0009_company_description.sql`.

### 3.4 `packages/shared`

Un solo pacchetto di logica pura, importato sia da web sia da crawler: tassonomia
(paesi, città, tag, ruoli, seniority), helper per slug e URL canonici, mapper dell'API
web3.career, classificatore remote, rilevatore agenzie di staffing, calcolo
dell'esclusività, costruzione della digest email, costanti del tenant.

---

## 4. Come scorrono i dati

1. Il cron del crawler ogni 6 ore mette in coda le fonti da visitare.
2. I consumer scaricano, normalizzano tramite `@gaming/shared`, calcolano la chiave
   canonica e fanno upsert su `jobs`. I tag e le location vengono agganciati.
3. `close-stale` mette `listed = 0` agli annunci non più visti. `rollups` ricalcola gli
   stipendi aggregati.
4. Il sito legge D1 su ogni richiesta. Le pagine pubbliche hanno `revalidate = 300` e
   vengono prerenderizzate in CI contro un database vuoto: la prima richiesta reale le
   riempie.
5. Il candidato si candida tramite `/api/apply` (Turnstile), la candidatura finisce in
   `job_applications`.

---

## 5. Setup locale

Prerequisiti: Node 22, pnpm 9 (`corepack enable` basta), Git. Windows va bene per
sviluppare, **non** per fare la build di produzione (vedi sezione 7).

```bash
git clone https://github.com/Fanu24/studio-direct.git
cd studio-direct
pnpm install
```

### 5.1 Database locale

Il D1 locale vive in `apps/web/.wrangler/state/v3/d1` (gitignored). Va creato e migrato:

```bash
cd apps/web
pnpm exec wrangler d1 migrations apply gaming-jobs --local
```

Poi servono dati. Due strade:

- **Seed minimo** (tenant + aziende, nessun annuncio), da `apps/web`:
  `pnpm exec wrangler d1 execute gaming-jobs --local --file ../../packages/db/seed/studio-direct.sql`
  (lo script `pnpm --filter @gaming/db seed` fa la stessa cosa ma sul D1 locale del
  crawler, che è un file separato: `apps/web` e `apps/crawler` hanno ciascuno il proprio
  `.wrangler/`).
- **Annunci veri dall'API di web3.career:** crea `apps/crawler/.dev.vars` copiando
  `.dev.vars.example` e inserendo `WEB3_CAREER_API_TOKEN`, poi
  `pnpm --filter @gaming/crawler bootstrap:web3`. Lo script scrive in entrambi i D1
  locali (crawler e web), che devono già esistere e essere migrati. Chiedi il token a
  Xavier, non passa da git.

Se inserisci annunci a mano: `jobs` richiede `created_at` e `updated_at`, e per la ricerca
va inserita anche la riga in `jobs_fts`. Usa `INSERT` semplice, non `INSERT OR IGNORE`,
altrimenti gli errori di NOT NULL spariscono.

### 5.2 Dev server

```bash
cd apps/web
pnpm exec next dev -p 3000
```

Usa il D1 locale tramite il proxy di OpenNext. Nota: `next dev` non vede le `vars` di
`wrangler.jsonc` (per esempio `SITE_URL`), quindi il codice pubblico deve degradare a
percorsi relativi, mai lanciare eccezioni su una variabile mancante.

### 5.3 Secret in locale

`apps/web` non ha ancora un `.dev.vars.example`. Per far funzionare login e Turnstile in
locale servono `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`TURNSTILE_SECRET_KEY` in `apps/web/.dev.vars`. Le pagine pubbliche funzionano anche
senza.

---

## 6. Test e verifica

```bash
pnpm typecheck     # tutti i pacchetti
pnpm test          # tutti i pacchetti
```

Per un solo pacchetto: `pnpm --filter @gaming/web test`. Il crawler esegue tre config
Vitest in sequenza (contratto wrangler, unit Node, integrazione Miniflare).

Convenzioni dei test:

- I test stanno accanto al sorgente (`*.test.ts`, `*.test.tsx`).
- D1 si simula con `DatabaseSync` di `node:sqlite`, applicando le migrazioni vere.
- **I test delle pagine chiamano il componente come funzione e camminano l'albero
  restituito seguendo solo `props.children`.** Non usano un renderer DOM. Quindi una
  stringa da verificare deve essere un figlio JSX diretto in `page.tsx`, non una prop di
  un componente figlio. Se devi verificare il testo di un componente, chiamalo come
  funzione: `{PriceTable({ ... })}` invece di `<PriceTable />`.
- Mai cancellare un'asserzione in silenzio: se cambia un comportamento, si sostituisce
  con l'asserzione sul nuovo invariante.

Verifica visiva: la suite può essere verde e la pagina rotta (parametri di route
percent-encoded, ordine dei token CSS, variabili d'ambiente). Dopo un cambiamento di
routing, CSS o env, controlla con `curl` contro localhost. Screenshot con Chrome headless:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --hide-scrollbars --window-size=1440,7800 --virtual-time-budget=20000 --screenshot=out.png http://localhost:3000/
```

Per il mobile non basta ridurre `--window-size`: ritaglia, non rifluisce. Serve
l'emulazione dispositivo via Playwright o CDP, che è quello che fanno gli script in
`apps/web/qa/`.

---

## 7. Deploy e produzione

**La CI è l'unica via.** Un push su `main` che tocca `apps/web/**`, `packages/**`, il
lockfile o il workflow stesso esegue `.github/workflows/deploy.yml`: install, typecheck,
test, migrazione del D1 locale del runner (serve al prerender), `opennextjs-cloudflare
build`, deploy con wrangler, poi uno smoke test sul sito vivo che include una pagina di
dettaglio azienda.

- **Mai `pnpm cf:build` su Windows.** Cuoce i percorsi `C:\Users\...` nel bundle e il
  worker risponde 500 su ogni route. La build deve avvenire su Linux.
- **Mai `next build` con `next dev` acceso** sulla stessa app: sovrascrive `.next` e il dev
  server serve pagine senza CSS. Rimedio: ferma dev, cancella `.next`, riavvia.
- Il secret `CLOUDFLARE_API_TOKEN` è nel repo GitHub. I secret del worker
  (`BETTER_AUTH_SECRET`, Google, Turnstile, Stripe) si impostano con `wrangler secret put`
  e non stanno nel repo.

### 7.1 Migrazioni in produzione

Il workflow migra solo il D1 del runner. **Una migrazione che aggiunge colonne va
applicata a produzione prima del push**, altrimenti le pagine che leggono la colonna
nuova rispondono 500 mentre il worker dice `outcome: ok`.

`wrangler d1 migrations apply --remote` non funziona su questo database: la tabella
`d1_migrations` di produzione è vuota e wrangler riparte da `0001`, che fallisce su
"table already exists". Si applica il singolo file:

```bash
cd apps/web
pnpm exec wrangler d1 execute gaming-jobs --remote --file ../../packages/db/migrations/00XX_nome.sql
```

Poi si conferma interrogando `sqlite_master`, non fidandosi dell'exit code.

### 7.2 Costo D1

Il piano gratuito di D1 legge al massimo 5 milioni di righe al giorno. Il primo giorno
in produzione ne abbiamo lette 16 milioni per colpa di indici mancanti; superato il tetto
ogni pagina con database rende un 500 fino a mezzanotte UTC. La migrazione `0008` ha
aggiunto gli indici. Prima di aggiungere una query che filtra su una colonna nuova,
chiediti se ha un indice. Diagnosi: `wrangler tail --format json`, l'errore di quota è in
`logs[].errorInfo`, non in `exceptions`.

---

## 8. Convenzioni di codice

- TypeScript strict, `verbatimModuleSyntax: true`: i tipi si importano con
  `import type { X }` o `import { a, type B }`.
- `apps/web/lib/**` usa solo export nominati. `export default` esiste solo nei file
  page/layout/route di `app/**`.
- Ordine degli import: `node:*`, pacchetti esterni, riga vuota, import relativi.
- `apps/web` e `apps/crawler` usano import relativi senza estensione; `packages/shared` e
  `packages/db` usano l'estensione `.ts` esplicita.
- Nuovi fogli di stile: importati solo da `app/layout.tsx`, nessuna custom property,
  nessun blocco `:root`, nessun selettore più specifico di una classe singola.
- Il denaro è sempre in centesimi interi. Niente float.
- Copy: niente trattini lunghi, niente "Trusted by", niente KPI inventati, niente
  affermazioni di performance non verificabili ("3x more views"). Uno studio non riceve
  mai il profilo di un candidato solo perché si è candidato.
- Ogni cambiamento di comportamento arriva con il suo test.

---

## 9. Trappole note

Tutte costate ore di debug. Tutte invisibili alla suite di test.

- **I parametri di route arrivano percent-encoded.** `/remote+solidity-jobs` arriva a
  `app/[slug]/page.tsx` come `remote%2Bsolidity-jobs`. Il parser fa `decodeURIComponent`
  in un try/catch.
- **L'ordine dei token CSS lo decide il bundler,** non `layout.tsx`. Per questo nessun
  componente importa CSS e i token vivono in un solo file.
- **L'API di web3.career rifiuta le richieste senza uno User-Agent da browser** (403
  "Error 1010"). Non c'entra il token.
- **I nomi dei campi dell'API** sono `is_remote`, `salary_min_value`,
  `salary_max_value`, `salary_currency`, `salary_unit`, `city` e `country` già in slug,
  `date_epoch`. Non importare `estimated_*_salary`: sono stime del provider, non dati.
- **`posted_at` deve avere un solo formato** (ISO). SQLite confronta come testo.
- **`jobs_fts` è una FTS5 semplice:** il comando `'delete'` è illegale. Fu il motivo per
  cui ogni UPDATE su `jobs` falliva al secondo passaggio. Risolto in `0007`.
- **Un dev server lasciato acceso per ore con modifiche concorrenti si corrompe.** Prima
  di dichiarare rotta un'interazione, riavvia `next dev` e riprova.
- **`grep -c` conta le righe,** e l'HTML di Next è una riga sola. Usa `grep -o | wc -l`.

---

## 10. Stato attuale e lavoro in corso

Cronologia sintetica (le spec in `docs/superpowers/specs/` hanno il dettaglio):

| Data | Iniziativa | Stato |
|---|---|---|
| 2026-09-02 | Fondazione: crawler, web, DB, org | Fatto |
| 2026-09-08 | Inventario SEO Nodework (parità con web3.career) | Fatto, poi superato |
| 2026-09-09 | Redesign "Aurora" (due registri visivi, QA su 3 motori) | Fatto, live dal 10/09 |
| 2026-09-10 | Struttura lean web3 (jobs subito in pagina) | Fatto |
| 2026-09-14 | **Inserzioni pagate dal datore di lavoro** | Spec e piano scritti, **nessun codice** |

Il prossimo lavoro è il piano `docs/superpowers/plans/2026-09-14-employer-paid-listings.md`
(25 task in 6 fasi). Decisioni già prese che non si deducono dal codice:

- Prezzi in USD, esattamente quelli di web3.career. Base 299, sticky da 49 a 299 in base
  ai giorni, highlight 99 o 149, logo 49. Il supporto premium **non** si vende: non
  abbiamo un canale di supporto.
- Pubblicazione automatica al pagamento, con takedown. Nessuna coda di moderazione.
- La candidatura resta sempre su Nodework. Nessun redirect all'URL del datore.
- Il logo aziendale è un URL, non un upload.
- L'abbonamento candidato e la quota di unlock vengono cancellati del tutto.
- La migrazione `0010` (allarga lo schema) va **prima** del deploy; `0011` (cancella
  `unlocks` e `subscriptions`) va **dopo**, perché il worker vivo le legge ancora.

Per andare live con i pagamenti servono due passi manuali: i secret `STRIPE_SECRET_KEY`
e `STRIPE_WEBHOOK_SECRET` con un webhook puntato a `/api/stripe/webhook`, e il flip di
`STRIPE_ENABLED` a `"true"` in `wrangler.jsonc` (aggiornando `wrangler.test.ts`).

---

## 11. Come lavoriamo in due

- `main` è protetto: si arriva solo via pull request con CI verde. Ogni merge su `main`
  che tocca `apps/web` o `packages` va in produzione.
- Un branch per ogni lavoro (`feat/...`, `fix/...`), PR piccole e frequenti. Chi non ha
  scritto il codice lo legge prima del merge, anche solo per un minuto.
- Se lavoriamo in parallelo sul piano delle inserzioni, ci dividiamo per fase, non per
  file: le fasi 1-3 (modello, dominio, route) e la fase 6 (pagine) toccano file diversi.
- Prima di aprire una PR: `pnpm typecheck && pnpm test` verdi in locale.
- I secret non passano mai da git, chat pubbliche o issue.
- Ogni decisione di prodotto non ovvia si scrive in una spec sotto
  `docs/superpowers/specs/` con la data nel nome. Il codice dice cosa, la spec dice perché.

---

## 12. Dove guardare

| Domanda | File |
|---|---|
| Perché il sito è fatto così? | `docs/superpowers/specs/2026-09-09-aurora-redesign-design.md`, `2026-09-10-lean-web3-structure-design.md` |
| Cosa stiamo costruendo adesso? | `docs/superpowers/specs/2026-09-14-employer-paid-listings-design.md` e il piano omonimo |
| Come è fatto il database? | `packages/db/migrations/` |
| Quali route esistono? | `apps/web/app/` e `apps/web/qa/templates.mjs` |
| Come si fa il deploy? | `.github/workflows/deploy.yml` (i commenti spiegano ogni passo) |
| Come si testa la UI su più dispositivi? | `apps/web/qa/README.md` |
| Cosa è successo nelle sessioni precedenti? | `docs/qa/`, `docs/handoff/` |
