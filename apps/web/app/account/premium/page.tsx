import Link from 'next/link';
import {pricing,money} from '@gaming/shared';
import {platform,currentUser} from '../../../lib/platform';
import {candidatePremium} from '../../../lib/product/candidates';
import {loadProductFlags} from '../../../lib/product/flags';
import {requireTenantId} from '../../../lib/tenant';
import {PurchaseButton} from '../../_components/product/purchase-button';
export const dynamic='force-dynamic';
export const metadata={title:'Candidate Premium'};
export default async function Page(){const env=await platform(),user=await currentUser(env),flags=await loadProductFlags(env.DB,await requireTenantId(env.DB),env),active=user?await candidatePremium(env.DB,user.id):false;return <main className="container container--content stack"><h1>Candidate Premium</h1><p>Early applications, detailed application tracking, company reviews, profile visit history and eligibility for Featured Member of the Day.</p><p>Your profile and ordinary applications remain free. Identity verification is a separate review.</p>{active?<><p>Premium is active.</p><Link href="/account/billing">Manage subscription</Link></>:flags.PRODUCT_CANDIDATE_PREMIUM?<><PurchaseButton kind="candidate_premium" choice="monthly" label={money(pricing.candidate.premiumMonthly)+' / month'}/><PurchaseButton kind="candidate_premium" choice="annual" label={money(pricing.candidate.premiumAnnual)+' / year'}/></>:<p>Premium subscriptions are not available yet.</p>}<p>Cancel renewal any time. Your profile is retained when the subscription ends.</p><Link href="/account/verification">Identity verification</Link></main>;}
