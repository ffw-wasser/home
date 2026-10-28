// Synthetic invitations only. No mail is sent and external services are blocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));return u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();});
 await page.goto('https://ffw-wasser.github.io/home/index.html');await page.locator('#appStartup').waitFor({state:'detached'});
 await page.evaluate(()=>{
  members=[{id:'welcome-a',firstName:'Anna',lastName:'Beispiel',roles:[]}];
  oneDriveAdministrationReady=()=>true;oneDriveStateConfirmed=true;oneDriveLocalRevision=oneDriveSyncedRevision;
  oneDriveReadState=async()=>({members});adminUnlocked=true;resetAdminTimeout();
  DrinksStore.sourceKey=()=> 'welcome-source';DrinksCentral.connection=async()=>({origin:'https://synthetic.example.workers.dev',source:'welcome-source'});
  DrinksMobile.preparePortalAccess=async()=>({alias:'a'.repeat(32),revision:'welcome-revision'});
  DrinksPush.request=async(c,p)=>p.endsWith('/identity-ticket')?{code:'t'.repeat(43),expiresAt:Date.now()+600000}:p.endsWith('/evidence/overview')?{items:[],count:0,memberCount:0,servedAt:Date.now()}:{evidenceVersion:1,items:[],members:[]};
  showView('settingsPortalView');
 });
 await page.locator('#portal-admin-member option').nth(1).waitFor({state:'attached'});await page.locator('#portal-admin-member').selectOption('welcome-a');
 page.once('dialog',dialog=>dialog.accept());await page.locator('#portal-admin-show-qr').click();
 const email=page.locator('#portal-admin-identity-email');await email.waitFor({state:'visible'});
 const href=await email.getAttribute('href'),mail=new URL(href),body=mail.searchParams.get('body');
 assert.equal(mail.protocol,'mailto:');assert.equal(mail.pathname,'');assert.match(body,/Anna/);assert.match(body,/10 Minuten/);assert.match(body,/nicht weiterleiten/);assert.ok(body.includes('#setup='+'t'.repeat(43)));assert.doesNotMatch(body,/[?&]k=/);
 await page.locator('#portal-admin-member').selectOption('');assert.equal(await email.isVisible(),false);assert.equal(await email.getAttribute('href'),null);
 // The link lands in the existing one-use-ticket flow, erasing the secret from the address bar.
 await page.goto('https://ffw-wasser.github.io/home/deckel.html#setup='+'t'.repeat(43));await page.locator('#h2oStartup').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>location.hash),'');assert.equal(await page.locator('#identity-code').inputValue(),'t'.repeat(43));
 assert.equal(await page.locator('#h2o-onboarding-title').innerText(),'Zugang einrichten');
 assert.equal(await page.locator('#h2o-onboarding #identity-register').isVisible(),true);
 assert.ok((await page.locator('#h2o-onboarding').innerText()).length<240,'entry is concise');
 for(const width of [320,390,768])for(const scale of [100,200]){await page.setViewportSize({width,height:844});await page.evaluate(s=>document.documentElement.style.fontSize=s+'%',scale);assert.equal(await page.locator('#h2o-onboarding').evaluate(n=>n.scrollWidth>n.clientWidth+1),false);}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='100%');
 await page.evaluate(()=>{Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (iPhone) Version/26.0 Mobile Safari/604.1'});H2OOnboarding.accessReady();H2OOnboarding.signedIn();});
 const wizard=page.locator('#h2o-onboarding');
 if(process.env.QA_OUTPUT){fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});await wizard.screenshot({path:path.join(process.env.QA_OUTPUT,'installation-schritt.jpg')});}
 assert.match(await wizard.innerText(),/Teilen/);assert.equal(await wizard.locator('#installNext').isVisible(),false,'only one navigation');
 assert.equal(await wizard.locator('#installPlatform').isVisible(),false,'device controls stay out of the guided flow');
 assert.equal(await wizard.locator('#installSteps li:visible').count(),3,'Safari guide stays together when its share menu covers the page');
 assert.equal(await wizard.locator('#installIllustration').isVisible(),true);assert.match(await wizard.innerText(),/nach unten scrollen/);assert.match(await wizard.innerText(),/Zu Home-Bildschirm hinzufügen/);
 assert.equal(await wizard.getByRole('button',{name:'Weiter',exact:true}).count(),0,'no instruction to return to the wizard between Safari actions');
 for(const width of [320,390,768])for(const scale of [100,200]){await page.setViewportSize({width,height:844});await page.evaluate(s=>document.documentElement.style.fontSize=s+'%',scale);assert.equal(await wizard.evaluate(n=>n.scrollWidth>n.clientWidth+1),false);}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='100%');
 await wizard.getByRole('button',{name:'Symbol ist hinzugefügt',exact:true}).click();assert.equal(await wizard.getByRole('button',{name:'H₂O öffnen',exact:true}).count(),1);
 assert.equal(await wizard.locator('#portal-push-enable').count(),0,'optional settings are deferred');
 await wizard.getByRole('button',{name:'H₂O öffnen',exact:true}).click();
 await page.evaluate(()=>Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 Chrome/140.0 Safari/537.36'}));

 await page.evaluate(()=>{DeckelMobile.show(true);DeckelMobile.jump('more-security');document.getElementById('installSection').open=true;DeckelInstall.refresh();});
 for(const platform of ['ios','android','desktop']){
  await page.locator('#installPlatform').selectOption(platform);
  if(platform==='ios'){assert.equal(await page.locator('#installSteps li:visible').count(),3);assert.equal(await page.locator('#installNext').isVisible(),false);assert.equal(await page.locator('#installAfterSteps').isVisible(),true);continue;}
  const total=platform==='desktop'?3:4;assert.equal(await page.locator('#installProgress').innerText(),'Schritt 1 von '+total);
  assert.equal(await page.locator('#installSteps li:visible').count(),1);assert.equal(await page.locator('#installBack').isDisabled(),true);
  await page.locator('#installNext').click();assert.equal(await page.locator('#installProgress').innerText(),'Schritt 2 von '+total);
  assert.match(await page.locator('#installSteps li:visible').innerText(),platform==='ios'?/Home-Bildschirm/:platform==='android'?/App installieren/:/Installieren/);
  for(let index=1;index<total-1;index++)await page.locator('#installNext').click();assert.equal(await page.locator('#installNext').isDisabled(),true);
  await page.locator('#installBack').click();assert.equal(await page.locator('#installProgress').innerText(),'Schritt '+(total-1)+' von '+total);
 }
 await page.evaluate(()=>DeckelMobile.jump('more-help'));
 const privacy=page.locator('.guide-data-fields');assert.match(await privacy.innerText(),/Vorname, Nachname/);assert.match(await privacy.innerText(),/G26.3/);assert.doesNotMatch(await privacy.innerText(),/Mitgliedsdaten/);
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 assert.deepEqual(errors,[]);console.log('PASS: email preparation/cleanup, ticket handoff, three platform guides, concrete privacy fields and responsive layout');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
