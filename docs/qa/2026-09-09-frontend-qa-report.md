# QA frontend — Nodework — 9 settembre 2026

Audit funzionale, grafico e prestazionale di `apps/web`, condotto in locale contro
`http://localhost:3001` (dev) e una build di produzione su `:3002`.

**Perimetro coperto:** tutte le 59 route template dell'applicazione, mappate su 60 URL reali
(le 14 dinamiche su istanze vere prese dal database), misurate a tre viewport — mobile 390px,
tablet 768px, desktop 1440px. In totale **154 righe di misura**: 47 URL renderizzate × 3
device, più 13 route di redirect o autenticazione verificate come solo-status. In aggiunta,
**1202 link interni unici** risolti uno a uno, e **51 screenshot** dei 17 template
visivamente distinti esaminati a occhio.

**Regola applicata a ogni voce di questo report:** nulla è entrato senza essere stato
riprodotto. Dei 13 candidati grafici sollevati dalla revisione visiva, 12 sono stati respinti
con prove; quelli rimasti hanno una causa radice identificata nel codice.

---

## Sintesi

| Gravità | Difetti |
|---|---|
| Critical | **0** |
| High | **2** |
| Medium | **3** |
| Low / informativi | **1** |

Il sito non ha difetti bloccanti. Non ci sono pagine che non renderizzano, errori 5xx,
eccezioni JavaScript che impediscono l'interazione, né overflow orizzontale su mobile. I due
problemi High sono reali e hanno entrambi una causa precisa e un punto di intervento unico.

---

## High

### H1 — La lentezza percepita è reale e sopravvive alla build di produzione

**Route colpite:** `/` e altre cinque pagine con aggregazioni su salari e aziende.

Misure sequenziali a caldo, mediana di tre campioni:

| Route | dev | **produzione** | miglioramento |
|---|---|---|---|
| `/` | 2.72s | **2.13s** | −22% |
| `/web3-companies` | 2.21s | **1.84s** | −17% |
| `/web3-salaries` | 2.37s | **1.68s** | −29% |
| `/web3-non-tech-salaries` | 2.20s | **1.70s** | −23% |
| `/web3-salaries/solana-vs-ethereum` | 2.08s | **1.77s** | −15% |
| `/highest-paying-web3-jobs` | 1.66s | **1.16s** | −30% |
| `/jobs` | 0.65s | **0.39s** | −40% |
| `/about` | 0.12s | **0.008s** | **−94%** |

**La prova sta nel contrasto, non nei valori assoluti.** `/about` migliora di quindici volte,
il che dimostra che la build di produzione ottimizza davvero. La home migliora del 22% e
resta a 2,1 secondi. Quel residuo è lavoro server-side reale: non è compilazione on-demand,
non è cache fredda, non è stato HMR degradato.

Evidenze convergenti sulla causa:

- Il dev server **serializza**: a concorrenza 1/2/3/6 la home risponde in 2,7 / 5,3 / 7,8 /
  15,3 secondi. Ogni richiesta consuma circa 2,6s di CPU e le altre si accodano.
- La home costruisce **1481 nodi DOM** e contiene **437 link interni**, contro i 377 nodi e
  60 link di `/about`.
- Le cinque route più lente sono tutte e cinque pagine con aggregazioni su salari e aziende.

Il collo di bottiglia è lo strato dati, non il frontend. Una pagina statica come `/about`
scende a 8 millisecondi sulla stessa build.

**Nota di misura:** i tempi registrati durante la campagna a sei batch non sono citati qui.
Erano presi sotto carico concorrente deliberato e non valgono come prova prestazionale. Solo
le misure sequenziali sopra sono attendibili.

### H1 — corretto

**Causa individuata:** un N+1 in `apps/web/app/page.tsx`. La home caricava una pagina di 20
annunci e poi ne interrogava il dettaglio **uno per uno** — `getJobForListItem` → `loadJob`,
una `SELECT` per annuncio — al solo scopo di generare il JSON-LD. Circa 23 round-trip D1 per
richiesta. In più `listJobs` e `countHiringCompanies` giravano in sequenza pur essendo
indipendenti.

**Correzione:** nuova `getJobsForListItems` che carica tutti i dettagli con una sola query
(`WHERE j.external_id IN (...)`) e reindicizza i risultati preservando l'ordine di ingresso,
con `null` per i non risolti — l'ordine è un contratto, perché `page.tsx` usa `jobDetails[0]`
come annuncio in evidenza. `listJobs` e `countHiringCompanies` passano a `Promise.all`.

