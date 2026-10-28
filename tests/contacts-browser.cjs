// Contact cards use protected responses only; no production services or data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const [file,postfix] of [['deckel.html',''],['index.html','-ipad']]){
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  await page.route('**/*',route=>route.abort());
  const markup=read(file).match(/<section class="contacts-pane" id="contacts-duty[\s\S]*?<!-- help-guide:start -->/)[0];
  await page.setContent('<!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="helpView" hidden>'+markup+'</main></body></html>');
  await page.addStyleTag({content:read('css/features/portal.css')});
  assert.equal(await page.locator('#contacts-duty'+postfix).isVisible(),false);
  await page.evaluate(()=>{
   window.fixture={schemaVersion:1,sourceDate:'2099-01-01',groups:[
    {id:'c-dienst',title:'C-Dienst',contacts:[{name:'C-Dienst',role:'24/7 erreichbar',mobile:'+49 30 00000000'}]},
    {id:'test',title:'Beispielgruppe',contacts:[{name:'<b>Testperson</b>',phone:'030 00000001'}]}
   ]};
   window.H2OPortal={api:async()=>({contacts:window.fixture})};
   window.oneDriveAdministrationReady=()=>true;window.oneDriveReadContacts=async()=>window.fixture;
   window.DrinksCentral={connection:async()=>null};
  });
  await page.addScriptTag({content:read('js/features/contacts.js')});
  const load=()=>page.evaluate(postfix=>{if(postfix){const help=document.getElementById('helpView');help.hidden=true;help.hidden=false;}else{document.getElementById('helpView').hidden=false;dispatchEvent(new CustomEvent('portal-pagechange',{detail:{page:'more-help'}}));}},postfix);
  await load();const duty=page.locator('#contacts-duty'+postfix);
  await duty.waitFor({state:'visible'});
  assert.equal(await duty.locator('h3').innerText(),'C-Dienst');assert.match(await duty.innerText(),/24\/7 erreichbar/);
  assert.equal(await duty.locator('a').getAttribute('href'),'tel:+493000000000');
  assert.equal(await duty.evaluate(n=>n.nextElementSibling.querySelector('h3').textContent),'Ansprechpartner Feuerwehr Emmendingen');
  assert.equal(await page.locator('#contacts-list'+postfix+' b').count(),0);
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert.equal(await duty.evaluate(n=>n.scrollWidth>n.clientWidth),false);}
  if(process.env.QA_OUTPUT){fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(process.env.QA_OUTPUT,file+'-contacts.png')});}
  await page.evaluate(()=>{window.fixture.groups=window.fixture.groups.filter(g=>g.id!=='c-dienst');});
  await load();await duty.waitFor({state:'hidden'});assert.equal(await duty.innerText(),'');
  await page.close();
 }
 console.log('PASS protected contact card above directory in both views, phone link, safe text, 320–1280 px, removed contacts cleared');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
