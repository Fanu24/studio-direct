import { HOMEPAGE_CLAIM } from "../lib/copy";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main>
      <h1>Studio Direct</h1>
      <p>{HOMEPAGE_CLAIM}</p>
    </main>
  );
}
