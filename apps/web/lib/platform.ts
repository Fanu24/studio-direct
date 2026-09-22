import { getCloudflareContext } from '@opennextjs/cloudflare';
import { headers } from 'next/headers';
import { createAuth, type AuthEnv } from './auth/index';
import type {ProductFlag} from '@gaming/shared';

export interface Statement {
  bind(...values:unknown[]):Statement;
  first<T=Record<string,unknown>>(column?:string):Promise<T|null>;
  all<T=Record<string,unknown>>():Promise<{results:T[]}>;
  run():Promise<{meta?:{changes?:number}}>;
}
export interface Database { prepare(sql:string):Statement; batch(statements:Statement[]):Promise<unknown[]>; }
export type PlatformEnv = Omit<AuthEnv,'DB'> & Partial<Record<ProductFlag, string>> & {
  DB:Database; STRIPE_ENABLED?:string; STRIPE_SECRET_KEY?:string; STRIPE_WEBHOOK_SECRET?:string;
  FILES:{put(key:string,value:ArrayBuffer,options?:unknown):Promise<unknown>;get(key:string):Promise<{body:ReadableStream;httpMetadata?:{contentType?:string}}|null>;delete?(key:string):Promise<unknown>};
  ADMIN_EMAILS?:string;
};
export async function platform() {const {env}=await getCloudflareContext({async:true});return env as unknown as PlatformEnv;}
export async function currentUser(env:PlatformEnv, request?:Request) {
  return (await createAuth(env).api.getSession({headers:request?.headers ?? await headers()}))?.user ?? null;
}
export function sameOrigin(request:Request) {
  const origin=request.headers.get('origin');
  return !!origin && origin===new URL(request.url).origin;
}
export function httpUrl(value:unknown):string|null {
  if(typeof value!=='string')return null;
  try {const u=new URL(value); if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;return u.href;}catch{return null;}
}
export function appOrigin(env:PlatformEnv) {
  const url=httpUrl(env.SITE_URL || env.BETTER_AUTH_URL);
  if(!url)throw new Error('SITE_URL must be configured');
  return new URL(url).origin;
}
