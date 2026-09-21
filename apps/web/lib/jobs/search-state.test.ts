import {describe,it,expect} from 'vitest';
import {landingSearchState,searchFacets,searchHref} from './search-state';
import {remoteFilterHref,BoardSearch} from '../../app/_components/board-chrome';
import React from 'react';
Object.assign(globalThis,{React});
describe('search continuity',()=>{
  it('keeps geography and benefits when adding remote',()=>{
    expect(remoteFilterHref({kind:'city',city:'berlin'})).toBe('/jobs?location=berlin&remote=1');
    expect(remoteFilterHref({kind:'benefit',benefit:'pay-in-crypto'})).toBe('/jobs?benefit=pay-in-crypto&remote=1');
  });
  it('keeps all tags when submitting a combined landing search',()=>{
    const filters=landingSearchState({kind:'remote-tag',tag:'solidity',tags:['solidity','junior']});
    const tree=BoardSearch({remoteHref:'/jobs',remoteActive:true,filters});
    const inputs=React.Children.toArray(tree.props.children).flat().filter((x:any)=>x?.type==='input') as React.ReactElement<any>[];
    expect(inputs.map(x=>[x.props.name,x.props.value])).toEqual([['tags','solidity,junior'],['remote','1']]);
  });
  it('suggestion navigation preserves facets but clears stale selection and pagination',()=>{
    const url=new URL(searchHref({location:'berlin',benefit:'pto',remote:'1',q:'old',page:'9',job:'old',tags:'rust,junior'},{tag:'solidity',tags:undefined,q:undefined}),'https://example.com');
    expect(Object.fromEntries(url.searchParams)).toEqual({location:'berlin',benefit:'pto',remote:'1',tag:'solidity'});
    expect(searchFacets({source:'linkedin',hidden:'1',page:'4',location:['berlin','rome']})).toEqual({location:'berlin'});
  });
});
