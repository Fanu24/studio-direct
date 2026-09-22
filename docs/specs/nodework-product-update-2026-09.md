* Nodework: differenziazione dal competitor e creazione prodotto unico  
* Specifica di aggiornamento del sito. Prompt strutturato per Codex.  
* Sito in sviluppo: https://nodework-web.xavier-ff2.workers.dev (pagina di riferimento: /post-web3-job). Versione documento: settembre 2026\.

* # 0\. Istruzioni per Codex

* Sei uno sviluppatore full-stack senior che lavora sul repository di Nodework, un job aggregator per il settore web3/crypto. Questo documento è la specifica completa degli aggiornamenti da implementare. Va letto per intero prima di scrivere codice.

* ### 0.1 Prima di iniziare

* 1\.       Esplora il repository e identifica: framework e runtime (il sito gira su Cloudflare Workers), ORM e schema del database, sistema di autenticazione, provider di pagamento, sistema email, job scheduler/cron disponibili, come sono implementati oggi il form in /post-web3-job, gli upsell e il listing dei job.  
* 2\.       Scrivi un file PLAN.md nella root che mappa ogni sezione di questo documento (2.1, 2.2, ...) ai moduli, file e migrazioni che toccherai, nell'ordine delle fasi della sezione 8\. Segnala esplicitamente ogni punto in cui la spec entra in conflitto con l'esistente e la scelta che fai.  
* 3\.       Solo dopo il piano, implementa fase per fase. Ogni fase deve lasciare il sito funzionante e deployabile.

* ### 0.2 Regole vincolanti

* •         Non rompere route, URL pubblici o dati esistenti. Le migrazioni devono essere additive e reversibili; i job già pubblicati devono continuare a funzionare con i nuovi campi a null o con default sensati.  
* •         Tutti i prezzi vivono in un unico file di configurazione (pricing.ts o equivalente), espressi in centesimi USD. Nessun prezzo hardcoded nei componenti, nelle email o nei test.  
* •         Ogni feature nuova è dietro un feature flag (env o tabella feature\_flags) così da poterla attivare in produzione in modo graduale.  
* •         Tutti i testi visibili all'utente sono in inglese. I commenti nel codice in inglese. Questo documento è in italiano solo per comodità di chi lo scrive.  
* •         Distingui sempre tra post nativi (creati dal form, a pagamento) e post aggregati (importati da fonti esterne). Le feature a pagamento, le restrizioni e le candidature interne valgono solo per i post nativi. I post aggregati hanno apply esterno e non compaiono nelle statistiche di conversione.  
* •         Per ogni feature: test unitari sulla logica di business (pricing, crediti, match score, finestra early access, selezione featured member) e almeno un test end-to-end sul flusso principale.  
* •         Se qualcosa è ambiguo, scegli la soluzione più semplice coerente con il resto della spec, annotala in PLAN.md e vai avanti. Non fermarti ad aspettare chiarimenti.  
* •         Nessun dato finto in produzione. I seed servono solo per ambiente di sviluppo e test.

* # 1\. Glossario e ruoli

| Termine | Definizione |
| :---- | :---- |
| Recruiter / Company account | Utente aziendale. Può avere più membri (seat). Possiede una company page, i job post nativi, il piano annuale e la fatturazione. |
| Candidate (free) | Utente candidato registrato con profilo. Può candidarsi ai post aperti, lasciare recensioni alle aziende, comparire nel database. |
| Premium candidate | Candidato con abbonamento attivo (mensile o annuale). Ha accesso anticipato ai post con Early Access, priorità di visibilità e altri perk (sezione 3.2). |
| Piano annuale (Starter, Growth, Scale, Platinum) | Abbonamento annuale del company account con job post inclusi e perk crescenti (sezione 2.4). Targhette: Bronze, Silver, Gold, Platinum. |
| Post nativo | Job post creato dal form del sito, pagato a consumo o con un credito del piano. |
| Post aggregato | Job post importato automaticamente da fonti esterne. Apply esterno, nessuna feature a pagamento, nessuna candidatura interna. |
| Early Access | Add-on del post: per le prime 12 ore solo i Premium candidate possono candidarsi. Il post resta visibile a tutti (sezione 2.3). |
| Talent Search | Motore di ricerca sul database candidati con inviti. Solo Platinum (sezione 4.1). |
| Featured Member of the Day | Un Premium candidate scelto a caso ogni giorno e messo in evidenza gratis per 24 ore (sezione 3.3). |
| Admin | Utente interno con accesso a moderazione recensioni, tassonomie, feature flag, override. |

*  

* # 2\. Lato recruiter

* ## 2.1 Form Job Post: aggiornamento dei dati

* Il form in /post-web3-job va rifatto con i campi sotto. I campi obbligatori mostrano un asterisco rosso accanto alla label e validazione inline al blur e al submit. L'ordine dei campi nel form è quello dell'elenco.

* ### Campi obbligatori

