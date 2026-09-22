import type { LandingKind } from '@gaming/shared';

export type SearchState = Record<string, string | string[] | undefined>;
const facets = ['company', 'seniority', 'tag', 'tags', 'remote', 'location', 'benefit', 'salary_min', 'salary_max', 'crypto_payment'];

/** Keep only public search facets. Navigation never carries a stale page or selected job. */
export function searchFacets(state: SearchState = {}): Record<string, string> {
  return Object.fromEntries(facets.flatMap(key => {
    const value = state[key];
    const first = Array.isArray(value) ? value[0] : value;
    return first ? [[key, first]] : [];
  }));
}

export function landingSearchState(landing?: LandingKind): Record<string, string> {
  if (!landing) return {};
  switch (landing.kind) {
    case 'remote': return { remote: '1' };
    case 'tag': case 'remote-tag': return {
      ...(landing.kind === 'remote-tag' ? {remote: '1'} : {}),
      tags: (landing.tags ?? [landing.tag]).join(','),
    };
    case 'benefit': return {benefit: landing.benefit};
    case 'city': return {location: landing.city};
    case 'country': return {location: landing.country};
    case 'region': return {location: landing.region};
    case 'intern': case 'entry-level': return {tag: landing.kind};
  }
}

export function searchHref(state: SearchState, changes: Record<string, string | undefined> = {}) {
  const query = Array.isArray(state.q) ? state.q[0] : state.q;
  const params = new URLSearchParams({...searchFacets(state), ...(query ? {q: query} : {})});
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(key, value); else params.delete(key);
  }
  return '/jobs' + (params.size ? '?' + params : '');
}
