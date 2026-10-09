const CACHE_NAME="ffw-wasser-private-admin-20261009";
const CORE=["./js/core/privacy.js?v=20261009-private-admin", "./deckel.webmanifest", "./js/features/drinks/push-device.js?v=20261009-private-admin", "./js/features/drinks/deckel-push.js?v=20261009-push", "./js/features/drinks/drinks-push.js?v=20261009-push", "./deckel.html", "./css/features/deckel.css?v=20261009-push", "./js/features/drinks/deckel-crypto.js?v=20261009", "./js/features/drinks/drinks-mobile.js?v=20261009-push", "./js/features/drinks/deckel-view.js?v=20261009-push", "./", "./index.html", "./icon-192.png", "./icon-512.png", "./manifest.webmanifest?v=20260924-2", "./css/core/base.css?v=20260919-25", "./css/features/attendance.css?v=20260919-25", "./css/features/settings.css?v=20260919-25", "./css/layout/responsive.css?v=20260929-ios27", "./css/maintenance/01-foundation.css?v=20260929-quality", "./css/maintenance/02-components.css?v=20260929-quality", "./css/maintenance/03-features.css?v=20260929-quality", "./css/maintenance/04-pages.css?v=20260930-schritt3-overflow-mobil", "./css/maintenance/quality.css?v=20260930-gruenlinie-abstand", "./css/layout/desktop-cards.css?v=20260919-47", "./css/features/attendance-workflow.css?v=final-1", "./css/features/onedrive-sync.css?v=20260930-info-badge-icon", "./css/features/attendance-status.css?v=8-symbol-center", "./css/features/smart-workflow.css?v=20261006-clean-light", "./css/components/ui-components.css?v=20261001-wappen-fade-2x-datefix", "./css/layout/responsive-ios.css?v=20261006-clean-light", "./css/layout/patch-ios-history.css?v=20261007-5", "./css/layout/iphone-action-dock-fix.css?v=20261007-7", "./css/features/drinks.css?v=20261009-header", "./css/features/usability.css?v=20261009-private-admin", "./assets/drinks/bierfass.webp", "./taktik-lf10.webp?v=20260924-2", "./taktik-tsf.webp", "./taktik-sonderprobe.webp", "./taktik-unterricht.webp", "./js/core/config.js?v=20261008-plausibility-cleanup", "./js/core/onedrive-sync.js?v=20261009-private-admin", "./js/core/storage.js?v=20260924-1", "./js/core/database.js?v=20261009-private-admin", "./js/core/ui.js?v=20261009-private-admin", "./js/features/attendance/attendance-controller.js?v=20261009-smart", "./js/features/attendance/ipad-action-dock.js?v=20261006-final-80", "./js/features/reports/csv-engine.js?v=20261008-report-dates", "./js/features/reports/report-engine.js?v=20260920-1", "./js/features/history/backup-engine.js?v=20261008-plausibility-cleanup", "./js/vendor/pdf-lib.min.js?v=20260930", "./js/vendor/jszip.min.js?v=3.10.2", "./js/features/reports/ipad-document-editor.js?v=20261009-ux", "./js/features/reports/document-report.js?v=20261009-private-admin", "./js/features/reports/probe-pdf.js?v=20260919-25", "./js/features/reports/csv.js?v=20260924-2218", "./js/features/history/archive.js?v=20261009-ux", "./js/features/history/report-csv-import.js?v=20261009-ux", "./js/features/settings/admin.js?v=20261009-private-admin", "./js/features/statistics/statistics.js?v=20261008-report-dates", "./js/features/tactics/tactics-engine.js?v=20260924-1629", "./js/features/tactics/tactics.js?v=produktv-2-0-grossansicht-namen", "./js/features/reports/operation-template-images.js?v=20260930-clean-final", "./js/features/reports/operation-docx-template.js?v=20261006-embedded", "./js/features/reports/operation-docx.js?v=20261001-crosses-casefix", "./js/features/reports/operation-pdf-layout.js?v=20260930-boxlayout", "./js/features/reports/operation-pdf-worker-source.js?v=20261006-49", "./js/features/operations/operations.js?v=20261009-ux", "./js/features/reports/zip-terminpakete.js?v=20261009-smart", "./js/features/reports/termin-dateiname-fix.js?v=20261001-termin-datum", "./js/features/quality/quality-engine.js?v=20261009-ux", "./js/vendor/qrcode.js?v=1.4.4", "./js/features/drinks/drinks-model.js?v=20261009-admin-paypal", "./js/features/drinks/drinks-store.js?v=20261009-push", "./js/features/drinks/drinks.js?v=20261009-admin-paypal", "./js/app/app.js?v=20261009-private-admin", "./js/features/quality/smart-workflow.js?v=20261009-smart", "./js/features/statistics/statistics-role-scope-fix.js?v=20261006-clean-light", "./js/features/statistics/statistics-quality-term-fix.js?v=20261006-clean-light", "./js/core/ios-keyboard-fix.js?v=20261002-ios-keyboard", "./js/features/history/onedrive-history-live.js?v=20261009-private-admin", "./js/features/attendance/iphone-action-dock-fix.js?v=20261007-7", "./js/features/quality/usability.js?v=20261009-smart", "./js/features/tactics/tactics-touch.js?v=20261009-ux", "./js/features/drinks/drinks-extras.js?v=20261009-push", "./js/features/drinks/drinks-rewards.js?v=20261009-drinks-settings", "./js/features/attendance/attendance-smart.js?v=20261009-smart", "./assets/templates/Einsatzbericht-Wordvorlage-Kreuze-FINAL.docx"];
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
  const navigation=request.mode==="navigate"&&(path===""||path==="index.html");
  const asset=/^(?:js\/.*\.js|css\/.*\.css|assets\/templates\/[^/]+\.(?:docx|jpg)|assets\/drinks\/[^/]+\.webp|icon-(?:192|512)\.png|taktik-[^/]+\.webp|manifest\.webmanifest)$/.test(path);
  if(!navigation&&!asset)return;
  // OAuth-Codes in der Rücksprung-URL niemals als Cache-Schlüssel speichern.
  const cacheKey=navigation?new URL("index.html",scope).href:request;
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
importScripts('js/features/drinks/push-device.js?v=20261009-private-admin');
self.addEventListener('push',event=>event.waitUntil(self.registration.showNotification('Feuerwehr Wasser · Dein Deckel',{
 body:'🍺 Dein Deckel wartet auf dich. Tippe hier, um ihn anzusehen.',
 icon:new URL('icon-192.png',self.registration.scope).href,
 badge:new URL('icon-192.png',self.registration.scope).href,
 tag:'deckel-reminder',renotify:true
})));
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil((async()=>{
  const saved=await DeckelDevice.read().catch(()=>null);const url=saved?.url||new URL('deckel.html',self.registration.scope).href;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(client=>{const current=new URL(client.url),target=new URL(url);return current.origin===target.origin&&current.pathname===target.pathname;});
  if(existing){const navigated=await existing.navigate(url);await (navigated||existing).focus();}else await self.clients.openWindow(url);
 })());
});
