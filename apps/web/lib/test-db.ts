import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import type {Database} from './platform';
/** Actual migrations against SQLite, with D1's transactional batch semantics. Test-only. */
export function testDatabase(){
 const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite');
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 const dir=fileURLToPath(new URL('../../../packages/db/migrations/',import.meta.url));
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(dir+file,'utf8'));
 const db:Database={prepare(query){let bindings:unknown[]=[];return {bind(...values){bindings=values;return this;},async first<T>(column?:string){const row=sql.prepare(query).get(...bindings);return (column?row?.[column]:row)??null as T|null;},async all<T>(){return {results:sql.prepare(query).all(...bindings) as T[]};},async run(){return {meta:{changes:Number(sql.prepare(query).run(...bindings).changes)}};}};},async batch(statements){sql.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};return {sql,db};
}
