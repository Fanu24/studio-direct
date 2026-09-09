import { permanentRedirect } from "next/navigation";

// The canonical route is the singular spelling, /highest-paid-developer-jobs
// (see ../highest-paid-developer-jobs/page.tsx): that is the URL web3.career
// links from its own pages and serves at 200, so it is the one that must
// carry the content. This plural spelling is a real URL that older links and
// some searchers use - it must not 404, so it 308s to the canonical page.
export default function HighestPaidDevelopersJobsPage() {
  permanentRedirect("/highest-paid-developer-jobs");
}
