# Collaudo aggiuntivo — 19 settembre 2026

Prosegue il [collaudo del 17 settembre](2026-09-17-auth-payments-discovery.md). Tutte le transazioni sono nella sandbox Stripe, con account e annunci fittizi; nessun incasso reale, deploy o invio email esterno.

## Risultati osservati con Stripe

| Prova | Risultato |
|---|---|
| Rimborso completo annuncio singolo da $299 | Rimborso riuscito; ordine refunded; annuncio chiuso |
| Rimborso completo bundle da $717 | Rimborso riuscito; annuncio già pubblicato chiuso; credito restante inutilizzabile |
| Rimborso completo sponsor da $4.999 | Rimborso riuscito; campagna disattivata; slot 1 nuovamente disponibile |
| Rimborso completo recruiter da $199 | Rimborso riuscito; ordine refunded; accesso revocato |
| Carta rifiutata su nuovo bundle | Errore visibile in Checkout; ordine pending e zero crediti |
| Stesso checkout con carta valida e coupon del 10% | Da $1.112 a $1.000,80; ordine paid; esattamente due crediti disponibili nella dashboard |

I quattro eventi reali sandbox `charge.refunded` hanno ricevuto HTTP 200 dal webhook locale firmato. Stato Stripe confrontato con ordini e abilitazioni nel database. Il coupon di collaudo è limitato a un utilizzo. L'annuncio ricorrente da $695 resta attivo fino al 17 ottobre, con rinnovo già annullato nel precedente collaudo.

## Correzioni

- Migrazione `0017_payment_reversals.sql`: conserva la conferma di rimborso anche se arriva prima che Checkout sia associato all'ordine. Pubblicazione e accredito verificano questo registro nella propria transazione. Un checkout consegnato in ritardo non riattiva servizi già rimborsati.
- Il consumo di un credito verifica nuovamente lo stato pagato nella transazione: un rimborso concorrente non può pubblicare un nuovo annuncio.
- Recupero delle prenotazioni sponsor pendenti da oltre 15 minuti: riconciliazione con Stripe alla lettura di `/ads` o all'avvio di un checkout autenticato. Rilascia lo spazio solo dopo scadenza confermata o ricerca completa che dimostra l'assenza di una sessione. Ricollega sessioni perse e recupera pagamenti confermati, controllando anche eventuali rimborsi.
- Le richieste di recupero sono limitate a un passaggio ogni due minuti, quattro ordini, otto richieste Stripe e otto secondi complessivi di rete. Ricerca paginata fino a 500 sessioni per ordine; in caso di errore o ricerca incompleta conserva la prenotazione. Il recupero è attivato dalle richieste, non da un cron autonomo.
- Un tentativo troppo vecchio senza ID Stripe richiede un nuovo ordine, impedendo che il recupero concorra con una nuova creazione remota. Il modulo rigenera l'ID dopo scadenza.
- Risolto il build Linux che apriva D1 durante il prerender: le pagine basate sul database vengono renderizzate sul server a richiesta, mentre il proxy locale OpenNext parte solo in sviluppo. La CI costruisce prima del setup del database. Queste pagine non usano più la precedente revalidation di cinque minuti; il caching in produzione richiede una valutazione separata.

## Verifica automatica e limiti

Suite locale: **833 test Node passati** (559 web, 156 shared, 18 database, 100 crawler), **12 test Workers passati**, typecheck riuscito. Il runtime Workers su Windows continua a produrre avvisi di risoluzione dei percorsi; la CI Linux verifica anche quel runtime.

Tredici nuovi test SQLite coprono rimborsi prima/durante/dopo Checkout, duplicati, tutti i quattro servizi una tantum e consumo concorrente dei crediti. Nove test coprono recupero sponsor, paginazione, errori Stripe, sessioni appartenenti ad altri ordini, rimborsi precedenti e limitazione delle richieste. Il recupero dei webhook mancanti è provato con simulazioni automatiche; non è stato simulato un guasto del provider nella sandbox.

La [CI Linux del fix build](https://github.com/Fanu24/studio-direct/actions/runs/35434600240) è riuscita. Per le successive correzioni commerciali fa fede la verifica associata all'ultimo commit della [PR #2](https://github.com/Fanu24/studio-direct/pull/2).

Restano da completare e collaudare rinnovi effettivi, riconciliazione delle fatture ricorrenti e relativi rimborsi, oltre alle combinazioni commerciali non provate. I rimborsi parziali lasciano invariati i servizi. Un recupero che eccede il limite di ricerca richiede riconciliazione operativa. Non è una certificazione della parità completa: vedere [PARITA.md](../PARITA.md).
