/* The signed-in iPad applies encrypted requests to OneDrive, then acknowledges them. */
(function(g){
 'use strict';let working=false;const S=g.DrinksStore;
 async function sync(){
  if(working||document.hidden||!g.oneDriveSignedIn?.())return;working=true;
  try{
   const config=await g.DrinksPush.config();if(!config)return;const source=S.sourceKey();const result=await g.DrinksPush.request(config,'/admin/commands/pending',{});if(!result.commands?.length)return;
   const records=new Map();for(const id of await S.mobileIds()){const saved=await S.readMobileFile(await S.mobileFileName(id));if(saved)records.set(saved.data.alias,{id,record:saved.data});}
   for(const job of result.commands){
    if(document.hidden||!g.oneDriveSignedIn?.()||S.sourceKey()!==source)break;
    const member=records.get(job.alias);let rejection='';
    if(!member||member.record.revision!==job.revision)rejection='accessChanged';
    else{
     let command;try{command=await g.DeckelCommands.open(JSON.parse(job.envelope),member.record,job.id);}catch{rejection='invalid';}
     if(command){try{await S.applyMobileCommand(member.id,job,command,source);if(!await g.DrinksMobile.publish(member.id))continue;g.Drinks?.updateCards?.();}
      catch(e){if(['pointsChanged','correctionChanged','accessChanged'].includes(e.code))rejection=e.code;else continue;}}
    }
    await g.DrinksPush.request(config,'/admin/commands/ack',{alias:job.alias,revision:job.revision,id:job.id,status:rejection?'rejected':'done',result:rejection});
   }
  }catch{/* An unavailable relay never changes local account balances. Retry the same jobs later. */}
  finally{working=false;}
 }
 g.DrinksPhoneSync={sync};
 if(typeof document!=='undefined'){document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});g.addEventListener('online',sync);setInterval(sync,60000);setTimeout(sync,10000);}
})(globalThis);
