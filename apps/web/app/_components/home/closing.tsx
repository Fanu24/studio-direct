import Link from "next/link";

export function Closing({ listed, hidden }: { listed: number; hidden: number }) {
  return (
    <section className="closing">
      <div className="container closing__inner" data-reveal>
        <h2 className="closing__stat">
          <span className="closing__num">{listed.toLocaleString("en-US")}</span> remote and
          hybrid gaming roles indexed,{" "}
          <span className="closing__num">{hidden.toLocaleString("en-US")}</span> of them not
          on LinkedIn.
        </h2>
        <div className="cluster">
          <Link className="button button--lg" href="/jobs">
            Browse jobs
          </Link>
          <Link className="button button--secondary button--lg" href="/login">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
