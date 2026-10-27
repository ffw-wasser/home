const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {fixture}=require('./helpers/portal-fixture.cjs');
const read=p=>fs.readFileSync('docs/google-calendar-addon/'+p,'utf8');
function model(){const c={};vm.runInNewContext(read('Model.gs'),c);return c.H2OCalendarAddonModel;}
const names=['Alle aktiven Mitglieder','Atemschutz','Gruppenführer'];
const selection={type:'Unterricht',clothing:'Tagesdienst',mode:'selected',groups:['Atemschutz','Gruppenführer'],release:true};
test('Google add-on: selections round-trip to the existing importer without destroying notes or shared properties',()=>{
 const M=model(),c={};vm.runInNewContext(fs.readFileSync('js/features/portal/calendar-presentation.js','utf8'),c);
 for(const note of ['Hinweis mit Link: https://example.invalid/','<p><b>Hinweis &amp; Link</b></p><a href="https://example.invalid/">Info</a>']){
  const first=M.build({description:note,extendedProperties:{shared:{other:'preserved'}}},selection,names);
  assert.ok(first.description.startsWith(note));assert.equal(first.extendedProperties.shared.other,'preserved');
  const parsed=c.CalendarPresentation.instructions(first.description);assert.equal(parsed.issues.length,0);assert.equal(parsed.fields.type,'Unterricht');assert.equal(parsed.fields.group,'Atemschutz; Gruppenführer');assert.equal(parsed.fields.release,true);
  const second=M.build(first,{...selection,clothing:'Uniform',release:false},names);assert.equal((second.description.match(/Terminart:/g)||[]).length,1);assert.ok(second.description.startsWith(note));assert.equal(c.CalendarPresentation.instructions(second.description).fields.release,false);
  assert.equal(M.read(second.description,names).clothing,'Uniform');
 }
 assert.equal(M.read('',names,'Probe').type,'Probe');assert.equal(M.read('',names,'INFO: Straßensperrung').type,'Information');
});
test('Google add-on: migration, validation, renamed groups and outside description edits fail safely',()=>{
 const M=model();assert.throws(()=>M.groups('["A;B"]'));assert.throws(()=>M.groups('["A","a"]'));assert.throws(()=>M.groups('{}'));
 for(const bad of [{groups:[]},{groups:['Unknown']},{clothing:'Uniform\nFreigabe: Ja'},{type:'Invalid'},{release:'yes'},{groups:['Atemschutz','Atemschutz']}])assert.throws(()=>M.build({}, {...selection,...bad},names));
 for(const text of ['Gruppen: Unknown','Terminart: Probe\nTerminart: Sonderprobe','Freigabe: maybe'])assert.throws(()=>M.read(text,names));
 const legacy=M.build({description:'Hinweis\nTerminart: Probe\nGruppe: Atemschutz\nFreigabe: Nein'},selection,names);assert.equal(legacy.description.includes('Terminart: Probe'),false);assert.ok(legacy.description.startsWith('Hinweis'));
 assert.throws(()=>M.build({description:'<p>Terminart: Probe</p><p>Hinweis</p>'},selection,names),/formatierter/);
 const first=M.build({description:'<b>Hinweis</b>'},selection,names);
 assert.throws(()=>M.build({...first,description:first.description.replace('Freigabe: Ja','<b>Freigabe: Nein</b>')},selection,names),/formatierten/);
 const recovered=M.build({...first,description:'<b>Hinweis nach manueller Bereinigung</b>'},selection,names);assert.ok(recovered.description.startsWith('<b>Hinweis nach manueller Bereinigung</b>'));
});
function controller({role='writer',event={},responseStatus=200,network=false}={}){
 const widgets=[],calls=[],props={H2O_CALENDAR_ID:'synthetic@example.invalid',H2O_GROUP_NAMES:JSON.stringify(names)};
 const context={calendar:{calendarId:props.H2O_CALENDAR_ID,id:'synthetic-event'},commonEventObject:{}};
 const current={id:'synthetic-event',etag:'"v1"',summary:'Probe',description:'Öffentlicher Hinweis',...event};
 const builder=()=>{
  const data={};let proxy;
  proxy=new Proxy({}, {get(_,key){if(key==='data')return data;if(key==='build')return()=>data;return(...args)=>{const value=args[0]&&args[0].data||args[0];if(key==='addWidget'||key==='addSection'){(data[key]??=[]).push(value);widgets.push(value);}else if(key==='addItem')(data.items??=[]).push(args);else data[key]=value;return proxy;};}});
  return proxy;
 };
 const CardService=new Proxy({SelectionInputType:{DROPDOWN:'dropdown',CHECK_BOX:'checkbox'}},{get(t,k){return t[k]||builder;}});
 const c={CardService,PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key]})},ScriptApp:{getOAuthToken:()=> 'SYNTHETIC-TOKEN'},UrlFetchApp:{fetch(url,options){calls.push({url,options});if(network)throw Error('SYNTHETIC-TOKEN');const result=url.includes('maxResults=1')?{accessRole:role}:options.method==='patch'?{...current,...JSON.parse(options.payload)}:current;return {getResponseCode:()=>options.method==='patch'?responseStatus:200,getContentText:()=>JSON.stringify(result)};}}};
 vm.runInNewContext(read('Model.gs')+'\n'+read('Code.gs'),c);
 function open(){widgets.length=0;c.h2oOpen(context);return widgets.find(w=>w.setOnClickAction)?.setOnClickAction.setParameters;}
 function save(params){const values={type:['Unterricht'],outfit:['Tagesdienst'],mode:['Ausgewählte Gruppen'],groups:['Atemschutz','Gruppenführer'],release:['Freigeben']};return c.h2oSave({...context,commonEventObject:{parameters:params,formInputs:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{stringInputs:{value:v}}]))}});}
 return {c,context,props,current,calls,widgets,open,save};
}
test('Google add-on cards: dropdowns and multi-selection save description only, use own OAuth and ETag, never follow redirects',()=>{
 const f=controller(),params=f.open();assert.ok(params);assert.equal(f.widgets.find(w=>w.setFieldName==='groups').setType,'checkbox');assert.equal(f.widgets.find(w=>w.setFieldName==='type').items.length,6);
 const result=f.save(params),write=f.calls.find(r=>r.options.method==='patch');assert.ok(write);assert.match(result.setNotification.setText,/In Google gespeichert/);
 assert.equal(write.options.followRedirects,false);assert.equal(write.options.headers['If-Match'],'"v1"');assert.equal(write.options.headers.Authorization,'Bearer SYNTHETIC-TOKEN');assert.match(write.url,/sendUpdates=none/);
 assert.deepEqual(Object.keys(JSON.parse(write.options.payload)).sort(),['description','extendedProperties']);assert.equal(JSON.stringify(result).includes('SYNTHETIC-TOKEN'),false);
});
test('Google add-on: foreign calendar, cancelled/guest/master events, stale configuration and ETags never write',()=>{
 for(const options of [{role:'reader'},{event:{status:'cancelled'}},{event:{attendees:[{}]}},{event:{recurrence:['RRULE:FREQ=WEEKLY']}},{event:{summary:'Geburtstag Testperson'}}]){const f=controller(options);assert.equal(f.open(),undefined);assert.equal(f.calls.some(r=>r.options.method==='patch'),false);}
 const foreign=controller();foreign.context.calendar.calendarId='other@example.invalid';assert.equal(foreign.open(),undefined);assert.equal(foreign.calls.length,0);
 for(const change of ['event','groups','etag']){const f=controller(),p=f.open();if(change==='event')f.context.calendar.id='different-event';if(change==='groups')f.props.H2O_GROUP_NAMES='["Changed"]';if(change==='etag')f.current.etag='"v2"';f.save(p);assert.equal(f.calls.some(r=>r.options.method==='patch'),false);}
 for(const status of [302,403,412,503]){const f=controller({responseStatus:status}),p=f.open(),result=f.save(p);assert.doesNotMatch(result.setNotification.setText,/^In Google gespeichert/);assert.equal(f.calls.filter(r=>r.options.method==='patch').length,1);}
 const broken=controller({network:true});broken.open();assert.equal(JSON.stringify(broken.widgets).includes('SYNTHETIC-TOKEN'),false);
});
test('Google add-on selection is consumed by the real Worker; explicit H2O individual exceptions retain priority',async()=>{
 const f=await fixture(),M=model(),cal=(await f.call('list',{},null,true)).value,e=cal.events[0];
 const patch=M.build({}, {...selection,groups:['Alle aktiven Mitglieder']},names);
 const description=patch.description.replace(/\n/g,'\\n');
 f.raw('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test-event\r\nDTSTART:'+new Date(e.start).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')+'\r\nDTEND:'+new Date(e.end).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')+'\r\nSUMMARY:Unterricht Beispiel\r\nDESCRIPTION:'+description+'\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n');
 // Fixture classification is an intentional local override. The documented action opts back into Google.
 f.clock.now+=16*60*1000;
 let fresh=(await f.call('list',{force:true},null,true)).value;assert.equal(fresh.events[0].googleManaged,false);
 const follow=await f.call('classify',{eventId:e.id,kind:'probe',approved:true,followGoogle:true,expectedVersion:fresh.rulesVersion,expectedGroupsVersion:fresh.groupsVersion},null,true);assert.equal(follow.status,200,JSON.stringify(follow.value));
 fresh=(await f.call('list',{},null,true)).value;const imported=fresh.events[0];assert.equal(imported.attendanceType,'Unterricht');assert.equal(imported.clothing,'Tagesdienst');assert.equal(imported.approved,true);assert.equal(imported.googleManaged,true);assert.ok(imported.recipientIds.length>0);
 const own=await f.call('classify',{eventId:e.id,kind:'probe',approved:true,sessionType:'Sonderprobe',clothing:'Uniform',recipientMode:'groups',groupIds:['active'],includeIds:[],excludeIds:[f.people[0].memberId],expectedVersion:fresh.rulesVersion,expectedGroupsVersion:fresh.groupsVersion},null,true);assert.equal(own.status,200,JSON.stringify(own.value));
 const protectedEvent=(await f.call('list',{force:true},null,true)).value.events[0];assert.equal(protectedEvent.clothing,'Uniform');assert.equal(protectedEvent.recipientIds.includes(f.people[0].memberId),false);
});
test('Google add-on manifest is desktop Calendar metadata with API scopes, no web-app endpoint or stored account secrets',()=>{
 const manifest=JSON.parse(read('appsscript.json'));assert.equal(manifest.addOns.calendar.currentEventAccess,'METADATA');assert.equal(manifest.addOns.calendar.eventOpenTrigger.runFunction,'h2oOpen');assert.equal(manifest.webapp,undefined);assert.deepEqual(manifest.urlFetchWhitelist,['https://www.googleapis.com/calendar/v3/']);
 assert.equal(manifest.oauthScopes.some(x=>/drive|mail|admin/.test(x)),false);assert.doesNotMatch(read('Code.gs'),/console\.|Logger\.|setProperty|ADMIN_TOKEN|GOOGLE_CALENDAR_CLIENT_SECRET/);
});
