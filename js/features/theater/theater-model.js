(function(g){
 'use strict';
 const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v);
 function catalog(value){
  if(!value||typeof value.title!=='string'||!value.title.trim()||value.title.length>100||typeof value.open!=='boolean'||!Array.isArray(value.items)||value.items.length>200)throw Error('Bitte Veranstaltung und höchstens 200 Artikel angeben.');
  const seen=new Set();const items=value.items.map(p=>{
   if(!id(p.id)||seen.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>150||typeof p.category!=='string'||!p.category.trim()||p.category.length>60||!Number.isSafeInteger(p.cents)||p.cents<0||p.cents>100000||typeof p.active!=='boolean')throw Error('Artikel, Rubrik und Preis (0 bis 1.000 €) prüfen.');
   seen.add(p.id);return {id:p.id,name:p.name.trim(),category:p.category.trim(),cents:p.cents,active:p.active};
  });if(value.open&&!items.some(p=>p.active))throw Error('Zum Öffnen mindestens einen Artikel aktivieren.');return {title:value.title.trim(),open:value.open,items};
 }
 function lines(items,entries){
  if(!Array.isArray(entries)||!entries.length||entries.length>60)throw Error('Bitte 1 bis 60 verschiedene Artikel auswählen.');const seen=new Set();return entries.map(e=>{const p=items.find(p=>p.id===e.id&&p.active);if(!p||seen.has(e.id)||!Number.isSafeInteger(e.quantity)||e.quantity<1||e.quantity>99)throw Error('Artikelauswahl oder Menge ungültig.');seen.add(e.id);return {...p,quantity:e.quantity};});
 }
 const total=lines=>lines.reduce((n,p)=>n+p.cents*p.quantity,0);
 function summarize(orders){const result=new Map();for(const o of orders)for(const p of o.lines){const key=JSON.stringify([p.id,p.name,p.category,p.cents]);const row=result.get(key)||{...p,quantity:0};row.quantity+=p.quantity;result.set(key,row);}return [...result.values()];}
 function statistics(orders){const by=fn=>{const out=new Map();for(const o of orders){const key=fn(o),r=out.get(key)||{name:key,orders:0,cents:0};r.orders++;r.cents+=total(o.lines);out.set(key,r);}return [...out.values()];};return {count:orders.length,cents:orders.reduce((n,o)=>n+total(o.lines),0),items:summarize(orders),people:by(o=>o.member).map(r=>({...r,member:r.name,name:orders.find(o=>o.member===r.name).name})),hours:by(o=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',hour:'2-digit'}).format(new Date(o.createdAt))),states:by(o=>o.state)};}
 function price(v){const s=String(v??'').trim().replace(/\s|€/g,'').replace(',','.');if(!/^\d+(?:\.\d{1,2})?$/.test(s))throw Error('Ungültiger Preis: '+v);const n=Math.round(Number(s)*100);if(n>100000)throw Error('Preis darf höchstens 1.000 € betragen.');return n;}
 g.TheaterModel={id,catalog,lines,total,summarize,statistics,price,money:c=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(c/100)};
})(globalThis);
