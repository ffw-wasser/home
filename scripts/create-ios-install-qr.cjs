// Offline install card. The URL must first be obtained and checked in Apple.
'use strict';
const fs=require('node:fs'),path=require('node:path'),qrcode=require('../js/vendor/qrcode.js');
function installURL(value){
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash)throw Error('Nur unveränderte Apple-Installationslinks ohne Zugangsdaten verwenden.');
 const store=u.hostname==='apps.apple.com'&&/^\/(?:[a-z]{2}\/)?app\/(?:[A-Za-z0-9%_-]+\/)?id\d+$/.test(u.pathname);
 const beta=u.hostname==='testflight.apple.com'&&/^\/join\/[A-Za-z0-9]{8}$/.test(u.pathname);
 const common=u.hostname==='ffw-wasser.github.io'&&u.pathname==='/home/install.html';
 if(!store&&!beta&&!common)throw Error('Die gemeinsame H₂O-Installationsseite oder einen echten Apple-Installationslink angeben.');
 return {url:u.href,beta,common};
}
function generate(value){
 const {url,beta,common}=installURL(value),qr=qrcode(0,'M');qr.addData(url);qr.make();
 const svg=qr.createSvgTag({cellSize:8,margin:32,scalable:true,alt:'Installationslink für H₂O Portal'});
 const instructions=common?'Mit der Handykamera scannen. Die Installationsseite zeigt den passenden Weg für iPhone, iPad und Android.':beta?'Mit der iPhone-Kamera scannen. TestFlight installieren, die Einladung annehmen und H₂O Portal installieren.':'Mit der iPhone-Kamera scannen und H₂O Portal im App Store laden.';
 const html='<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>H₂O Portal installieren</title><style>body{font:20px system-ui;background:#eef6f1;color:#142238;margin:0;padding:32px;text-align:center}main{max-width:620px;margin:auto;border-top:12px solid #9e0a20;padding:24px;background:white;border-radius:20px}svg{width:100%;max-width:380px;height:auto}p{line-height:1.5}a{color:#74162c;overflow-wrap:anywhere}small{display:block;margin-top:24px}@media print{body{padding:0;background:white}}</style><main><h1>H₂O Portal installieren</h1><p>Feuerwehr Wasser'+(beta?' · Testversion':'')+'</p>'+svg+'<p>'+instructions+'</p><p><a href="'+url+'">'+url+'</a></p><small>Die Installation gibt keinen Mitgliederzugang frei. Verwende anschließend deine persönliche H₂O-Anmeldung.</small></main></html>';
 return {svg,html,qr,url};
}
if(require.main===module){
 try{
  const [url,out]=process.argv.slice(2);
  if(!url||!out)throw Error('Aufruf: node scripts/create-ios-install-qr.cjs APPLE_LINK AUSGABEORDNER');
  const card=generate(url);fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'H2O-Installation-iPhone.svg'),card.svg);
  fs.writeFileSync(path.join(out,'H2O-Installation-iPhone.html'),card.html);
  console.log('Installationskarte und QR-Code lokal erstellt. Den echten Link vor dem Aushang auf einem iPhone prüfen.');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={installURL,generate};
