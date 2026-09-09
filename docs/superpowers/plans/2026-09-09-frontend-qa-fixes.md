# Piano dei fix — QA frontend 2026-09-09

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correggere i due difetti High del QA e il difetto Medium di accessibilità, ognuno con una misura che dimostri il cambiamento.

**Architecture:** Tre task indipendenti che toccano file diversi. Nessuno dipende dagli altri e possono essere eseguiti in qualsiasi ordine.

**Tech Stack:** Next.js 15 App Router, React 19, D1 via OpenNext/Cloudflare, vitest.

**Spec:** `docs/qa/2026-09-09-frontend-qa-report.md` — il report è l'autorità: ogni task qui corrisponde a un finding verificato e riprodotto lì.

## Global Constraints

- Il dev server gira su `http://localhost:3001`. Non riavviarlo né ucciderlo se non richiesto.
- Mai `next build` mentre `next dev` gira sulla stessa app: la build sovrascrive `.next` e il dev server serve pagine senza CSS. Recupero: stop dev, `rm -rf .next`, riavvia.
- L'harness di misura è in `<SCRATCH>/qa/probe.py`, dove `<SCRATCH>` è `C:\Users\dotat\AppData\Local\Temp\claude\C--Users-dotat-Desktop-Saas-JOBS\8fac4de4-be73-46fb-8abb-ae6d1688435c\scratchpad`. Invocarlo con `MSYS_NO_PATHCONV=1` sotto Git Bash, altrimenti gli argomenti URL vengono corrotti.
- Le page test di questo repo camminano l'albero React restituito e ricorrono solo dentro `props.children`. Stringhe e campi testati devono essere figli JSX diretti in `page.tsx`, non props di un componente figlio. Chiamare un componente come funzione, `{JobCard({ job })}`, ne mette l'output in quell'albero.
- I percorsi contengono spazi: sempre tra virgolette.
- Comandi di verifica dal repo: `cd "C:/Users/dotat/Desktop/Saas JOBS/apps/web" && pnpm test` e `pnpm typecheck`.

---

## Task 1: La località non deve più essere tagliata a metà parola

Corrisponde a **H2** del report.

**Files:**
- Modify: `apps/web/app/styles/nodework.css:424-428`
- Test: `apps/web/app/_components/job-board.test.tsx`

**Interfaces:**
- Consumes: —
- Produces: nulla — fix CSS interno, nessun cambiamento di API o markup.

- [ ] **Step 1: Riprodurre il difetto e registrare il numero di partenza**

```bash
cd "<SCRATCH>/qa" && MSYS_NO_PATHCONV=1 python probe.py out 1 --only "/jobs"
```

Leggere `out/batch1.json` e annotare `clipped_text_count` per la riga `desktop`. È il valore che dovrà scendere.

- [ ] **Step 2: Applicare la correzione**

Il problema non è che manchi `text-overflow: ellipsis` — c'è già, su `.board-col-loc` in `board.css:133-138`. Il problema è che il suo unico figlio è un `inline-flex`, cioè un box atomico dentro il quale l'ellissi del genitore non può essere disegnata.

In `apps/web/app/styles/nodework.css`, sostituire:

```css
.board-loc {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
```

con:

```css
.board-loc {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.board-loc__pin {
  flex: none;
}
```

`min-width: 0` permette al flex item di restringersi sotto la larghezza del suo contenuto — senza, un flex item si rifiuta di scendere sotto `min-content` ed è la ragione per cui il taglio è netto. `flex: none` sul segnaposto impedisce che l'icona venga schiacciata invece del testo.

Non rimuovere `inline-flex`: sta allineando verticalmente l'icona con il testo.

- [ ] **Step 3: Verificare a occhio**

```bash
cd "<SCRATCH>/qa" && MSYS_NO_PATHCONV=1 python probe.py out 1 --only "/jobs"
```

Aprire `out/batch1-desktop-localhost-3001-jobs.png` con Read e cercare la colonna della località. Le voci lunghe devono ora finire con dei puntini di sospensione, non con una lettera tagliata a metà. Prima della correzione mostravano `New York, I` e `UT Salt Lak`.

- [ ] **Step 4: Verificare il numero**