**Risultato misurato sulla build di produzione:**

| | prima | dopo |
|---|---|---|
| home, mediana di 5 | **2,13s** | **0,77s** |
| blocchi JSON-LD `JobPosting` | 20 | 20 |

**−64%.** Il conteggio JSON-LD invariato conferma che nessun annuncio è rimasto irrisolto: una
riduzione ottenuta perdendo dati sarebbe stata una regressione SEO invisibile in pagina.

**Le altre cinque route lente NON sono migliorate** — misurate dopo il fix: `/web3-companies`
1,98s, `/web3-salaries` 1,71s, `/web3-non-tech-salaries` 1,69s,
`/web3-salaries/solana-vs-ethereum` 1,79s, `/highest-paying-web3-jobs` 1,19s. Solo la home
aveva *questo* N+1; le altre hanno cause proprie, ancora da diagnosticare. È il motivo per cui
il fix è stato applicato prima a una sola pagina.

---

### H2 — La località degli annunci viene tagliata a metà parola, senza ellissi

**Route colpite:** 25 pagine su 47 presentano testo troncato; il taglio della località è
visibile a occhio su almeno quattro pagine a larghezza desktop.

Esempi osservati negli screenshot: `UT Salt Lak`, `NY New Yc`, `London - H`, `New York, I`.
Non è un'abbreviazione con puntini di sospensione — è un taglio netto, che fa sembrare il
dato corrotto anziché accorciato.

**Causa radice identificata.** La cella `<td class="board-col-loc">`
(`apps/web/app/styles/board.css:133-138`) ha le proprietà corrette:

```css
.board-col-loc {
  width: 12%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Ma il suo unico figlio `.board-loc` (`apps/web/app/styles/nodework.css:424-428`) è
`display: inline-flex`. Un box inline-flex è un **elemento atomico a livello inline**:
`text-overflow: ellipsis` sul genitore non può inserire i puntini al suo interno, perché il
testo appartiene al flex item e non al contenuto inline del genitore. Il risultato è che
`overflow: hidden` affetta il box al bordo della cella, senza ellissi.

È il motivo per cui il CSS "sembra corretto" a una lettura: la regola è giusta, l'elemento a
cui è applicata è sbagliato.

**Direzione del fix — corretta dopo un primo tentativo fallito.** La prima proposta era di
mettere le proprietà di troncamento su `.board-loc` stesso. Non funziona, ed è stato misurato:
`clipped_text_count` è rimasto a 18 e gli screenshot mostravano ancora tagli netti
(`Hong Kor`, `South Afi`). Il motivo è che **`text-overflow` non si applica ai contenitori
flex**, ma ai contenitori di blocco — quindi su un `inline-flex` la proprietà è inerte
ovunque la si metta, sul genitore o su sé stesso.

La correzione richiede una modifica di markup, non solo CSS. In
`apps/web/app/_components/job-board.tsx:146-154` il testo è un nodo nudo dentro il flex
container, quindi diventa un flex item *anonimo* che nessun selettore può raggiungere. Va
avvolto in un proprio elemento, e le proprietà di troncamento vanno su quello:

```tsx
<span className="board-loc__text">{place}</span>
```

```css
.board-loc     { min-width: 0; max-width: 100%; }   /* può restringersi sotto il contenuto */
.board-loc__pin { flex: none; }                      /* l'icona non viene schiacciata */
.board-loc__text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

Da valutare anche `apps/web/app/[slug]/[id]/job-detail-view.tsx:111`, che rende
`<span className="board-loc">` senza wrapper.

### H2 — corretto

Applicata la correzione sopra. Verifica a livello DOM, non solo visiva: tutti e 20 gli
elementi `.board-loc__text` hanno `text-overflow: ellipsis` e `white-space: nowrap` attivi,
`.board-loc` ha `min-width: 0`, l'icona ha `flex: 0 0 auto`, e ogni cella risulta troncata
(`scrollWidth > clientWidth`). Gli screenshot mostrano ora `Hong K…` dove prima si leggeva
`Hong Kor`.

