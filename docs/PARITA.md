# Stato funzionale e preparazione online

Aggiornato il 21 settembre 2026. Questa fase prepara il prodotto al futuro collegamento dei servizi. Grafica, offerta distintiva, dominio e configurazione commerciale sono rinviati dal proprietario. Il prototipo non è il riferimento delle scelte funzionali.

Codice sul branch `feat/auth-payments-source-discovery`, [PR #2](https://github.com/Fanu24/studio-direct/pull/2). Nessun merge o deploy. Ricerca e candidature gratuite, senza i vecchi abbonamenti candidati o quote di sblocco.

| Area | Implementato e collaudato | Collegamento o limite successivo |
|---|---|---|
| Accesso | Magic link, Google sandbox; ingressi, onboarding e dashboard distinti candidato/azienda | Mittente reale e callback OAuth sul dominio definitivo |
| Ricerca | Testo, suggerimenti skill/azienda, remoto, sede, benefit, salario, filtri combinati conservati, dettaglio e preferiti | Design successivo; nessuna certificazione delle funzioni private del concorrente |
| Annunci | Editor, skill, benefit, X, logo, checkout, pubblicazione da webhook, modifica, nuovo pagamento dal form ripubblicazione | Distribuzione social/esterna richiede canali del nuovo business |
| Prezzi e bundle | Upsell, coupon, quantità 2–50, pagamento e consumo crediti, validità 24 mesi, rimborso completo | Politica commerciale dei rimborsi parziali da definire |
| Rinnovi | Fatture, ordine eventi invertito, rinnovi e rimborsi delle rate, annullamento/scadenza, riconciliazione | Ripetere una prova di consegna webhook sul dominio online |
| Candidature | PDF privato, accessi proprietari, gestione datore, note private, ritiro/eliminazione PDF, notifiche/outbox/retry | Provider email reale; impossibile richiamare copie già scaricate |
| Recruiter | Verifica azienda, acquisto, filtri, CV/contact autorizzati, shortlist/note, CSV paginato con audit e doppio consenso | Prezzo proprio da impostare; $199 era soltanto sandbox |
| Sponsor | Quattro slot, pagamento, banner, impression/click, rimborso e recupero prenotazioni | Metriche non certificate come utenti unici |
| CPM/CPC | AdSense disattivato per default, pannello admin, ads.txt, CMP Google, TCF/GPC e opt-out US | Publisher, CMP, approvazione dominio e ricavi reali |
| Alert | Filtri, consenso, coda giornaliera, disiscrizione, outbox/retry | Email reale |
| Aggregazione | Greenhouse, Lever, Ashby, JSON-LD indice/dettagli; deduplica, scadenza e gestione errori/snapshot incompleti | Siti bloccati o proprietari richiedono adattatori/accordi aggiuntivi |
| Catalogo | 1.192 provenienze/1.175 siti; 61 fonti attive tutte lette con successo, 689 offerte importate visibili | Catalogo di ricerca non equivale a 1.175 siti monitorati; dettaglio stati nel report QA |
| SEO | Pagine lavori, skill, sedi, benefit, aziende, salari/listicle; indice e 8 sitemap; statistiche sulle offerte visibili | Contenuto editoriale e design potranno essere personalizzati |
| Amministrazione | Moderazione resistente al ricrawl, riconciliazione, recruiter/prezzi, fonti, ticket prioritari e risposta, retry email | Il supporto premium richiede un operatore |
| API offerte | JSON/RSS, gestione chiavi UI/HTTP, hash, revoca, filtri, paginazione, 60 richieste/minuto | API del proprio catalogo; non compatibilità byte-per-byte con quella del concorrente |
| Ambiente | D1 fino a 0023, R2, code, cron giornaliero discovery/crawl 6 ore; controllo e generazione configurazione; build OpenNext | Risorse Cloudflare, dominio, mittente e secret di produzione |

## Prezzi del riferimento

Nel [modulo annunci](https://web3.career/post-web3-job): base $299; assistenza $99; logo $49; highlight $99 o colore personalizzato $149; pin 1/3/7/14/30 giorni a $49/$99/$149/$199/$299. Configurazione predefinita osservata $695, rinnovo ogni 30 giorni. Senza upsell $299.

Nel [bundle](https://web3.career/post-web3-job/bundle) sono stati controllati tutti i valori pari da 2 a 50: sconto 20% per 2, 29% per 4, 30% per 6, poi +1 punto ogni due annunci fino a 51% per 48; 55% per 50. Con configurazione da $695: 2=$1.112, 24=$10.175, 32=$12.677, 40=$14.734, 50=$15.638. Crediti dichiarati validi 24 mesi.

Nella [pubblicità](https://web3.career/ads): quattro posizioni $4.999/$3.999/$2.999/$1.999 per mese. Lo stato degli slot occupati del concorrente non è stato copiato. Per il [catalogo candidati](https://web3.career/hire) il prezzo riservato non è stato verificato: il progetto richiede di configurare un prezzo proprio.

## Evidenze

Il [report di preparazione online](qa/2026-09-21-readiness.md) contiene i risultati finali, le correzioni e i confini del collaudo. I [test del 17](qa/2026-09-17-auth-payments-discovery.md), [pagamenti del 19](qa/2026-09-19-payment-recovery.md) e [flussi del 21](qa/2026-09-21-functional-workflows.md) restano evidenze storiche; i conteggi e le attività aperte di quei checkpoint sono superati dal report finale.

Non si dichiara equivalenza assoluta al 100% con le funzioni riservate e gli accordi commerciali di Web3.career. Una prova sul dominio vero resterà necessaria dopo il collegamento dei servizi, prima di accettare pagamenti reali. Nessuna attivazione online è stata effettuata.
