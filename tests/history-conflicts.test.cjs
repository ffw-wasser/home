const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/features/history/onedrive-history-live.js'),'utf8');
function fixture(tag='v2'){
 const calls=[],c=vm.createContext({window:{},oneDriveResolveSharedRoot:async()=>({driveId:'test'}),odFetch:async(url,options={})=>{calls.push({url,options});return {json:async()=>({id:'file',eTag:tag})};}});vm.runInContext(source,c);return {c,calls};
}
for(const action of ['deleteOneDriveHistoryItem','saveOneDriveHistoryCorrection'])test(action+': veraltete Historienversion blockiert vor jeder Änderung',async()=>{
 const f=fixture();await assert.rejects(f.c.window[action]({oneDriveLive:true,id:'onedrive-zip:file',oneDriveETag:'v1'}),e=>e.status===412);
 assert.equal(f.calls.length,1);assert.equal(f.calls.some(x=>['DELETE','PUT'].includes(x.options.method)),false);
});
for(const action of ['deleteOneDriveHistoryItem','saveOneDriveHistoryCorrection'])test(action+': fehlende Dateiversion wird niemals ungeschützt geschrieben',async()=>{
 const f=fixture('');await assert.rejects(f.c.window[action]({oneDriveLive:true,id:'onedrive-zip:file'}),/Dateiversion/);assert.equal(f.calls.length,1);
});
test('Löschung verwendet die beim Laden bekannte Version und entfernt genau das Original',async()=>{
 const f=fixture('v1');await f.c.window.deleteOneDriveHistoryItem({oneDriveLive:true,id:'onedrive-zip:file',oneDriveETag:'v1'});
 assert.equal(f.calls[1].options.method,'DELETE');assert.equal(f.calls[1].options.headers['If-Match'],'v1');assert.match(f.calls[1].url,/items\/file$/);
});