`clipped_text_count` sulla riga desktop deve essere **inferiore** al valore dello Step 1. Non deve necessariamente andare a zero: altre celle possono legittimamente troncare con ellissi, e un'ellissi corretta conta comunque come testo troncato. Il criterio è la diminuzione più la conferma visiva dello Step 3.

Se il numero non scende, la correzione non ha avuto effetto: fermarsi e riportarlo invece di aggiungere altre regole CSS.

- [ ] **Step 5: Test di non regressione**

```bash
cd "C:/Users/dotat/Desktop/Saas JOBS/apps/web" && pnpm test && pnpm typecheck
```

Entrambi devono passare.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/dotat/Desktop/Saas JOBS"
git add apps/web/app/styles/nodework.css
git commit -m "fix(web): ellipsis instead of a hard cut on job location cells

The td carried text-overflow: ellipsis but its only child was an
inline-flex box, which is atomic at the inline level, so the parent's
ellipsis could never be drawn inside it and overflow: hidden simply
sliced the text mid-word.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01U6sYgooqFGL8V4yhabwg39"
```

---

## Task 2: I chip devono raggiungere il minimo tattile di 24px

Corrisponde a **M1** del report. Incluso benché Medium perché è una correzione di due proprietà che vale su ogni pagina del sito.

**Files:**
- Modify: `apps/web/app/globals.css:840-853`

**Interfaces:**
- Consumes: —
- Produces: nulla — fix CSS interno.

- [ ] **Step 1: Registrare il numero di partenza**

```bash
cd "<SCRATCH>/qa" && MSYS_NO_PATHCONV=1 python probe.py out 1 --only "/"
```

`small_tap_targets` sulla riga mobile contiene 8 voci: sette `a.chip` a 17px e un `button.visually-hidden` da 1×1. Quest'ultimo **non è un difetto** — è il pattern standard per screen reader — e resterà nell'elenco dopo la correzione. L'obiettivo è passare da 8 a 1.

- [ ] **Step 2: Applicare la correzione**

In `apps/web/app/globals.css`, nella regola `.chip`, sostituire `padding: 3px 8px;` con:

```css
  padding: 5px 10px;
  min-height: 24px;
```

Con `font-size: 0.66rem` il testo occupa circa 12,7px; `min-height: 24px` garantisce la soglia WCAG 2.2 SC 2.5.8 indipendentemente dal line-height ereditato, e il padding aumentato evita che il testo appaia schiacciato dentro il box più alto. `.chip` è già `inline-flex` con `align-items: center`, quindi il testo resta centrato verticalmente senza altre modifiche.

- [ ] **Step 3: Verificare il numero**

```bash
cd "<SCRATCH>/qa" && MSYS_NO_PATHCONV=1 python probe.py out 1 --only "/"
```

`small_tap_targets` deve contenere **una sola voce**, il `button.visually-hidden`. Nessuna voce `a.chip` deve restare. Se ne resta qualcuna, riportare l'altezza misurata invece di aumentare il padding a tentativi.

- [ ] **Step 4: Verificare che il layout non sia peggiorato**

Aprire `out/batch1-mobile-localhost-3001.png` con Read. I chip sono disposti in righe: verificare che l'altezza maggiorata non ne abbia mandati a capo in modo da rompere la griglia o da far crescere sensibilmente la pagina.

Controllare anche `overflow_px` sulla riga mobile: deve restare **0**. Chip più larghi che causassero overflow orizzontale sarebbero un difetto peggiore di quello corretto.

- [ ] **Step 5: Test di non regressione**

```bash
cd "C:/Users/dotat/Desktop/Saas JOBS/apps/web" && pnpm test && pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/dotat/Desktop/Saas JOBS"
git add apps/web/app/globals.css
git commit -m "fix(web): raise chip tap targets to the 24px WCAG minimum

