import { randomInt } from 'node:crypto';
export function shuffledDeck() {
 const deck = [...Array.from({length:144},(_,i)=>i%12+1),...Array(18).fill(0)];
 for(let i=deck.length-1;i>0;i--){const j=randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];} return deck;
}
export function createGame(players){
 const g={deck:shuffledDeck(),recycle:[],players:players.map(p=>({...p,stock:[],hand:[],discards:[[],[],[],[]]})),builds:[[],[],[],[]],turn:0,status:'active',winner:null,moves:0,log:[]};
 for(const p of g.players){p.stock=g.deck.splice(-20);p.hand=g.deck.splice(-5);}return g;
}
function fill(g,p){while(p.hand.length<5){if(!g.deck.length){g.deck=g.recycle.splice(0).sort(()=>Math.random()-.5);}if(!g.deck.length)break;p.hand.push(g.deck.pop());}}
export function move(g,id,action){
 if(g.status!=='active')throw Error('This match is not active.');
 const p=g.players[g.turn];if(p.id!==id)throw Error('Wait for your turn.');
 const index=Number(action.index);if(!Number.isInteger(index)||index<0)throw Error('Choose a card.');
 if(action.type==='pass'){
  if(p.hand.length)throw Error('Discard a hand card to end your turn.');
  g.log.push(`${p.name} passed with an empty hand.`);g.turn=(g.turn+1)%g.players.length;fill(g,g.players[g.turn]);
 }else if(action.type==='discard'){
  const pile=Number(action.pile);if(pile<0||pile>3||!Number.isInteger(pile)||index>=p.hand.length)throw Error('Choose a card from your hand and a discard pile.');
  p.discards[pile].push(p.hand.splice(index,1)[0]);g.log.push(`${p.name} ended their turn.`);g.turn=(g.turn+1)%g.players.length;fill(g,g.players[g.turn]);
 }else if(action.type==='play'){
  const target=Number(action.target);if(!Number.isInteger(target)||target<0||target>3)throw Error('Choose a building pile.');
  let source;if(action.source==='hand')source=p.hand;else if(action.source==='stock')source=p.stock;else if(action.source==='discard'&&index<4)source=p.discards[index];else throw Error('Choose a card.');
  const at=action.source==='hand'?index:source.length-1;if(at<0||at>=source.length)throw Error('That pile is empty.');
  const card=source[at],needed=g.builds[target].length+1;
  if(card!==0&&card!==needed)throw Error(`This pile needs a ${needed} or a wild card.`);
  source.splice(at,1);g.builds[target].push(card);g.log.push(`${p.name} played ${card===0?'a wild':card}${action.source==='stock'?' from their stock':''}.`);
  if(g.builds[target].length===12){g.recycle.push(...g.builds[target]);g.builds[target]=[];}
  if(!p.stock.length){g.status='completed';g.winner=p.id;g.points=25+g.players.reduce((sum,q)=>sum+(q.id!==id?q.stock.length:0),0);g.log.push(`${p.name} won the match!`);}
  else if(!p.hand.length)fill(g,p);
 }else throw Error('Unknown action.');
 p.moves=(p.moves||0)+1;g.moves++;g.log=g.log.slice(-30);return g;
}
export function botTurn(g){
 const p=g.players[g.turn];if(!p.bot||g.status!=='active')return;
 for(let n=0;n<100&&g.status==='active';n++){
  let found;
  const options=[{source:'stock',index:0,value:p.stock.at(-1)},...p.hand.map((value,index)=>({source:'hand',index,value})),...p.discards.map((a,index)=>({source:'discard',index,value:a.at(-1)}))];
  for(const o of options){const target=g.builds.findIndex(b=>o.value!==undefined&&(o.value===0||o.value===b.length+1));if(target>=0){found={...o,target};break;}}
  if(!found)break;move(g,p.id,{type:'play',...found});
 }
 if(g.status==='active')move(g,p.id,p.hand.length?{type:'discard',index:p.hand.length-1,pile:g.moves%4}:{type:'pass',index:0});
}
export function publicGame(g,id){return {...g,deck:undefined,recycle:undefined,deckCount:g.deck.length,players:g.players.map(p=>({...p,stock:undefined,stockCount:p.stock?.length||0,top:p.stock?.at(-1),hand:p.id===id?p.hand:undefined,handCount:p.hand?.length||0}))};}
