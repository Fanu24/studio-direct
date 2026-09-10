import type { Metadata } from "next";
import Link from "next/link";

import { ArticleLayout } from "../_components/article-layout";

export const metadata: Metadata = {
  title: "What is Web3",
  description:
    "A long Nodework explainer of Web 1.0, Web 2.0, and Web 3.0: ownership, blockchains, how crypto differs from Web3, the metaverse, and how those words show up in jobs.",
  alternates: { canonical: "/what-is-web3" },
};

const TOC = [
  { href: "#web1-web2-web3", label: "Web 1.0, Web 2.0, and Web 3.0" },
  { href: "#ownership", label: "Ownership is a key" },
  { href: "#blockchain", label: "What a blockchain is doing" },
  { href: "#crypto-versus-web3", label: "Crypto versus Web3" },
  { href: "#metaverse", label: "The metaverse" },
  { href: "#jobs", label: "How the word shows up on Nodework" },
] as const;

export default function WhatIsWeb3Page() {
  return (
    <ArticleLayout
      lead="A Nodework essay on the term as history, as infrastructure, and as it shows up in crypto job listings. Not a protocol whitepaper."
      related={
        <p className="cluster" style={{ marginTop: 32 }}>
          <Link className="text-link" href="/jobs">
            Browse Web3 jobs
          </Link>
          <Link className="text-link" href="/faq">
            FAQ
          </Link>
          <Link className="text-link" href="/learn-web3">
            Learn Web3
          </Link>
          <Link className="text-link" href="/web3-non-tech-salaries">
            Non-tech salaries
          </Link>
        </p>
      }
      title="What is Web3"
      toc={TOC}
    >
      <section className="m-reveal" data-reveal>
        <h2 id="web1-web2-web3">Web 1.0, Web 2.0, and Web 3.0</h2>
        <p>
          The useful story is about who could publish, who stored the result, and
          who could take it away. Web 1.0 was a read-mostly web: sites you visited,
          documents you downloaded, and directories you browsed. You could run your
          own server if you were technical. Most people did not. The unit of the
          product was a page.
        </p>
        <p>
          Web 2.0 made publishing cheap and identity portable across apps. You
          posted, commented, uploaded, and streamed. A handful of platforms took
          the write path and kept the database. That was convenient. It also meant
          your graph, your media, and often your livelihood sat in an account you
          did not own. The unit of the product became the feed, the profile, and
          the API key someone else could revoke.
        </p>
        <p>
          Web 3.0, in the sense job posts mean when they say Web3, is an attempt
          to put some of that state on shared ledgers: balances, ownership records,
          and programs that keep running when the original company is asleep. The
          slogan is read, write, own. The engineering is wallets, keys, fees, and
          a public history that is hard to quietly edit. The social claim is larger
          than the software. Nodework cares about the software and the jobs, not
          about declaring the slogan finished.
        </p>
      </section>

      <section className="m-reveal" data-reveal>
        <h2 id="ownership">Ownership is a key, not a feeling</h2>
        <p>
          On a platform, ownership is a row in someone else's database plus a
          terms-of-service clause. On a public chain, ownership is closer to
          control of a key that can sign a transfer the network will honor. That
          is a real difference. It is also a sharp one. Lose the key and the
          network will not restore your account because you sent a nice email.
          Give an application unlimited approval and it can empty a wallet without
          a second password prompt that looks like a bank.
        </p>
        <p>
          Tokens, NFTs, and DAO votes are all implementations of that idea with
          different blast radii. A token can be a payment rail, a governance
          widget, or a speculative chip. An NFT can be a ticket, a game item, or
          a receipt for a file that still lives on a server. None of those uses
          are automatic just because a contract exists. Product teams still have
          to decide what the user can do when the page loads, and they still have
          to staff support when a transaction fails.
        </p>
      </section>

      <section className="m-reveal" data-reveal>
        <h2 id="blockchain">What a blockchain is doing in this story</h2>
        <p>
          A blockchain is a replicated log with rules for who may append the next
          batch of entries. Nodes check those rules. Users broadcast signed
          transactions. Smart contracts are programs stored in that log. The
          useful property for products is shared state that is not a single
          company's Postgres. The costly property is that everyone pays for
          replication, mistakes are public, and upgrades need a story (a new
          contract, a proxy, a social process).
        </p>
        <p>
          Not every product needs that. Many job listings that say blockchain are
          really about an API in front of someone else's chain, an indexer, a
          wallet UI, or an exchange matching engine. Those are still Web3 jobs on
          this board. They are not all protocol research. If you are new, the
          practical skill is being able to explain which trust assumptions a
          listing still has: a sequencer, a bridge, a custodian, an oracle, or a
          support agent with an admin tool.
        </p>
      </section>

      <section className="m-reveal" data-reveal>
        <h2 id="crypto-versus-web3">Crypto is not the same word as Web3</h2>
        <p>
          Cryptocurrency is an asset and a payment system. Bitcoin is a
          cryptocurrency. Ether is a cryptocurrency used as fuel and as a unit of
          account on Ethereum. Web3 is the looser label for products, companies,
          and jobs around those rails. A role can be Web3-flavored and never list
          a ticker. A token can exist with almost no product. Mixing the words is
          how job seekers end up applying to a market-making desk when they wanted
          a design seat, or to a wallet UI when they wanted protocol work.
        </p>
        <p>
          On Nodework, tags exist to split that mix: Bitcoin, DeFi, Solidity,
          marketing, and the rest. Salary pages only use jobs that printed both a
          minimum and a maximum. A Web3 URL is not proof you will be paid in a
          token. The posting has to say that.
        </p>
      </section>

      <section className="m-reveal" data-reveal>
        <h2 id="metaverse">The metaverse, briefly</h2>
        <p>
          The metaverse is a claim about a persistent shared space: avatars,
          worlds, and real-time interaction. Job posts glue it to Web3 when a
          game or a world wants on-chain items, a marketplace, or a token. They
          are not synonyms. You can ship a wallet with no world to walk around
          in. You can ship a virtual space that settles in an ordinary database.
          If a listing says metaverse, read for the engine, the live-ops plan,
          and whether the chain is in the critical path or only in the pitch.
        </p>
      </section>

      <section className="m-reveal" data-reveal>
        <h2 id="jobs">How the word shows up on Nodework</h2>
        <p>
          On Nodework, Web3 is also a hiring label. Employers use it for products
          that settle value on a chain, hold user assets in a wallet, or run
          infrastructure those products depend on. The catalog also includes
          adjacent crypto work: exchanges, custody, on-chain analytics, and the
          non-tech roles that ship those products. That one sentence is not the
          whole definition. It is how a job board has to read a messy market.
        </p>
        <p>
          Engineering listings cluster around smart contracts, node software,
          wallets, and the APIs in front of them. Product, design, and research
          roles translate that stack into something a user can finish.
          Operations, legal, and community roles keep the same companies running.
          If a posting says Web3 and then describes a generic SaaS job, treat the
          description as the source of truth. Intern and entry-level landings
          collect jobs tagged that way. Remote landings collect jobs tagged
          remote or hybrid.
        </p>
        <p>
          You do not need to believe the most ambitious version of the essay to
          use the catalog. You need to match a skill you have (or can show) to a
          listing that names it. Search, open a tag such as Solana or Solidity,
          or filter to remote. If you are still mapping the space, the FAQ covers
          how Apply and salary rollups work on this site.
        </p>
      </section>
    </ArticleLayout>
  );
}