Chips measured 17px tall on every page and every viewport, below
WCAG 2.2 SC 2.5.8.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01U6sYgooqFGL8V4yhabwg39"
```

---

## Task 3: Eliminare l'N+1 che rende lenta la home

Corrisponde a **H1** del report. È l'unico task che tocca il codice applicativo e va eseguito con più cura degli altri due.

**Files:**
- Modify: `apps/web/app/page.tsx:114-118`
- Modify: `apps/web/lib/jobs/queries.ts` (nuova funzione di caricamento in blocco)
- Test: `apps/web/app/page.test.tsx`

**Interfaces:**
- Consumes: `listJobs`, `loadJob` esistenti in `lib/jobs/queries.ts`.
- Produces: `getJobsForListItems(db, tenantId, jobs): Promise<(JobDetail | null)[]>` — restituisce i dettagli **nello stesso ordine** dell'array in ingresso, con `null` nelle posizioni non risolte. L'ordine è parte del contratto: `page.tsx` usa `jobDetails[0]` come annuncio selezionato.

- [ ] **Step 1: Misurare il punto di partenza**

```bash
for i in 1 2 3; do curl -s -o /dev/null -w "%{time_total}\n" http://localhost:3001/; done
```

Annotare la mediana. Riferimento dal report: 2,72s in dev, 2,13s in produzione.

- [ ] **Step 2: Contare le query effettive**

Prima di ottimizzare, confermare il numero. Aggiungere temporaneamente un contatore nel wrapper `db.prepare` oppure loggare in `loadJob`, caricare la home una volta, e registrare quante SELECT partono.

Atteso: circa 23 — una per il tenant, una o due per `listJobs`, una per `countHiringCompanies`, e **venti** per i dettagli. Se il numero reale è molto diverso, fermarsi e riportarlo: significa che la diagnosi del report è incompleta e il fix va ripensato.

Rimuovere la strumentazione prima di proseguire.

- [ ] **Step 3: Scrivere il test che fallisce**

Il test difende il contratto d'ordine, che è la parte facile da rompere in un caricamento in blocco.

```tsx
import { describe, expect, it } from "vitest";

describe("getJobsForListItems", () => {
  it("returns details in the same order as the input, with null for misses", async () => {
    const rows = [
      { external_id: "b", slug: "beta", title: "Beta" },
      { external_id: "a", slug: "alpha", title: "Alpha" },
    ];
    const db = {
      prepare: (sql: string) => ({
        bind: (..._args: unknown[]) => ({
          all: async () => ({ results: rows }),
          first: async () => rows[0],
        }),
      }),
    } as unknown as JobsDatabase;

    const out = await getJobsForListItems(db, "t", [
      { slug: "alpha", externalId: "a" },
      { slug: "missing", externalId: "zzz" },
      { slug: "beta", externalId: "b" },
    ]);

    expect(out.map((j) => j?.externalId ?? null)).toEqual(["a", null, "b"]);
  });
});
```

- [ ] **Step 4: Eseguire il test e verificarne il fallimento**

```bash
cd "C:/Users/dotat/Desktop/Saas JOBS/apps/web" && pnpm test -- page.test.tsx
```

Atteso: FAIL con `getJobsForListItems is not defined`.

- [ ] **Step 5: Implementare il caricamento in blocco**

In `apps/web/lib/jobs/queries.ts`, aggiungere una funzione che riusa la stessa SELECT di `loadJob` ma con una clausola `IN`, e che reindicizza i risultati sull'ordine richiesto:

```ts
export async function getJobsForListItems(
  db: JobsDatabase,
  tenantId: string,
  jobs: Pick<JobListItem, "slug" | "externalId">[],
): Promise<(JobDetail | null)[]> {
  const externalIds = jobs.map((j) => j.externalId).filter(Boolean) as string[];
  if (externalIds.length === 0) return jobs.map(() => null);

  const placeholders = externalIds.map(() => "?").join(", ");
  const rows = await loadJobs(db, tenantId, `j.external_id IN (${placeholders})`, externalIds);

  const byExternalId = new Map(rows.map((row) => [row.externalId, row]));
  return jobs.map((job) => (job.externalId ? byExternalId.get(job.externalId) ?? null : null));
}
```

`loadJobs` è la variante plurale di `loadJob`: stessa SELECT e stessa mappatura di riga, ma `.all()` invece di `.first()`. Estrarre la costruzione della query e la mappatura in modo che le due funzioni le condividano, invece di duplicare l'SQL — una SELECT copiata in due punti diverge alla prima modifica di schema.

- [ ] **Step 6: Usarla nella home**

In `apps/web/app/page.tsx`, sostituire le righe 114-118 con:

```tsx
  const [listed, companyCount] = await Promise.all([
    listJobs(db, tenantId, { pageSize: 20, page }),
    countHiringCompanies(db, tenantId),
  ]);
  const jobDetails = await getJobsForListItems(db, tenantId, listed.jobs);
