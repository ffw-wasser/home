const CACHE_NAME="ffw-wasser-20261025.17";
const CORE=[
  "./css/features/water-info.css?v=20261025.17",
  "./css/features/help-guide.css?v=20261025.17",
  "./js/features/portal/calendar-presentation.js?v=20261025.17",
  "./js/features/portal/calendar-display-admin.js?v=20261025.17",
  "./js/features/portal/calendar-sidebar.js?v=20261025.17",
  "./js/features/portal/public-holidays.js?v=20261025.17",
  "./js/features/portal/school-holidays.js?v=20261025.17",
  "./js/features/portal/year-plan-pdf.js?v=20261025.17",
  "./js/features/portal/year-plan.js?v=20261025.17",
  "./css/features/year-plan.css?v=20261025.17",
  "./js/features/portal/portal-reminders.js?v=20261025.17",
  "./js/features/portal/plan-zoom.js?v=20261025.17",
  "./js/vendor/pdfjs/pdf-5.4.624.min.mjs",
  "./js/vendor/pdfjs/pdf.worker-5.4.624.min.mjs",
  "./js/features/portal/portal-hydrants.js?v=20261025.17",
  "./js/features/portal/portal-identity.js?v=20261025.17",
  "./js/vendor/passkeys-browser.js",
  "./js/features/portal/portal-bundesliga.js?v=20261025.17",
  "./css/features/theater.css?v=20261025.17",
  "./js/features/theater/theater-model.js?v=20261025.17",
  "./js/features/theater/theater-import.js?v=20261025.17",
  "./js/features/theater/theater-admin.js?v=20261025.17",
  "./js/features/theater/theater-phone.js?v=20261025.17",
  "./js/features/portal/portal-calendar-export.js?v=20261025.17",
  "./assets/help/portal-install-iphone.png",
  "./assets/help/portal-install-android.png",
  "./css/layout/mobile.css?v=20261025.17",
  "./js/features/attendance/action-dock.js?v=20261025.17",
  "./js/core/keyboard.js?v=20261025.17",
  "./js/features/drinks/drinks-challenge-settings.js?v=20261025.17",
  "./js/features/drinks/drinks-birthday-settings.js?v=20261025.17",
  "./js/features/drinks/deckel-update.js?v=20261025.17",
  "./assets/drinks/bierglas.svg",
  "./assets/drinks/weinglas.svg",
  "./js/features/drinks/deckel-mobile.js?v=20261025.17",
  "./taktik-geraetehaus.svg",
  "./js/features/drinks/deckel-challenge.js?v=20261025.17",
  "./css/features/deckel-challenge.css?v=20261025.17",
  "./js/features/drinks/drinks-quiz-model.js?v=20261025.17",
  "./js/features/drinks/drinks-quiz-admin.js?v=20261025.17",
  "./js/features/drinks/drinks-central.js?v=20261025.17",
  "./js/features/drinks/deckel-live.js?v=20261025.17",
  "./js/features/drinks/deckel-commands.js?v=20261025.17",
  "./js/features/drinks/deckel-actions.js?v=20261025.17",
  "./js/features/drinks/drinks-phone-sync.js?v=20261025.17",
  "./js/features/drinks/drinks-statistics.js?v=20261025.17",
  "./js/features/drinks/drinks-bookings-admin.js?v=20261025.17",
  "./assets/drinks/deckel-kamerad.webp",
  "./deckel-android.webmanifest",
  "./js/features/drinks/deckel-manifest.js?v=20261025.17",
  "./js/features/drinks/deckel-install.js?v=20261025.17",
  "./js/features/quality/workflow-ux.js?v=20261025.17",
  "./js/core/privacy.js?v=20261025.17",
  "./deckel.webmanifest?v=20261025.17",
  "./js/features/drinks/push-device.js?v=20261025.17",
  "./js/features/drinks/deckel-push.js?v=20261025.17",
  "./js/features/drinks/drinks-push.js?v=20261025.17",
  "./deckel.html",
  "./css/features/deckel.css?v=20261025.17",
  "./js/features/drinks/deckel-crypto.js?v=20261025.17",
  "./js/features/drinks/drinks-mobile.js?v=20261025.17",
  "./js/features/drinks/deckel-startup.js?v=20261025.17",
  "./js/features/drinks/deckel-view.js?v=20261025.17",
  "./",
  "./index.html",
  "./icon-192.png?v=20261025.17",
  "./icon-512.png?v=20261025.17",
  "./assets/branding/ffw-home-180.png?v=20261025.17",
  "./assets/branding/ffw-home-192.png?v=20261025.17",
  "./assets/branding/ffw-home-512.png?v=20261025.17",
  "./manifest.webmanifest?v=20261025.17",
  "./css/core/base.css?v=20261025.17",
  "./css/features/attendance.css?v=20261025.17",
  "./css/features/settings.css?v=20261025.17",
  "./css/layout/responsive.css?v=20261025.17",
  "./css/core/application.css?v=20261025.17",
  "./css/features/quality.css?v=20261025.17",
  "./css/layout/desktop-cards.css?v=20261025.17",
  "./css/features/attendance-workflow.css?v=20261025.17",
  "./css/features/onedrive-sync.css?v=20261025.17",
  "./css/features/attendance-status.css?v=20261025.17",
  "./css/features/smart-workflow.css?v=20261025.17",
  "./css/components/ui-components.css?v=20261025.17",
  "./css/features/drinks.css?v=20261025.17",
  "./css/features/usability.css?v=20261025.17",
  "./assets/drinks/bierfass.webp",
  "./taktik-lf10.webp?v=20261025.17",
  "./taktik-tsf.webp",
  "./taktik-sonderprobe.webp",
  "./taktik-unterricht.webp",
  "./js/core/config.js?v=20261025.17",
  "./js/core/onedrive-sync.js?v=20261025.17",
  "./js/core/storage.js?v=20261025.17",
  "./js/core/database.js?v=20261025.17",
  "./js/core/ui.js?v=20261025.17",
  "./js/features/attendance/attendance-controller.js?v=20261025.17",
  "./js/features/reports/csv-engine.js?v=20261025.17",
  "./js/features/reports/report-engine.js?v=20261025.17",
  "./js/features/history/backup-engine.js?v=20261025.17",
  "./js/vendor/pdf-lib.min.js?v=20261025.17",
  "./js/vendor/jszip.min.js?v=20261025.17",
  "./js/features/reports/ipad-document-editor.js?v=20261025.17",
  "./js/features/reports/document-report.js?v=20261025.17",
  "./js/features/reports/probe-pdf.js?v=20261025.17",
  "./js/features/reports/csv.js?v=20261025.17",
  "./js/features/history/archive.js?v=20261025.17",
  "./js/features/history/report-csv-import.js?v=20261025.17",
  "./js/features/settings/admin.js?v=20261025.17",
  "./js/features/statistics/statistics-pdf.js?v=20261025.17",
  "./js/features/statistics/statistics.js?v=20261025.17",
  "./js/features/tactics/tactics-engine.js?v=20261025.17",
  "./js/features/tactics/tactics.js?v=20261025.17",
  "./js/features/reports/operation-template-images.js?v=20261025.17",
  "./js/features/reports/operation-docx-template.js?v=20261025.17",
  "./js/features/reports/operation-docx.js?v=20261025.17",
  "./js/features/reports/operation-pdf-layout.js?v=20261025.17",
  "./js/features/reports/operation-pdf-worker-source.js?v=20261025.17",
  "./js/features/operations/operations.js?v=20261025.17",
  "./js/features/reports/zip-terminpakete.js?v=20261025.17",
  "./js/features/quality/quality-engine.js?v=20261025.17",
  "./js/features/attendance/qr-checkin.js?v=20261025.17",
  "./js/vendor/jsqr.js?v=20261025.17",
  "./js/vendor/qrcode.js?v=20261025.17",
  "./js/features/drinks/drinks-model.js?v=20261025.17",
  "./js/features/drinks/drinks-store.js?v=20261025.17",
  "./js/features/drinks/drinks.js?v=20261025.17",
  "./js/app/app.js?v=20261025.17",
  "./js/app/app-update.js?v=20261025.17",
  "./js/features/quality/smart-workflow.js?v=20261025.17",
  "./js/features/history/onedrive-history-live.js?v=20261025.17",
  "./js/features/quality/usability.js?v=20261025.17",
  "./js/features/tactics/tactics-touch.js?v=20261025.17",
  "./js/features/drinks/drinks-extras.js?v=20261025.17",
  "./js/features/drinks/drinks-rewards.js?v=20261025.17",
  "./js/features/attendance/attendance-smart.js?v=20261025.17",
  "./assets/templates/Einsatzbericht-Wordvorlage-Kreuze-FINAL.docx",
  "./js/core/connection-status.js?v=20261025.17",
  "./js/features/portal/member-evidence.js?v=20261025.17",
  "./js/features/portal/portal-member.js?v=20261025.17",
  "./js/features/portal/portal-evidence-editor.js?v=20261025.17",
  "./js/features/portal/portal-gf-breathing.js?v=20261025.17",
  "./js/features/portal/calendar-model.js?v=20261025.17", "./js/features/portal/portal-admin.js?v=20261025.17", "./js/features/portal/portal-evidence-admin.js?v=20261025.17", "./js/features/contacts.js?v=20261025.17",
  "./css/features/portal.css?v=20261025.17",
  "./assets/drinks/h2o-symbol-white-96.png?v=20261025.17",
  "./assets/drinks/h2o-symbol-white-512.png?v=20261025.17",
  "./assets/drinks/h2o-symbol-blue-180.png?v=20261025.17",
  "./assets/drinks/h2o-symbol-blue-192.png?v=20261025.17",
  "./assets/drinks/h2o-symbol-blue-512.png?v=20261025.17"
];
self.addEventListener("install",event=>event.waitUntil(
  caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())
));
self.addEventListener("activate",event=>event.waitUntil(
  // Alte App-Caches können OneDrive-Antworten enthalten; beim Update entfernen.
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("ffw-wasser-")&&key!==CACHE_NAME).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));
self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
  // Ausschließlich öffentliche App-Dateien speichern. Microsoft-Anmeldung,
  // OneDrive-Daten und authentifizierte Antworten bleiben außerhalb des Caches.
  if(request.method!=="GET"||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname)||request.headers.has("Authorization"))return;
  const path=url.pathname.slice(scope.pathname.length);
  const navigation=request.mode==="navigate"&&(path===""||path==="index.html"||path==="deckel.html");
  const asset=/^(?:js\/.*\.js|css\/.*\.css|assets\/help\/guide\/[a-z0-9-]+\.jpg|assets\/templates\/[^/]+\.(?:docx|jpg)|assets\/drinks\/[^/]+\.(?:webp|png|svg)|assets\/branding\/ffw-home-\d+\.png|icon-(?:192|512)\.png|taktik-[^/]+\.(?:webp|svg)|(?:manifest|deckel|deckel-android)\.webmanifest)$/.test(path);
  if(!navigation&&!asset)return;
  // OAuth-Codes in der Rücksprung-URL niemals als Cache-Schlüssel speichern.
  const cacheKey=navigation?new URL(path==="deckel.html"?"deckel.html":"index.html",scope).href:request;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    try{
      const response=await fetch(request,navigation?{cache:'no-store'}:undefined);
      if(response.ok&&response.type!=="opaque"&&new URL(response.url||request.url).origin===scope.origin){
        await cache.put(cacheKey,response.clone()).catch(()=>{});
      }
      return response;
    }catch(error){
      const cached=await cache.match(cacheKey);
      if(cached)return cached;
      // Fehlende Skripte oder Daten erhalten keine HTML-Antwort als Ersatz.
      throw error;
    }
  })());
});

