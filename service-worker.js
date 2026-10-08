const CACHE_NAME="ffw-wasser-age-statistics-20261008";
const CORE=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png"];
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
  const asset=/^(?:js\/.*\.js|css\/.*\.css|assets\/templates\/[^/]+\.(?:docx|jpg)|icon-(?:192|512)\.png|taktik-[^/]+\.webp|manifest\.webmanifest)$/.test(path);
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
