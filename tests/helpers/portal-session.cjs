// Synthetic authenticated sessions for business-rule tests. Real WebAuthn
// enrollment, signatures and scope boundaries are covered by portal-identity.
const {randomBytes,createHash}=require('node:crypto');
async function sessions(c,env,sql,people,now=Date.now()){
 await c.PortalService.ready(env);
 const tokens=new Map();
 for(const p of people){
  const token=randomBytes(32).toString('base64url'),credential='fixture-'+p.alias;
  sql.prepare('INSERT INTO portal_passkeys(id,alias,revision,public_key,counter,user_id) VALUES(?,?,?,?,0,?)').run(credential,p.alias,p.revision,'synthetic-not-a-public-key',credential);
  sql.prepare('INSERT INTO portal_identity_grants(id,alias) VALUES(?,?)').run(credential,p.alias);
  sql.prepare('INSERT INTO portal_identity_sessions(token_hash,alias,revision,credential,created_at,expires_at) VALUES(?,?,?,?,?,?)').run(createHash('sha256').update('portal-session:'+token).digest('base64url'),p.alias,p.revision,credential,now,now+30*86400000);
  tokens.set(p.alias+':'+p.revision,token);
 }
 return async(_env,p)=>p.testToken||tokens.get(p.alias+':'+p.revision)||'invalid-test-session';
}
module.exports={sessions};
