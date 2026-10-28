const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c={};vm.runInNewContext(fs.readFileSync('js/features/portal/calendar-presentation.js','utf8'),c);const M=c.CalendarPresentation,id='a'.repeat(43),url=M.responseLink(id);
test('Öffentlicher Rückmeldelink enthält nur die Termin-ID und bleibt bei Wiederholung identisch',()=>{
 assert.equal(url,'https://ffw-wasser.github.io/home/termin.html?event='+id);assert.throws(()=>M.responseLink('bad'));assert.throws(()=>M.responseLink('a'.repeat(43)+'&token=secret'));
 for(const original of ['','Hinweis\nTerminart: Probe\nFreigabe: Ja','<b>Hinweis</b><br><br>Terminart: Probe<br>Freigabe: Ja']){const next=M.withResponseLink(original,id);assert.ok(next.endsWith(original));assert.ok(next.includes(url));assert.equal(M.withResponseLink(next,id),next);assert.equal(M.instructions(next).fields.release,M.instructions(original).fields.release);}
 assert.throws(()=>M.withResponseLink('x'.repeat(3999),id),/zu lang/);assert.ok(M.withResponseLink(url+'not-the-same-id',id).startsWith('H₂O-Rückmeldung: '+url+'\n'));
});
test('Der Google-Add-on-Auswahlblock bleibt nach Linkergänzung unverändert am Beschreibungsende',()=>{
 const addon={};vm.runInNewContext(fs.readFileSync('docs/google-calendar-addon/Model.gs','utf8')+'\nthis.M=H2OCalendarAddonModel;',addon);
 const selection={type:'Probe',clothing:'Einsatzkleidung',mode:'automatic',groups:[],release:true},first=addon.M.build({description:'<p>Unveränderter Hinweis</p>'},selection,['Alle aktiven Mitglieder']);
 const linked={...first,description:M.withResponseLink(first.description,id)},again=addon.M.build(linked,{...selection,clothing:'Uniform'},['Alle aktiven Mitglieder']);assert.ok(again.description.includes(url));assert.ok(again.description.includes('<p>Unveränderter Hinweis</p>'));assert.equal((again.description.match(/H₂O-Rückmeldung/g)||[]).length,1);
});
