# Nodework — sviluppo della piattaforma Web3 jobs

Progetto in sviluppo a partire da studio-direct. Il riferimento funzionale è Web3.career; le scelte e i dati del prototipo non costituiscono requisiti. Il lavoro sul design viene dopo la parità funzionale.

## Avvio locale

Node.js 24 LTS, pnpm 9.15.0:

```sh
pnpm install --frozen-lockfile
pnpm setup:local
pnpm dev
```

Aprire http://localhost:3000. Nessun servizio a pagamento viene attivato. Le email di login locali compaiono nel terminale; usare admin@example.test per il pannello amministratore locale. Nessun annuncio fittizio è inserito dal setup.

```sh
pnpm dev:crawler
pnpm typecheck
pnpm test
# Alternativa Windows per il caricamento della configurazione:
pnpm test:portable
```

- [Guida ambiente e attivazione](docs/AMBIENTE.md)
- [Stato di parità, verifiche e lavoro ancora aperto](docs/PARITA.md)

Il progetto non è ancora pronto per incassi reali né certificato al 100% rispetto al riferimento. I documenti AMBIENTE e PARITA prevalgono sui vecchi documenti descrittivi del prototipo per lo stato di implementazione. Le credenziali reali vanno nei secret dei worker, mai nel repository. Il deploy è manuale tramite workflow Linux dopo configurazione e collaudo sandbox.
