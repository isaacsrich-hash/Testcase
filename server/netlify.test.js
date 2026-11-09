import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createPostgresStore} from './store.js';
import {createNetlifyHandler} from './netlify-handler.js';

test('Netlify function routing, Postgres migration, full match scoring, chat and cold-start recovery',async t=>{
 const directory=await mkdtemp('/tmp/kindred-postgres-');
 let pg=new PGlite(directory);let released=0;
 const pool={connect:async()=>({query:(text,params)=>pg.query(text,params),release:()=>released++})};
 t.after(async()=>{await pg.close();await rm(directory,{recursive:true,force:true});});
 const schema=await readFile(new URL('../database/supabase.sql',import.meta.url),'utf8');
 await pg.exec(schema);
 await pg.exec(schema); // Re-running the setup must not delete existing tables.
 assert.equal((await pg.query("SELECT table_name FROM information_schema.tables WHERE table_schema='kindred'")).rows.length,4);
 assert.equal((await pg.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='users'")).rows.length,0);
 let handler=createNetlifyHandler(createPostgresStore(pool));
 async function api(path,body,token,expected=200,direct=true){
  const response=await handler({httpMethod:body?'POST':'GET',path:(direct?'/.netlify/functions/api':'/api')+path,headers:{'content-type':'application/json',authorization:'Bearer '+(token||'')},body:body?JSON.stringify(body):'',isBase64Encoded:false},{});
  const text=Buffer.from(response.body,response.isBase64Encoded?'base64':'utf8').toString();
  assert.equal(response.statusCode,expected,text);assert.equal(response.headers['cache-control'],'no-store');
  return JSON.parse(text);
 }
 assert.equal((await api('/health')).status,'ready');
 const a=await api('/session',{name:'Alex'}),b=await api('/session',{name:'Sam'},null,200,false);
 let r=await api('/rooms',{practice:false,title:'Netlify game night'},a.token);
 await api('/rooms/'+r.id,null,b.token,404);
 r=await api('/join',{code:r.code},b.token);
 assert.equal(r.state.players.length,2);
 r=await api('/rooms/'+r.id+'/start',{},a.token);
 assert.equal(r.state.players[1].hand,undefined);
 r=await api('/rooms/'+r.id+'/move',{type:'discard',index:0,pile:1,version:r.version},a.token);
 await api('/rooms/'+r.id+'/move',{type:'discard',index:0,pile:1,version:r.version-1},b.token,409);
 await api('/rooms/'+r.id+'/chat',{body:'Hello from another country!'},a.token);
 const version=r.version;
 await pg.exec(schema); // Setup rerun must also preserve existing matches and chat.
 await pg.close();pg=new PGlite(directory);
 handler=createNetlifyHandler(createPostgresStore(pool));
 r=await api('/rooms/'+r.id,null,b.token);
 assert.equal(r.version,version);assert.equal(r.state.turn,1);assert.equal(r.messages.at(-1).body,'Hello from another country!');
 assert.equal(r.state.players[0].discards[1].length,1);
 const tokens={[a.id]:a.token,[b.id]:b.token};
 for(let i=0;i<4000&&r.state.status==='active';i++){
  const id=r.state.players[r.state.turn].id;r=await api('/rooms/'+r.id,null,tokens[id]);
  const p=r.state.players.find(p=>p.id===id);let action;
  const options=[{source:'stock',index:0,value:p.top},...p.hand.map((value,index)=>({source:'hand',index,value})),...p.discards.map((pile,index)=>({source:'discard',index,value:pile.at(-1)}))];
  for(const o of options){const target=r.state.builds.findIndex(pile=>o.value!==undefined&&(o.value===0||o.value===pile.length+1));if(target>=0){action={type:'play',...o,target};break;}}
  action||=p.hand.length?{type:'discard',index:p.hand.length-1,pile:i%4}:{type:'pass',index:0};
  r=await api('/rooms/'+r.id+'/move',{...action,version:r.version},tokens[id]);
 }
 assert.equal(r.state.status,'completed');
 const board=await api('/dashboard',null,a.token),winner=board.leaderboard.find(p=>p.id===r.state.winner);
 assert.equal(winner.wins,1);assert.equal(winner.points,r.state.points);
 assert.equal((await api('/session',{token:a.token,restore:true})).id,a.id);
 assert.ok(released>10);
});
