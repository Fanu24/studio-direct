# Frontend QA (funzionale + grafico + performance) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Misurare tutte le 59 route template di `apps/web` su tre viewport, produrre un report di bug verificati e ordinati per severità, e correggere i confermati critical/high.

**Architecture:** Un responsabile (Opus, la sessione principale) orchestra. La misura è delegata a sub-agenti economici (Haiku) che eseguono uno script deterministico e riportano JSON grezzo — non giudicano. Il giudizio visivo, che uno script non può dare, va a sub-agenti Sonnet che guardano gli screenshot. Il responsabile deduplica, riproduce ogni candidato bug su processo pulito, e solo allora scrive il report e applica i fix.

**Tech Stack:** Next.js 15 (App Router) su OpenNext/Cloudflare, React 19, D1 locale via `.wrangler/state`, vitest, Chrome headless guidato via DevTools Protocol da Python (`websocket-client`).

**Spec:** nessun documento separato — questo piano è stato approvato in chat sul percorso *bounded* del brainstorming. La sezione "Global Constraints" qui sotto contiene tutti i vincoli che sarebbero stati nella spec.

## Global Constraints

Ogni task eredita implicitamente questi vincoli. Sono lezioni già pagate su questo progetto: ignorarne uno produce un report sbagliato con sicurezza.

- **Dev server pulito prima di misurare.** Un `next dev` lasciato girare per ore sotto edit concorrenti degrada: in una sessione precedente il menu mobile risultava morto a cinque controlli indipendenti e funzionava dopo un semplice riavvio, senza modifiche al codice. Nessuna interazione va riportata come rotta senza aver ri-testato su processo appena avviato.
- **Mai `next build` mentre `next dev` gira sulla stessa app.** La build sovrascrive `.next` e il dev server inizia a servire pagine senza CSS. Recupero: stop dev, `rm -rf .next`, riavvia. Il confronto con la build di produzione (Task 7) va fatto su una copia separata dell'albero.
- **Uno screenshot a `--window-size=390` ritaglia, non rifluisce.** Sembra identico a un layout mobile rotto. Solo `Emulation.setDeviceMetricsOverride` via CDP impagina davvero a quella larghezza. L'overflow si giudica da `documentElement.scrollWidth - innerWidth`, mai da un'immagine.
- **Un elemento oltre il bordo destro non è un difetto se un antenato lo taglia o lo scrolla** (una track di carosello è il caso ovvio). Attribuire overflow per-elemento solo quando la pagina stessa overflowa.
- **React aggiorna il DOM in modo asincrono.** Leggere `aria-expanded` nello stesso turno JS del `.click()` restituisce sempre il valore vecchio e fa passare per morto un controllo funzionante. Attendere ~350ms prima di rileggere.
- **`grep -c` conta le RIGHE.** L'HTML di Next.js è una riga sola, quindi sottostima in modo grossolano. Usare `grep -o pattern | wc -l`.
- **Screenshot con `--virtual-time-budget=20000`.** Con budget più bassi le transizioni scroll-reveal vengono catturate a metà e le sezioni sembrano sbiadite. I "theaters" CSS si mettono in pausa fuori schermo: parcheggiare il viewport sulla sezione prima di catturare.
- **Base URL: `http://localhost:3001`.** Il dev server è già attivo su quella porta.
- **Path assoluti con spazi.** La working directory è `C:\Users\dotat\Desktop\Saas JOBS` — sempre tra virgolette nei comandi.
- **Scratchpad di sessione per tutti gli artefatti temporanei:** `C:\Users\dotat\AppData\Local\Temp\claude\C--Users-dotat-Desktop-Saas-JOBS\8fac4de4-be73-46fb-8abb-ae6d1688435c\scratchpad`. In questo piano abbreviato `$SCRATCH`. Script e JSON di misura NON vanno committati.
- **Modelli:** misura → `haiku`; giudizio visivo → `sonnet`; triage, riproduzione e fix → il responsabile (Opus). Nessun sub-agente applica fix.
- **Severità:** un finding entra nel report solo se il responsabile lo ha riprodotto a mano su dev server pulito. Rubrica in Task 8.

---

## File Structure

**Artefatti temporanei (non committati), in `$SCRATCH/qa/`:**

| File | Responsabilità |
|---|---|
| `manifest.json` | Le 59 route template mappate su URL reali, con il tipo di controllo atteso per ciascuna. Unica fonte di verità sul perimetro. |
| `probe.py` | Harness CDP: apre Chrome, per ogni URL × device misura layout/overflow/tap target/console/link/performance e scrive JSON + screenshot. Adattato da `device_qa.py` esistente. |
| `selftest.py` | Fixture HTML con difetti noti + asserzioni che `probe.py` li rilevi. Impedisce che un harness rotto produca "zero bug". |
| `out/<batch>.json` | Output grezzo di ogni batch di misura. |
| `out/*.png` | Screenshot, `<batch>-<device>-<slug>.png`. |
| `perf-compare.json` | Tempi dev vs build di produzione sulle route lente. |

**Artefatti committati:**

