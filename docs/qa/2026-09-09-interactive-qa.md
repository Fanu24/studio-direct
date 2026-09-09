# QA interattivo — Nodework — 9 settembre 2026

Secondo passaggio di QA, con un metodo diverso dal primo. Il primo misurava il layout e
guardava screenshot; questo **clicca, trascina e legge**. È il tipo di difetto che il primo
passaggio non poteva vedere: un controllo che sembra giusto e non fa niente, una tabella che
taglia i numeri, un grafico senza assi leggibili.

**Perimetro:** 15 combinazioni pagina/dispositivo — home, jobs, salari (indice, dettaglio,
non-tech, confronto), aziende (indice e dettaglio), hire con skill e città, pricing, learn,
login — a desktop e mobile. Per ogni pagina: ogni controllo interattivo cliccato con eventi
mouse reali, ogni slider e carosello trascinato, ogni tabella e ogni grafico letti cella per
cella ed etichetta per etichetta.

**Regola applicata:** nulla entra in questo report senza che io lo abbia riprodotto a mano.
Degli 8 candidati sollevati dagli strumenti, **6 erano artefatti della sonda** e sono stati
scartati con prove.

---

## Difetti reali

### R1 — Il grafico "da intern a CTO" è per metà vuoto

**Pagine:** ogni pagina salario di ruolo, e le pagine indice.

Su `/web3-salaries/backend-developer`, il grafico intitolato *"How Backend Developer pay
changes from intern to CTO"* mostra:

| Intern | Junior | Senior | Lead | CTO |
|---|---|---|---|---|
| **—** | **—** | $170k | $270k | $270k |

Sulle pagine indice va poco meglio: `$60k, —, $176k, $176k, $231k` (Junior vuoto).

**Non è un errore di dati.** I valori sono calcolati per ruolo — `resolveSalaryBreakdown(db,
tenantId, { tag: stem }, "seniority")` — e per il backend non esistono annunci intern o junior
con salario pubblicato. Il database ha dati di seniority globali (intern $60k, senior $176k,
lead $176k, cto $231k), ma il grafico giustamente non li usa per un grafico di ruolo.

Il problema è **di presentazione**: un grafico che promette una progressione completa e ne
consegna metà a trattini si legge come rotto, non come incompleto. Un lettore non distingue
"nessun dato" da "errore".

**Direzione:** omettere i livelli senza dati e dirlo nel titolo ("da senior a CTO", quando è
quello che si ha), oppure marcarli esplicitamente come *nessun dato disponibile* invece di un
trattino muto. Non inventare valori.

### R2 — Titoli annuncio troncati fino a 227px

**Pagine:** tutte quelle con il board.

I titoli perdono fino a **227px** di testo ("Binance Accelerator Program - …"), le località
fino a 155px. Il troncamento avviene con l'ellissi — quindi si legge come abbreviazione e non
come dato corrotto, che era il difetto corretto in precedenza — ma resta molto contenuto perso
su una colonna larga il 42% della tabella.

Da valutare come scelta di prodotto: la colonna può crescere, o il titolo può andare a capo su
due righe, o si accetta così.

---

## Verificato come funzionante

Tutto quanto segue era stato segnalato dagli strumenti e si è rivelato **corretto**. Lo elenco
perché sapere cosa è stato escluso, e su quale base, vale quanto sapere cosa è stato trovato.

**I sei accordion delle FAQ funzionano.** Erano riportati morti su home e jobs. Causa: si
trovano a y≈3725, fuori dal viewport, e la sonda cliccava coordinate che non colpivano nulla.
Portati in vista, il click apre e chiude (`open: true → false`). Difetto della sonda, corretto:
ora ogni controllo viene scrollato in vista e rimisurato prima del click.

**Il carosello recensioni funziona.** Era riportato come non trascinabile. È un carosello a
radio CSS: cliccando il secondo pallino l'indice passa da 0 a 1 e la track trasla da
`translateX(0)` a `translateX(-1392px)`. Il trascinamento non è la sua interazione — la sonda
provava la cosa sbagliata.

**Il form di login funziona.** "Send magic link" e "Continue with Google" erano riportati
morti. Sono `<button type=submit>` in un form con email `required`: il click a campo vuoto
attiva la validazione nativa del browser (`:invalid = 2`). Il bubble nativo non modifica il
testo della pagina, quindi la sonda non vedeva reazione.

**I grafici hanno le etichette.** Erano riportati "senza etichette" perché la sonda cercava
`<text>` dentro l'SVG. Questo progetto le mette in HTML accanto al grafico (`salary-chart__label`),
con l'SVG `aria-hidden` che disegna solo la barra — che è una scelta corretta per
l'accessibilità. Le etichette esistono e sono leggibili: "Backend Developer $175k".

**Il pulsante "Search" nascosto è corretto.** `<button class="visually-hidden">` da 1×1 px: è
il pattern standard per screen reader, presente su ogni pagina e correttamente inerte al click.

**Tutti i link navigano.** Nessun `href` vuoto o `#` su nessuna delle 15 pagine.

---

## Verificato come pulito

Questi sono risultati di misura, non assenza di dati.

- **Nessun numero perde cifre.** Su **73 celle troncate** nell'intero perimetro, incluse tutte
  le pagine salariali, **zero sono numeriche**. Le tabelle salariali sono leggibili: gli
  importi non vengono mai tagliati. Era la preoccupazione principale sulle tabelle, ed è
  smentita dai numeri.
- **Nessuna cella troncata senza ellissi.** La correzione precedente sulla località regge in
  tutto il sito.
- **Zero controlli morti** su `/web3-companies`, `/web3-companies/1inch`, `/pricing`,
  `/learn-web3`.
- **Zero celle troncate** sulle stesse quattro pagine.
- **Nessun errore JavaScript** durante nessuna delle interazioni.

---

## Nota di metodo

Sei degli otto candidati erano artefatti dello strumento, e tutti e sei avevano la stessa
radice: **la sonda misurava qualcosa di diverso da ciò che il lettore vive**. Cliccava fuori
schermo, cercava le etichette nel posto sbagliato, trascinava un carosello che si comanda a
pallini, e leggeva "nessuna reazione" dove il browser mostrava un messaggio di validazione
nativo.

Ogni volta il difetto si è manifestato come una segnalazione *plausibile* — sei accordion
rotti, un carosello bloccato, un login inerte. Nessuna di queste sarebbe sembrata sospetta
leggendo il report. Sono state smontate solo riproducendole una per una.

Le due correzioni applicate alla sonda (scroll in vista prima del click, e la validazione
nativa contata come reazione) hanno portato i controlli "morti" sulla home da 8 a 2, ed
entrambi i rimanenti sono artefatti noti e documentati.
