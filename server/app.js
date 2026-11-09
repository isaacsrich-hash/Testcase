import express from 'express';
import {storageProblem} from './storage-errors.js';
import {randomUUID,randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {createGame,move,botTurn,publicGame} from './game.js';
class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
const clean=(s,max=40)=>String(s||'').trim().slice(0,max);
export function createApp(store,{serveStatic=true}={}) {
 const app=express();app.use(express.json({limit:'16kb'}));
 app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');next();});
 // Return responses only after the entire transaction commits successfully.
 function route(fn,{anonymous=false}={}){return async(req,res,next)=>{
  try{const data=await store.transaction(async db=>{
   let user;
   if(!anonymous){user=await db.get('SELECT * FROM users WHERE token=?',req.headers.authorization?.replace('Bearer ','')||'');if(!user)throw new HttpError(401,'Please reconnect your profile.');}
   return fn({req,db,user});
  });res.json(data);}catch(e){next(e);}
 };}
 async function roomView(db,r,id){return {...r,state:publicGame(JSON.parse(r.state),id),messages:(await db.all('SELECT * FROM messages WHERE room=? ORDER BY id DESC LIMIT 100',r.id)).reverse(),members:await db.all('SELECT u.id,u.name,u.country FROM members m JOIN users u ON u.id=m."user" WHERE room=?',r.id)};}
 async function getRoom(db,id,user,{lock=false}={}){
  const r=await db.get('SELECT * FROM rooms WHERE id=?'+(lock?' FOR UPDATE':''),id);
  if(!r||!await db.get('SELECT * FROM members WHERE room=? AND "user"=?',id,user.id))throw new HttpError(404,'Match not found.');
  return r;
 }
 app.get('/api/health',route(async({db})=>{
  // Readiness checks do not create profiles or reveal player records.
  await db.get('SELECT id,token,name,country,family FROM users LIMIT 0');
  await db.get('SELECT id,title,family,host,practice,code,state,version,created FROM rooms LIMIT 0');
  await db.get('SELECT room,"user" FROM members LIMIT 0');
  await db.get('SELECT id,room,"user",name,body,created FROM messages LIMIT 0');
  return {status:'ready'};
 },{anonymous:true}));
 app.post('/api/session',route(async({req,db})=>{
  let u=await db.get('SELECT * FROM users WHERE token=?',req.body.token||'');
  if(!u&&req.body.restore)throw new HttpError(401,'This recovery file is not recognized by this server.');
  if(!u){const id=randomUUID();u={id,token:randomBytes(32).toString('hex'),name:clean(req.body.name)||'Alex',country:'Canada',family:id};await db.run('INSERT INTO users(id,token,name,country,family) VALUES(?,?,?,?,?)',u.id,u.token,u.name,u.country,u.family);}
  return u;
 },{anonymous:true}));
 app.patch('/api/profile',route(async({req,db,user})=>{
  await db.run('UPDATE users SET name=?,country=? WHERE id=?',clean(req.body.name)||user.name,clean(req.body.country)||user.country,user.id);
  return db.get('SELECT * FROM users WHERE id=?',user.id);
 }));
 app.get('/api/dashboard',route(async({db,user})=>{
  const rooms=(await db.all('SELECT r.* FROM rooms r JOIN members m ON m.room=r.id WHERE m."user"=? ORDER BY r.created DESC',user.id)).map(r=>({...r,state:publicGame(JSON.parse(r.state),user.id)}));
  const users=(await db.all('SELECT id,name,country FROM users WHERE family=?',user.family)).map(u=>({...u,wins:0,played:0,points:0}));
  for(const r of await db.all('SELECT state FROM rooms WHERE family=? AND practice=0',user.family)){
   const g=JSON.parse(r.state);if(g.status==='completed')for(const p of g.players){const u=users.find(u=>u.id===p.id);if(u){u.played++;if(g.winner===u.id){u.wins++;u.points+=g.points;}}}
  }
  return {rooms,leaderboard:users.sort((a,b)=>b.points-a.points),user};
 }));
 app.post('/api/rooms',route(async({req,db,user})=>{
  const practice=!!req.body.practice,id=randomUUID(),code=randomBytes(5).toString('hex');
  const players=[{id:user.id,name:user.name,country:user.country}];
  if(practice)players.push({id:'bot-mia',name:'Mia',country:'United Kingdom',bot:true},{id:'bot-leo',name:'Leo',country:'Australia',bot:true});
  const g=practice?createGame(players):{players,status:'waiting',builds:[[],[],[],[]],turn:0,log:[],deck:[],recycle:[]};
  await db.run('INSERT INTO rooms(id,title,family,host,practice,code,state,created) VALUES(?,?,?,?,?,?,?,?)',id,clean(req.body.title)||'Sunday family table',user.family,user.id,Number(practice),code,JSON.stringify(g),new Date().toISOString());
  await db.run('INSERT INTO members(room,"user") VALUES(?,?)',id,user.id);
  if(practice)await db.run('INSERT INTO messages(room,"user",name,body,created) VALUES(?,?,?,?,?)',id,'system','Spite n Malice','Welcome to your practice table. Your progress is saved after every move.',new Date().toISOString());
  return roomView(db,await db.get('SELECT * FROM rooms WHERE id=?',id),user.id);
 }));
 app.post('/api/join',route(async({req,db,user})=>{
  // A row lock serializes concurrent joins against the four-seat limit.
  const r=await db.get('SELECT * FROM rooms WHERE code=? FOR UPDATE',clean(req.body.code,30));
  if(!r)throw new HttpError(404,'That invitation was not found. Check the invite code.');
  const g=JSON.parse(r.state);
  if(!await db.get('SELECT * FROM members WHERE room=? AND "user"=?',r.id,user.id)){
   if(g.status!=='waiting'||g.players.length>=4)throw new HttpError(400,'This table has already started or is full.');
   g.players.push({id:user.id,name:user.name,country:user.country});
   await db.run('INSERT INTO members(room,"user") VALUES(?,?)',r.id,user.id);
   await db.run('UPDATE users SET family=? WHERE id=?',r.family,user.id);
   await db.run('UPDATE rooms SET state=?,version=version+1 WHERE id=?',JSON.stringify(g),r.id);
  }
  return roomView(db,await db.get('SELECT * FROM rooms WHERE id=?',r.id),user.id);
 }));
 app.get('/api/rooms/:id',route(async({req,db,user})=>roomView(db,await getRoom(db,req.params.id,user),user.id)));
 app.post('/api/rooms/:id/start',route(async({req,db,user})=>{
  const r=await getRoom(db,req.params.id,user,{lock:true}),g=JSON.parse(r.state);
  if(r.host!==user.id||g.status!=='waiting'||g.players.length<2)throw new HttpError(400,'The host can start once at least two players have joined.');
  await db.run('UPDATE rooms SET state=?,version=version+1 WHERE id=?',JSON.stringify(createGame(g.players)),r.id);
  return roomView(db,await db.get('SELECT * FROM rooms WHERE id=?',r.id),user.id);
 }));
 app.post('/api/rooms/:id/move',route(async({req,db,user})=>{
  const r=await getRoom(db,req.params.id,user,{lock:true});
  if(req.body.version!==r.version)throw new HttpError(409,'The table changed. Please choose your move again.');
  const g=JSON.parse(r.state);move(g,user.id,req.body);
  while(g.status==='active'&&g.players[g.turn].bot)botTurn(g);
  await db.run('UPDATE rooms SET state=?,version=version+1 WHERE id=?',JSON.stringify(g),r.id);
  return roomView(db,await db.get('SELECT * FROM rooms WHERE id=?',r.id),user.id);
 }));
 app.post('/api/rooms/:id/chat',route(async({req,db,user})=>{
  const r=await getRoom(db,req.params.id,user,{lock:true}),body=clean(req.body.body,500);
  if(!body)throw new HttpError(400,'Write a message first.');
  const recent=await db.get('SELECT created FROM messages WHERE "user"=? ORDER BY id DESC LIMIT 1',user.id);
  if(recent&&Date.now()-Date.parse(recent.created)<500)throw new HttpError(429,'Give your last message a moment.');
  await db.run('INSERT INTO messages(room,"user",name,body,created) VALUES(?,?,?,?,?)',r.id,user.id,user.name,body,new Date().toISOString());
  return roomView(db,r,user.id);
 }));
 app.use('/api',(req,res)=>res.status(404).json({error:'Not found.'}));
 if(serveStatic){app.use(express.static('dist'));app.get('/{*splat}',(req,res)=>res.sendFile(resolve('dist/index.html')));}
 app.use((err,req,res,next)=>{
  const issue=storageProblem(err);
  if(issue){console.error('Spite n Malice storage failure:',issue.code);return res.status(503).json(issue);}
  const status=err.status||(err.code?500:400);
  if(status>=500)console.error('Kindred request failed:',err.code||err.name);
  res.status(status).json({error:status>=500?'The game service is unavailable. Please try again.':err.message||'Something went wrong.'});
 });
 return app;
}