| File | Responsabilità |
|---|---|
| `docs/qa/2026-09-09-frontend-qa-report.md` | Il report: findings verificati, ordinati per severità, con evidenza numerica e file sospetto. |
| `docs/superpowers/plans/2026-09-09-frontend-qa-fixes.md` | Il piano dei fix, generato in Task 9 una volta noti i findings. |
| `apps/web/app/**`, `apps/web/app/globals.css`, `apps/web/app/_components/**` | I file toccati dai fix. Quali, lo dicono i findings. |

**Perché i fix non sono task concreti in questo piano.** Non si possono scrivere passi TDD per correggere bug che non sono ancora stati misurati; inventarli adesso sarebbe fingere. Questo piano arriva fino al report verificato e produce, come suo ultimo deliverable, un secondo piano di fix con task reali. Task 9 contiene la rubrica di severità e il template esatto che ogni task di fix dovrà seguire, quindi l'handoff è definito, non rimandato.

---

## Task 1: Baseline pulita e manifest delle route

**Files:**
- Create: `$SCRATCH/qa/manifest.json`

**Interfaces:**
- Produces: `manifest.json` — array di oggetti `{ "route": string, "url": string, "kind": "render" | "redirect" | "auth", "expect": number, "batch": int }`. Ogni task successivo legge questo file e nient'altro per sapere cosa controllare.

- [ ] **Step 1: Riavviare il dev server su processo pulito**

Il server attuale gira da ore. Prima di qualsiasi misura va riavviato, altrimenti i risultati non sono attendibili (vedi Global Constraints).

```bash
# Trova e termina il processo su :3001
netstat -ano | grep ":3001" | grep LISTENING
# taskkill //PID <pid> //F   con il PID trovato
cd "C:/Users/dotat/Desktop/Saas JOBS/apps/web" && pnpm exec next dev -p 3001
```

Avviare in background. Attendere che risponda prima di proseguire.

