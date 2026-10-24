// All content is local; no production account or external service is accessed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768]){
   const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});
   await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.replace(/^\/home\//,''));if(u.origin==='https://ffw-wasser.github.io'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});return route.abort();});
   await page.goto('https://ffw-wasser.github.io/home/deckel.html');
   await page.waitForFunction(()=>globalThis.DeckelMobile);
   await page.evaluate(()=>{DeckelMobile.show(true);DeckelMobile.jump('deckel-more');document.querySelector('[data-portal-tile="more-breathing"]').hidden=false;});
   assert.deepEqual(await page.locator('#portal-more-grid [data-portal-tile]').evaluateAll(ns=>ns.map(n=>n.dataset.portalTile)),['more-year-plan','more-breathing','more-hydrants','more-water','more-help','theater-phone-section','more-bundesliga','more-security'],'fire brigade topics precede leisure and account');
   const compactLabels=await page.locator('#deckel-nav button>strong').evaluateAll(ns=>ns.map(n=>({text:n.textContent,height:n.getBoundingClientRect().height,line:parseFloat(getComputedStyle(n).lineHeight),scroll:n.scrollWidth,width:n.clientWidth})));assert.ok(compactLabels.every(n=>n.height<=n.line+1&&n.scroll<=n.width+1),'default labels remain complete on one line: '+JSON.stringify(compactLabels));
   const headings=await page.locator('#portal-more-grid [data-portal-tile]:not([hidden])').evaluateAll(tiles=>tiles.map(tile=>{const i=tile.querySelector('.portal-more-icon,.portal-nav-symbol'),h=tile.querySelector('strong'),d=tile.querySelector('.portal-tile-description'),a=i.getBoundingClientRect(),b=h.getBoundingClientRect(),c=d.getBoundingClientRect();return {id:tile.dataset.portalTile,iconRight:a.right,titleLeft:b.left,iconTop:a.top,titleTop:b.top,contentBottom:Math.max(a.bottom,b.bottom),descriptionTop:c.top,descriptionLeft:c.left,iconLeft:a.left,background:getComputedStyle(i).backgroundColor};}));
   for(const h of headings){assert.ok(h.titleLeft>=h.iconRight+6&&Math.abs(h.titleTop-h.iconTop)<=4,'icon and heading share a row: '+JSON.stringify(h));assert.ok(h.descriptionTop>=h.contentBottom+4&&Math.abs(h.descriptionLeft-h.iconLeft)<1,'description starts below the heading at the left edge: '+JSON.stringify(h));assert.equal(h.background,'rgba(0, 0, 0, 0)','no separate icon badge');}
   const originalLabels=await page.locator('[data-portal-tile]').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.dataset.portalTile,n.querySelector('strong').innerHTML])));
   // Reproduce the original drag-and-drop of the hydrant tile into the bottom menu.
   const from=await page.locator('[data-portal-tile="more-hydrants"]').boundingBox(),nav=await page.locator('#deckel-nav').boundingBox();
   await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.waitForTimeout(600);await page.mouse.move(nav.x+nav.width*.65,nav.y+nav.height/2,{steps:8});await page.mouse.up();
   await page.waitForFunction(()=>document.querySelector('#deckel-nav [data-portal-tile="more-hydrants"]'));
   const verify=async(group,size,artSize)=>{
    const metrics=await page.locator(group+' [data-portal-tile]:not([hidden])').evaluateAll(tiles=>tiles.map(tile=>{const icon=tile.querySelector('.portal-nav-symbol,.portal-more-icon'),art=icon?.querySelector('svg,img'),r=icon?.getBoundingClientRect(),a=art?.getBoundingClientRect();return {id:tile.dataset.portalTile,w:r?.width,h:r?.height,top:r.top-tile.getBoundingClientRect().top,font:getComputedStyle(icon).fontSize,art:a?{w:a.width,h:a.height}:null,center:Math.abs(r.left+r.width/2-(a?a.left+a.width/2:r.left+r.width/2)),overflow:tile.scrollWidth>tile.clientWidth+1};}));
    if(metrics.length)for(const m of metrics)assert.ok(Math.abs(m.top-metrics[0].top)<1,'icons share a top alignment: '+JSON.stringify(metrics));
    for(const m of metrics){assert.equal(m.w,size,JSON.stringify(m));assert.equal(m.h,size,JSON.stringify(m));assert.equal(m.overflow,false,JSON.stringify(m));if(m.art){assert.equal(m.art.w,artSize,JSON.stringify(m));assert.equal(m.art.h,artSize,JSON.stringify(m));assert.ok(m.center<1,JSON.stringify(m));}}
   };
   await verify('#deckel-nav',28,24);await verify('#portal-more-grid',28,26);
   if(width===390&&process.env.PORTAL_ICON_SCREENSHOT)await page.screenshot({path:process.env.PORTAL_ICON_SCREENSHOT});
   // Every movable tile must use the same container rules in both directions.
   await page.locator('#portal-layout-open').click();
   const ids=await page.locator('#portal-layout-item option').evaluateAll(items=>items.map(item=>item.value));
   for(const id of ids){
    await page.locator('#portal-layout-item').selectOption(id);
    const wasMain=await page.locator('#deckel-nav [data-portal-tile="'+id+'"]').count();
    await page.locator('#portal-layout-transfer').click();
    const target=wasMain?'#portal-more-grid':'#deckel-nav';assert.equal(await page.locator(target+' [data-portal-tile="'+id+'"]').count(),1);
    await verify('#deckel-nav',28,24);await verify('#portal-more-grid',28,26);
    const labelMetrics=await page.locator('#deckel-nav button>strong').evaluateAll(ns=>ns.map(n=>({text:n.textContent,h:n.getBoundingClientRect().height,line:parseFloat(getComputedStyle(n).lineHeight),width:n.clientWidth,scroll:n.scrollWidth})));assert.ok(labelMetrics.every(n=>n.h<=n.line+1&&n.scroll<=n.width+1),'every moved tile has a complete one-line name: '+JSON.stringify(labelMetrics));
    if(target==='#portal-more-grid')assert.equal(await page.locator(target+' [data-portal-tile="'+id+'"] strong').innerHTML(),originalLabels[id],'More restores the complete original title and word breaks');
    if(target==='#deckel-nav')assert.ok(await page.locator(target+' [data-portal-tile="'+id+'"]').getAttribute('aria-label'),'short names keep their complete accessible title');
    await page.locator('#portal-layout-transfer').click();
   }
   await page.locator('#portal-layout-close').click();
   // Raised selection stays outside the rail and above its reserved content gap.
   for(const target of ['portal-section','portal-evidence','account','portal-points','deckel-more']){
    await page.evaluate(id=>DeckelMobile.jump(id),target);
    const geometry=await page.evaluate(()=>{const nav=document.getElementById('deckel-nav'),active=nav.querySelector('[aria-current=page]'),main=document.getElementById('deckel-main'),n=nav.getBoundingClientRect(),a=active.getBoundingClientRect(),m=main.getBoundingClientRect();return {rail:n.top,active:a.top,content:m.bottom,left:a.left,right:a.right,width:innerWidth,overflow:getComputedStyle(nav).overflowY};});
    assert.ok(geometry.active<geometry.rail&&geometry.active>=geometry.content-1,'raised selection has its own space: '+JSON.stringify(geometry));
    assert.equal(geometry.overflow,'visible','raised card is not clipped');
    const defaultLabels=await page.locator('#deckel-nav button>strong').evaluateAll(ns=>ns.map(n=>({text:n.textContent,height:n.getBoundingClientRect().height,line:parseFloat(getComputedStyle(n).lineHeight)})));assert.ok(defaultLabels.every(n=>n.height<=n.line+1),'all navigation labels fit one line: '+JSON.stringify(defaultLabels));
    const tops=await page.locator('#deckel-nav button').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().top-(n.hasAttribute('aria-current')?-12:0)));assert.ok(Math.max(...tops)-Math.min(...tops)<1,'all navigation tiles share one row');
    assert.ok(geometry.left>=0&&geometry.right<=geometry.width,'raised selection stays inside the screen');
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.close();
  }
  console.log('Portal icon sizing passed at 320/390/768px, including drag and every tile transfer.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

