/* Android browser installs may generate outdated WebAPKs. Retain the web manifest
   for iOS and desktop; Android can create a plain home-screen shortcut instead. */
(function(){
 'use strict';
 if(/Android/i.test(navigator.userAgent))return;
 const link=document.createElement('link');
 link.id='deckelManifest';
 link.rel='manifest';
 link.href='deckel.webmanifest?v=20261026.10';
 document.head.appendChild(link);
})();