- [ ] **Step 2: Verificare che il server risponda su processo nuovo**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/
```

Atteso: `200`. La prima richiesta dopo il riavvio include la compilazione: ignorare il suo tempo, non è un dato di performance.

- [ ] **Step 3: Scrivere il manifest**

Contenuto esatto. Le 45 route statiche hanno URL diretti; le 14 dinamiche sono mappate su istanze reali già verificate contro il DB locale. `expect` è lo status HTTP osservato oggi: uno scostamento è di per sé un finding.

```json
[
  {"route":"/","url":"/","kind":"render","expect":200,"batch":1},
  {"route":"/about","url":"/about","kind":"render","expect":200,"batch":1},
  {"route":"/ads","url":"/ads","kind":"render","expect":200,"batch":1},
  {"route":"/crypto-events","url":"/crypto-events","kind":"render","expect":200,"batch":1},
  {"route":"/faq","url":"/faq","kind":"render","expect":200,"batch":1},
  {"route":"/hire","url":"/hire","kind":"render","expect":200,"batch":1},
  {"route":"/jobs","url":"/jobs","kind":"render","expect":200,"batch":1},
  {"route":"/learn-web3","url":"/learn-web3","kind":"render","expect":200,"batch":1},
  {"route":"/legal","url":"/legal","kind":"render","expect":200,"batch":1},
  {"route":"/login","url":"/login","kind":"render","expect":200,"batch":1},

  {"route":"/pricing","url":"/pricing","kind":"render","expect":200,"batch":2},
  {"route":"/privacy","url":"/privacy","kind":"render","expect":200,"batch":2},
  {"route":"/roles","url":"/roles","kind":"render","expect":200,"batch":2},
  {"route":"/terms","url":"/terms","kind":"render","expect":200,"batch":2},
  {"route":"/what-is-web3","url":"/what-is-web3","kind":"render","expect":200,"batch":2},
  {"route":"/web3-cities","url":"/web3-cities","kind":"render","expect":200,"batch":2},
  {"route":"/web3-companies","url":"/web3-companies","kind":"render","expect":200,"batch":2},
  {"route":"/web3-companies/top-growing","url":"/web3-companies/top-growing","kind":"render","expect":200,"batch":2},
  {"route":"/web3-jobs-api","url":"/web3-jobs-api","kind":"render","expect":200,"batch":2},
  {"route":"/post-web3-job","url":"/post-web3-job","kind":"render","expect":200,"batch":2},

  {"route":"/post-web3-job/bundle","url":"/post-web3-job/bundle","kind":"render","expect":200,"batch":3},
  {"route":"/web3-salaries","url":"/web3-salaries","kind":"render","expect":200,"batch":3},
  {"route":"/web3-salaries/solana-vs-ethereum","url":"/web3-salaries/solana-vs-ethereum","kind":"render","expect":200,"batch":3},
  {"route":"/web3-non-tech-salaries","url":"/web3-non-tech-salaries","kind":"render","expect":200,"batch":3},
  {"route":"/entry-designer-jobs","url":"/entry-designer-jobs","kind":"render","expect":200,"batch":3},
  {"route":"/entry-developer-jobs","url":"/entry-developer-jobs","kind":"render","expect":200,"batch":3},
  {"route":"/entry-non-tech-jobs","url":"/entry-non-tech-jobs","kind":"render","expect":200,"batch":3},
  {"route":"/highest-paid-designers-jobs","url":"/highest-paid-designers-jobs","kind":"render","expect":200,"batch":3},
  {"route":"/highest-paid-developer-jobs","url":"/highest-paid-developer-jobs","kind":"render","expect":200,"batch":3},
  {"route":"/highest-paid-non-tech-jobs","url":"/highest-paid-non-tech-jobs","kind":"render","expect":200,"batch":3},

  {"route":"/highest-paying-web3-jobs","url":"/highest-paying-web3-jobs","kind":"render","expect":200,"batch":4},
  {"route":"/most-popular-designers-jobs","url":"/most-popular-designers-jobs","kind":"render","expect":200,"batch":4},
  {"route":"/most-popular-developer-jobs","url":"/most-popular-developer-jobs","kind":"render","expect":200,"batch":4},
  {"route":"/most-popular-non-tech-jobs","url":"/most-popular-non-tech-jobs","kind":"render","expect":200,"batch":4},
  {"route":"/top-web3-internships","url":"/top-web3-internships","kind":"render","expect":200,"batch":4},
  {"route":"/top-web3-jobs","url":"/top-web3-jobs","kind":"render","expect":200,"batch":4},
  {"route":"/[slug]","url":"/remote-jobs","kind":"render","expect":200,"batch":4},
  {"route":"/[slug] (alt)","url":"/solidity-jobs","kind":"render","expect":200,"batch":4},
  {"route":"/learn-web3/[category]","url":"/learn-web3/article","kind":"render","expect":200,"batch":4},
  {"route":"/hire/[skill]","url":"/hire/ai","kind":"render","expect":200,"batch":4},

  {"route":"/hire/[skill]/[location]","url":"/hire/ai/london","kind":"render","expect":200,"batch":5},
  {"route":"/web3-companies/[slug]","url":"/web3-companies/1inch","kind":"render","expect":200,"batch":5},
  {"route":"/web3-companies/tag/[tag]","url":"/web3-companies/tag/ai","kind":"render","expect":200,"batch":5},
  {"route":"/web3-salaries/[slug]","url":"/web3-salaries/backend-developer","kind":"render","expect":200,"batch":5},
  {"route":"/web3-non-tech-salaries/[slug]","url":"/web3-non-tech-salaries/marketing","kind":"render","expect":200,"batch":5},
  {"route":"/[slug]/[id]","url":"/backend-engineer-blockchain-assistant-vice-president-icapital/153705","kind":"render","expect":200,"batch":5},
  {"route":"/[slug]/[id]/apply","url":"/backend-engineer-blockchain-assistant-vice-president-icapital/153705/apply","kind":"render","expect":200,"batch":5},
  {"route":"/jobs/[slug]/apply","url":"/jobs/backend-engineer-blockchain-assistant-vice-president-icapital/apply","kind":"render","expect":200,"batch":5},

  {"route":"/companies","url":"/companies","kind":"redirect","expect":308,"batch":6},
  {"route":"/companies/[slug]","url":"/companies/1inch","kind":"redirect","expect":308,"batch":6},
  {"route":"/skills/[slug]","url":"/skills/solidity","kind":"redirect","expect":307,"batch":6},
  {"route":"/hidden-jobs","url":"/hidden-jobs","kind":"redirect","expect":308,"batch":6},
  {"route":"/highest-paid-developers-jobs","url":"/highest-paid-developers-jobs","kind":"redirect","expect":308,"batch":6},
  {"route":"/most-popular-designer-jobs","url":"/most-popular-designer-jobs","kind":"redirect","expect":308,"batch":6},
  {"route":"/top-growing-web3-companies","url":"/top-growing-web3-companies","kind":"redirect","expect":308,"batch":6},
  {"route":"/jobs/[slug]","url":"/jobs/backend-engineer-blockchain-assistant-vice-president-icapital","kind":"redirect","expect":404,"batch":6},
  {"route":"/dashboard","url":"/dashboard","kind":"auth","expect":307,"batch":6},
  {"route":"/profile","url":"/profile","kind":"auth","expect":307,"batch":6},
  {"route":"/settings","url":"/settings","kind":"auth","expect":307,"batch":6},
  {"route":"/onboarding","url":"/onboarding","kind":"auth","expect":307,"batch":6}
]
```

- [ ] **Step 4: Verificare che il manifest copra tutte le route template**

```bash
cd "C:/Users/dotat/Desktop/Saas JOBS"
find apps/web/app -name "page.tsx" | wc -l
python -c "import json;d=json.load(open(r'$SCRATCH/qa/manifest.json'));print(len(d))"
```

Atteso: `59` dal `find`, `60` dal manifest (una route in più perché `/[slug]` compare due volte, con due istanze diverse, per distinguere un hub geografico da uno per skill). Qualsiasi altro scarto significa che una route template è scoperta: trovarla e aggiungerla prima di proseguire.

- [ ] **Step 5: Commit**

Il manifest vive nello scratchpad e non si committa. Nessun commit in questo task.

---

## Task 2: Harness di misura

**Files:**
- Create: `$SCRATCH/qa/probe.py` (copia adattata di `C:\Users\dotat\AppData\Local\Temp\claude\C--Users-dotat-Desktop-Saas-JOBS\5b3eba47-35c1-411f-b3cb-acc46ad2a81f\scratchpad\device_qa.py`, 417 righe)

**Interfaces:**
- Consumes: `manifest.json` di Task 1.
- Produces: eseguibile come `python probe.py <out_dir> <batch_number>`. Scrive `<out_dir>/batch<N>.json` con, per ogni URL × device, un oggetto:
  `{ url, device, status, redirect_url, overflow_px, offenders[], clipped_text_count, small_tap_targets[], console_errors[], broken_links[], broken_images[], animation_count, reduced_motion_ok, ttfb_ms, dom_nodes, transfer_bytes, largest_resources[], screenshot }`

- [ ] **Step 1: Copiare l'harness esistente**

`device_qa.py` già implementa la parte difficile e già corretta: avvio di Chrome, connessione CDP, `Emulation.setDeviceMetricsOverride` con i tre device, la logica di overflow che esclude gli elementi tagliati da un antenato, il conteggio del testo troncato, i tap target e gli screenshot. Va riusato, non riscritto.

```bash
mkdir -p "$SCRATCH/qa/out"
cp "C:/Users/dotat/AppData/Local/Temp/claude/C--Users-dotat-Desktop-Saas-JOBS/5b3eba47-35c1-411f-b3cb-acc46ad2a81f/scratchpad/device_qa.py" "$SCRATCH/qa/probe.py"
```

- [ ] **Step 2: Verificare che la dipendenza `websocket-client` sia disponibile**

```bash
python -c "import websocket; print(websocket.__version__)"
```

Se fallisce: `pip install websocket-client`.

- [ ] **Step 3: Aggiungere la lettura del manifest**

Sostituire il parsing degli URL da riga di comando con la lettura del manifest filtrata per batch, così i sub-agenti non passano URL a mano e non possono sbagliare perimetro.

```python
def load_batch(manifest_path, batch):
    with open(manifest_path, encoding="utf-8") as fh:
        entries = json.load(fh)
    return [e for e in entries if e["batch"] == batch]