**Attenzione a un dettaglio del contatore.** Dopo il fix `clipped_text_count` **sale** da 18 a
34, e non è una regressione: prima della correzione il testo era un flex item *anonimo*, quindi
invisibile a una metrica che conta solo elementi foglia. Reso un elemento reale, entra nel
conteggio — troncato correttamente, con ellissi. Le due cifre misurano popolazioni diverse e
non sono confrontabili. La prova del fix è il DOM e lo screenshot, non quel numero.

**Osservazione emersa dalla verifica:** la colonna località ha una larghezza utile di soli
**53px** a 1440px (12% della tabella). Persino "Hong Kong", che ne richiede 65, viene troncato.
La correzione fa sì che il troncamento appaia intenzionale invece che corrotto — che è il
comportamento giusto — ma la larghezza della colonna resta una questione di design aperta: così
com'è, quasi ogni località è illeggibile per intero.

---

## Medium

### M1 — I chip di filtro sono sotto il minimo WCAG per i target tattili

**Route colpite:** tutte, su tutti e tre i viewport.

Ogni pagina renderizzata riporta **38 target tattili sotto la soglia**, contro i **24×24 px**
richiesti da WCAG 2.2 SC 2.5.8 (Target Size — Minimum). Sette sono link `a.chip` misurati a
**17px di altezza**; i restanti sono link del footer.

> **Correzione al conteggio, aggiunta dopo il fix.** Questo report indicava inizialmente
> "8 target per pagina". Era sbagliato: la lista prodotta dallo strumento è **troncata a 8
> voci**, e il numero reale è 38. Lo si è scoperto correggendo i chip — la lista restava a 8
> mentre i chip sparivano, perché altri elementi risalivano a occupare gli slot liberati. Un
> conteggio senza tetto ha poi confermato 38 → 31 dopo il fix, un calo di esattamente 7,
> pari ai chip. La causa e il rimedio descritti qui sotto restano corretti; era sbagliata la
> portata.

Causa in `apps/web/app/globals.css:840-853`: `padding: 3px 8px` con
`font-size: 0.66rem` (~10,5px), che con line-height di default produce esattamente i 17px
misurati.

Punto di intervento unico per i chip. Classificato Medium e non High perché sono controlli di
filtro secondari, non le CTA principali — ma sono presenti su ogni pagina del sito.

**Correzione applicata** (commit `f1c7a14`): `padding: 5px 10px` e `min-height: 24px`. I sette
`a.chip` non compaiono più tra i target sotto soglia e l'overflow orizzontale su mobile resta 0.

### M3 — I link del footer sono anch'essi sotto il minimo tattile

Emerso correggendo M1. Dopo il fix dei chip restano **31 target sotto i 24px**, tutti link del
footer, presenti su ogni pagina. Non corretti: non erano nel perimetro approvato e meritano una
decisione a parte, perché il footer è denso e aumentarne le altezze ne cambia la resa. Il
rimedio è della stessa natura di M1.

### M2 — La build con prerendering non completa contro il D1 locale

`pnpm exec next build` fallisce durante la generazione statica, a circa 30 pagine su 122, con:

```
Error: D1_ERROR: Failed to parse body as JSON, got: Error: internal error
```

Il fallimento è **riproducibile ma non deterministico nel punto**: due tentativi si sono
fermati su pagine diverse (`/learn-web3/blockchain-engineer` e `/learn-web3/recruiter`), stesso
template di route, stesso punto di avanzamento. È la firma di un limite di concorrenza del D1
emulato da miniflare sotto prerender, non di una pagina difettosa — la route e i suoi
parametri sono legittimi (`generateStaticParams` restituisce `LEARN_CATEGORIES`).

**Da leggere con precisione:** questo dice che *la build completa con prerendering non passa
contro il D1 locale in emulazione*. Non è stato verificato se il D1 reale di Cloudflare si
comporti allo stesso modo, e questo report non afferma che il sito non sia distribuibile.

### M2 — causa radice trovata e corretta

Indagato durante il tentativo di deploy. **Non era un limite dell'emulatore né una pagina
difettosa.**

Le pagine funzionano: richieste una a una al dev server, tutte e dieci le categorie che
avevano fatto fallire la build rispondono 200; e dieci richieste concorrenti passano senza un
solo errore D1. Il guasto è esclusivo del contesto di build.

