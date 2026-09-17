# Collaudo autenticazione, pagamenti e fonti — 17 settembre 2026

Ambiente: localhost, D1/R2/Queues locali, Google OAuth in modalità Testing e Stripe sandbox. Nessun deploy Cloudflare, pagamento reale o email consegnata a destinatari esterni. Gli annunci `[SANDBOX QA]` sono dati fittizi e non rappresentano offerte di lavoro.

## Accessi e dashboard

- Magic link candidato: account fittizio, link dal log locale, onboarding e dashboard verificati nel browser.
- Google candidato: autorizzazione reale, callback, creazione utente, onboarding e dashboard verificati. Corretto il campo interno `tenantId`, che il parser OAuth chiedeva erroneamente al provider; resta assegnato dal server e non modificabile dal client.
- Magic link datore: onboarding aziendale e dashboard verificati senza richiedere il profilo candidato o il CV.
- Google datore: verificato il reindirizzamento all'onboarding aziendale distinto. Non sono stati inseriti dati aziendali fittizi nel profilo Google del proprietario.
- Entrate separate `/login` e `/employer/login`, onboarding e navigazione distinti. La stessa identità può avere entrambi i profili; i permessi dipendono dalle risorse possedute e dalla verifica recruiter.
- Google Cloud: progetto `nodework-test`, client web `Nodework Local Test`, origine `http://localhost:3000`, callback `/api/auth/callback/google`, audience External/Testing con un test user. Le credenziali restano soltanto in `.dev.vars`, ignorato da Git.

## Pagamenti sandbox

| Servizio | Importo simulato | Risultato osservato |
|---|---:|---|
| Annuncio con rinnovo e upsell predefiniti | $695 | Pagato; webhook 200; annuncio pubblicato nella dashboard e nella ricerca |
| Annuncio singolo senza upsell né rinnovo | $299 | Pagato; conferma automatica nella dashboard; annuncio pubblicato |
| Bundle di 2 annunci con highlight personalizzato | $717 | Pagato; 2 crediti accreditati; primo credito consumato, secondo disponibile; annuncio pubblicato |
| Sponsor, posizione 1, 30 giorni | $4.999 | Pagato; campagna attiva nella dashboard pubblicitaria e banner visibile |
| Accesso recruiter, 30 giorni | $199 | Pagato; accesso attivo per azienda fittizia verificata localmente |

Il prezzo recruiter è una configurazione locale di collaudo, non un prezzo attribuito a Web3.career. Non sono stati acquistati né esportati dati di candidati reali.

Provati anche upload logo dal modulo, destinazione esterna della candidatura, ritorno dal checkout con ripristino della bozza e riutilizzo dello stesso ordine, Customer Portal e annullamento del rinnovo alla fine del periodo. Il portale conferma fine servizio il 17 ottobre 2026. La conferma del pagamento arriva dal webhook firmato; il parametro nell'URL non basta ad attivare un servizio.

Rimangono da collaudare con Stripe i coupon, il rinnovo effettivo, i rimborsi, i pagamenti rifiutati e tutte le combinazioni di upsell/posizioni. I test automatici coprono calcoli, idempotenza, importi, proprietà degli ordini e consumo dei crediti. I casi di webhook fuori ordine, rimborso di rate ricorrenti e prenotazione sponsor abbandonata prima della sessione richiedono ulteriore lavoro prima degli incassi reali.

## Catalogo e importazione effettiva

La discovery usa le prime 1.000 destinazioni distinte estratte dai protocolli DefiLlama ordinati per TVL, 122 voci del portfolio a16z crypto e 70 aziende curate, comprese aziende senza token. CoinMarketCap rimane opzionale.

- 1.192 voci di provenienza, corrispondenti a 1.175 stringhe di sito distinte. Non equivalgono a 1.192 aziende che assumono.
- Esito della scansione: 68 riferimenti ATS, 12 associazioni da verificare, 118 pagine che richiedono un adattatore, 83 bloccate, 39 errori, 872 senza un link Careers riconosciuto.
- I 68 riferimenti producono 60 board distinti: 53 endpoint pubblici verificati e attivati, 7 non disponibili alla verifica.
- Esecuzione del worker reale con Miniflare e code locali: **53 fonti completate, 0 errori, 577 annunci Careers pubblicati**. Le offerte chiuse non restano attive dopo una scansione completa riuscita.
- Il catalogo conserva provenienza, esito ed errore; `/admin/sources` mostra fonti e salute del crawler. Un feed temporaneamente irraggiungibile non cancella il catalogo.

La scoperta controlla robots.txt, URL pubblici, redirect, tempi e dimensioni delle risposte. Le associazioni ATS ambigue passano a revisione invece di attribuire automaticamente annunci a un'altra azienda. La corrispondenza per nome/dominio è una verifica euristica: serve comunque controllo editoriale dei dati importati.

Il cron è configurato ogni sei ore, con aggiornamento catalogo massimo una volta al giorno, paginazione delle code, intervalli tra i board, retry e coda `crawl-career-failed`. **Questa pianificazione non è attiva online finché il worker non viene distribuito su Cloudflare.** Careers solo JavaScript, board proprietari e alcune varianti regionali richiedono altri adattatori.

## Aggregatori valutati

- [Web3.career/Bondex API](https://docs.bondex.app/api-reference): token privato, JSON/RSS, massimo 100 risultati; la documentazione consultata non espone offset/cursore. Richiede attribuzione con collegamento e conservazione di `apply_url`. L'adattatore esistente può essere collegato con un token autorizzato, ma non è stato testato contro l'API autenticata.
- [CryptoJobsList API](https://cryptojobslist.com/api-access): accesso su richiesta, chiave `x-api-key`, paginazione. Possibile fonte complementare, non collegata in questa sessione.
- La sitemap aiuta a trovare URL, ma non sostituisce un feed aggiornato né definisce le condizioni di riutilizzo. La base operativa resta l'importazione diretta dai portali aziendali.

Fonti del catalogo: [DefiLlama API](https://api.llama.fi/protocols), [portfolio a16z crypto](https://a16zcrypto.com/portfolio), [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html), [Ashby public posting API](https://developers.ashbyhq.com/docs/public-job-posting-api).

## Riproducibilità e limiti

Verifica locale conclusa: typecheck riuscito, **811 test Node passati** (537 web, 156 shared, 18 database, 100 crawler) e build Next riuscita con 136 pagine generate. Il numero di pagine statiche non include tutte le rotte dinamiche e non misura la parità con il concorrente.

Migrazioni locali fino a `0016`; credenziali, database, CV e log di autenticazione esclusi da Git. Sul computer Windows, evitare due processi Miniflare che aprono contemporaneamente lo stesso D1: durante il collaudo questa concorrenza ha prodotto lock risolti serializzando server e crawler.

La workflow `Validate platform` esegue typecheck, test Node/Workers, setup D1 e build Next su Linux per ogni pull request. Il deploy rimane manuale. Questa verifica copre i cinque interventi richiesti; lo stato della parità complessiva e i lavori ancora aperti sono in [PARITA.md](../PARITA.md).