```

Due cambiamenti, non uno: il caricamento in blocco sostituisce le venti query, e `listJobs` con `countHiringCompanies` passano da sequenziali a paralleli — erano già indipendenti.

- [ ] **Step 7: Eseguire il test e verificarne il successo**

```bash
cd "C:/Users/dotat/Desktop/Saas JOBS/apps/web" && pnpm test -- page.test.tsx
```

- [ ] **Step 8: Verificare che la pagina sia ancora corretta**

La home deve mostrare gli stessi venti annunci, nello stesso ordine, con lo stesso annuncio selezionato in evidenza, e gli stessi blocchi JSON-LD.

```bash
curl -s http://localhost:3001/ | grep -o 'JobPosting' | wc -l
```

Il conteggio deve essere identico a prima della modifica. Meno blocchi JSON-LD significa che alcuni annunci non sono stati risolti, ed è una regressione SEO silenziosa — il tipo di danno che non si vede guardando la pagina.

- [ ] **Step 9: Misurare il guadagno**

```bash
for i in 1 2 3; do curl -s -o /dev/null -w "%{time_total}\n" http://localhost:3001/; done
```

Confrontare con lo Step 1. Ci si attende una riduzione sostanziale se la diagnosi è corretta. **Se il tempo non scende, non insistere con altre ottimizzazioni**: significa che le venti query non erano il costo dominante, e la cosa giusta da fare è riportarlo, non continuare a modificare.

Nota: questa misura è in dev, quindi vale come confronto relativo prima/dopo, non come cifra assoluta. La verifica in produzione è lo Step 10.

- [ ] **Step 10: Confermare in produzione**

Solo dopo che i test passano, e mai mentre `next dev` gira sulla stessa app:

```bash
# fermare il dev server su 3001, poi:
cd "C:/Users/dotat/Desktop/Saas JOBS/apps/web"
pnpm exec next build --experimental-build-mode compile
pnpm exec next start -p 3002
# misurare, poi ripristinare:
# fermare 3002, rm -rf .next, riavviare next dev -p 3001
```

Confronto con il valore del report: **2,13s**. La modalità `compile` è necessaria perché la build completa con prerendering non passa contro il D1 locale (M2 del report).

- [ ] **Step 11: Test di non regressione completo**

```bash
cd "C:/Users/dotat/Desktop/Saas JOBS/apps/web" && pnpm test && pnpm typecheck
```

- [ ] **Step 12: Commit**

```bash
cd "C:/Users/dotat/Desktop/Saas JOBS"
git add apps/web/app/page.tsx apps/web/lib/jobs/queries.ts apps/web/app/page.test.tsx
git commit -m "perf(web): load job details in one query instead of twenty

The home page loaded a 20-job page and then issued one SELECT per job
to build the JobPosting JSON-LD, about 23 D1 round trips per request.
listJobs and countHiringCompanies also ran sequentially despite being
independent.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01U6sYgooqFGL8V4yhabwg39"
```

---

## Fuori dal perimetro di questo piano

- **M2, la build che non completa contro il D1 locale.** Va indagata contro il D1 reale di Cloudflare prima di decidere se sia un problema. Correggerla alla cieca sull'emulatore rischia di ottimizzare per un limite che in produzione non esiste.
- **Il troncamento eccessivo su due schede annuncio a mobile.** Non riprodotto. Va prima riprodotto.
- **L'area account.** Richiede un ambiente con `BETTER_AUTH_SECRET` configurato; nessun fix è possibile senza prima poterla testare.
- **Le altre cinque route lente.** Se il Task 3 conferma che l'N+1 era la causa, quasi certamente condividono lo stesso pattern e vanno affrontate con lo stesso rimedio — ma dopo aver verificato che il rimedio funziona sulla home.
