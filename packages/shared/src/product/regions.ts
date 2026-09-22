export type ReferenceCountry = {code: string; name: string; continent: string};
export type ReferenceRegion = {id: string; name: string; type: 'country' | 'continent' | 'region'; countryCodes: string[]};

// These are explicit recruiting regions, not assertions about political membership.
const GROUPS: Record<string, {name: string; codes: string}> = {
  eu: {name: 'EU', codes: 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'},
  'uk-ireland': {name: 'UK & Ireland', codes: 'GB IE'},
  dach: {name: 'DACH', codes: 'DE AT CH'},
  nordics: {name: 'Nordics', codes: 'DK FI IS NO SE AX FO GL'},
  cee: {name: 'CEE', codes: 'AL BA BG HR CZ EE HU XK LV LT ME MK PL RO RS SK SI'},
  cis: {name: 'CIS region', codes: 'AM AZ BY KZ KG MD RU TJ TM UZ'},
  mena: {name: 'MENA', codes: 'DZ BH EG IR IQ IL JO KW LB LY MA OM PS QA SA SY TN AE YE'},
  sea: {name: 'SEA', codes: 'BN KH ID LA MY MM PH SG TH TL VN'},
  anz: {name: 'ANZ', codes: 'AU NZ'},
  latam: {name: 'LATAM', codes: 'AR BO BR CL CO CR CU DO EC SV GF GT HT HN MX NI PA PY PE PR UY VE'},
};

/** Country sets are resolved at import, so matching never relies on region labels. */
export function buildReferenceRegions(countries: ReferenceCountry[]): ReferenceRegion[] {
  const all = [...new Set(countries.map(country => country.code))].sort();
  if (all.length !== countries.length || all.some(code => !/^[A-Z]{2}$/.test(code))) throw new Error('Invalid country reference.');
  const byContinent = (...codes: string[]) => countries.filter(country => codes.includes(country.continent)).map(country => country.code);
  const result: ReferenceRegion[] = countries.map(country => ({id: `country:${country.code}`, name: country.name.trim(), type: 'country', countryCodes: [country.code]}));
  for (const [code, name] of Object.entries({AF: 'Africa', AS: 'Asia', EU: 'Europe', NA: 'North America', SA: 'South America', OC: 'Oceania'})) {
    result.push({id: `continent:${code}`, name, type: 'continent', countryCodes: byContinent(code)});
  }
  const groups = {...GROUPS,
    worldwide: {name: 'Worldwide', codes: all.join(' ')},
    eea: {name: 'EEA', codes: `${GROUPS.eu.codes} IS LI NO`},
    emea: {name: 'EMEA', codes: [...byContinent('EU', 'AF'), ...GROUPS.mena.codes.split(' '), 'TR', 'CY', 'AM', 'AZ', 'GE'].join(' ')},
    apac: {name: 'APAC', codes: [...byContinent('AS', 'OC')].join(' ')},
  };
  for (const [id, group] of Object.entries(groups)) result.push({id: `region:${id}`, name: group.name, type: 'region', countryCodes: group.codes.split(' ')});
  for (const region of result) {
    region.countryCodes = [...new Set(region.countryCodes)].sort();
    if (!region.countryCodes.length || region.countryCodes.some(code => !all.includes(code))) throw new Error(`Unknown country in ${region.id}`);
  }
  if (new Set(result.map(region => region.name.toLowerCase())).size !== result.length) throw new Error('Duplicate region name.');
  return result;
}
