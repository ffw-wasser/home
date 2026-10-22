/* RFC 5545 calendar projection. Identity follows UID / original recurrence, never title. */
(function(g){
 'use strict';
 function parse(raw,now=Date.now()){
  if(typeof raw!=='string'||raw.length>2000000||!raw.trimStart().startsWith('BEGIN:VCALENDAR'))throw Error('Keine gültige iCal-Kalenderdatei.');
  const I=g.ICAL,root=new I.Component(I.parse(raw)),from=now-31*86400000,to=now+370*86400000,events=[],groups=new Map();let steps=0;
  I.TimezoneService.reset();
  for(const c of root.getAllSubcomponents('vtimezone'))I.TimezoneService.register(new I.Timezone(c));
  const components=root.getAllSubcomponents('vevent');if(components.length>10000)throw Error('Der Kalender enthält zu viele Einträge.');
  for(const c of components){const uid=c.getFirstPropertyValue('uid');if(!uid)throw Error('Kalendereintrag ohne feste Kennung.');if(!groups.has(uid))groups.set(uid,[]);groups.get(uid).push(c);}
  const timestamp=t=>{
   if(t.zone===I.Timezone.localTimezone){
    // Floating/date-only Google entries use the brigade's Berlin timezone.
    const wall=Date.UTC(t.year,t.month-1,t.day,t.hour||0,t.minute||0,t.second||0);let guess=wall;
    for(let i=0;i<3;i++){const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess)),v=Object.fromEntries(parts.map(p=>[p.type,p.value]));guess=wall-(Date.UTC(+v.year,+v.month-1,+v.day,+v.hour,+v.minute,+v.second)-guess);}return guess;
   }
   return t.toJSDate().getTime();
  };
  function add(uid,event,original,start,end,recurring){
   if(event.component.getFirstPropertyValue('status')==='CANCELLED')return;
   const ms=timestamp(start),finish=timestamp(end);if(!Number.isFinite(ms)||!Number.isFinite(finish))throw Error('Ungültige Terminzeit.');if(ms<from||ms>to)return;
   events.push({seriesKey:uid,birthdayHint:/geburtstag|birthday|\bgeb\.|🎂/i.test(String(event.summary||'')+' '+String(event.component.getFirstPropertyValue('categories')||'')),key:uid+(recurring?'\n'+original.toString():''),title:String(event.summary||'Termin').slice(0,240),location:String(event.location||'').slice(0,300),start:ms,end:finish,allDay:start.isDate});if(events.length>500)throw Error('Zu viele Termine im Vorschauzeitraum.');
  }
  for(const [uid,items] of groups){
   const main=items.find(c=>!c.hasProperty('recurrence-id'));
   if(!main){for(const c of items){const e=new I.Event(c);add(uid,e,e.recurrenceId,e.startDate,e.endDate,true);}continue;}
   const event=new I.Event(main),recurring=event.isRecurring();if(main.getFirstPropertyValue('status')==='CANCELLED')continue;
   for(const c of items.filter(c=>c!==main))event.relateException(new I.Event(c));
   if(!recurring){add(uid,event,event.startDate,event.startDate,event.endDate,false);continue;}
   const it=event.iterator();let occurrence;while((occurrence=it.next())){
    if(++steps>50000)throw Error('Die Terminserie ist zu umfangreich. Bitte Kalender eingrenzen.');
    if(timestamp(occurrence)>to+370*86400000)break;
    const details=event.getOccurrenceDetails(occurrence);add(uid,details.item,occurrence,details.startDate,details.endDate,true);
   }
  }
  const unique=new Map(events.map(e=>[e.key,e]));return [...unique.values()].sort((a,b)=>a.start-b.start);
 }
 g.PortalCalendar={parse};
})(globalThis);

