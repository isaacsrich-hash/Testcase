import test from 'node:test';
import {spawn} from 'node:child_process';import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';
test('private multiplayer sessions and chat survive server restarts',async()=>{
const data=mkdtempSync('/tmp/kindred-api-');const port=3199;let server;
async function start(){server=spawn(process.execPath,['server/index.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),DATA_DIR:data},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',c=>reject(Error('Server exited '+c)));});}
async function stop(){server.kill();await new Promise(r=>server.once('exit',r));}
async function req(path,body,token,expected=200){const r=await fetch(`http://127.0.0.1:${port}/api${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(token||'')},body:body?JSON.stringify(body):undefined});const d=await r.json();assert.equal(r.status,expected,JSON.stringify(d));return d;}
try{await start();const a=await req('/session',{name:'Alex'}),b=await req('/session',{name:'Robin'}),stranger=await req('/session',{name:'Stranger'});
let r=await req('/rooms',{title:'Family night',practice:false},a.token);assert.equal(r.state.status,'waiting');await req('/rooms/'+r.id,null,stranger.token,404);const joined=await req('/join',{code:r.code},b.token);assert.equal(joined.state.players.length,2);
r=await req('/rooms/'+r.id+'/start',{},a.token);assert.equal(r.state.status,'active');assert.equal(r.state.players[1].hand,undefined);
r=await req('/rooms/'+r.id+'/move',{type:'discard',index:0,pile:2,version:r.version},a.token);assert.equal(r.state.turn,1);const version=r.version;
await req('/rooms/'+r.id+'/move',{type:'discard',index:0,pile:0,version:version-1},b.token,409);
await req('/rooms/'+r.id+'/chat',{body:'See you at the table!'},a.token);
await stop();await start();r=await req('/rooms/'+r.id,null,b.token);assert.equal(r.version,version);assert.equal(r.state.turn,1);assert.equal(r.messages.at(-1).body,'See you at the table!');assert.equal(r.state.players[0].discards[2].length,1);const d=await req('/dashboard',null,b.token);assert.equal(d.leaderboard.length,2);
const tokens={[a.id]:a.token,[b.id]:b.token};
for(let i=0;i<4000&&r.state.status==='active';i++){
 const id=r.state.players[r.state.turn].id;r=await req('/rooms/'+r.id,null,tokens[id]);
 const p=r.state.players.find(p=>p.id===id);let action;
 const options=[{source:'stock',index:0,value:p.top},...p.hand.map((value,index)=>({source:'hand',index,value})),...p.discards.map((pile,index)=>({source:'discard',index,value:pile.at(-1)}))];
 for(const o of options){const target=r.state.builds.findIndex(pile=>o.value!==undefined&&(o.value===0||o.value===pile.length+1));if(target>=0){action={type:'play',...o,target};break;}}
 action||=p.hand.length?{type:'discard',index:p.hand.length-1,pile:i%4}:{type:'pass',index:0};
 r=await req('/rooms/'+r.id+'/move',{...action,version:r.version},tokens[id]);
}
assert.equal(r.state.status,'completed');const final=await req('/dashboard',null,a.token);const winner=final.leaderboard.find(p=>p.id===r.state.winner);assert.equal(winner.wins,1);assert.equal(winner.played,1);assert.equal(winner.points,r.state.points);assert.ok(winner.points>=25);
console.log('PASS: a full multiplayer match awards the winner correct persisted leaderboard points.');
console.log('PASS: private-room authorization, two-user join, hidden hands, turn persistence, stale-action protection, chat persistence, and restart recovery.');
}finally{if(server?.exitCode===null)await stop();}

});
