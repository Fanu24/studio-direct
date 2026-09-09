import { permanentRedirect } from "next/navigation";

/**
 * /companies was the old canonical company index. The canonical path is now
 * /web3-companies, which is what the reference taxonomy and every internal
 * link should use - this stays as a permanent redirect so old links and any
 * indexed URL keep resolving.
 */
export default function CompaniesRedirect() {
  permanentRedirect("/web3-companies");
}
