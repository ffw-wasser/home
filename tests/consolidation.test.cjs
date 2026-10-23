const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const read=p=>fs.readFileSync(require.resolve('../'+p),'utf8');
function dockFixture(){
 const nodes=new Map(),frames=[],events=new Map();let c;
 const classes=()=>{const set=new Set();return {contains:k=>set.has(k),toggle(k,value){value?set.add(k):set.delete(k);},add:k=>set.add(k)};};
 class Node{
  constructor(id){this._id=id;this.children=[];this.hidden=false;this.classList=classes();this.isConnected=true;if(id)nodes.set(id,this);}
  set id(value){this._id=value;nodes.set(value,this);}get id(){return this._id;}
  get nextSibling(){const children=this.parentNode?.children||[];return children[children.indexOf(this)+1]||null;}
  setAttribute(){}
  appendChild(node){if(node.parentNode)node.parentNode.children.splice(node.parentNode.children.indexOf(node),1);this.children.push(node);node.parentNode=this;}
  insertBefore(node,next){if(node.parentNode)node.parentNode.children.splice(node.parentNode.children.indexOf(node),1);this.children.splice(this.children.indexOf(next),0,node);node.parentNode=this;}
 }
 const body=new Node('body'),root=new Node('root'),view=new Node('attendanceView'),workspace=new Node('attendanceSelectionWorkspace'),saveHome=new Node('save-home'),stepHome=new Node('step-home'),save=new Node('saveButton'),step=new Node('step3ActionArea');
 saveHome.appendChild(save);stepHome.appendChild(step);body.appendChild(view);view.classList.add('workflow-stage-2');
 const bind=(name,fn)=>{const list=events.get(name)||[];list.push(fn);events.set(name,list);};
 c=vm.createContext({navigator:{maxTouchPoints:5,userAgent:'iPad',platform:'MacIntel'},innerWidth:1024,matchMedia:()=>({matches:c.innerWidth<=600}),getComputedStyle:n=>({display:n.hidden?'none':'block'}),requestAnimationFrame:fn=>frames.push(fn),setTimeout:fn=>fn(),addEventListener:bind,MutationObserver:class{constructor(fn){this.fn=fn;}observe(){}},document:{readyState:'loading',body,documentElement:root,getElementById:id=>nodes.get(id),createElement:()=>new Node(),addEventListener:bind}});
 vm.runInContext(read('js/features/attendance/action-dock.js'),c);
 const emit=name=>{for(const fn of events.get(name)||[])fn();while(frames.length)frames.shift()();};
 return {c,nodes,view,save,step,saveHome,stepHome,root,frames,emit};
}
test('Die ursprünglichen Aktionen wechseln zwischen iPad, iPhone und Desktop ohne fremde Rücksprungorte',()=>{
 const f=dockFixture();f.emit('DOMContentLoaded');assert.equal(f.save.parentNode.id,'ipadAttendanceActionDock');assert.equal(f.step.parentNode,f.save.parentNode);
 f.c.innerWidth=390;f.emit('resize');assert.equal(f.save.parentNode.id,'iphoneAttendanceActionDock');assert.equal(f.nodes.get('ipadAttendanceActionDock').hidden,true);
 f.c.innerWidth=1024;f.emit('orientationchange');assert.equal(f.save.parentNode.id,'ipadAttendanceActionDock');assert.equal(f.nodes.get('iphoneAttendanceActionDock').hidden,true);
 f.c.innerWidth=1800;f.c.navigator={maxTouchPoints:0,userAgent:'Desktop',platform:'Linux'};f.emit('resize');assert.equal(f.save.parentNode,f.saveHome);assert.equal(f.step.parentNode,f.stepHome);
 assert.equal(f.root.classList.contains('iphone-action-dock-active'),false);assert.equal(f.root.classList.contains('ipad-attendance-dock-active'),false);
});
test('Der Dock ist nur in der sichtbaren Anwesenheitsauswahl aktiv',()=>{
 const f=dockFixture();f.emit('DOMContentLoaded');assert.equal(f.nodes.get('ipadAttendanceActionDock').hidden,false);
 f.view.hidden=true;f.emit('attendance:updated');assert.equal(f.nodes.get('ipadAttendanceActionDock').hidden,true);
 f.view.hidden=false;f.emit('attendance:updated');assert.equal(f.nodes.get('ipadAttendanceActionDock').hidden,false);
});
test('Archivprüfung liest beide CSV-Felder ohne Archiveinträge vorübergehend umzuschreiben',()=>{
 const source=read('js/features/quality/smart-workflow.js'),items=[{topic:'Funk',sessionType:'Allgemeine Probe',content:'CSV',csvContent:' '},{topic:'Funk',sessionType:'Allgemeine Probe',csvContent:'CSV'},{topic:'Funk',sessionType:'Sonderprobe'}];
 const c=vm.createContext({csvArchive:items});vm.runInContext(source.slice(source.indexOf('  function qualityData()'),source.indexOf('  function renderQualityPanel')),c);
 const before=JSON.stringify(items);assert.equal(c.qualityData().length,0);assert.equal(JSON.stringify(items),before);
 items.push({topic:'Funk',sessionType:'Allgemeine Probe'});assert.equal(c.qualityData().length,1);
});
test('Die Abschlussprüfung ist direkt erreichbar und führt genau eine Prüfung aus',async()=>{
 const source=read('js/features/settings/admin.js');let checks=0,stages=[];const c=vm.createContext({guardProbeCompletion:()=>{checks++;return true;},todayEntries:()=>[{}],setHomeFlowStage:s=>stages.push(s),sessionType:'Allgemeine Probe'});
 vm.runInContext(source.slice(source.indexOf('async function requestCloseProbe()'),source.indexOf('function ensureProbeTopicDialog()')),c);await c.requestCloseProbe();assert.equal(checks,1);assert.deepEqual(stages,[3]);
 c.guardProbeCompletion=()=>false;stages=[];await c.requestCloseProbe();assert.deepEqual(stages,[]);
});
test('Neu erstellter Einsatz verwendet denselben Namen für Paket, Vorschau, CSV, PDF und Archiv',async()=>{
 const source=read('js/features/reports/zip-terminpakete.js'),captured={};const button={setAttribute(){},removeAttribute(){}};
 const c=vm.createContext({window:{WorkflowUX:{terminCompleted:result=>captured.completed=result}},Date,File,console,byId:id=>id==='operationFinish'?button:null,requestAnimationFrame:fn=>fn(),editingOperationArchiveId:'',csvArchive:[],currentOperationId:'op',entries:[],makeId:()=> 'archive',collectOperationData:()=>({date:'2026-10-14',members:['Testperson'],times:{alarm:'14:15'}}),persistOperationDraft(){},validateOperation:()=>({errors:[],warnings:[]}),operationCsv:()=> 'CSV',operationPdfBlob:async()=>({}),showOperationPdfPreview:async(pdf,name,done)=>{captured.preview=name;return done();},buildTerminPackage:async options=>{captured.options=options;return {zipBlob:{},finalPdf:{}};},saveTerminPackage:async name=>{captured.saved=name;return 'saved';},saveImportedReportPdf:async()=>{},commitPendingDocumentReport:async()=>{},saveArchive(){},saveEntries(){},resetDocumentReportState(){},resetOperationState(){},renderEntries(){},renderMembers(){},renderStatistics(){},renderHistory(){},setHomeFlowStage(){},showView(){},showToast(){}});
 vm.runInContext(source.slice(source.indexOf('window.finishOperationZip='),source.indexOf('// Der Abschlussbutton')),c);await c.window.finishOperationZip();
 assert.equal(captured.saved,'FFW-Wasser_2026-10-14_Einsatz.zip');assert.equal(captured.preview,'FFW-Wasser_2026-10-14_Einsatz.pdf');assert.equal(captured.options.csvName,'FFW-Wasser_2026-10-14_Einsatz.csv');assert.equal(captured.options.pdfName,captured.preview);assert.equal(c.csvArchive[0].packageFileName,captured.saved);assert.equal(captured.completed,'saved');
});
test('Ein beschädigter alter Sicherungspunkt verhindert die eigentliche Aktion nicht',()=>{
 const status={},c=vm.createContext({safeStorage:{length:0,getItem:()=>'{invalid',setItem(){}},byId:id=>id==='qualityStatusCard'?{querySelector:()=>status}:null,console:{error(){}},window:{addEventListener(){}}});
 vm.runInContext(read('js/features/quality/quality-engine.js'),c);assert.doesNotThrow(()=>c.captureQualitySnapshot('Test'));assert.match(status.textContent,/Noch kein Sicherungspunkt/);
});
