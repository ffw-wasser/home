/* Speicherstatus der Anwesenheitserfassung mit dem bestehenden Ablauf abgleichen. */
(function(){
  'use strict';
  function storageStatus(){window.Usability?.attendanceState();}
  function refresh(count){
    storageStatus();
  }
  function init(){
    const target=byId('members');if(!target)return;
    window.addEventListener('online',storageStatus);window.addEventListener('offline',storageStatus);renderMembers();
  }
  window.AttendanceSmart={refresh,storageStatus};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
