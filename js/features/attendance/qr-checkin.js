/* Camera frames stay on device. QR tokens grant attendance identification only. */
(function(g){
 'use strict';let stream=null,frame=0,epoch=0,refresh=0,busy=false,last='',dialog,video,canvas,status,scope;
 let sound=true,audio,guideFrame,guideLabel,tracking,outline,candidate='',candidateFrames=0,guideStarted=0,guideHoldUntil=0,checkmark,checkmarkTimer=0;
 function guide(state,message){
  if(!guideFrame||!guideLabel)return;
  guideFrame.dataset.state=state;guideLabel.dataset.state=state;
  if(guideLabel.textContent!==message)guideLabel.textContent=message;
  if(['success','error'].includes(state))guideHoldUntil=Date.now()+2200;
  clearTimeout(checkmarkTimer);if(checkmark){checkmark.hidden=state!=='success';if(state==='success')checkmarkTimer=setTimeout(()=>{if(checkmark)checkmark.hidden=true;},1800);}
 }
 function track(qr,width,height){
  tracking.setAttribute('viewBox','0 0 '+width+' '+height);
  const points=qr?.location&&['topLeftCorner','topRightCorner','bottomRightCorner','bottomLeftCorner'].map(key=>qr.location[key]);
  outline.style.display=points?.every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y))?'':'none';
  if(points?.every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)))outline.setAttribute('points',points.map(p=>p.x+','+p.y).join(' '));
 }

 function prepareAudio(){if(!sound)return;try{audio=audio||new (g.AudioContext||g.webkitAudioContext)();audio.resume().catch(()=>{});}catch{}}
 function beep(){if(!sound)return;try{audio=audio||new (g.AudioContext||g.webkitAudioContext)();audio.resume();const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.frequency.value=880;gain.gain.value=.08;oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+.12);}catch{}}
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function stop(){clearTimeout(checkmarkTimer);if(checkmark)checkmark.hidden=true;epoch++;cancelAnimationFrame(frame);clearTimeout(refresh);stream?.getTracks().forEach(t=>t.stop());stream=null;if(video)video.srcObject=null;busy=false;last='';candidate='';candidateFrames=0;guideStarted=Date.now();guideHoldUntil=0;}
 function panel(title){stop();dialog?.remove();dialog=node('dialog');dialog.className='checkin-dialog';const h=node('h2',title),close=node('button','Fertig');close.type='button';close.onclick=()=>dialog.close();status=node('p');status.className='checkin-result';status.setAttribute('role','status');status.setAttribute('aria-live','polite');dialog.append(h,status,close);dialog.addEventListener('close',stop);document.body.append(dialog);dialog.showModal();return dialog;}
 function context(){return JSON.stringify({id:currentOperationId||currentSessionId,date:today(),type:sessionType,source:g.PortalAdmin.checkinContext().source,event:g.PortalAdmin.checkinContext().eventId});}
 function valid(){return dialog?.open&&context()===scope&&oneDriveAdministrationReady()&&document.getElementById('attendanceView')?.hidden===false&&homeFlowStage===2;}
 async function accept(code){
  if(busy||code===last||!valid())return;busy=true;last=code;status.dataset.success='false';const version=epoch;guide('checking','QR-Code erkannt · Anwesenheit wird geprüft …');
  try{
   const result=await g.PortalAdmin.resolveCheckin(code);if(version!==epoch||!valid())return;
   const member=members.find(m=>String(m.id)===String(result.memberId));if(!member)throw Error('Mitglieder bitte zuerst synchronisieren.');
   if(sessionType==='Einsatz'&&member.ageDepartment||sessionType==='Ausschuss Sitzung'&&!member.committeeMember)throw Error('Dieses Mitglied ist für diese Terminart nicht auswählbar.');
   const name=nameForTile(member),existing=todayEntries().find(e=>e.storedName===nameForStorage(member)||e.displayName===name);
   if(existing?.status==='Anwesend'){status.textContent=name+' – bereits erfasst ✓';guide('success','Bereits als anwesend erfasst ✓');return;}
   const selected=g.PortalAdmin.checkinContext(),info=selected.replies,reply=!info?.stale&&(!info?.event||info.event.id===selected.eventId)&&info?.replies?.find(r=>String(r.memberId)===String(member.id));
   const excused=existing?.status==='Entschuldigt'||pendingMemberStatuses.get(member.id)==='Entschuldigt'||reply?.status==='excused';
   if((excused||reply?.status!=='yes')&&!confirm(name+(excused?' ist entschuldigt. Trotzdem als anwesend erfassen?':' ist nicht vorgemerkt. Als anwesend hinzufügen?'))){guide('waiting','Erfassung nicht übernommen');return;}
   if(!valid())return;
   const before=existing?{...existing}:null,pendingBefore=pendingMemberStatuses.get(member.id);
   if(existing){existing.status='Anwesend';existing.role=sessionType==='Unterricht'?'Unterricht':sessionType==='Ausschuss Sitzung'?'Ausschuss Sitzung':'';}
   else entries.unshift({id:makeId(),date:today(),time:new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}),storedName:nameForStorage(member),displayName:name,status:'Anwesend',role:sessionType==='Unterricht'?'Unterricht':sessionType==='Ausschuss Sitzung'?'Ausschuss Sitzung':'',sessionType,sessionId:sessionType==='Einsatz'?'':ensureCurrentSessionId(),operationId:sessionType==='Einsatz'?currentOperationId:''});
   try{saveEntries();}catch(error){if(existing)Object.assign(existing,before);else entries.shift();throw error;}
   pendingMemberStatuses.delete(member.id);chosenMemberIds.delete(member.id);persistAttendanceDraft();renderMembers();renderEntries();updateSelection();g.updateProbeWorkflow?.();g.updatePrimaryAction?.();
   beep();guide('success','Anwesenheit bestätigt ✓');status.textContent=name+' – anwesend ✓';status.dataset.success='true';
   dialog.querySelector('[data-checkin-undo]')?.remove();const saved=existing||entries[0],undo=node('button','Letzte Erfassung rückgängig');undo.type='button';undo.dataset.checkinUndo='true';dialog.append(undo);undo.onclick=()=>{if(!valid()||!entries.includes(saved))return;const index=entries.indexOf(saved);if(before)Object.assign(saved,before);else entries.splice(index,1);saveEntries();if(pendingBefore){pendingMemberStatuses.set(member.id,pendingBefore);chosenMemberIds.add(member.id);}persistAttendanceDraft();renderMembers();renderEntries();updateSelection();g.updateProbeWorkflow?.();g.updatePrimaryAction?.();guide('waiting','Erfassung zurückgenommen');status.textContent=name+' – Erfassung zurückgenommen';undo.remove();last=code;};
  }catch(e){if(version===epoch){status.textContent=e.message||'Erfassung fehlgeschlagen.';guide('error','Nicht bestätigt · Hinweis unten beachten');}}finally{if(version===epoch)busy=false;}
 }
 async function scan(){
  if(!oneDriveAdministrationReady()||homeFlowStage!==2||!(currentSessionId||currentOperationId))return showToast('Bitte zuerst einen Termin starten und OneDrive verbinden.','error');
  prepareAudio();const d=panel('Anwesenheit scannen');scope=context();
  const event=g.PortalAdmin.selectedEvent?.(),term=node('p',(event?.title||(typeof currentClosingTopic==='string'?currentClosingTopic:'')||sessionType)+' · '+today());d.insertBefore(term,status);
  const tools=node('div');tools.className='checkin-tools';const soundButton=node('button',sound?'Ton an':'Ton aus');soundButton.type='button';soundButton.setAttribute('aria-pressed',String(sound));soundButton.onclick=()=>{sound=!sound;soundButton.textContent=sound?'Ton an':'Ton aus';soundButton.setAttribute('aria-pressed',String(sound));if(sound)beep();};tools.append(soundButton);
  video=node('video');video.autoplay=true;video.muted=true;video.playsInline=true;canvas=node('canvas');guideFrame=node('div');guideFrame.className='checkin-camera';
  const target=node('div');target.className='checkin-target';target.setAttribute('aria-hidden','true');
  tracking=document.createElementNS('http://www.w3.org/2000/svg','svg');tracking.classList.add('checkin-tracking');tracking.setAttribute('aria-hidden','true');outline=document.createElementNS('http://www.w3.org/2000/svg','polygon');outline.style.display='none';tracking.append(outline);
  checkmark=node('div','✓');checkmark.className='checkin-success';checkmark.hidden=true;checkmark.setAttribute('aria-hidden','true');guideFrame.append(video,target,tracking,checkmark);guideLabel=node('p');guideLabel.className='checkin-guide';guideLabel.setAttribute('role','status');guideLabel.setAttribute('aria-live','polite');
  d.insertBefore(guideFrame,status);d.insertBefore(guideLabel,status);d.insertBefore(tools,status);status.textContent='';guide('waiting','QR-Code in den Rahmen halten');
  const switcher=node('button','Kamera wechseln');switcher.type='button';tools.append(switcher);let facing='user';
  async function start(){
   stop();const version=epoch;outline.style.display='none';guide('waiting','QR-Code in den Rahmen halten');
   try{
    const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1280}}});
    if(version!==epoch||!d.open){next.getTracks().forEach(t=>t.stop());return;}
    stream=next;const actualFacing=next.getVideoTracks()[0]?.getSettings?.().facingMode||facing;
    video.style.transform=actualFacing==='user'?'scaleX(-1)':'none';tracking.style.transform=video.style.transform;video.srcObject=stream;await video.play();
    const ctx=canvas.getContext('2d',{willReadFrequently:true});let previous=0;
    function tick(now){
     if(version!==epoch)return;if(!valid()){d.close();return;}
     if(now-previous>250&&video.readyState>=2&&video.videoWidth&&!busy){
      previous=now;const scale=Math.min(1,960/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);ctx.drawImage(video,0,0,canvas.width,canvas.height);
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),qr=g.jsQR(pixels.data,canvas.width,canvas.height);track(qr,canvas.width,canvas.height);
      if(qr){
       if(!qr.data.startsWith('FFW-CHECKIN:1:')){guide('error','Bitte den persönlichen Anwesenheitscode im Portal öffnen');candidate='';candidateFrames=0;}
       else if(qr.data!==last){
        if(candidate===qr.data)candidateFrames++;else{candidate=qr.data;candidateFrames=1;}
        if(candidateFrames>=2)accept(qr.data);else guide('readable','QR-Code lesbar · kurz ruhig halten');
       }
      }else{
       candidate='';candidateFrames=0;last='';
       if(Date.now()>guideHoldUntil)guide('waiting',Date.now()-guideStarted>6000?'Noch nicht lesbar · Bildschirm heller stellen und Abstand langsam ändern':'Noch kein QR-Code erkannt · Handy ruhig in den Rahmen halten');
      }
     }
     frame=requestAnimationFrame(tick);
    }
    frame=requestAnimationFrame(tick);
   }catch(e){if(version===epoch){stop();guide('error','Kamera nicht verfügbar');status.textContent='Bitte Kamerazugriff erlauben oder Personen manuell auswählen.';}}
  }
  switcher.onclick=()=>{facing=facing==='user'?'environment':'user';start();};await start();
 }
 async function personal(){
  const d=panel('Mein Anwesenheitscode'),image=node('canvas');image.style.cssText='width:min(100%,320px);height:auto;display:block;margin:16px auto';d.insertBefore(image,status);const version=epoch;const name=document.getElementById('identity-member')?.textContent;if(name)d.insertBefore(node('p',name),image);
  async function renew(){try{const identity=g.H2OIdentity.session();if(!identity)throw Error('Bitte zuerst im Portal anmelden.');const response=await fetch('https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev/portal/checkin-code',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+identity.token},body:JSON.stringify({alias:identity.alias,revision:identity.revision}),cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw Error(result.error||'Code konnte nicht geladen werden.');if(version!==epoch||!d.open)return;const qr=qrcode(0,'M');qr.addData(result.code);qr.make();const count=qr.getModuleCount(),unit=5,quiet=4;image.width=image.height=(count+quiet*2)*unit;const ctx=image.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,image.width,image.height);ctx.fillStyle='#000';for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))ctx.fillRect((c+quiet)*unit,(r+quiet)*unit,unit,unit);status.textContent='Am Gerätehaus vor die iPad-Kamera halten. Der Code erneuert sich automatisch.';refresh=setTimeout(renew,60000);}catch(e){if(version===epoch){image.width=image.height=0;status.textContent=e.message;}}}await renew();
 }
 document.getElementById('attendanceScanButton')?.addEventListener('click',scan);document.getElementById('memberCheckinButton')?.addEventListener('click',personal);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){dialog?.close();stop();}});addEventListener('pagehide',stop);
})(globalThis);