```

- [ ] **Step 4: Aggiungere la misura di status e redirect**

Va misurato senza seguire il redirect, altrimenti un 308 diventa invisibile.

```python
def http_status(url):
    req = urllib.request.Request(url, method="GET")
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    opener = urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(url, timeout=30) as resp:
            return resp.status, resp.headers.get("Location")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.headers.get("Location")
```

- [ ] **Step 5: Aggiungere le metriche di performance al PROBE**

Da inserire nell'oggetto restituito dallo snippet `PROBE` già presente nel file.

```javascript
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const res = performance.getEntriesByType('resource');
  const perf = {
    ttfb_ms: Math.round(nav.responseStart || 0),
    dom_content_loaded_ms: Math.round(nav.domContentLoadedEventEnd || 0),
    load_ms: Math.round(nav.loadEventEnd || 0),
    dom_nodes: document.getElementsByTagName('*').length,
    transfer_bytes: res.reduce((sum, r) => sum + (r.transferSize || 0), 0),
    largest_resources: res
      .map(r => ({ name: r.name.slice(-80), bytes: r.transferSize || 0, ms: Math.round(r.duration) }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8),
  };
```

- [ ] **Step 6: Aggiungere il rilevamento di link e immagini rotti**

Solo link interni: quelli esterni dipendono dalla rete e produrrebbero falsi positivi.

```javascript
  const links = Array.from(document.querySelectorAll('a[href^="/"]'))
    .map(a => a.getAttribute('href'))
    .filter(h => h && !h.startsWith('/_next/'));
  const internal_links = Array.from(new Set(links));
  const broken_images = Array.from(document.images)
    .filter(img => img.complete && img.naturalWidth === 0)
    .map(img => img.currentSrc || img.src);
```

Il controllo dello status dei link interni si fa lato Python, deduplicando su tutto il batch così lo stesso link di navigazione non viene richiesto sessanta volte:

```python
def check_links(base, hrefs, cache):
    broken = []
    for href in hrefs:
        if href in cache:
            status = cache[href]
        else:
            status, _ = http_status(base.rstrip("/") + href)
            cache[href] = status
        if status >= 400:
            broken.append({"href": href, "status": status})
    return broken
```

- [ ] **Step 7: Appiattire le metriche di performance nell'oggetto di primo livello**

Lo snippet dello Step 5 restituisce le metriche annidate sotto `perf`, ma l'interfaccia dichiarata da questo task le vuole al primo livello, ed è quella che leggono Task 4 e Task 8. Unire lato Python subito dopo aver ricevuto il risultato del PROBE:

```python
def flatten(result):
    perf = result.pop("perf", {})
    result.update(perf)
    return result
```

- [ ] **Step 8: Aggiungere la cattura degli errori di console**

`Runtime.enable` e `Log.enable` vanno inviati sulla sessione CDP *prima* della navigazione, altrimenti gli errori emessi durante il primo render non vengono mai consegnati.

```python
def collect_console(ws, errors):
    """Chiamare su ogni messaggio CDP ricevuto durante la navigazione."""
    method = msg.get("method")
    if method == "Runtime.exceptionThrown":
        detail = msg["params"]["exceptionDetails"]
        text = detail.get("exception", {}).get("description") or detail.get("text", "")
        errors.append({"kind": "exception", "text": text[:300]})
    elif method == "Runtime.consoleAPICalled" and msg["params"]["type"] == "error":
        parts = [a.get("value", a.get("description", "")) for a in msg["params"]["args"]]
        errors.append({"kind": "console.error", "text": " ".join(map(str, parts))[:300]})
```

Da distinguere in fase di triage: un errore di rete su una risorsa esterna non è un bug del frontend, un `TypeError` di React sì.

- [ ] **Step 9: Eseguire su una singola URL nota e ispezionare l'output**

```bash
cd "$SCRATCH/qa" && python probe.py out 1 --only "/about"
```

Atteso: un JSON con tutti i campi dell'interfaccia popolati, `status: 200`, e uno screenshot per device. Se un campo è `null` o assente, l'harness non è pronto — nessun batch va lanciato finché non lo è.

---

## Task 3: Self-test dell'harness

**Files:**
- Create: `$SCRATCH/qa/selftest.py`, `$SCRATCH/qa/fixture.html`

**Interfaces:**
- Consumes: `probe.py` di Task 2.
- Produces: exit code 0 se l'harness rileva i difetti piantati apposta.
- Richiede un flag aggiuntivo `--url <url>` su `probe.py`, che misura un singolo URL arbitrario e scrive `<out_dir>/<slug>.json`, saltando il manifest. Aggiungerlo in questo task: la fixture non è una route del sito e non può stare nel manifest.

Un harness che non misura niente riporta zero bug, ed è indistinguibile da un sito perfetto. Questo task rende quella differenza visibile prima di spendere sei agenti.

- [ ] **Step 1: Scrivere la fixture con difetti noti**

```html
<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0">
  <div style="width:900px;height:40px;background:#c00">overflow voluto a 390px</div>
  <button style="width:16px;height:16px">x</button>
  <img src="/does-not-exist.png" alt="rotta">
  <script>console.error("errore piantato");</script>
</body></html>
```

Difetti attesi: overflow orizzontale su mobile (900px in 390px), un tap target 16×16 sotto la soglia di 24px, un'immagine rotta, un errore di console.

- [ ] **Step 2: Scrivere le asserzioni**

La fixture va servita via HTTP, non aperta come `file://`: un file locale non ha né status HTTP né gli stessi vincoli di caricamento risorse, e misurarlo non direbbe nulla su come si comporta l'harness sul sito vero.

```python
import functools, http.server, json, socketserver, subprocess, sys, threading

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=".")
server = socketserver.TCPServer(("127.0.0.1", 3099), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()

subprocess.run([sys.executable, "probe.py", "out", "--url", "http://127.0.0.1:3099/fixture.html"], check=True)
server.shutdown()

data = json.load(open("out/fixture.json", encoding="utf-8"))
mobile = next(d for d in data if d["device"] == "mobile")

assert mobile["overflow_px"] > 400, f"overflow non rilevato: {mobile['overflow_px']}"
assert mobile["small_tap_targets"], "tap target piccolo non rilevato"
assert mobile["broken_images"], "immagine rotta non rilevata"
assert mobile["console_errors"], "errore di console non catturato"
print("selftest OK")
```

- [ ] **Step 3: Eseguire il self-test e verificare che fallisca se si disattiva una misura**

```bash
cd "$SCRATCH/qa" && python selftest.py
```

Nota: `broken_images` nella fixture richiede che l'immagine `/does-not-exist.png` sia servita dallo stesso server locale, che restituirà 404 — è esattamente la condizione che rende `img.naturalWidth === 0`.

Atteso: `selftest OK`. Per confermare che le asserzioni mordano davvero, commentare temporaneamente il calcolo di `overflow` nel PROBE e rilanciare: deve fallire con `overflow non rilevato`. Ripristinare subito.

---

## Task 4: Misura fan-out (6 sub-agenti Haiku)

**Files:**
- Create: `$SCRATCH/qa/out/batch1.json` … `batch6.json`

**Interfaces:**
- Consumes: `manifest.json`, `probe.py`.
- Produces: sei file JSON conformi all'interfaccia di Task 2.

- [ ] **Step 1: Lanciare i sei agenti in un unico messaggio**

Sei chiamate `Agent` nello stesso blocco, `subagent_type: "general-purpose"`, `model: "haiku"`. Prompt identico per ciascuno salvo il numero di batch:

> Esegui questo comando esatto e nient'altro:
> `cd "<SCRATCH>/qa" && python probe.py out <N>`
> Poi leggi `out/batch<N>.json` e riporta: (a) il path del file, (b) per ogni URL con `status` diverso da `expect`, la coppia attesa/osservata, (c) per ogni URL con `overflow_px > 1`, il valore e i primi tre `offenders`, (d) tutti i `console_errors`, `broken_links`, `broken_images`, (e) i tre URL con `ttfb_ms` più alto e il loro valore.
> Riporta NUMERI, non giudizi. Non definire nulla "grave", "rotto" o "critico" — non è il tuo compito e non hai il contesto per farlo. Non modificare alcun file del progetto. Se lo script fallisce, riporta lo stderr integrale e fermati.

L'istruzione di non giudicare non è cortesia: un modello economico che qualifica la severità produce rumore che il responsabile deve poi smontare, e costa più di quanto faccia risparmiare.

- [ ] **Step 2: Verificare che tutti e sei i batch abbiano prodotto output**

```bash
ls -la "$SCRATCH/qa/out/"*.json
python -c "
import json,glob
tot=0
for f in sorted(glob.glob(r'$SCRATCH/qa/out/batch*.json')):
    d=json.load(open(f,encoding='utf-8')); tot+=len(d); print(f, len(d))
print('righe totali:', tot)
"
```

Atteso: 6 file, e un totale di 60 URL × 3 device = 180 righe. Un batch mancante o corto va rilanciato, non stimato.

---

## Task 5: Sessione autenticata per l'area account

**Files:**
- Modify: `$SCRATCH/qa/manifest.json` (le 4 righe `kind: "auth"` passano a `kind: "render"` con il cookie di sessione)

**Interfaces:**
- Consumes: D1 locale in `apps/web/.wrangler/state/v3/d1`.
- Produces: un cookie di sessione riusabile da `probe.py` via `Network.setCookie`.

Le route `/dashboard`, `/profile`, `/settings`, `/onboarding` rispondono 307 verso `/login` da sloggati. Senza sessione, il QA dell'area account non copre nulla.

- [ ] **Step 1: Ispezionare lo schema delle sessioni di better-auth nel D1 locale**

```bash
cd "C:/Users/dotat/Desktop/Saas JOBS/apps/web"
pnpm exec wrangler d1 execute gaming-jobs --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('user','session','account');"
pnpm exec wrangler d1 execute gaming-jobs --local --command "SELECT sql FROM sqlite_master WHERE name='session';"
```

- [ ] **Step 2: Creare utente e sessione di test**

I nomi esatti delle colonne vengono dallo Step 1; better-auth usa `session(id, token, userId, expiresAt)` e `user(id, email, name, emailVerified)`. Adattare se lo schema differisce.

```sql
INSERT INTO user (id, email, name, emailVerified, createdAt, updatedAt)
VALUES ('qa-user', 'qa@example.test', 'QA User', 1, unixepoch(), unixepoch());
INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt)
VALUES ('qa-session', 'qa-token-2026', 'qa-user', unixepoch() + 86400, unixepoch(), unixepoch());
```

Usare `INSERT` semplice, non `INSERT OR IGNORE`: quest'ultimo nasconde i fallimenti su NOT NULL e lascia credere che l'inserimento sia riuscito.

- [ ] **Step 3: Verificare che il cookie apra le pagine**

Il nome del cookie va letto dalla config di better-auth (tipicamente `better-auth.session_token`).

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: better-auth.session_token=qa-token-2026" http://localhost:3001/dashboard
```

Atteso: `200`. Se resta `307`, il token non è valido: rileggere lo schema e correggere l'insert prima di proseguire.

- [ ] **Step 4: Misurare le 4 route autenticate**

Aggiungere a `probe.py` un flag `--cookie` che invoca `Network.setCookie` prima della navigazione, e rilanciare il batch 6.

- [ ] **Step 5: Se lo Step 3 non riesce entro questi passi, dichiararlo**

L'area account entra nel report come **non coperta**, con la ragione. Un'area saltata in silenzio è peggio di un'area dichiarata scoperta: la seconda si può decidere di coprire dopo, la prima si crede testata.

---

## Task 6: Revisione visiva (3 sub-agenti Sonnet)

**Files:**
- Create: `$SCRATCH/qa/visual-<N>.md` (tre file, uno per agente)

**Interfaces:**
- Consumes: gli screenshot in `$SCRATCH/qa/out/*.png`.
- Produces: findings visivi in prosa, ciascuno con il file PNG di riferimento.

Uno script misura l'overflow ma non vede che una griglia è disallineata, che un titolo è illeggibile sul suo sfondo o che una sezione è rimasta vuota. Serve un occhio, e serve su un sottoinsieme: i ~15 template visivamente distinti, non tutte le 60 URL, perché le landing SEO condividono lo stesso layout con dati diversi.

- [ ] **Step 1: Selezionare i template distinti**

Home, jobs list, job detail, apply, companies list, company detail, company tag, salaries list, salary detail, non-tech salaries, hire list, hire location, learn, roles, login, pricing, hub `[slug]`. Diciassette PNG × 3 device = 51 immagini, ripartite in tre gruppi da 17.

- [ ] **Step 2: Lanciare i tre agenti in un unico messaggio**

`subagent_type: "general-purpose"`, `model: "sonnet"`. Prompt:

> Guarda questi screenshot con lo strumento Read: `<lista di 17 path PNG>`. Sono catture reali del sito a 390px, 768px e 1440px.
> Per ciascuno riporta solo difetti grafici che vedi nell'immagine: testo illeggibile o sovrapposto, elementi disallineati rispetto alla griglia della pagina, sezioni vuote o a metà, immagini mancanti, contrasto insufficiente, spaziature palesemente incoerenti con il resto della pagina, elementi tagliati dal bordo.
> Per ogni difetto: nome del file, dove si trova nella pagina, cosa vedi. Se una pagina ti sembra a posto, dillo in una riga e passa oltre — non inventare difetti per avere qualcosa da riportare.
> Non misurare nulla e non dedurre cause dal codice: non hai accesso al DOM e non devi aprirlo. Non modificare alcun file.

- [ ] **Step 3: Verificare la resa degli screenshot prima di fidarsi dei findings**

Aprire due PNG a caso con Read. Se le sezioni appaiono sbiadite o a metà transizione, il budget di virtual time era troppo basso e i findings visivi sono artefatti: rilanciare le catture con `--virtual-time-budget=20000` e ripetere lo Step 2.

---

## Task 7: Confronto dev contro build di produzione

**Files:**
- Create: `$SCRATCH/qa/perf-compare.json`

**Interfaces:**
- Consumes: le route più lente dai batch di Task 4.
- Produces: per ogni route lenta, `{ route, dev_ttfb_ms, prod_ttfb_ms, delta }`.

Le misure di oggi su dev mostrano `/` a 2.55s, `/web3-companies` a 2.21s, `/web3-salaries` a 2.37s, `/web3-non-tech-salaries` a 2.20s, `/web3-salaries/solana-vs-ethereum` a 2.08s, contro 0.10–0.13s delle pagine statiche. Sono tempi a compilazione già avvenuta, quindi non sono spiegabili come costo di primo accesso — ma `next dev` non ottimizza nulla, e senza questo confronto "il sito è lento" resta una sensazione, non una diagnosi.

- [ ] **Step 1: Copiare l'albero in una directory separata**

Obbligatorio: buildare nella stessa cartella mentre il dev server gira sovrascrive `.next` e rompe il server in corso (vedi Global Constraints).

```bash
cd "C:/Users/dotat/Desktop/Saas JOBS"
robocopy "apps\web" "$SCRATCH\prodbuild\web" /E /XD node_modules .next /NFL /NDL /NJH /NJS
```

- [ ] **Step 2: Installare le dipendenze e buildare**

```bash
cd "$SCRATCH/prodbuild/web" && pnpm install --ignore-workspace && pnpm exec next build
```

- [ ] **Step 3: Avviare la build su una porta diversa**

```bash
cd "$SCRATCH/prodbuild/web" && pnpm exec next start -p 3002
```

Porta 3002 per non toccare il dev server su 3001.

- [ ] **Step 4: Misurare le stesse route su entrambe le porte**

```bash
for u in / /web3-companies /web3-salaries /web3-non-tech-salaries /web3-salaries/solana-vs-ethereum /highest-paying-web3-jobs /jobs; do
  d=$(curl -s -o /dev/null -w '%{time_total}' "http://localhost:3001$u")
  p=$(curl -s -o /dev/null -w '%{time_total}' "http://localhost:3002$u")
  echo "$u dev=$d prod=$p"
done
```

Per ciascuna route, tre misure e si tiene la mediana: una misura singola su Windows oscilla abbastanza da invertire una conclusione.

- [ ] **Step 5: Trarre la conclusione esplicitamente**

Se prod scende sotto i 300ms, la lentezza è del dev server e non c'è nulla da correggere nel codice: va scritto nel report in questi termini. Se prod resta sopra il secondo, il collo di bottiglia è reale e va cercato nelle query D1 di quelle pagine — le cinque route lente sono tutte pagine con aggregazioni su salari e aziende, il che è già un indizio.

---

## Task 8: Triage, riproduzione e report

**Files:**
- Create: `docs/qa/2026-09-09-frontend-qa-report.md`

**Interfaces:**
- Consumes: i sei `batch*.json`, i tre `visual-*.md`, `perf-compare.json`.
- Produces: il report, unico input del piano di fix.

- [ ] **Step 1: Deduplicare**

Lo stesso difetto in header o footer compare su tutte e 60 le pagine. Va raggruppato per componente sorgente, non per URL, altrimenti un bug diventa sessanta findings e il report è illeggibile. I componenti condivisi stanno in `apps/web/app/_components/` — `site-chrome.tsx`, `nav-links.tsx`, `mobile-menu.tsx`, `footer-data.ts` sono i sospetti tipici.

- [ ] **Step 2: Riprodurre ogni candidato a mano**

Questo passo non è opzionale ed è il motivo per cui il triage non è delegato. Per ciascun candidato: aprire l'URL sul dev server appena riavviato, riprodurre la condizione, e annotare il numero osservato. Un candidato non riproducibile non entra nel report come bug — entra come "non riprodotto", con la misura originale allegata.

Nella sessione precedente tre findings "critici" erano artefatti di stato HMR stantio o della misura stessa. La percentuale attesa di falsi positivi non è zero.

- [ ] **Step 3: Assegnare la severità con questa rubrica**

| Severità | Criterio |
|---|---|
| **Critical** | La pagina non renderizza, restituisce 5xx, un'eccezione JS blocca l'interazione, il contenuto principale è invisibile, o c'è overflow orizzontale su mobile su home / jobs / job detail. |
| **High** | Link o immagine rotta, errore di console riproducibile, tap target sotto 24px su una CTA primaria, overflow su una pagina secondaria, TTFB sopra 1s sulla build di produzione. |
| **Medium** | Disallineamento cosmetico, contrasto sotto WCAG AA, animazione a scatti, `prefers-reduced-motion` non rispettato. |
| **Low** | Nit estetici, spaziature discutibili ma coerenti. |

- [ ] **Step 4: Scrivere il report**

Una sezione per severità, decrescente. Ogni finding: titolo, route colpite, evidenza numerica o PNG, file sospetto con riga se identificabile, e come è stato riprodotto. In coda: le aree non coperte e i candidati non riprodotti, con la ragione.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/dotat/Desktop/Saas JOBS"
git add docs/qa/2026-09-09-frontend-qa-report.md
git commit -m "docs(qa): frontend QA report across 59 route templates

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01U6sYgooqFGL8V4yhabwg39"
```

---

## Task 9: Piano dei fix

**Files:**
- Create: `docs/superpowers/plans/2026-09-09-frontend-qa-fixes.md`

**Interfaces:**
- Consumes: il report di Task 8.
- Produces: un piano eseguibile con un task per ogni cluster di findings critical/high.

- [ ] **Step 1: Selezionare i findings da correggere**

Solo Critical e High confermati. Medium e Low restano nel report con la diagnosi e non si toccano senza un ok esplicito: allargare il perimetro dei fix in autonomia è come non averlo mai concordato.

- [ ] **Step 2: Raggruppare per file toccato**

Due findings che vivono nello stesso componente sono un task solo — altrimenti il secondo task trova il file già cambiato sotto di sé e il piano si sfalda.

- [ ] **Step 3: Scrivere un task per gruppo, con questa forma esatta**

````markdown
### Task N: <titolo del fix>

**Files:**
- Modify: `<path esatto>:<righe>`
- Test: `<path del test esistente, o del nuovo test>`

**Interfaces:**
- Consumes: —
- Produces: <cosa cambia per gli altri componenti, o "nulla: fix interno">

- [ ] **Step 1: Scrivere il test che fallisce**
  <codice del test, reale>
- [ ] **Step 2: Eseguirlo e verificare che fallisca**
  Run: `cd "C:/Users/dotat/Desktop/Saas JOBS/apps/web" && pnpm test <file>`
  Expected: FAIL con <messaggio atteso>
- [ ] **Step 3: Applicare la correzione minima**
  <codice>
- [ ] **Step 4: Eseguire il test e verificare che passi**
- [ ] **Step 5: Ri-misurare la route colpita**
  Run: `cd "<SCRATCH>/qa" && python probe.py out <batch> --only "<url>"`
  Expected: <la metrica specifica> passata da <valore prima> a <valore atteso>
- [ ] **Step 6: Commit**
````

Lo Step 5 è ciò che distingue un fix da una speranza: la stessa misura che ha trovato il bug deve dire che è sparito.

Sui test: le page test di questo repo camminano l'albero React restituito e ricorrono solo dentro `props.children`. Stringhe e campi form testati devono essere figli JSX diretti in `page.tsx`, non props di un componente figlio. Chiamare un componente come funzione, `{JobCard({ job })}`, ne mette l'output in quell'albero e soddisfa la visita.

- [ ] **Step 4: Aggiungere un task finale di regressione**

```bash
cd "C:/Users/dotat/Desktop/Saas JOBS"
pnpm test
pnpm typecheck
```

Entrambi devono passare. Poi rilanciare l'intero fan-out di Task 4 e confrontare i sei JSON con quelli pre-fix: nessuna metrica deve essere peggiorata su una route non toccata.

- [ ] **Step 5: Commit del piano e handoff**

```bash
cd "C:/Users/dotat/Desktop/Saas JOBS"
git add docs/superpowers/plans/2026-09-09-frontend-qa-fixes.md
git commit -m "docs(qa): fix plan from frontend QA findings

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01U6sYgooqFGL8V4yhabwg39"
```

Presentare il report e il piano dei fix all'utente prima di eseguire un solo task di fix.

---

## Note di esecuzione

**Ordine e parallelismo.** Task 1 → 2 → 3 in sequenza: l'harness va provato prima di spendere sei agenti su un misuratore rotto. Task 4, 5 e 7 sono indipendenti e possono correre insieme. Task 6 richiede gli screenshot di Task 4. Task 8 richiede tutto.

**Conteggio agenti:** 6 Haiku (Task 4) + 3 Sonnet (Task 6) = 9 sub-agenti. Task 5, 7, 8 e 9 li esegue il responsabile: toccano il DB, decidono severità o scrivono conclusioni, e nessuna delle tre cose si delega a un modello economico.

**Se qualcosa emerge di più grande del previsto** — per esempio se il confronto di Task 7 rivela che il collo di bottiglia è nello strato dati e non nel frontend — il perimetro cambia natura e va rinegoziato, non assorbito in silenzio dentro questo piano.
