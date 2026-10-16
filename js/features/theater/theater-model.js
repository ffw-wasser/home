(function(g){
 'use strict';
 const palette=[['Blau','#075baf'],['Grün','#176b36'],['Orange','#a94b00'],['Violett','#7040a0'],['Rot','#a32632'],['Türkis','#006c70']];
 const categoryName=v=>String(v||'').trim().replace(/\s+/g,' ');
 function categoryColor(name,items=[]){const saved=items.find(p=>categoryName(p.category)===categoryName(name)&&palette.some(([,color])=>color===p.categoryColor));if(saved)return saved.categoryColor;let hash=0;for(const c of categoryName(name))hash=(hash+c.charCodeAt(0))%palette.length;return palette[hash][1];}
 // Preserve the existing catalogue schema: serving details remain in the full name.
 function itemPresentation(item){
  const food=/\b(essen|speisen|speise|gerichte|snacks|kuchen|desserts|gebäck)\b/i.test(categoryName(item.category));
  const full=String(item.name||'');if(food)return {article:full,container:'',size:'',food:true};
  const vessel=full.match(/\b(glas|flasche|tasse)\b/i),volume=full.match(/\b\d+(?:[.,]\d+)?\s*(?:ml|cl|liter|l)\b/i);
  const container=vessel?({glas:'Glas',flasche:'Flasche',tasse:'Tasse'})[vessel[0].toLowerCase()]:'';
  const size=volume?volume[0].replace(/\s*(ml|cl|liter|l)$/i,(_,unit)=>' '+unit.toLowerCase()).replace('.',','):'';
  const article=full.replace(/\b(glas|flasche|tasse)\b/ig,'').replace(/\b\d+(?:[.,]\d+)?\s*(?:ml|cl|liter|l)\b/ig,'').replace(/\s*·\s*/g,' ').replace(/\(\s*\)/g,'').replace(/\s+/g,' ').trim();
  return {article:article||full,container,size,food:false};
 }
 function itemName(article,container,size){return [String(article).trim(),[container,String(size||'').trim()].filter(Boolean).join(' · ')].filter(Boolean).join(' · ');}
 const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v);
 function catalog(value){
  if(!value||typeof value.title!=='string'||!value.title.trim()||value.title.length>100||typeof value.open!=='boolean'||!Array.isArray(value.items)||value.items.length>200)throw Error('Bitte Veranstaltung und höchstens 200 Artikel angeben.');
  const seen=new Set();const items=value.items.map(p=>{
   if(!id(p.id)||seen.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>150||typeof p.category!=='string'||!p.category.trim()||p.category.length>60||!Number.isSafeInteger(p.cents)||p.cents<0||p.cents>100000||typeof p.active!=='boolean')throw Error('Artikel, Rubrik und Preis (0 bis 1.000 €) prüfen.');
   if(p.categoryColor!==undefined&&!palette.some(([,color])=>color===p.categoryColor))throw Error('Bitte eine Rubrikfarbe aus der Palette wählen.');
   seen.add(p.id);return {id:p.id,name:p.name.trim(),category:categoryName(p.category),cents:p.cents,active:p.active,...(p.categoryColor?{categoryColor:p.categoryColor}:{})};
  });if(value.open&&!items.some(p=>p.active))throw Error('Zum Öffnen mindestens einen Artikel aktivieren.');return {title:value.title.trim(),open:value.open,items};
 }
 function lines(items,entries){
  if(!Array.isArray(entries)||!entries.length||entries.length>60)throw Error('Bitte 1 bis 60 verschiedene Artikel auswählen.');const seen=new Set();return entries.map(e=>{const p=items.find(p=>p.id===e.id&&p.active);if(!p||seen.has(e.id)||!Number.isSafeInteger(e.quantity)||e.quantity===0||e.quantity< -99||e.quantity>99)throw Error('Artikelauswahl oder Menge ungültig.');seen.add(e.id);return {...p,quantity:e.quantity};});
 }
 const total=lines=>lines.reduce((n,p)=>n+p.cents*p.quantity,0);
 function summarize(orders){const result=new Map();for(const o of orders)for(const p of o.lines){const key=JSON.stringify([p.id,p.name,p.category,p.cents]);const row=result.get(key)||{...p,quantity:0};row.quantity+=p.quantity;result.set(key,row);}return [...result.values()];}
 function statistics(orders){const by=fn=>{const out=new Map();for(const o of orders){const key=fn(o),r=out.get(key)||{name:key,orders:0,cents:0};r.orders++;r.cents+=total(o.lines);out.set(key,r);}return [...out.values()];};return {count:orders.length,cents:orders.reduce((n,o)=>n+total(o.lines),0),items:summarize(orders),people:by(o=>o.member).map(r=>({...r,member:r.name,name:orders.find(o=>o.member===r.name).name})),hours:by(o=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',hour:'2-digit'}).format(new Date(o.createdAt))),states:by(o=>o.state)};}
 function price(v){const s=String(v??'').trim().replace(/\s|€/g,'').replace(',','.');if(!/^\d+(?:\.\d{1,2})?$/.test(s))throw Error('Ungültiger Preis: '+v);const n=Math.round(Number(s)*100);if(n>100000)throw Error('Preis darf höchstens 1.000 € betragen.');return n;}
 g.TheaterModel={itemPresentation,itemName,palette,categoryName,categoryColor,id,catalog,lines,total,summarize,statistics,price,money:c=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(c/100)};
})(globalThis);
