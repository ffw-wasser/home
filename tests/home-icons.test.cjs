const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const release=JSON.parse(read('app-release.json'));
const ffw=JSON.parse(read('manifest.webmanifest'));
const h2o=JSON.parse(read('deckel.webmanifest'));
const android=JSON.parse(read('deckel-android.webmanifest'));
const main=read('index.html'),portal=read('deckel.html'),service=read('service-worker.js');
test('FFW und H2O haben unterschiedliche schwarze Startbildschirm-Icons',()=>{
 assert.equal(ffw.background_color,'#000000');
 assert.equal(h2o.background_color,'#000000');
 assert.equal(android.background_color,'#000000');
 assert.match(ffw.icons[0].src,/ffw-home-192\.png/);
 assert.match(ffw.icons[1].src,/ffw-home-512\.png/);
 for(const manifest of [h2o,android]){
  assert.match(manifest.icons[0].src,/h2o-symbol-black-192\.png/);
  assert.match(manifest.icons[1].src,/h2o-symbol-black-512\.png/);
  assert.equal(manifest.id,'./deckel.html','Persönliches Portal-ID bleibt gleich');
 }
});
test('iOS Homebildschirm-Icons sind getrennt; innerhalb der Apps stimmen die Logos',()=>{
 assert.match(main,/rel="apple-touch-icon"/);
 assert.match(main,/assets\/branding\/ffw-home-180\.png\?v=/);
 assert.match(main,/class="top-brand"><img[^>]+src="assets\/branding\/ffw-header\.svg\?v=[^"]+"/);
 assert.match(portal,/rel="apple-touch-icon"[^>]+h2o-symbol-black-180\.png/);
 assert.match(portal,/class="deckel-title"><img src="assets\/drinks\/h2o-symbol-black-96\.png\?v=[^"]+"/);
 assert.match(service,/new URL\('assets\/drinks\/h2o-symbol-black-192\.png\?v=[^']+'/);
});
test('Alle generierten Icons haben die deklarierten Abmessungen',()=>{
 const png=(filename,size)=>{
  const b=fs.readFileSync(path.join(__dirname,'..',filename));
  assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a',filename);
  assert.equal(b.readUInt32BE(16),size,filename+' Breite');
  assert.equal(b.readUInt32BE(20),size,filename+' Höhe');
 };
 for(const size of [180,192,512])png('assets/branding/ffw-home-'+size+'.png',size);
 for(const size of [96,180,192,512])png('assets/drinks/h2o-symbol-black-'+size+'.png',size);
});
test('Cache- und HTML-Build stimmen überein, Schutzdaten unverändert',()=>{
 for(const manifest of [ffw,h2o,android])for(const icon of manifest.icons)assert.ok(icon.src.endsWith('?v='+release.build));
 assert.ok(main.includes('ffw-build" content="'+release.build+'"'));
 assert.ok(portal.includes('deckel-build" content="'+release.build+'"'));
 assert.ok(service.includes('ffw-wasser-'+release.build+'"'));
 assert.ok(!main.includes('20261016.41'));
 assert.ok(!portal.includes('20261016.41'));
});
