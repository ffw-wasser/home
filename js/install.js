(function(){
 'use strict';
 // Public installation only. Never copy an invitation or membership token here.
 const ua=navigator.userAgent||'',apple=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),android=/Android/.test(ua);
 if(apple)document.getElementById('android-install').hidden=true;
 if(android)document.getElementById('apple-install').hidden=true;
 async function load(){
  try{
   const response=await fetch('native/store/install-links.json',{cache:'no-store',credentials:'omit'});
   if(!response.ok)return;const data=await response.json();if(!data.ios)return;
   const url=new URL(data.ios);
   const store=url.hostname==='apps.apple.com'&&/^\/(?:[a-z]{2}\/)?app\/(?:[A-Za-z0-9%_-]+\/)?id\d+$/.test(url.pathname);
   const beta=url.hostname==='testflight.apple.com'&&/^\/join\/[A-Za-z0-9]{8}$/.test(url.pathname);
   if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||(!store&&!beta))return;
   const button=document.getElementById('apple-store');button.href=url.href;button.textContent=beta?'Testversion über TestFlight installieren':'Apple-App im App Store installieren';button.hidden=false;
   document.getElementById('apple-pending').textContent=beta?'TestFlight installieren, die Einladung annehmen und anschließend H₂O Portal installieren.':'H₂O Portal direkt im App Store laden und anschließend persönlich anmelden.';
  }catch{ /* The existing browser installation remains available. */ }
 }
 load();
})();
