const CACHE_NAME="ffw-wasser-20261010.1";
const CORE=["./js/features/drinks/drinks-statistics.js?v=20261010.1", "./js/features/drinks/drinks-bookings-admin.js?v=20261010.1", "./assets/drinks/deckel-kamerad.webp", "./deckel-android.webmanifest", "./assets/drinks/deckel-icon-180.png", "./assets/drinks/deckel-icon-192.png", "./assets/drinks/deckel-icon-512.png", "./assets/drinks/deckel-icon-maskable-512.png", "./js/features/drinks/deckel-install.js?v=20261010.1", "./js/features/quality/workflow-ux.js?v=20261010.1", "./js/core/privacy.js?v=20261010.1", "./deckel.webmanifest", "./js/features/drinks/push-device.js?v=20261010.1", "./js/features/drinks/deckel-push.js?v=20261010.1", "./js/features/drinks/drinks-push.js?v=20261010.1", "./deckel.html", "./css/features/deckel.css?v=20261010.1", "./js/features/drinks/deckel-crypto.js?v=20261010.1", "./js/features/drinks/drinks-mobile.js?v=20261010.1", "./js/features/drinks/deckel-view.js?v=20261010.1", "./", "./index.html", "./icon-192.png", "./icon-512.png", "./manifest.webmanifest?v=20261010.1", "./css/core/base.css?v=20261010.1", "./css/features/attendance.css?v=20261010.1", "./css/features/settings.css?v=20261010.1", "./css/layout/responsive.css?v=20261010.1", "./css/maintenance/01-foundation.css?v=20261010.1", "./css/maintenance/02-components.css?v=20261010.1", "./css/maintenance/03-features.css?v=20261010.1", "./css/maintenance/04-pages.css?v=20261010.1", "./css/maintenance/quality.css?v=20261010.1", "./css/layout/desktop-cards.css?v=20261010.1", "./css/features/attendance-workflow.css?v=20261010.1", "./css/features/onedrive-sync.css?v=20261010.1", "./css/features/attendance-status.css?v=20261010.1", "./css/features/smart-workflow.css?v=20261010.1", "./css/components/ui-components.css?v=20261010.1", "./css/layout/responsive-ios.css?v=20261010.1", "./css/layout/patch-ios-history.css?v=20261010.1", "./css/layout/iphone-action-dock-fix.css?v=20261010.1", "./css/features/drinks.css?v=20261010.1", "./css/features/usability.css?v=20261010.1", "./assets/drinks/bierfass.webp", "./taktik-lf10.webp?v=20261010.1", "./taktik-tsf.webp", "./taktik-sonderprobe.webp", "./taktik-unterricht.webp", "./js/core/config.js?v=20261010.1", "./js/core/onedrive-sync.js?v=20261010.1", "./js/core/storage.js?v=20261010.1", "./js/core/database.js?v=20261010.1", "./js/core/ui.js?v=20261010.1", "./js/features/attendance/attendance-controller.js?v=20261010.1", "./js/features/attendance/ipad-action-dock.js?v=20261010.1", "./js/features/reports/csv-engine.js?v=20261010.1", "./js/features/reports/report-engine.js?v=20261010.1", "./js/features/history/backup-engine.js?v=20261010.1", "./js/vendor/pdf-lib.min.js?v=20261010.1", "./js/vendor/jszip.min.js?v=20261010.1", "./js/features/reports/ipad-document-editor.js?v=20261010.1", "./js/features/reports/document-report.js?v=20261010.1", "./js/features/reports/probe-pdf.js?v=20261010.1", "./js/features/reports/csv.js?v=20261010.1", "./js/features/history/archive.js?v=20261010.1", "./js/features/history/report-csv-import.js?v=20261010.1", "./js/features/settings/admin.js?v=20261010.1", "./js/features/statistics/statistics.js?v=20261010.1", "./js/features/tactics/tactics-engine.js?v=20261010.1", "./js/features/tactics/tactics.js?v=20261010.1", "./js/features/reports/operation-template-images.js?v=20261010.1", "./js/features/reports/operation-docx-template.js?v=20261010.1", "./js/features/reports/operation-docx.js?v=20261010.1", "./js/features/reports/operation-pdf-layout.js?v=20261010.1", "./js/features/reports/operation-pdf-worker-source.js?v=20261010.1", "./js/features/operations/operations.js?v=20261010.1", "./js/features/reports/zip-terminpakete.js?v=20261010.1", "./js/features/reports/termin-dateiname-fix.js?v=20261010.1", "./js/features/quality/quality-engine.js?v=20261010.1", "./js/vendor/qrcode.js?v=20261010.1", "./js/features/drinks/drinks-model.js?v=20261010.1", "./js/features/drinks/drinks-store.js?v=20261010.1", "./js/features/drinks/drinks.js?v=20261010.1", "./js/app/app.js?v=20261010.1", "./js/features/quality/smart-workflow.js?v=20261010.1", "./js/features/statistics/statistics-role-scope-fix.js?v=20261010.1", "./js/features/statistics/statistics-quality-term-fix.js?v=20261010.1", "./js/core/ios-keyboard-fix.js?v=20261010.1", "./js/features/history/onedrive-history-live.js?v=20261010.1", "./js/features/attendance/iphone-action-dock-fix.js?v=20261010.1", "./js/features/quality/usability.js?v=20261010.1", "./js/features/tactics/tactics-touch.js?v=20261010.1", "./js/features/drinks/drinks-extras.js?v=20261010.1", "./js/features/drinks/drinks-rewards.js?v=20261010.1", "./js/features/attendance/attendance-smart.js?v=20261010.1", "./assets/templates/Einsatzbericht-Wordvorlage-Kreuze-FINAL.docx"];
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
  const asset=/^(?:js\/.*\.js|css\/.*\.css|assets\/templates\/[^/]+\.(?:docx|jpg)|assets\/drinks\/[^/]+\.(?:webp|png)|icon-(?:192|512)\.png|taktik-[^/]+\.webp|(?:manifest|deckel|deckel-android)\.webmanifest)$/.test(path);
  if(!navigation&&!asset)return;
  // OAuth-Codes in der Rücksprung-URL niemals als Cache-Schlüssel speichern.
  const cacheKey=navigation?new URL(path==="deckel.html"?"deckel.html":"index.html",scope).href:request;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    try{
      const response=await fetch(request);
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
importScripts('js/features/drinks/push-device.js?v=20261010.1');
async function updateDeckelBadge(count){
 try{
  const nav=self.navigator;
  if(count&&typeof nav?.setAppBadge==='function')await nav.setAppBadge(count);
  else if(!count&&typeof nav?.clearAppBadge==='function')await nav.clearAppBadge();
 }catch{/* Die Benachrichtigung bleibt auch ohne Symbolanzeige verfügbar. */}
}
self.addEventListener('push',event=>event.waitUntil(Promise.all([self.registration.showNotification('Feuerwehr Wasser · Dein Deckel',{
 body:'🍺 Dein Deckel wartet auf dich. Tippe hier, um ihn anzusehen.',
 icon:new URL('assets/drinks/deckel-icon-192.png',self.registration.scope).href,
 badge:new URL('icon-192.png',self.registration.scope).href,
 tag:'deckel-reminder',renotify:true
}),updateDeckelBadge(1)])));
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil((async()=>{
  await updateDeckelBadge(0);
  const saved=await DeckelDevice.read().catch(()=>null);const url=saved?.url||new URL('deckel.html',self.registration.scope).href;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(client=>{const current=new URL(client.url),target=new URL(url);return current.origin===target.origin&&current.pathname===target.pathname;});
  if(existing){const navigated=await existing.navigate(url);await (navigated||existing).focus();}else await self.clients.openWindow(url);
 })());
});
