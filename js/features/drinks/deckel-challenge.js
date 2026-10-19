/* Personal monthly challenge. Pending answers stay encrypted and retry by ID. */
(function(g){
 'use strict';const $=id=>document.getElementById('challenge-'+id),utf=new TextEncoder(),dec=new TextDecoder(),points=n=>(n/150).toLocaleString('de-DE');
 let section=null,record=null,service=null,state={pending:null},game=null,monthly=null,categories=null,busy=false,ready=false,loaded=false,refreshFailed=false,generation=0,timer=null,renderedKey=null,selectedAnswer=null,answerButtons=[],advanceAfterConfirm=false;
 const pageVisible=()=>{const page=document.getElementById('portal-page-challenge');return !page||!page.hidden;};
 const names={TM:'Truppmann',TF:'Truppführer',GF:'Gruppenführer'},profile=()=>names[service?.challengeLevel]?service.challengeLevel:null,level=()=>profile()||$('level').value,say=text=>{if($('status'))$('status').textContent=text;};
 function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
 async function crypt(value,reading=false,rec=record){const key=await crypto.subtle.importKey('raw',Uint8Array.from(rec.key.match(/../g),x=>parseInt(x,16)),'AES-GCM',false,[reading?'decrypt':'encrypt']),aad=utf.encode('deckel-challenge-phone/v1/'+rec.alias);if(reading)return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(value.iv),additionalData:aad},key,Uint8Array.from(atob(value.data),c=>c.charCodeAt(0)))));const iv=crypto.getRandomValues(new Uint8Array(12)),bytes=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,utf.encode(JSON.stringify(value))));return {version:1,iv:Array.from(iv),data:btoa(Array.from(bytes,x=>String.fromCharCode(x)).join(''))};}
 async function persist(next,rec=record){await g.DeckelDevice.saveChallenge(rec.alias,await crypt(next,false,rec));}
 async function api(action,data={}){if(!ready||!service||!record)throw Error('Die Monats-Challenge benötigt das aktuelle Worker-Update.');const response=await fetch(service.origin+'/challenge/'+action,{method:'POST',headers:{Authorization:'Bearer '+service.capability,'Content-Type':'application/json'},body:JSON.stringify({...data,alias:record.alias,revision:service.revision}),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(20000)}),value=await response.json();if(!response.ok)throw Object.assign(Error(value.error||'Vorgang nicht bestätigt.'),{status:response.status,code:value.code});return value;}
 function controls(){if(!section)return;for(const n of section.querySelectorAll('button,input,select'))n.disabled=busy||!!state.pending||!ready;$('refresh').hidden=!refreshFailed||!!state.pending;$('retry').hidden=!state.pending;$('retry').disabled=busy||!ready;$('level').disabled=$('level').disabled||!!profile();$('create').disabled=$('create').disabled||!!game||!monthly?.awardUnits||!categories?.some(c=>c.name===$('category').value&&(c.counts?.[level()]||0)>=7);const confirm=$('confirm');if(confirm)confirm.disabled=busy||!!state.pending||!ready||selectedAnswer===null;}
 function paintCategories(){const selected=$('category').value;$('category').replaceChildren();const blank=node('option','Kategorie wählen …');blank.value='';$('category').append(blank);for(const c of categories||[]){const count=c.counts?.[level()]||0,option=node('option',c.name+(count<7?' · noch nicht verfügbar':''));option.value=c.name;option.disabled=count<7;$('category').append(option);}$('category').value=categories?.some(c=>c.name===selected&&(c.counts?.[level()]||0)>=7)?selected:'';$('category-note').textContent=!level()?'Bitte zuerst deine Ausbildungsstufe auswählen.':categories?.some(c=>(c.counts?.[level()]||0)>=7)?'Sieben zufällige Fragen für '+names[level()]+'.':'Für '+names[level()]+' fehlen Fragen im Spieldienst. Bitte die Verwaltung bitten, die freigegebenen Fragen zu übertragen.';controls();}
 function bindStableActivation(button,viewKey,activate){
  let press=null;
  button.onpointerdown=event=>{
   press=null;
   if(event.isPrimary===false||button.disabled||viewKey!==renderedKey)return;
   press={key:renderedKey,selection:selectedAnswer,x:event.clientX,y:event.clientY,rect:button.getBoundingClientRect()};
  };
  button.onpointermove=event=>{if(press&&(Math.abs(event.clientX-press.x)>12||Math.abs(event.clientY-press.y)>12))press=null;};
  button.onpointercancel=()=>{press=null;};
  button.onclick=event=>{
   const start=press;press=null;
   if(button.disabled||viewKey!==renderedKey)return;
   // Tastatur und Bedienungshilfen erzeugen Klicks ohne vorausgehende Berührung.
   if(event?.detail>0){
    if(!start||start.key!==renderedKey||start.selection!==selectedAnswer)return;
    const rect=button.getBoundingClientRect();
    if(['top','left','width','height'].some(key=>Math.abs(rect[key]-start.rect[key])>2)||Math.abs(event.clientX-start.x)>12||Math.abs(event.clientY-start.y)>12)return;
   }
   activate();
  };
 }
 function selectAnswer(index){
  if(!ready||busy||state.pending||!game?.question||game.status!=='running')return;
  selectedAnswer=index;
  answerButtons.forEach((button,i)=>{
   button.className='challenge-answer'+(i===index?' is-selected':'');
   button.setAttribute?.('aria-pressed',i===index?'true':'false');
  });
  const hint=$('selection-hint');
  if(hint)hint.textContent='Ausgewählt: '+game.question.answers[index]+' · Du kannst die Auswahl noch ändern.';
  controls();
 }
 function show(value){
  const oldKey=renderedKey;
  const viewKey=value?[value.gameId,value.status,value.question?.index??'-',value.score??'-',value.review?.length??0].join(':'):'none';
  game=value;
  $('create-area').hidden=!!value;
  $('game-area').hidden=!value;
  // Periodische Aktualisierungen dürfen die Frage, Schaltflächen und Berührungspunkte nicht ersetzen.
  if(viewKey===oldKey){controls();return;}
  renderedKey=viewKey;selectedAnswer=null;answerButtons=[];
  $('question').replaceChildren();$('review').replaceChildren();
  if(value){
   $('round-note').textContent=value.month+' · '+value.category+' · '+names[value.level];
   if(value.status==='running'&&value.question){
    const q=value.question,progress=node('progress');
    progress.id='challenge-progress';progress.max=7;progress.value=q.index;
    progress.setAttribute?.('aria-label','Beantwortete Fragen');
    $('question').append(node('small','Frage '+(q.index+1)+' von 7'),progress,node('h3',q.text));
    q.answers.forEach((answer,i)=>{
     const button=node('button',answer);
     button.type='button';button.className='challenge-answer';
     button.setAttribute?.('aria-pressed','false');
     bindStableActivation(button,viewKey,()=>selectAnswer(i));
     answerButtons.push(button);$('question').append(button);
    });
    const hint=node('p','Wähle eine Antwort. Gespeichert wird erst nach deiner Bestätigung.');
    hint.id='challenge-selection-hint';hint.className='challenge-selection-hint';hint.setAttribute?.('aria-live','polite');
    const confirm=node('button','Ausgewählte Antwort verbindlich abgeben');
    confirm.id='challenge-confirm';confirm.type='button';confirm.className='challenge-confirm';confirm.disabled=true;
    bindStableActivation(confirm,viewKey,()=>{
     if(viewKey!==renderedKey||selectedAnswer===null||busy||state.pending||!ready)return;
     advanceAfterConfirm=true;
     send('solo-answer',{gameId:value.gameId,index:q.index,answer:selectedAnswer});
    });
    $('question').append(hint,confirm);
   }
   if(value.status==='done'){
    $('question').append(node('h3',value.earnedUnits?'⭐ Einsatzwissen zahlt sich aus!':'🚒 Wissen aufgefrischt!'),
     node('p',value.score+' von 7 richtig · '+(value.earnedUnits?'+'+points(value.earnedUnits)+' Treuepunkte bestätigt.':'Für den Monatsbonus brauchst du mindestens 5 richtige Antworten.')),
     node('p','Nächster Monatsversuch im nächsten Kalendermonat.'));
    const details=node('details');details.className='challenge-results';details.open=true;
    const wrong=(value.review||[]).filter(q=>q.selected!==q.correct).length;
    details.append(node('summary','Auswertung · '+wrong+' falsch von '+(value.review?.length||7)+' Fragen'));
    for(const q of value.review||[]){
     const correct=q.selected===q.correct,card=node('article');
     card.className='challenge-review-card '+(correct?'is-correct':'is-wrong');
     card.append(node('h4',(correct?'✓ Richtig beantwortet':'✗ Falsch beantwortet')+' · '+q.text));
     if(!correct)card.append(node('p','Deine Antwort: '+(q.answers?.[q.selected]??'Keine Antwort')));
     const answer=node('p','Richtige Antwort: '+(q.answers?.[q.correct]??'Nicht verfügbar'));
     answer.className='challenge-review-correct';card.append(answer);
     if(q.explanation)card.append(node('p',q.explanation));
     if(q.source)card.append(node('small',q.source));
     details.append(card);
    }
    $('review').append(details);
   }else if(value.status==='cancelled'){
    $('question').append(node('p',value.reason),node('p','Neuer Monatsversuch im nächsten Kalendermonat.'));
   }else if(value.status==='running'){
    $('question').append(node('small','Zeit bis '+new Date(value.expiresAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})));
   }
  }
  // Nur nach einer bewusst bestätigten Antwort die nächste Frage in den Blick nehmen.
  if(advanceAfterConfirm&&oldKey!==null&&pageVisible()&&value){
   advanceAfterConfirm=false;
   const heading=$('question').querySelector?.('h3');
   if(heading){heading.tabIndex=-1;heading.focus?.({preventScroll:true});}
   $('question').scrollIntoView?.({block:'start',behavior:'instant'});
  }
  controls();
 }
 function paintBonus(){$('bonus').textContent=monthly?.awardUnits?'⭐ Ab 5 richtigen Antworten: '+points(monthly.awardUnits)+' Treuepunkte.':'Die Verwaltung muss den Monatsbonus noch festlegen.';}
 function schedule(delay=15000){clearTimeout(timer);if(ready&&section&&!section.hidden&&pageVisible()&&!document.hidden&&(state.pending||game?.status==='running'))timer=setTimeout(()=>state.pending?retry():refresh(),delay);}
 async function refresh(){if(busy||state.pending||!ready)return;const version=generation;busy=true;controls();try{const [meta,cats]=await Promise.all([api('solo-status'),api('categories')]);if(version!==generation)return;if(!Array.isArray(cats.categories))throw Error('Kategorien konnten nicht geprüft werden.');const finished=meta.game?.status==='done'&&game?.status!=='done';monthly=meta;categories=cats.categories;paintBonus();paintCategories();show(meta.game);refreshFailed=false;say('');if(finished)g.DeckelReload?.();}catch(e){if(version===generation){refreshFailed=true;say(g.ConnectionStatus?.message(e)||e.message);}}finally{if(version===generation){busy=false;controls();schedule();}}}
 async function retry(){if(busy||!state.pending||!ready)return;const version=generation,job=state.pending;busy=true;controls();say('Wird gespeichert …');try{const value=await api(job.action,{...job.data,id:job.id});if(version!==generation)return;const next={pending:null};await persist(next);if(version!==generation)return;state=next;show(value);say(value.status==='done'?'✓ Monatsrunde bestätigt.':'');if(value.status==='done')g.DeckelReload?.();}catch(e){if(version!==generation)return;if(e.code==='rejected'&&[400,401,403,404,409].includes(e.status)){try{await persist({pending:null});if(version!==generation)return;state={pending:null};say('Nicht übernommen: '+e.message);setTimeout(refresh,0);}catch{say('Lokaler Status konnte nicht gespeichert werden. Bitte erneut prüfen.');}}else say(e.message+' Bitte erneut prüfen.');}finally{if(version===generation){busy=false;controls();schedule();}}}
 async function send(action,data){if(busy||state.pending||!ready)return;const version=generation,rec=record,next={epoch:service?.epoch||'0',pending:{id:crypto.randomUUID(),action,data:{...data,epoch:service?.epoch||'0'}}};busy=true;controls();try{await persist(next,rec);if(version!==generation)return;state=next;}catch{if(version===generation)say('Nicht gesendet: Der sichere Gerätespeicher ist nicht verfügbar.');}finally{if(version===generation){busy=false;controls();if(state.pending)retry();}}}
 function create(){const category=$('category').value,l=level();if(!names[l])return say('Bitte deine Ausbildungsstufe auswählen.');if(!categories?.some(c=>c.name===category&&(c.counts?.[l]||0)>=7))return say('Bitte eine verfügbare Kategorie auswählen.');if(!monthly?.awardUnits)return say('Bitte den Monatsbonus durch die Verwaltung festlegen lassen.');send('solo-create',{category,level:l,month:monthly.month,policyRevision:monthly.policyRevision});}
 function clear(){const pointHint=document.getElementById('deckel-challenge-points-note');if(pointHint)pointHint.hidden=true;generation++;clearTimeout(timer);record=null;service=null;state={pending:null};game=null;monthly=null;categories=null;busy=false;ready=false;loaded=false;refreshFailed=false;renderedKey=null;selectedAnswer=null;answerButtons=[];advanceAfterConfirm=false;if(section){section.hidden=true;section.open=false;for(const id of ['question','review','category'])$(id).replaceChildren();for(const id of ['round-note','bonus','category-note','level-note'])$(id).textContent='';$('level').value='';$('category').value='';say('');controls();}}
 async function render(snapshot){if(!section)return;const params=new URLSearchParams(location.hash.slice(1)),rec={alias:params.get('a'),key:params.get('k')},changed=rec.alias!==record?.alias||rec.key!==record?.key||!!record&&(snapshot.actions?.origin!==service?.origin||snapshot.actions?.revision!==service?.revision||snapshot.actions?.epoch!==service?.epoch);if(changed)clear();record=rec;service=snapshot.actions;ready=service?.central===true&&service.challengeSoloVersion===1;section.hidden=false;const pointHint=document.getElementById('deckel-challenge-points-note');if(pointHint)pointHint.hidden=!ready;$('level-choice').hidden=!!profile();$('level').value=profile()||$('level').value;$('level-note').textContent=profile()?'Deine Stufe: '+names[profile()]: 'Bitte deine Ausbildungsstufe auswählen.';if(!ready){say(service?.central?'Bitte den Cloudflare-Worker für die Monats-Challenge aktualisieren.':'Die Challenge benötigt eine Verbindung zum H₂O Portal.');controls();return;}if(!loaded){const version=generation;busy=true;controls();try{const saved=await g.DeckelDevice.readChallenge(rec.alias);if(version!==generation)return;if(saved){const parsed=await crypt(saved,true,rec);if((parsed.epoch===undefined||parsed.epoch===(service?.epoch||'0'))&&parsed.pending&&['solo-create','solo-answer'].includes(parsed.pending.action))state={pending:parsed.pending};else if(parsed.pending)await persist({pending:null},rec);}loaded=true;}catch{if(version===generation){ready=false;say('Der sichere Spielstand konnte nicht gelesen werden. Bitte erneut prüfen.');}}finally{if(version===generation){busy=false;controls();}}}if(state.pending)retry();else await refresh();}
 function init(){section=document.createElement('section');section.id='deckel-challenge';section.className='deckel-challenge';section.hidden=true;section.innerHTML='<p class="challenge-intro">Beantworte sieben Fragen. Ab fünf richtigen Antworten erhältst du den eingestellten Monatsbonus als Treuepunkte.</p><p id="challenge-bonus" class="note"></p><div id="challenge-create-area"><div id="challenge-level-choice"><label for="challenge-level">Deine Ausbildungsstufe</label><select id="challenge-level"><option value="">Bitte auswählen …</option><option value="TM">Truppmann</option><option value="TF">Truppführer</option><option value="GF">Gruppenführer</option></select></div><p id="challenge-level-note" class="note"></p><label for="challenge-category">Kategorie</label><select id="challenge-category"></select><p id="challenge-category-note" class="note" role="status"></p><button id="challenge-create" type="button">Meine 7 Fragen starten</button><p class="note">Ein gewerteter Versuch pro Kalendermonat · 30 Minuten Zeit.</p></div><div id="challenge-game-area" hidden><p id="challenge-round-note"></p><div id="challenge-question"></div><div id="challenge-review"></div></div><p id="challenge-status" role="status" aria-live="polite"></p><button id="challenge-refresh" class="secondary" type="button" hidden>Erneut laden</button><button id="challenge-retry" type="button" hidden>Speicherung erneut prüfen</button>';const host=document.getElementById('portal-challenge');if(host)host.append(section);else document.getElementById('account').append(section);$('level').onchange=paintCategories;$('category').onchange=controls;$('create').onclick=create;$('refresh').onclick=refresh;$('retry').onclick=retry;document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else if(pageVisible()){if(state.pending)retry();else refresh();}});g.addEventListener('portal-pagechange',event=>{if(event.detail?.page==='portal-challenge'){if(state.pending)retry();else refresh();schedule();}else clearTimeout(timer);});g.addEventListener('hashchange',clear);controls();}
 g.DeckelChallenge={render,clear};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);

