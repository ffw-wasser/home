const {createHash}=require('node:crypto');
async function seed(f,{count=1,verification=false}={}){
 const secret='c'.repeat(64),calendarId='private-invitations@group.calendar.google.com',event=(await f.call('list',{},null,true)).value.events[0];
 const payload=await f.L.seal(f.env,{enabled:true,secretHash:createHash('sha256').update(secret).digest('hex'),calendarId},'calendar-bridge');
 f.sql.prepare('INSERT INTO portal_calendar_bridge(id,payload) VALUES(1,?)').run(payload);
 const jobs=[];
 for(let i=0;i<count;i++){const id=createHash('sha256').update('synthetic-old-invitation-'+i).digest('hex'),googleEventId='h2o'+id+'0',member=f.people[i%f.people.length].memberId,value={phase:'active',googleEventId,profileVersion:1,endsAt:f.start+3600000,verification:verification&&i===0,email:'member@example.test',description:'Synthetic old invitation',confirmToken:'synthetic-old-proof'};
  f.sql.prepare("INSERT INTO portal_calendar_invites(id,event,member,payload,state) VALUES(?,?,?,?,'active')").run(id,value.verification?'verification':event.id,member,await f.L.seal(f.env,value,'calendar-invite:'+id));jobs.push({id,googleEventId});}
 const p=f.people[0];f.sql.prepare('INSERT INTO portal_calendar_profiles(member,alias,revision,email_hash,payload) VALUES(?,?,?,?,?)').run(p.memberId,p.alias,p.revision,'synthetic-email-hash',await f.L.seal(f.env,{allowed:true,verified:true,email:'member@example.test',alias:p.alias,revision:p.revision},'calendar-profile:'+p.memberId));
 const bridge=async(action,data={})=>{const r=await f.c.worker.fetch(new Request('https://test.example/portal/calendar-bridge/'+action,{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(data)}),f.env);return {status:r.status,value:await r.json()};};
 return {jobs,secret,calendarId,bridge,begin:()=>bridge('begin',{calendarId,sourceCalendarId:'test-calendar'})};
}
module.exports={seed};
