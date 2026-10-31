// Only synthetic sessions, simulated native callbacks and blocked external services.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright'),root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
 page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));return u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();});
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'userAgent',{value:'Mozilla/5.0 (iPhone) H2ONative/1 iOS H2OMemberPilot/1'});
  window.nativeRequests=[];window.webkit={messageHandlers:{h2oNotifications:{postMessage(message){nativeRequests.push(message.action);setTimeout(()=>dispatchEvent(new CustomEvent('h2o-native-notifications',{detail:{id:message.id,permission:message.action==='request'?'granted':'default',...(message.action==='request'?{deviceToken:'a'.repeat(64)}:{})}})),0);}}}};
 });
 await page.goto('https://ffw-wasser.github.io/home/deckel.html');await page.locator('#h2oStartup').waitFor({state:'hidden'});
 await page.evaluate(async()=>{
  H2OIdentity.session=()=>({alias:'a'.repeat(32)});H2OIdentity.credentials=()=>({alias:'a'.repeat(32),key:'a'.repeat(64)});
  H2OPortal.api=async(_,body)=>({ok:true,ready:true,registered:body.action==='subscribe'});
  await DeckelPush.render({origin:'https://synthetic.invalid',alias:'a'.repeat(32),revision:'synthetic',capability:'synthetic'});
  H2OOnboarding.signedIn();DeckelInstall.refresh();
 });
 const wizard=page.locator('#h2o-onboarding');await wizard.getByRole('heading',{name:'Feuerwehrkalender einrichten?',exact:true}).waitFor();
 async function capture(name){
  if(process.env.CAPTURE_NATIVE_HELP){const folder=path.join(root,'assets/help/guide'),box=await wizard.boundingBox(),sizes=JSON.parse(fs.readFileSync(path.join(folder,'screens.json'),'utf8'));await wizard.screenshot({path:path.join(folder,name+'.jpg'),type:'jpeg',quality:80});sizes[name]={width:Math.round(box.width),height:Math.round(box.height)};fs.writeFileSync(path.join(folder,'screens.json'),JSON.stringify(sizes,null,2)+'\n');}
 }
 await capture('h2o-native-kalender');
 assert.equal(await page.locator('#nativeRetired').isVisible(),false);assert.equal(await page.locator('#installSection').isVisible(),false);
 assert.doesNotMatch(await wizard.innerText(),/Zum Home-Bildschirm hinzufügen/);assert.deepEqual(await page.evaluate(()=>nativeRequests),['status']);
 if(process.env.QA_OUTPUT){fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});await wizard.screenshot({path:path.join(process.env.QA_OUTPUT,'native-kalender.png')});}
 await wizard.getByRole('button',{name:'Jetzt nicht',exact:true}).click();await wizard.getByRole('button',{name:'Mitteilungen erlauben',exact:true}).click();
 await wizard.getByText('Mitteilungen auf diesem iPhone aktiviert.',{exact:true}).waitFor();assert.deepEqual(await page.evaluate(()=>nativeRequests),['status','request']);
 for(const width of [320,390,768])for(const scale of [100,200]){await page.setViewportSize({width,height:1000});await page.evaluate(s=>document.documentElement.style.fontSize=s+'%',scale);assert.equal(await wizard.evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='100%');
 if(process.env.QA_OUTPUT)await wizard.screenshot({path:path.join(process.env.QA_OUTPUT,'native-mitteilungen.png')});
 await capture('h2o-native-mitteilungen');
 await wizard.getByRole('button',{name:'Einrichtung abschließen',exact:true}).click();await wizard.getByRole('button',{name:'H₂O öffnen',exact:true}).click();await page.evaluate(()=>H2OOnboarding.offerOptions());assert.equal(await wizard.isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS native setup: no home-install instruction; calendar then notifications; no permission request before click; repeat login does not repeat setup; responsive layout.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