La causa sta in `@opennextjs/cloudflare/dist/api/cloudflare-context.js`. Durante la
generazione statica Next.js crea **un processo worker per CPU** — sedici su questa macchina.
Ogni worker è un processo separato, quindi il suo `getCloudflareContext` non trova il contesto
nello stato globale e ricade su `getCloudflareContextFromWrangler()`, che chiama
`getPlatformProxy()`: **una nuova istanza miniflare, con il suo workerd, per ogni worker.**
Tutte aprono lo stesso file SQLite sotto `.wrangler/state`. La contesa di lock fra processi fa
restituire a D1 un errore interno, che risale come `Failed to parse body as JSON`.

Il commento nel sorgente di OpenNext descrive proprio questo scenario: *"for SSG Next.js
creates (jest) workers that don't get access to the normal global state"*.

Tre osservazioni combaciano con questa spiegazione e con nessun'altra: il fallimento cade su
una pagina diversa a ogni build (è una gara fra lock, non un difetto di contenuto);
`staticGenerationMaxConcurrency: 1` migliorava senza risolvere, perché limita la concorrenza
*dentro* un worker e non il numero di worker; e le stesse pagine servite dal dev server, dove
l'istanza miniflare è una sola, non falliscono mai.

**Correzione**, in `apps/web/next.config.ts`:

```ts
experimental: { cpus: 1 }
```

Un solo worker, una sola istanza miniflare, nessuna contesa. **Risultato: build 122/122,
zero errori di prerender, exit 0.** Il costo è una generazione statica serializzata, quindi
più lenta — accettabile per una build che arriva in fondo.

Aggiramento usato per l'analisi prestazionale:
`next build --experimental-build-mode compile`, che salta il prerendering e produce un server
di produzione che renderizza su richiesta.

---

## Low / informativo

### L1 — Errori di console sulla pagina di login

Tre errori (uno per viewport) su `/login`, tutti relativi alla sitekey di Turnstile. Sono
conseguenza dei secret assenti in locale (`TURNSTILE_SECRET_KEY` e gli altri elencati sotto),
non un difetto dell'applicazione. Vanno riverificati in un ambiente con le chiavi configurate.

---

## Verificato come sano

Questi risultati sono misure, non assenza di dati. Lo strumento è stato validato con un
self-test che pianta quattro difetti noti in una pagina di prova e verifica che li rilevi
tutti; il test è stato anche eseguito con la misura dell'overflow deliberatamente disattivata,
per dimostrare che sa fallire.

- **Nessun overflow orizzontale**, su tutte e 141 le righe renderizzate, a 390 / 768 / 1440px.
  Lo stesso strumento misura 510px di overflow sulla fixture di controllo, quindi lo zero è
  reale.
- **Nessun link interno rotto**: 1202 URL uniche risolte, 1200 rispondono 200, 2 rispondono
  307 (`/onboarding` e `/profile`, redirect di autenticazione corretti per un visitatore non
  autenticato).
- **Nessuna immagine rotta** su nessuna pagina.
- **`prefers-reduced-motion` rispettato** su tutte le 141 righe.
- **Nessun errore JavaScript** oltre a L1.
- **Nessuna discrepanza di status HTTP**: tutte le 60 route rispondono con lo status atteso,
  inclusi i 7 redirect legacy (`/companies`, `/hidden-jobs`, `/top-growing-web3-companies`,
  `/highest-paid-developers-jobs`, `/most-popular-designer-jobs`, `/companies/[slug]`,
  `/skills/[slug]`) e i redirect `/jobs/[slug]` verso l'URL canonico.
- **Nessuna pagina vuota o a metà rendering**: il conteggio dei nodi DOM è sempre sopra i 100.

---

## Non coperto

**L'area account** — `/dashboard`, `/profile`, `/settings`, `/onboarding` — è verificata solo
come "redirige correttamente a `/login` quando non si è autenticati" (307). Il suo stato
renderizzato **non è stato testato**.

Motivo: `BETTER_AUTH_SECRET` non è configurato in locale, quindi better-auth non può validare
crittograficamente alcun token di sessione, per quanto corrette siano le righe inserite nel
database. È un limite d'ambiente, non un difetto dell'applicazione. Sono stati verificati lo
schema reale delle tabelle (`users`, `session`) e il nome del cookie
(`better-auth.session_token`) prima di concludere.

Per coprire quest'area serve un ambiente con i secret configurati. Le righe di test inserite
durante il tentativo sono state rimosse e la loro assenza verificata.

