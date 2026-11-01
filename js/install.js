(function(){
 'use strict';
 // Public installation only. Never copy an invitation or membership token here.
 const ua=navigator.userAgent||'',apple=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),android=/Android/.test(ua);
 if(apple)document.getElementById('android-install').hidden=true;
 if(android)document.getElementById('apple-install').hidden=true;
 async function load(){
  try{
   const response=await fetch('native/store/install-links.json',{cache:'no-store',credentials:'omit'});
   if(!response.ok)throw Error();const data=await response.json();
   function approved(value,platform){
    try{
     const url=new URL(value);
     if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash)return null;
     const allowed=platform==='android'?url.hostname==='play.google.com'&&/^\/apps\/internaltest\/\d+$/.test(url.pathname):
      url.hostname==='apps.apple.com'&&/^\/(?:[a-z]{2}\/)?app\/(?:[A-Za-z0-9%_-]+\/)?id\d+$/.test(url.pathname)||url.hostname==='testflight.apple.com'&&/^\/join\/[A-Za-z0-9]{8}$/.test(url.pathname);
     return allowed?url:null;
    }catch{return null;}
   }
   const ios=approved(data.ios,'ios'),play=approved(data.android,'android');
   if(ios){
    const beta=ios.hostname==='testflight.apple.com',button=document.getElementById('apple-store');button.href=ios.href;button.textContent=beta?'Testversion über TestFlight installieren':'Apple-App im App Store installieren';button.hidden=false;
    document.getElementById('apple-pending').textContent=beta?'TestFlight installieren, die Einladung annehmen und anschließend H₂O Portal installieren.':'H₂O Portal direkt im App Store laden und anschließend persönlich anmelden.';
   }
   if(play){const button=document.getElementById('android-store');button.href=play.href;button.hidden=false;document.getElementById('android-pending').hidden=true;}
   const target=apple?ios:android?play:null;
   if(target){document.getElementById('install-state').textContent='Der passende Store wird geöffnet. Falls nötig, tippe auf den Installationsbutton.';location.replace(target.href);}
  }catch{document.getElementById('install-state').textContent='Der Store-Link ist gerade nicht verfügbar. Bitte später erneut versuchen oder H₂O im Browser öffnen.';}
 }
 load();
})();