// Generic empty push: account keys and balances never pass through the push service.
importScripts('js/features/drinks/push-device.js?v=20261025.17');
async function updateDeckelBadge(count){
 try{
  const nav=self.navigator;
  if(count&&typeof nav?.setAppBadge==='function')await nav.setAppBadge(count);
  else if(!count&&typeof nav?.clearAppBadge==='function')await nav.clearAppBadge();
 }catch{/* Die Benachrichtigung bleibt auch ohne Symbolanzeige verfügbar. */}
}
// Empty push payload: resolve the reminder through the locally stored scoped access.
async function showPortalReminder(){
 let event=null;
 try{const saved=await DeckelDevice.read();if(saved?.portal&&/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(saved.origin||'')&&/^[A-Za-z0-9_-]{43}$/.test(saved.capability||'')){
  const res=await fetch(saved.origin+'/portal/notification',{method:'POST',headers:{Authorization:'Bearer '+saved.capability,'Content-Type':'application/json'},body:JSON.stringify({alias:saved.alias,revision:saved.revision}),cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(10000)});if(res.ok)event=(await res.json()).event;
 }}catch{}
 const time=event?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(event.start)):'';
 await self.registration.showNotification(event?'Feuerwehr Wasser · '+event.title:'H₂O Portal · Feuerwehr Wasser',{body:event?time+' Uhr · Wir erinnern dich an deinen Termin. Tippen zum Öffnen.':'Eine neue Termin-Erinnerung ist eingegangen. Öffne das Portal für den aktuellen Stand.',icon:new URL('assets/drinks/h2o-symbol-blue-192.png?v=20261025.17',self.registration.scope).href,tag:'h2o-portal-reminder',data:{eventId:event?.id||null}});
 await updateDeckelBadge(1);
}
self.addEventListener('push',event=>event.waitUntil(showPortalReminder()));
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil((async()=>{
  await updateDeckelBadge(0);
  const saved=await DeckelDevice.read().catch(()=>null);const targetURL=new URL(saved?.url||'deckel.html',self.registration.scope);const eventId=event.notification.data?.eventId;if(/^[A-Za-z0-9_-]{43}$/.test(eventId||''))targetURL.searchParams.set('event',eventId);const url=targetURL.href;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(client=>{const current=new URL(client.url),target=new URL(url);return current.origin===target.origin&&current.pathname===target.pathname;});
  if(existing){const navigated=await existing.navigate(url);await (navigated||existing).focus();}else await self.clients.openWindow(url);
 })());
});