**Non riprodotto:** la revisione visiva ha segnalato un troncamento eccessivo su due schede
annuncio a mobile (titoli ridotti a `Ex...`, `Krak...`, `S...`, `K...`), incoerente con le
schede vicine alla stessa larghezza. Non è stato riprodotto e potrebbe appartenere alla stessa
classe di H2 — un flex item senza `min-width: 0` compresso da un fratello lungo. Va verificato
prima di intervenire.

---

## Falsi positivi respinti

Sono elencati perché sapere cosa è stato escluso, e su quale base, vale quanto sapere cosa è
stato trovato.

**L'overlay "N" — 13 segnalazioni da tutti e tre i revisori visivi.** Un widget flottante in
basso a sinistra che copre il contenuto su mobile e tablet. È **l'indicatore di sviluppo di
Next.js**, non un elemento del sito. Prove: il CSS dell'applicazione non contiene nulla del
genere (gli unici `position: fixed` sono l'overlay di grana, che non intercetta i click, e il
menu mobile); la pagina servita in dev carica
`next-devtools/userspace/app/segment-explorer-node.js`; e la stessa pagina servita dalla build
di produzione ne contiene **zero occorrenze**. Buona parte dei troncamenti "a sinistra"
segnalati altrove erano questo widget sovrapposto alla prima parola.

**Testo fantasma del footer nell'intestazione (desktop).** Non riprodotto. Ricatturando la
stessa posizione di scorrimento senza `captureBeyondViewport`, l'intestazione è pulita: era un
artefatto di composizione della cattura a pagina intera con la navigazione `position: sticky`.

**Sezione "Backend salary breakdown" apparentemente vuota.** Non è un titolo di sezione senza
contenuto: è un **link** (`<a class="text-link" href="/web3-salaries/backend-developer">`)
dentro un pannello che ha già il proprio contenuto sopra. Lo spazio sotto è lo stacco verso la
sezione successiva.

**Barra di candidatura sticky "che taglia il titolo".** La barra funziona come progettata:
titolo con ellissi regolare e pulsante Apply. Il taglio a sinistra era l'indicatore di Next.

**Ottavo target tattile per pagina.** `button.visually-hidden` da 1×1 px: è il pattern
standard per gli screen reader (`globals.css:118-128`), corretto e voluto. Lo strumento
sovrastima di esattamente uno per pagina.

**"Zero animazioni" su 138 righe su 141.** *Non* riportato come difetto, perché il dato non è
misurato: la fase di misura non scorre la pagina, quindi i reveal sotto la piega non scattano
mai, e gli effetti realizzati con `transition` anziché `animation` finiscono in un campo che la
serializzazione scarta. Non si può distinguere "nessuna animazione" da "animazioni non ancora
innescate". La revisione visiva è il controllo compensativo, e non ha trovato sezioni invisibili.

---

## Note di metodo

Cinque difetti sono stati trovati **nello strumento** prima che producesse dati, e quattro di
essi avrebbero generato un report sbagliato con numeri credibili a supporto:

1. **L'overflow era sempre zero.** La formula usava `window.innerWidth`, che sotto emulazione
   mobile riporta il viewport *visuale* — il quale si allarga fino al contenuto e quindi
   coincide sempre con `scrollWidth`. Il divisore corretto è `documentElement.clientWidth`.
   Non corretto, l'audit avrebbe dichiarato zero problemi di layout mobile su 47 pagine.
2. **Le pagine venivano misurate a metà caricamento.** Un `sleep` fisso di 3 secondi contro un
   server che a sei richieste concorrenti risponde in 15,3s avrebbe prodotto decine di
   "sezioni mancanti" inesistenti. Ora si attende `readyState === 'complete'`.
3. **Gli errori di console venivano scartati** prima del collettore, che sarebbe stato
   corretto e avrebbe comunque riportato sempre zero.
4. **Un controllo dei link travestito da misura di layout.** La home ha 437 link interni e
   ognuno era risolto dentro l'audit della pagina: oltre 420 secondi senza produrre una riga.
   Diventato un passaggio globale unico, la home si misura in 87 secondi.
5. **Collisione di nomi file negli screenshot** tra la pagina di dettaglio annuncio e la sua
   `/apply`: il revisore visivo del template "dettaglio" avrebbe descritto il form di
   candidatura.

Il self-test che ha scoperto il primo punto è anche l'unica ragione per cui gli "zero" di
questo report sono affermazioni e non silenzi.
