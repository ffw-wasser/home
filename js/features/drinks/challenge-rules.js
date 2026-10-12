/* No public questions or solution keys. Equal-score winners share only real debt. */
(function(g){
 'use strict';
 function allocate(total,caps){
  const values=caps.map(()=>0);let left=total,remaining=caps.map((_,i)=>i);
  while(left&&remaining.length){const share=Math.floor(left/remaining.length),extra=left%remaining.length;let used=0;for(let j=0;j<remaining.length;j++){const i=remaining[j],n=Math.min(caps[i]-values[i],share+(j<extra?1:0));values[i]+=n;used+=n;}left-=used;remaining=remaining.filter(i=>values[i]<caps[i]);if(!used)break;}
  return values;
 }
 function settle(players,questions,stake){
  if(!Array.isArray(players)||players.length<2||players.length>20||new Set(players.map(p=>p.alias)).size!==players.length||!Array.isArray(questions)||questions.length!==7||!Number.isSafeInteger(stake)||stake<1||stake>100000)throw Error('Ungültige Spielrunde.');
  const sorted=players.slice().sort((a,b)=>a.alias.localeCompare(b.alias));
  const result=sorted.map(p=>{const own=p.questions||questions;if(!Array.isArray(own)||own.length!==7||own.some(q=>!Number.isSafeInteger(q.correct)||q.correct<0||q.correct>3)||!Number.isSafeInteger(p.debt)||p.debt<0||!Array.isArray(p.answers)||p.answers.length!==7||p.answers.some(a=>!Number.isSafeInteger(a)||a<0||a>3))throw Error('Die Runde ist noch nicht vollständig.');return {alias:p.alias,score:p.answers.filter((a,i)=>a===own[i].correct).length,delta:0};});
  const best=Math.max(...result.map(p=>p.score)),winners=result.filter(p=>p.score===best),losers=result.filter(p=>p.score!==best);
  if(!losers.length)return result;
  const caps=winners.map(p=>sorted.find(x=>x.alias===p.alias).debt),pot=Math.min(stake*losers.length,caps.reduce((a,b)=>a+b,0)),gains=allocate(pot,caps),losses=allocate(pot,losers.map(()=>stake));
  winners.forEach((p,i)=>p.delta=-gains[i]);losers.forEach((p,i)=>p.delta=losses[i]);return result;
 }
 g.DeckelChallengeRules={settle,allocate};
})(globalThis);
