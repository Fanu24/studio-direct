# Stato della parità funzionale

Aggiornato il 21 settembre 2026. Il progetto è funzionante nell'ambiente locale per i flussi collaudati sotto. Non è ancora certificabile come equivalente al 100% a Web3.career: restano verifica delle funzioni riservate del riferimento, copertura Careers aggiuntiva e servizi di produzione. La grafica finale resta fuori da questa fase.

Il codice è sul branch `feat/auth-payments-source-discovery`, [PR #2](https://github.com/Fanu24/studio-direct/pull/2). Pubblicare il branch non distribuisce il sito. Il prototipo è una base tecnica: ricerca e candidature sono gratuite, senza i vecchi abbonamenti candidati o quote di sblocco.

| Area | Implementato e verificato | Limite aperto |
|---|---|---|
| Accesso | Magic link e Google OAuth sandbox; ingressi, onboarding e dashboard candidati/aziende distinti | Mittente email reale e OAuth sul dominio finale |
| Ricerca | Suggerimenti skill/aziende, remoto, 15 risultati, dettaglio, preferiti, pin/highlight, filtri benefit e città/paese/continente | Audit completo delle combinazioni del search center rispetto al riferimento |
| Annunci | Editor formattato, skill principale, benefit, link X, upload logo, checkout server, pubblicazione dopo webhook, modifica e form ripubblicazione | Distribuzione esterna/social; test di un nuovo pagamento partendo dal form di ripubblicazione |
| Prezzi e bundle | Upsell, coupon, scala bundle 2–50 osservata sul riferimento, acquisto/consumo crediti, scadenza 24 mesi, rimborso completo | Politica commerciale dei rimborsi parziali da definire |
| Rinnovi | Periodi fatture, fattura prima/dopo Checkout, rimborsi vecchio/corrente, annullamento e scadenza, riconciliazione ordine/subscription | Consegna webhook e riconciliazione su Cloudflare distribuito |
| Candidature | Email autenticata, PDF privato, dashboard, filtri/stato/note datore, ritiro con rimozione CV, notifiche e retry | Invio email reale; il ritiro non richiama file già scaricati |
| Recruiter | Accesso verificato a pagamento, filtri, CV/contact autorizzati, shortlist e note, export CSV paginato con audit e doppio consenso | Prezzo e funzioni riservate del concorrente non verificati; $199 usato solo nel test |
| Sponsor | Quattro slot esclusivi, pagamento, banner, impression/click, rimborso, recupero prenotazioni e strumenti admin | Metriche non certificate come utenti unici |
| CPM/CPC | Adapter AdSense disattivato per default, admin, ads.txt, CMP Google, TCF/GPC e opt-out US | Publisher, approvazione dominio, CMP reale e ricavi non collaudati |
| Alert | Filtri, consenso, coda giornaliera, disiscrizione, outbox e retry | Provider email reale |
| Aggregazione | Greenhouse, Lever, Ashby, JSON-LD di indice e dettagli; snapshot incompleti conservano i lavori esistenti | Portali proprietari/JavaScript richiedono adattatori aggiuntivi |
| Discovery | DefiLlama, portfolio a16z crypto e aziende curate; 1.192 voci/1.175 siti analizzati; 53 board verificati, 577 lavori importati | Non tutti i siti sono monitorabili: 118 richiedevano adattatori, 12 associazioni revisione; nuova scansione completa non eseguita il 21 |
| SEO | Pagine lavori, skill, località, benefit, aziende, salari e listicle; otto sitemap; corretto inserimento improprio delle aziende nella sitemap salari | Audit integrale contenuti, canonical e indicizzazione ancora aperto |
| Amministrazione | Recruiter, prezzo, fonti, supporto, moderazione, riconciliazione, retry email, recupero sponsor | Collaudo UI delle nuove operazioni con account amministratore |
| Ambiente | D1 locale fino a 0021, R2 locale, code, cron discovery giornaliero/crawl 6 ore, operazioni ogni 5 minuti, CI con OpenNext | Dominio, risorse Cloudflare remote, email e deploy rinviati dal proprietario |

## Prezzi del riferimento

Nel [modulo annunci](https://web3.career/post-web3-job): base $299; assistenza $99; logo $49; highlight $99 o colore personalizzato $149; pin 1/3/7/14/30 giorni a $49/$99/$149/$199/$299. Configurazione predefinita osservata $695, rinnovo ogni 30 giorni. Senza upsell $299.

Nel [bundle](https://web3.career/post-web3-job/bundle) sono stati controllati tutti i valori pari da 2 a 50: sconto 20% per 2, 29% per 4, 30% per 6, poi +1 punto ogni due annunci fino a 51% per 48; 55% per 50. Con configurazione da $695: 2=$1.112, 24=$10.175, 32=$12.677, 40=$14.734, 50=$15.638. Crediti dichiarati validi 24 mesi.

Nella [pubblicità](https://web3.career/ads): quattro posizioni $4.999/$3.999/$2.999/$1.999 per mese. Lo stato degli slot occupati del concorrente non è stato copiato. Per il [catalogo candidati](https://web3.career/hire) il prezzo riservato non è stato verificato: il progetto richiede di configurare un prezzo proprio.

## Evidenze del collaudo

- Suite completa locale: 858 test Node (160 shared, 18 database, 577 web, 103 crawler) e 12 Workers passati; un test Stripe opt-in saltato dalla suite ordinaria. I test mirati delle correzioni successive sono passati.
- Typecheck workspace passato. CI Linux su `2c29dd7` completata con successo, inclusa build OpenNext Cloudflare. Il risultato dei commit successivi va controllato sulla PR.
- Test locale HTTP/browser: modifica annuncio e form repost, filtri località/benefit, login candidato, invio PDF, proprietà CV, gestione datore, ritiro, assenza di note private dall'account candidato.
- Ulteriore acquisto recruiter Stripe sandbox da $199: export, shortlist e revoca di ciascun consenso verificati; rimborso completo seguito da revoca dell'export verificato.
- Test con Stripe Test Clock eseguito il 19 settembre: fattura iniziale e rinnovo reali, rimborsi vecchio/corrente, cancellazione/scadenza su database isolato. L'associazione Checkout in quel test è una fixture; i Checkout browser sono prove distinte.
- Smoke HTTP del 21: 20 pagine pubbliche, otto sitemap, sitemap principale e robots.txt passati. Non equivale a audit SEO integrale.
- Cron configurati ma non ancora attivi online. Nessun deploy, pagamento reale o invio email reale.

Resoconti: [accessi e discovery](qa/2026-09-17-auth-payments-discovery.md), [recupero pagamenti](qa/2026-09-19-payment-recovery.md), [flussi del 21 settembre](qa/2026-09-21-functional-workflows.md).
