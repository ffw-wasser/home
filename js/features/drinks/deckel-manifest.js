/* Stable, public manifests: never embed member credentials or setup tickets. */
(function(){
 'use strict';
 const link=document.createElement('link');
 link.id='deckelManifest';
 link.rel='manifest';
 link.href=(/Android/i.test(navigator.userAgent)?'deckel-android.webmanifest':'deckel.webmanifest')+'?v=20261028.2';
 document.head.appendChild(link);
})();

