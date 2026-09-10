import { permanentRedirect } from "next/navigation";

/**
 * The growth leaderboard now lives under the company taxonomy at
 * /web3-companies/top-growing. This flat path stays as a permanent redirect
 * so old links and any indexed URL keep resolving.
 */
export default function TopGrowingRedirect() {
  permanentRedirect("/web3-companies/top-growing");
}