/* Audience rules are independent of calendar kind / attendance type. Shared by Worker and admin. */
(function(g){
 'use strict';
 const normalize=value=>String(value).toLocaleLowerCase('de').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ae/g,'a').replace(/oe/g,'o').replace(/ue/g,'u').replace(/[^a-z0-9]+/g,' ').trim();
 const defaults=()=>[
  {id:'active',name:'Alle aktiven Mitglieder',keywords:['Probe'],source:'active',memberIds:[],enabled:true,general:true},
  {id:'agt',name:'Atemschutz',keywords:['Atemschutz','AGT','AS-Probe'],source:'agt',memberIds:[],enabled:true,general:false},
  {id:'gf',name:'Gruppenführer',keywords:['Gruppenführer','GF'],source:'leader',memberIds:[],enabled:true,general:false},
  {id:'committee',name:'Ausschuss',keywords:['Ausschuss','Ausschusssitzung'],source:'committee',memberIds:[],enabled:true,general:false},
  {id:'age',name:'Alterskameraden',keywords:['Alterskameraden','Altersabteilung'],source:'age',memberIds:[],enabled:true,general:false}
 ];
 function validate(groups){
  const safe=(s,n)=>typeof s==='string'&&s.trim()&&s.length<=n&&!/[\x00-\x1f<>]/.test(s);
  if(!Array.isArray(groups)||groups.length>100)throw Error('Höchstens 100 Gruppen erlaubt.');
  const ids=new Set(),words=new Set(),names=new Set();let total=0;
  return groups.map(group=>{
   if(!group||!safe(group.id,80)||ids.has(group.id)||!safe(group.name,80)||names.has(normalize(group.name))||!['active','agt','leader','age','committee','manual'].includes(group.source)||typeof group.enabled!=='boolean'||typeof group.general!=='boolean'||!Array.isArray(group.keywords)||group.keywords.length>200||!Array.isArray(group.memberIds)||group.memberIds.length>500||group.memberIds.some(id=>!safe(id,200))||new Set(group.memberIds).size!==group.memberIds.length)throw Error('Gruppenname, Kennzeichen oder Mitgliederauswahl ungültig oder doppelt.');
   ids.add(group.id);names.add(normalize(group.name));
   const keywords=group.keywords.map(word=>{const key=normalize(word);if(!safe(word,80)||!key||words.has(key))throw Error('Schlagwort ungültig oder mehrfach vergeben: '+String(word).slice(0,80));words.add(key);return word.trim();});
   total+=keywords.length;if(total>2000)throw Error('Höchstens 2000 Schlagwörter insgesamt erlaubt.');
   return {id:group.id,name:group.name.trim(),source:group.source,enabled:group.enabled,general:group.general,keywords,memberIds:[...group.memberIds]};
  });
 }
 function members(group,roster){const selected=group.source==='manual'?new Set(group.memberIds):null;return (roster?.members||[]).filter(m=>group.source==='manual'?selected.has(m.id):group.source==='agt'?m.agt===true:group.source==='leader'?m.leader===true:group.source==='committee'?m.committeeMember===true:group.source==='age'?m.ageDepartment===true:m.ageDepartment!==true).map(m=>m.id);}
 function resolver(groups,roster){
  const index=new Map(),cache=new Map(),people=new Map(),fallback=(roster?.members||[]).filter(m=>m.ageDepartment!==true).map(m=>m.id);let longest=1;
  const add=(word,group)=>{if(!index.has(word))index.set(word,new Set());index.get(word).add(group);};
  for(const group of groups){if(!group.enabled)continue;people.set(group.id,members(group,roster));for(const keyword of group.keywords){const key=normalize(keyword);add(key,group);longest=Math.max(longest,key.split(' ').length);
   if(!key.includes(' ')&&key.length>2)for(const word of [key+'probe',key+'ubung',key+'ausbildung','sonderprobe'+key,'probe'+key])add(word,group);
  }}
  return title=>{
   const normalized=normalize(title);if(cache.has(normalized))return cache.get(normalized);
   const words=normalized.split(' '),hits=new Set();
   for(let i=0;i<words.length;i++){let phrase='';for(let j=i;j<Math.min(words.length,i+longest);j++){phrase+=(j===i?'':' ')+words[j];for(const group of index.get(phrase)||[])hits.add(group);}}
   const specific=[...hits].filter(group=>!group.general),selected=specific.length?specific:[...hits];
   const result={recipientIds:[...new Set(selected.length?selected.flatMap(group=>people.get(group.id)):fallback)],groupIds:selected.map(group=>group.id)};cache.set(normalized,result);return result;
  };
 }
 function resolve(title,groups,roster){return resolver(groups,roster)(title);}
 g.PortalGroups={normalize,defaults,validate,members,resolve,resolver};
})(globalThis);