* 4\.       Job title. Testo, max 120 caratteri.  
* 5\.       Job description. Editor rich text (grassetto, elenchi, link, titoli h3). Salvare HTML sanificato e una versione plain text per ricerca e SEO. Min 200 caratteri.  
* 6\.       Company name. Autocomplete sulle aziende già presenti; se il nome non esiste, viene creata una nuova company page (sezione 2.5) collegata al company account.  
* 7\.       Company website. URL validata (https obbligatorio, normalizzazione del dominio).  
* 8\.       Salary range. Due campi numerici salary\_min e salary\_max (max \>= min), select currency con USD predefinito e le maggiori valute internazionali (USD, EUR, GBP, CHF, CAD, AUD, SGD, AED, JPY, HKD, INR, BRL, PLN, SEK, NOK, DKK, CZK, TRY, MXN, ZAR), select period (Yearly predefinito, Monthly, Hourly). Sotto il range, due checkbox:  
* ◦          crypto\_payment\_available: "Salary or fee can be paid in crypto". Flag informativo, gratuito, aperto a tutti. Mostra il badge "Crypto pay" sulla card e sulla pagina del job e alimenta il filtro "Crypto payment" nel listing e i salary insights (sezione 4.3).  
* ◦          hide\_salary: "Hide salary range from the public (+$25)". Il range resta obbligatorio e viene usato in forma aggregata (salary insights, filtri per fascia), ma sulla pagina pubblica compare "Not disclosed". Selezionarla aggiunge l'upsell al carrello. Gratis per Growth, Scale e Platinum (sezione 2.4).  
* 9\.       Work arrangement. Radio: Remote, Hybrid, On-site. Governa la visibilità delle due sezioni seguenti.  
* 10\.   Location. Visibile solo con Hybrid o On-site. Autocomplete città basato su un dataset standardizzato (GeoNames o Places API): l'utente digita, il sistema propone "City, Region, Country" e salva city\_id, nome canonico, country\_code, regione, lat/lng e time zone IANA. Nessun testo libero: si evitano nomenclature diverse e typo per la stessa città. Possibile aggiungere più location (fino a 5\) per post multi-sede.  
* 11\.   Candidate eligibility. Visibile solo con Remote (Location scompare). Multi-select con lista pre-caricata e senza doppioni: paesi (ISO 3166-1), continenti (Africa, Asia, Europe, North America, South America, Oceania) e aree economiche/regionali (Worldwide, EU, EEA, EMEA, UK & Ireland, DACH, Nordics, CEE, CIS, MENA, APAC, SEA, ANZ, LATAM, North America). Ogni voce ha un type (country, continent, region) e una lista di country code risolti, così il matching col candidato è sempre su paesi. Checkbox "Restrict by time zone instead": nasconde la lista geografica e mostra una selezione di intervalli in UTC (da UTC-12 a UTC+14, inclusi gli offset a mezz'ora), con "from" e "to". Niente GMT o nomi localizzati. Salvare come eligibility\_mode (geo | timezone) e regole strutturate.  
* 12\.   Required skills. Da 1 a 3, typeahead sulla tassonomia skill (sezione 4.6): l'utente scrive, il sistema propone per nome canonico e alias. Sostituisce l'attuale "Main skill".  
* 13\.   Languages. Fino a 3 lingue. Typeahead sull'elenco lingue (ISO 639-1), per ogni lingua livello (A1, A2, B1, B2, C1, C2, Native) e toggle Required / Preferred.  
* 14\.   Application method. Radio: "Redirect to a website" oppure "Email". Con Redirect compare il campo obbligatorio Application URL; con Email compare il campo obbligatorio Applications email. In entrambi i casi le candidature vengono registrate nella recruiter dashboard (sezione 2.6): con Email il sito raccoglie candidatura e CV, li salva e li inoltra all'indirizzo; con Redirect il click su Apply di un candidato loggato crea un record application con stato redirected e snapshot del profilo prima di aprire l'URL; il click anonimo viene solo contato.

* ### Campi opzionali

* •         Preferred skills. Fino a 12, stessa tassonomia. Sostituisce "Other skills".  
* •         Benefits. Multi-select sulla tassonomia benefit. Skill e benefit sono due tassonomie separate e disgiunte: una voce non può esistere in entrambe (vincolo a livello di dati e validazione all'inserimento).  
* •         Company X e Company LinkedIn. URL validate.

* ### Rimuovere

* •         I campi "Main skill" e "Other skills" e tutti gli upsell attuali non elencati nella sezione 2.2.

* ## 2.2 Prezzi a consumo

* Prezzo base del job post: 129 USD, 30 giorni online, condivisione sui social del sito inclusa (sezione 4.5). Rimuovere ogni altro upsell esistente e sostituirlo con la tabella seguente. Il checkout mostra il riepilogo voce per voce, il totale e un campo coupon.

| Voce | Prezzo | Note |
| :---- | :---- | :---- |
| Job post base | $129 | 30 giorni, social share inclusa. Scalato da un credito se l'azienda ha un piano attivo. |
| Hide salary range | \+$25 | Vedi 2.1. Gratis da Growth in su. |
| Pinned post 1 giorno | \+$35 | Post fissato in cima al listing e card evidenziata. |
| Pinned post 3 giorni | \+$65 |   |
| Pinned post 7 giorni | \+$120 |   |
| Pinned post 14 giorni | \+$175 |   |
| Pinned post 30 giorni | \+$245 |   |
| Early Access (12h) | \+$19.99 | Vedi 2.3. Acquistabile da chiunque, piani inclusi. |

*    
* Ordinamento del listing: prima i post pinnati (per scadenza pin più lontana), poi tutti gli altri per max(published\_at, bumped\_at) decrescente. I post aggregati seguono la stessa regola ma non possono essere pinnati.  
* Pin acquistato su un post di un piano: si somma alla durata inclusa dal piano (es. Growth ha 24h incluse, compra 3 giorni: pin totale 4 giorni).

* ## 2.3 Add-on Early Access (restrizione 12 ore) e info box

* ### Comportamento

* •         All'acquisto viene salvato early\_access\_until \= published\_at \+ 12h.  
* •         Durante la finestra il post è pubblico e indicizzabile come tutti gli altri, ma il pulsante Apply è attivo solo per Premium candidate loggati. Per i post con Redirect l'URL di destinazione non deve essere presente nel DOM prima della fine della finestra: il redirect passa da un endpoint server che verifica lo stato dell'utente.  
* •         Candidato non premium loggato: pulsante in stato disabilitato con countdown "Early access for Premium members. Opens in 7h 12m". Al click si apre una bubble con: spiegazione in una frase, CTA "Go Premium", link "Notify me when it opens" (crea una notifica email allo scadere della finestra).  
* •         Utente anonimo: stesso pulsante, bubble con "Log in" e "Go Premium".  
* •         Un candidato invitato dal recruiter (shortlist, sezione 2.4, o Talent Search, sezione 4.1) bypassa la finestra.  
* •         Allo scadere della finestra il post torna normale senza alcuna azione manuale. La card nel listing mostra un piccolo tag "Early access" con il tempo residuo.  
* •         Flag di configurazione EARLY\_ACCESS\_FREE\_FIRST\_POST (default false): se attivo, il primo post di ogni nuovo company account ha l'add-on incluso gratis.

* ### Info box nel form

* Nel form, accanto alla checkbox "Early access (12h) \+$19.99", c'è un'icona "i". All'hover del mouse e al focus da tastiera (e al tap su mobile) si apre un tooltip con questo testo:  
* Why enable Early Access? For the first 12 hours only Premium members can apply. Premium members are active, verified candidates with complete profiles, so your first applications come from people who actually match the role instead of mass-applies. Your post is public and shared from minute one; everyone else can apply as soon as the window closes.  
* Il tooltip è un componente riutilizzabile (InfoTooltip) con aria-describedby, chiusura con Esc e posizionamento automatico.

* ## 2.4 Piani annuali (Premium aziende)

* Quattro piani, solo annuali, pagati in anticipo. Ogni piano assegna un numero di job post inclusi (crediti), una targhetta per la company page e un insieme crescente di perk. La tabella è la fonte di verità; le specifiche di ogni perk seguono.

|   | Starter | Growth | Scale | Platinum |
| :---- | :---- | :---- | :---- | :---- |
| Prezzo / anno | $360 | $575 | $880 | $1,500 |
| Job post inclusi | 3 | 5 | 8 | Illimitati (fair use: 30/anno, max 5 attivi) |
| Post extra oltre gli inclusi | $120 | $115 | $110 | $50 oltre il fair use |
| Targhetta company page | Bronze | Silver | Gold | Platinum |
| Durata post | 45 gg | 45 gg | 60 gg | 60 gg |
| Match score candidati | Sì | Sì | Sì | Sì |
| Export candidature CSV | Sì | Sì | Sì | Sì |
| Bump gratuito per post | 1 | 1 | 1 | 1 |
| Seat recruiter | 2 | 3 | 5 | Illimitati |
| Pin incluso per post | No | 24 h | 3 gg | 7 gg |
| Hide salary incluso | No | Sì | Sì | Sì |
| Analytics per post | No | Sì | Sì | Sì |
| Risposta alle recensioni | No | Sì | Sì | Sì |
| Shortlist automatica \+ inviti | No | No | 20 inviti / post | 20 inviti / post |
| Carosello "Hiring now" in home | No | No | Sì | Sì |
| Menzione in newsletter | No | No | 1 / mese | Ogni post |
| Talent Search | No | No | No | Incluso, 100 inviti / mese |
| Confidential post | No | No | No | Add-on $49 / post |
| Feed ATS / API | No | No | No | Sì |
| Supporto prioritario | No | No | No | Sì |
| Early Access | $19.99 / post | $19.99 / post | $19.99 / post | $19.99 / post |

*    
* Nessun piano include l'Early Access: è un add-on a consumo uguale per tutti (sezione 2.3).

* ### Specifiche dei perk (come costruirli)

* Crediti job post. All'attivazione del piano l'account riceve post\_credits pari ai post inclusi, con scadenza alla data di rinnovo. Alla pubblicazione di un post nativo, se ci sono crediti disponibili se ne consuma uno e il prezzo base non viene addebitato (gli add-on sì). Esauriti i crediti, il post base costa il prezzo "post extra" del piano al posto di $129. I crediti non usati scadono al rinnovo e non si cumulano. Tabella plan\_credits con granted, used, expires\_at; ogni consumo scrive in credit\_ledger.  
* Fair use Platinum. Contatore annuale posts\_published\_in\_period e vincolo active\_posts \<= 5\. Al 31esimo post nell'anno il prezzo diventa $50; al sesto post attivo il pulsante Publish è disabilitato con messaggio "You have 5 active posts. Close one to publish a new one." Entrambi i limiti sono in pricing.ts.  
* Durata post. expires\_at \= published\_at \+ durata del piano (30 giorni senza piano, 45 Starter e Growth, 60 Scale e Platinum). Il recruiter può chiudere il post prima. Reminder email 3 giorni prima della scadenza con pulsante "Extend 30 days" a prezzo post extra.  
* Match score. Per ogni candidatura ricevuta su un post nativo si calcola un punteggio 0-100 confrontando il profilo del candidato col post: required skills coperte (peso 50, proporzionale), preferred skills coperte (peso 20), lingue con livello \>= richiesto (peso 20; se una lingua Required manca, il punteggio lingue è 0), eligibility geografica o di time zone soddisfatta (peso 10). Il risultato è mostrato come percentuale con chip di dettaglio (es. "2/3 required skills", "English C1 ok", "Outside eligible countries"). La lista candidature è ordinabile per score. Il calcolo va in un modulo puro matchScore(post, profile) con test unitari; lo stesso modulo alimenta shortlist e Talent Search.  
* Export CSV. Pulsante nella lista candidature di un post: esporta nome, email, link profilo, match score, stato, data, risposte al form. Tutti i piani.  
* Targhetta company page. Campo badge\_tier sul company account, derivato dal piano attivo. Icona Bronze / Silver / Gold / Platinum accanto al nome sulla company page, sulle card dei job e nella pagina del job, con tooltip "Nodework Starter partner" ecc. Alla scadenza del piano la targhetta sparisce.  
* Bump. Pulsante "Bump to top" nella dashboard, una volta per post e per ciclo di vita: imposta bumped\_at \= now() e il post risale in cima alla sezione non pinnata (vedi ordinamento in 2.2). Contatore bumps\_used sul post.  
* Seat. Sezione Team nella dashboard: invito via email con ruolo Owner o Member. Il limite di seat dipende dal piano (2, 3, 5, illimitati); senza piano 1 seat. Member può creare e gestire post e candidature, non la fatturazione.  
* Pin incluso. Alla pubblicazione, se il piano prevede un pin, viene creato automaticamente un record pins con durata 24h / 3 giorni / 7 giorni e source \= plan. Eventuali pin acquistati si sommano.  
* Hide salary incluso. Per Growth, Scale e Platinum la checkbox del form non aggiunge l'upsell al carrello e mostra "Included in your plan".  
* Analytics per post. Pagina per ogni post nativo con: visualizzazioni uniche al giorno, click su Apply, candidature, tasso di conversione, provenienza raggruppata (direct, Google, X, LinkedIn, Telegram, newsletter, altri referrer). Grafico a 30 giorni. Dati da una tabella eventi job\_events (job\_id, type, referrer\_group, session\_hash, created\_at) scritta lato server, senza tracker di terze parti. Starter vede solo il totale di view e candidature.  
* Risposta alle recensioni. Owner e Member di un'azienda con piano Growth o superiore possono pubblicare una risposta per ogni recensione ricevuta (sezione 4.2). Una sola risposta per recensione, modificabile, etichettata "Company response", visibile a tutti.  
* Shortlist automatica e inviti (Scale, Platinum). Per ogni post nativo attivo, un job giornaliero calcola i 20 candidati con match score più alto tra quelli discoverable, con profilo completo almeno al 60% e che soddisfano l'eligibility. La shortlist è visibile nella pagina del post in dashboard con score e chip. Il recruiter può cliccare "Invite to apply": il candidato riceve email e notifica in-app con link al post, la candidatura risultante è marcata invited \= true e bypassa l'Early Access. Quota: 20 inviti per post, contatore visibile. I candidati invitati e quelli che si sono già candidati escono dalla shortlist al refresh.  
* Carosello "Hiring now" (Scale, Platinum). Widget in homepage con i loghi delle aziende Scale e Platinum che hanno almeno un post nativo attivo. Ordine casuale a ogni caricamento, massimo 12 loghi, ogni logo linka alla company page. Cache 5 minuti.  
* Menzione in newsletter. La newsletter settimanale (sezione 4.7) ha un blocco "Featured jobs". Scale: l'azienda sceglie un post al mese da includere (pulsante "Feature in newsletter", contatore mensile). Platinum: ogni post nativo pubblicato nella settimana entra automaticamente. Tabella newsletter\_features (job\_id, issue\_date, source).  
* Talent Search (Platinum). Vedi sezione 4.1. Incluso nel piano con 100 inviti al mese; pacchetti extra di 50 inviti a $49 configurati in pricing.ts.  
* Confidential post (add-on Platinum, $49 / post). Il post non è indicizzato (noindex), non appare nel listing pubblico, nei feed, nei social, nella newsletter e non viene aggregato. È raggiungibile solo dai candidati loggati tramite Talent Search, shortlist, inviti e link diretto. Il nome azienda può essere sostituito da "Confidential" con settore opzionale. Serve per ricerche riservate (sostituzioni, progetti sotto NDA).  
* Feed ATS / API (Platinum). Pagina Integrations: l'azienda inserisce il board token di Greenhouse, Lever o Ashby; il sistema importa le posizioni dalle rispettive API pubbliche una volta al giorno, le mappa sui campi del form (con una schermata di mapping per skill e lingue, che le API non forniscono) e le pubblica come post nativi consumando i crediti del piano. Le posizioni chiuse nell'ATS vengono chiuse su Nodework.  
* Supporto prioritario (Platinum). I messaggi di supporto dagli account Platinum hanno tag "priority" e SLA di risposta 24 ore lavorative. Etichetta "Priority support" nella dashboard con link diretto.

* ## 2.5 Company page

* •         URL /companies/{slug}. Creata automaticamente al primo post; modificabile dall'Owner: logo, banner, descrizione, sito, X, LinkedIn, sede, dimensione.  
* •         Mostra: targhetta del piano, badge "Verified employer" (assegnato quando l'email dell'Owner ha lo stesso dominio del sito aziendale o dopo verifica admin), elenco dei post attivi, riepilogo recensioni (stelle e numero, sezione 4.2), badge "Crypto-friendly" se almeno un post attivo ha crypto\_payment\_available.  
* •         Indicizzabile, con dati strutturati Organization.

* ## 2.6 Recruiter dashboard

* •         Lista post con stato (draft, pending payment, active, early access, expired, closed, confidential), scadenza, crediti residui, pin attivi, bump disponibili.  
* •         Per ogni post: candidature con match score, filtri per score e stato, stadi minimi (Applied, Reviewed, Interview, Rejected, Hired) aggiornabili in blocco, note interne, export CSV, analytics (se nel piano), shortlist (se nel piano).  
* •         Sezioni: Team, Billing (piano, rinnovo, fatture, add-on acquistati), Integrations (Platinum), Company page.  
* •         Il cambio di stadio di una candidatura genera una notifica al candidato (sezione 3.2, tracking candidature).

* # 3\. Lato candidato

* Oggi il sito non ha profili candidato. Vanno creati da zero: sono la base del database per Talent Search, delle candidature interne, delle recensioni e del premium candidato. Il modello di riferimento è ProZ.com: profilo gratuito e pubblico per tutti, abbonamento a pagamento per accesso anticipato e visibilità.

* ## 3.1 Profilo candidato (gratuito)

* •         Registrazione con email e password, più i provider social già presenti nel sistema di auth. Verifica email obbligatoria per candidarsi e recensire.  
* •         Campi: nome, headline (max 80 caratteri), foto, location (stesso autocomplete città del form job, oppure "Remote from {country}"), time zone UTC, skills (dalla tassonomia, fino a 30), lingue con livello CEFR o Native, esperienze (ruolo, azienda, periodo, descrizione breve), link (GitHub, X, LinkedIn, portfolio, indirizzo wallet opzionale), CV in PDF, disponibilità (Open to work, Open to contracts, Not looking), work arrangement preferito, checkbox "Open to being paid in crypto".  
* •         Pagina pubblica /talent/{handle}, indicizzabile se il candidato lascia attivo "Public profile" (default attivo, disattivabile in privacy). Dati strutturati Person.  
* •         Toggle "Discoverable by recruiters" (default attivo): controlla la presenza in Talent Search e nelle shortlist. Toggle "Eligible for Featured Member of the Day" (default attivo, sezione 3.3).  
* •         Profile completeness: percentuale calcolata sui campi compilati con pesi (foto 5, headline 10, location 5, skills 25, lingue 15, esperienze 20, CV 10, link 10). Mostrata con barra e suggerimenti "Add 3 skills to reach 80%". Usata come soglia per shortlist e featured member.  
* •         Sezione "My applications" con stato aggiornato dal recruiter, e "Saved jobs".

* ## 3.2 Candidate Premium

|   | Free | Premium |
| :---- | :---- | :---- |
| Prezzo | 0 | $9.99 / mese oppure $79 / anno |
| Profilo pubblico e presenza nel database | Sì | Sì |
| Apply sui post con Early Access | Dopo la finestra di 12 ore | Subito |
| Posizione nella lista candidature vista dal recruiter | Normale | In cima a parità di score, con badge Premium |
| Posizione in Talent Search e shortlist | Normale | Priorità a parità di score |
| Recensioni aziende | Solo stelle e conteggio | Testo completo di ogni recensione |
| Chi ha visto il profilo | No | Sì (nome azienda, data) |
| Tracking candidature | Stato base | Stato dettagliato \+ notifiche a ogni cambio di stadio |
| Featured Member of the Day | No | Idoneo |
| Badge Premium sul profilo | No | Sì |

*    
* •         Fatturazione tramite il provider esistente, mensile o annuale, cancellabile in qualsiasi momento; alla scadenza il profilo torna free senza perdere dati.  
* •         Salary insights (sezione 4.3) e filtro "Crypto payment" restano aperti a tutti, anche non registrati. Non sono perk premium.  
* •         Verified badge, una tantum $39, indipendente dal premium: verifica identità tramite provider (es. Stripe Identity) o revisione manuale admin. Mostra un segno di spunta sul profilo, nella lista candidature e in Talent Search. Campo verified\_at sul profilo.

* ## 3.3 Featured Member of the Day

* Ogni giorno il sito sceglie a caso un Premium candidate e lo mette in evidenza gratis per 24 ore, come fa ProZ con il "featured member". È un perk del premium candidato a costo zero che dà visibilità reale e un motivo concreto per completare il profilo.

* ### Selezione

* •         Job schedulato ogni giorno alle 00:00 UTC (cron di Cloudflare o scheduler esistente), idempotente: se per la data corrente esiste già un record in featured\_members, non fa nulla.  
* •         Pool idoneo: premium attivo, profilo pubblico e discoverable, completeness \>= 80%, toggle "Eligible for Featured Member" attivo, non selezionato negli ultimi 90 giorni. Se il pool è vuoto, la finestra scende a 30 giorni; se è ancora vuoto, nessun featured per quel giorno e il widget non viene mostrato.  
* •         Scelta uniforme casuale nel pool (ORDER BY random() LIMIT 1 o equivalente). Salvare featured\_members (date, user\_id, selected\_at, source \= auto | admin).  
* •         Override admin: pulsante per impostare manualmente il featured di un giorno (source \= admin), utile per test e casi speciali.

* ### Dove compare per 24 ore

* •         Widget in homepage "Featured member of the day": foto, nome, headline, prime 3 skill, lingue, disponibilità, badge Premium e Verified se presenti, pulsanti "View profile" e, per i recruiter Platinum, "Invite to a job".  
* •         Box nella sidebar delle pagine job (post nativi e aggregati).  
* •         Prima posizione fissa nei risultati di Talent Search, con etichetta "Featured today".  
* •         Badge "Featured today" sul profilo pubblico.

* ### Notifiche e storico

* •         Email e notifica in-app al candidato al momento della selezione ("You are today's featured member") con link al profilo e invito a condividerlo.  
* •         Pagina pubblica /featured con lo storico (data, profilo), indicizzabile, che funge anche da prova sociale del premium.  
* •         Statistiche per il candidato: view del profilo nelle 24 ore rispetto alla media, mostrate nella sua dashboard il giorno dopo.

* ## 3.4 Flusso di candidatura

* •         Post con Email: form interno con dati precompilati dal profilo, CV (dal profilo o upload), messaggio opzionale, eventuali domande del recruiter. Salva application, invia email al recruiter, conferma al candidato.  
* •         Post con Redirect: candidato loggato, click su Apply crea application con stato redirected e apre l'URL in nuova scheda; candidato anonimo viene contato in job\_events e reindirizzato senza record.  
* •         Post aggregato: Apply esterno diretto, nessun record.  
* •         Stati del pulsante Apply: Open, Early access (countdown, sezione 2.3), Applied (già candidato), Closed, Not eligible (se il candidato non rientra nell'eligibility: pulsante attivo ma con avviso "This role is limited to {regions}").  
* •         Un candidato può candidarsi una sola volta per post.

* # 4\. Feature trasversali (da creare da zero)

* ## 4.1 Talent Search

* Motore di ricerca sul database candidati, riservato agli account Platinum. È la feature che giustifica il prezzo del piano alto e va costruita con la stessa cura del listing job.  
* •         Pagina /dashboard/talent con filtri: skills (AND/OR), lingue con livello minimo, paese o area, time zone, disponibilità, work arrangement, "open to crypto", completeness minima, Verified, Premium, ultima attività. Ricerca full text su headline ed esperienze.  
* •         Risultati: card con foto, headline, skill principali, lingue, location, disponibilità, badge, e match score rispetto a un post selezionabile dal menu ("Match against: {post}"). Ordinamento per rilevanza, score, ultima attività. Featured Member of the Day sempre in prima posizione con etichetta.  
* •         Pulsante "Invite to apply": scelta del post nativo attivo, messaggio opzionale; invia email e notifica in-app, crea invitations (company\_id, job\_id, candidate\_id, sent\_at, status). Quota 100 inviti al mese per account, contatore visibile, pacchetti extra in pricing.ts. Un candidato non può ricevere più di un invito per lo stesso post.  
* •         Ogni visualizzazione di un profilo da Talent Search scrive in profile\_views (viewer\_company\_id, candidate\_id, viewed\_at) per il perk "Chi ha visto il profilo".  
* •         Privacy: sono ricercabili solo i candidati con "Discoverable by recruiters" attivo. I dati di contatto non sono esposti: il contatto avviene solo tramite invito. Rate limit e log degli accessi per prevenire scraping.  
* •         Senza piano Platinum la pagina mostra una preview con i filtri disabilitati e la CTA di upgrade.

* ## 4.2 Recensioni aziende

* Equivalente della Blue Board di ProZ applicato al web3: i candidati valutano le aziende con cui hanno avuto un processo di selezione o un rapporto di lavoro. Le stelle sono pubbliche per tutti, il testo delle recensioni è riservato ai Premium candidate. Le aziende con piano Growth o superiore possono rispondere.

* ### Chi può recensire

* •         Candidati registrati con email verificata, account creato da almeno 7 giorni. Una recensione per azienda ogni 12 mesi per candidato, modificabile entro 30 giorni.

* ### Contenuto della recensione

* •         Valutazione complessiva 1-5 (obbligatoria).  
* •         Tre valutazioni specifiche 1-5: "Paid on time" (per contractor e dipendenti), "Transparent process", "Would work with them again".  
* •         Tipo di rapporto: Interview only, Contract, Full-time employee, Bounty/grant.  
* •         Testo, 50-1500 caratteri, obbligatorio.  
* •         Checkbox "Post anonymously": il nome non viene mostrato pubblicamente ma resta associato internamente.

* ### Visualizzazione

* •         Sulla company page: media stelle, numero recensioni, medie delle tre voci, distribuzione. Visibile a tutti, anche non registrati.  
* •         Elenco recensioni con testo: visibile solo ai Premium candidate loggati. Per gli altri le card sono sfocate con CTA "Go Premium to read reviews".  
* •         Risposta dell'azienda sotto la recensione, etichettata "Company response" (perk Growth+).  
* •         Sulle card dei job e nella pagina job: stelle e conteggio accanto al nome azienda.

* ### Moderazione e anti-abuso

* •         Le recensioni entrano in coda pending e vengono pubblicate dopo controllo admin (o automaticamente dopo 48 ore se un filtro automatico su parole vietate, link e ripetizioni non le blocca; scelta configurabile).  
* •         Pulsante "Report" per aziende e utenti; una recensione segnalata torna in coda.  
* •         Le aziende non possono nascondere o cancellare le recensioni. Solo l'admin può rimuoverle, con motivazione registrata.  
* •         Blocco delle recensioni da account con lo stesso dominio email dell'azienda recensita.

* ## 4.3 Salary insights (pubblici, SEO)

* Pagine aggregate sugli stipendi calcolate dai salary range dei job post (nativi e aggregati quando il range è disponibile). Aperte a tutti, senza registrazione: sono contenuto SEO e valore gratuito per chi visita.  
* •         Route: /salaries (indice), /salaries/{role} (es. solidity-developer), /salaries/{role}/{location} dove location è un paese oppure remote.  
* •         Il ruolo è derivato da una tassonomia di job title canonici (sezione 4.6) mappata sul titolo del post con regole e alias; i titoli non mappati non entrano nelle statistiche.  
* •         Metriche per pagina: mediana, quartili, min e max del range normalizzato in USD annui (conversione con tassi FX aggiornati ogni giorno, mensile x12, orario x2080), numero di post nel campione, percentuale di post con pagamento in crypto, distribuzione per work arrangement, trend degli ultimi 12 mesi, esempi di post attivi.  
* •         I range con hide\_salary contribuiscono al calcolo aggregato ma non vengono mai mostrati singolarmente.  
* •         Soglia minima: sotto 5 post nel campione la pagina non viene generata (o è noindex). Ricalcolo giornaliero in una tabella materializzata salary\_stats.  
* •         Dati strutturati e meta description generate dai numeri; link incrociati tra ruoli, paesi e listing filtrato.  
* •         Nella pagina di ogni job nativo, box "Salary insight": posizione del range del post rispetto alla mediana del ruolo ("15% above median for Solidity Developer, Remote").

* ## 4.4 Flag pagamento in crypto

* •         Campo crypto\_payment\_available sul job (sezione 2.1), impostato dal recruiter. Gratuito e disponibile a tutti.  
* •         Badge "Crypto pay" su card e pagina job, filtro nel listing, parametro nell'API di ricerca, statistica nei salary insights, badge "Crypto-friendly" sulla company page.  
* •         Sul profilo candidato il campo speculare "Open to being paid in crypto" è un filtro in Talent Search. Non incide sul match score.

* ## 4.5 Condivisione social (inclusa nel post base)

* •         Alla pubblicazione di ogni post nativo viene accodato un job social\_share che pubblica su X, LinkedIn e Telegram del sito con template fisso (titolo, azienda, arrangement, range se visibile, badge crypto, link). Retry con backoff, log in social\_shares (job\_id, channel, status, posted\_at, external\_id).  
* •         I post confidential non vengono condivisi. I post aggregati non vengono condivisi.  
* •         Nella dashboard il recruiter vede i link ai post social generati.

* ## 4.6 Tassonomie e dati di riferimento

* •         Skills: tabella skills (id, name, slug, category, aliases\[\], status). Categorie: smart contracts, blockchain infra, frontend, backend, security, data, product, design, marketing, community, BD, operations, legal e altre. Seed iniziale di almeno 300 skill web3 e generali. Le richieste di nuove skill dal form vanno in status \= pending e sono approvate da admin; finché pending non sono ricercabili.  
* •         Benefits: tabella benefits (id, name, slug, aliases\[\]), seed di almeno 40 voci. Vincolo: nessun slug può esistere in entrambe le tabelle skills e benefits (controllo in migrazione e in validazione).  
* •         Lingue: ISO 639-1 con nome inglese e nativo; livelli CEFR A1-C2 più Native, ordinati.  
* •         Città: dataset standardizzato (GeoNames cities15000 o Places API) con city\_id, nome, regione, country\_code, lat/lng, time zone IANA.  
* •         Paesi, continenti, aree: tabella regions (id, name, type, country\_codes\[\]) con la lista della sezione 2.1, senza duplicati semantici.  
* •         Time zone: lista fissa degli offset UTC da \-12 a \+14 inclusi i mezzi (es. UTC+5:30, UTC+9:30).  
* •         Job title canonici (per salary insights): tabella job\_roles (id, name, slug, aliases\[\], patterns\[\]) con seed di almeno 60 ruoli web3.  
* •         Valute: elenco della sezione 2.1 con tassi FX in fx\_rates (currency, rate\_to\_usd, updated\_at) aggiornati da un job giornaliero.

* ## 4.7 Notifiche, email e newsletter

* •         Sistema di notifiche in-app (notifications (user\_id, type, payload, read\_at)) e email transazionali con template: candidatura ricevuta, cambio stadio, invito, early access aperto, featured member, recensione pubblicata, risposta dell'azienda, scadenza post, crediti in esaurimento, rinnovo piano.  
* •         Newsletter settimanale ai candidati iscritti: post della settimana, blocco "Featured jobs" (perk Scale e Platinum), featured member della settimana, salary insight del mese. Gestione iscrizione e disiscrizione conforme.  
* •         Preferenze di notifica per utente.

* # 5\. Modello dati

* Elenco delle entità nuove o modificate. Adatta nomi e tipi alle convenzioni dell'ORM in uso; mantieni i nomi dei campi indicati per coerenza col resto del documento.

| Tabella | Campi principali | Note |
| :---- | :---- | :---- |
| jobs (modifica) | salary\_min, salary\_max, salary\_currency, salary\_period, hide\_salary, crypto\_payment\_available, work\_arrangement, eligibility\_mode, application\_method, application\_url, application\_email, early\_access\_until, expires\_at, bumped\_at, bumps\_used, is\_confidential, source (native | aggregated | ats), company\_id, plan\_credit\_id | Rimuovere main\_skill e other\_skills dopo la migrazione dei dati in job\_skills. |
| job\_locations | job\_id, city\_id | Solo Hybrid e On-site, fino a 5\. |
| job\_eligibility | job\_id, region\_id | (utc\_from, utc\_to) | Solo Remote. |
| job\_skills | job\_id, skill\_id, kind (required | preferred) | Max 3 required, 12 preferred. |
| job\_languages | job\_id, language\_code, level, kind (required | preferred) | Max 3\. |
| job\_benefits | job\_id, benefit\_id |   |
| job\_addons | job\_id, type (hide\_salary | pin | early\_access | confidential), duration\_days, price\_cents, source (purchase | plan), starts\_at, ends\_at | Un pin per riga; più pin si sommano. |
| job\_events | job\_id, type (view | apply\_click | application), referrer\_group, session\_hash, created\_at | Analytics. |
| companies | name, slug, website, x\_url, linkedin\_url, logo, banner, description, badge\_tier, verified\_at |   |
| company\_members | company\_id, user\_id, role (owner | member) | Limite seat per piano. |
| company\_plans | company\_id, tier, started\_at, renews\_at, status, posts\_published\_in\_period |   |
| plan\_credits / credit\_ledger | company\_id, granted, used, expires\_at / company\_id, job\_id, delta, reason, created\_at |   |
| candidate\_profiles | user\_id, handle, headline, photo, city\_id | remote\_country, utc\_offset, availability, work\_arrangement, open\_to\_crypto, cv\_url, is\_public, is\_discoverable, featured\_optin, completeness, verified\_at, premium\_until |   |
| candidate\_skills / candidate\_languages / candidate\_experiences / candidate\_links | user\_id \+ riferimenti |   |
| applications | job\_id, user\_id, status (redirected | applied | reviewed | interview | rejected | hired), match\_score, score\_breakdown (json), invited, cv\_url, message, created\_at | Unica per (job\_id, user\_id). |
| shortlists | job\_id, user\_id, match\_score, computed\_at | Ricalcolo giornaliero. |
| invitations | company\_id, job\_id, candidate\_id, source (shortlist | talent\_search), sent\_at, status | Quote per post e per mese. |
| profile\_views | viewer\_company\_id, candidate\_id, viewed\_at |   |
| featured\_members | date, user\_id, selected\_at, source (auto | admin) | Unique su date. |
| company\_reviews | company\_id, user\_id, overall, paid\_on\_time, transparent\_process, would\_work\_again, relationship, body, is\_anonymous, status (pending | published | removed), created\_at | Una per (company\_id, user\_id) ogni 12 mesi. |
| review\_responses | review\_id, company\_id, body, created\_at | Una per recensione. |
| skills, benefits, regions, job\_roles, fx\_rates, salary\_stats | Vedi sezioni 4.3 e 4.6 |   |
| social\_shares, newsletter\_features, notifications | Vedi sezioni 4.5 e 4.7 |   |
| candidate\_subscriptions | user\_id, plan (monthly | annual), status, renews\_at, provider\_ref | Premium candidato. |

*  

* # 6\. Route e pagine

| Route | Stato | Descrizione |
| :---- | :---- | :---- |
| /post-web3-job | Modifica | Nuovo form (2.1), checkout con add-on (2.2, 2.3), consumo crediti. |
| /pricing | Modifica o nuova | Prezzo base, add-on, i quattro piani con tabella perk, premium candidato. |
| /dashboard/\* | Modifica | Post, candidature, analytics, shortlist, team, billing, integrations, company page. |
| /dashboard/talent | Nuova | Talent Search (Platinum). |
| /companies/{slug} | Nuova | Company page con recensioni. |
| /talent/{handle} | Nuova | Profilo pubblico candidato. |
| /account/\* | Nuova | Profilo, candidature, salvati, privacy, premium, verifica. |
| /featured | Nuova | Storico Featured Member of the Day. |
| /salaries, /salaries/{role}, /salaries/{role}/{location} | Nuove | Salary insights. |
| /jobs (listing) | Modifica | Filtri: crypto payment, arrangement, eligibility, skill, lingua, fascia salariale; ordinamento con pin e bump; tag Early access; stelle azienda. |
| /jobs/{slug} | Modifica | Nuovi campi, stati del pulsante Apply, box salary insight, sidebar featured member, recensioni. |
| /admin/\* | Nuova o modifica | Moderazione recensioni, tassonomie pending, feature flag, override featured member. |

*  

* # 7\. Configurazione prezzi

* Struttura attesa del file di configurazione. I valori sono in centesimi USD.  
* export const pricing \= {  
*   jobPost: { base: 12900, durationDays: 30 },  
*   addons: {  
* 	hideSalary: 2500,  
* 	earlyAccess: { price: 1999, hours: 12 },  
* 	pin: { 1: 3500, 3: 6500, 7: 12000, 14: 17500, 30: 24500 },  
* 	confidential: 4900, // Platinum only  
*   },  
*   plans: {  
* 	starter:  { price: 36000, posts: 3,  extraPost: 12000, durationDays: 45, seats: 2, pinDays: 0, badge: "bronze" },  
* 	growth:   { price: 57500, posts: 5,  extraPost: 11500, durationDays: 45, seats: 3, pinDays: 1, badge: "silver", hideSalaryIncluded: true, analytics: true, reviewReplies: true },  
* 	scale:    { price: 88000, posts: 8,  extraPost: 11000, durationDays: 60, seats: 5, pinDays: 3, badge: "gold", shortlist: { invitesPerPost: 20 }, hiringNow: true, newsletter: "monthly" },  
* 	platinum: { price: 150000, posts: null, fairUse: { perYear: 30, maxActive: 5, overPrice: 5000 }, durationDays: 60, seats: null, pinDays: 7, badge: "platinum",  
*             	talentSearch: { invitesPerMonth: 100, extraPack: { invites: 50, price: 4900 } }, confidential: true, atsFeed: true, prioritySupport: true, newsletter: "every\_post" },  
*   },  
*   candidate: { premiumMonthly: 999, premiumAnnual: 7900, verifiedBadge: 3900 },  
*   flags: { EARLY\_ACCESS\_FREE\_FIRST\_POST: false },  
* };  
*  

* # 8\. Fasi di implementazione e criteri di accettazione

* Ogni fase termina con test verdi, migrazioni applicate e PLAN.md aggiornato. Non iniziare la fase successiva se i criteri della precedente non sono soddisfatti.

* ### Fase 1\. Fondamenta: tassonomie, form, pricing a consumo

* •         Sezioni 2.1, 2.2, 4.4, 4.6, 7\.  
* •         Accettazione: il form rifiuta il submit senza i campi obbligatori e mostra gli asterischi; Location compare solo con Hybrid/On-site e Candidate eligibility solo con Remote; lo switch time zone funziona; le skill sono selezionabili solo dalla tassonomia e nessuna voce è sia skill che benefit; il checkout calcola correttamente base \+ add-on da pricing.ts; un post con hide\_salary mostra "Not disclosed" ma il range è salvato; il badge "Crypto pay" appare e filtra; l'ordinamento pin/bump è corretto; i post esistenti restano visibili.

* ### Fase 2\. Profili candidato, candidature interne, Early Access

* •         Sezioni 3.1, 3.4, 2.3, 2.6 (candidature e stadi), 4.7 (notifiche base).  
* •         Accettazione: un candidato registrato ha un profilo pubblico con completeness; le candidature via Email e via Redirect creano record in dashboard; il pulsante Apply rispetta i cinque stati; durante l'Early Access un non premium non può candidarsi e l'URL di redirect non è nel DOM; il tooltip "i" si apre con hover, focus e tap; allo scadere della finestra il post si apre senza intervento.

* ### Fase 3\. Piani annuali e perk

* •         Sezioni 2.4, 2.5, 2.6 (team, billing).  
* •         Accettazione: l'attivazione di un piano crea i crediti e la targhetta; la pubblicazione consuma un credito e non addebita il base; esauriti i crediti si applica il prezzo post extra; durata post, pin incluso, hide salary incluso e seat rispettano il piano; il match score è calcolato e testato su almeno 10 casi; bump funziona una volta; analytics registra view e click; il fair use Platinum blocca il sesto post attivo; alla scadenza del piano i perk si disattivano.

* ### Fase 4\. Candidate Premium e Featured Member of the Day

* •         Sezioni 3.2, 3.3.  
* •         Accettazione: l'abbonamento premium si attiva e si cancella; un premium si candida durante l'Early Access; la lista candidature mette i premium in cima a parità di score; il job giornaliero seleziona un featured idoneo, è idempotente, rispetta i 90 giorni e il fallback; il widget appare in home, nella sidebar job e in cima a Talent Search per 24 ore; il candidato riceve la notifica; /featured mostra lo storico.

* ### Fase 5\. Recensioni aziende e salary insights

* •         Sezioni 4.2, 4.3.  
* •         Accettazione: un candidato idoneo può lasciare una sola recensione per azienda ogni 12 mesi; le stelle sono pubbliche, il testo solo per premium; la moderazione funziona; Growth+ può rispondere; le pagine salary si generano solo sopra la soglia, con conversione valute corretta e percentuale crypto; il box salary insight appare nella pagina job.

* ### Fase 6\. Shortlist, Talent Search, newsletter, carosello, social share

* •         Sezioni 2.4 (shortlist, hiring now, newsletter), 4.1, 4.5, 4.7 (newsletter).  
* •         Accettazione: la shortlist giornaliera contiene solo candidati discoverable ed eleggibili; gli inviti rispettano le quote e bypassano l'Early Access; Talent Search è accessibile solo a Platinum, filtra correttamente e registra le profile view; il carosello mostra solo Scale/Platinum con post attivi; la newsletter include i post giusti; ogni post nativo viene condiviso sui social con log.

* ### Fase 7\. Confidential post, feed ATS, supporto prioritario, admin

* •         Sezioni 2.4 (confidential, ATS, supporto), 6 (admin).  
* •         Accettazione: un post confidential non è indicizzato né nel listing, nei feed, nei social e nella newsletter, ma è raggiungibile da inviti e link diretto; l'import da Greenhouse, Lever e Ashby crea post nativi consumando i crediti e chiude quelli rimossi; l'admin gestisce recensioni, tassonomie pending, feature flag e override featured.

* # 9\. Vincoli e cose da non fare

* •         Non rendere a pagamento i salary insights né il flag crypto: sono pubblici per scelta di prodotto.  
* •         Non nascondere mai la pagina di un post con Early Access: la restrizione riguarda solo il pulsante Apply.  
* •         Non permettere alle aziende di cancellare o nascondere recensioni.  
* •         Non esporre email o contatti dei candidati in Talent Search: il contatto passa solo dagli inviti. Stessa cosa vale per il profilo che non può contenere nessun dettaglio di contatto (altrimenti chiunque può scrivere in privato al di fuori della piattaforma).  
* •         Non applicare add-on, restrizioni o candidature interne ai post aggregati.  
* •         Non usare tracker di terze parti per le analytics dei post.  
* •         Non duplicare i prezzi fuori da pricing.ts.  
* •         Non introdurre dipendenze pesanti per il rich text, il tooltip o i typeahead se il framework in uso offre già una soluzione.