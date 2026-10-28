/* Private OneDrive contacts. H2O loads only after server-side membership validation. */
(function(g){
'use strict';
const $=id=>document.getElementById(id);
const el=(tag,value)=>{const item=document.createElement(tag);if(value!==undefined)item.textContent=value;return item;};
const state={phone:false,ipad:false};
function paint(contacts,postfix){
 const area=$('contacts-list'+postfix),status=$('contacts-status'+postfix),duty=$('contacts-duty'+postfix);
 if(duty){duty.replaceChildren();duty.hidden=true;}
 if(!area||!status)return;area.replaceChildren();
 if(!contacts?.groups?.length){status.textContent='Kontaktverzeichnis noch nicht abgeglichen. Bitte am Gerätehaus-iPad „Kontakte aktualisieren“ wählen.';return;}
 for(const group of contacts.groups){
  const isDuty=group.id==='c-dienst'&&duty;
  const section=isDuty?duty:el('section');
  if(isDuty){const header=el('header');header.className='contacts-head';const title=el('h3',group.title);title.id='contacts-duty-title'+postfix;header.append(title);section.append(header);}
  else{section.className='contacts-group';section.append(el('h4',group.title));}
  if(group.email){const link=el('a',group.email);link.className='contacts-group-mail';link.href='mailto:'+group.email;section.append(link);}
  for(const person of group.contacts||[]){
   const card=el('div');card.className='contacts-person';if(!isDuty||person.name!==group.title)card.append(el('strong',person.name));
   if(person.role){const role=el('p',person.role);role.className='contacts-role';card.append(role);}
   const links=el('div');links.className='contacts-actions';
   for(const [kind,value,label] of [['tel',person.phone,'Festnetz'],['tel',person.mobile,'Mobil'],['mailto',person.email,'E-Mail']]){
    if(!value)continue;const a=el('a',kind==='tel'?'☎ '+value:'✉ E-Mail');a.href=kind+':'+(kind==='tel'?value.replace(/[^+0-9]/g,''):value);a.setAttribute('aria-label',label+' '+person.name+': '+value);links.append(a);
   }
   card.append(links);section.append(card);
  }
  if(isDuty)section.hidden=false;else area.append(section);
 }
 status.textContent='Verzeichnisstand: '+(contacts.sourceDate||'unbekannt');
}
async function loadPhone(){
 if(state.phone)return;state.phone=true;const status=$('contacts-status');if(status)status.textContent='Kontakte werden geschützt geladen …';
 try{const data=await g.H2OPortal.api('contacts');paint(data.contacts,'');}
 catch(e){if(status)status.textContent=g.ConnectionStatus?.message(e)||e.message;}
 finally{state.phone=false;}
}
async function loadIpad(){
 if(state.ipad)return;state.ipad=true;const status=$('contacts-status-ipad');if(status)status.textContent='Kontakte werden aus OneDrive geladen …';
 try{
  if(typeof g.oneDriveReadContacts!=='function'||!oneDriveAdministrationReady())throw Error('Bitte auf diesem iPad OneDrive verbinden.');
  const contacts=await g.oneDriveReadContacts();paint(contacts,'-ipad');
  try{
   const c=await g.DrinksCentral.connection();if(!c)throw Error('Kontodienst nicht verbunden.');
   await g.DrinksPush.request(c,'/admin/portal/contacts',{source:c.source,contacts});
   status.textContent+=' · Für H₂O synchronisiert.';
  }catch(e){status.textContent+=' · Abgleich für H₂O noch offen: '+(g.ConnectionStatus?.message(e)||e.message);}
 }catch(e){if(status)status.textContent=g.ConnectionStatus?.message(e)||e.message;}
 finally{state.ipad=false;}
}
function init(){
 $('contacts-refresh')?.addEventListener('click',loadPhone);
 $('contacts-refresh-ipad')?.addEventListener('click',loadIpad);
 const help=$('helpView');if(help)new MutationObserver(()=>{if(!help.hidden)loadIpad();}).observe(help,{attributes:true,attributeFilter:['hidden']});
 g.addEventListener('portal-pagechange',event=>{if(event.detail?.page==='more-help')loadPhone();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
