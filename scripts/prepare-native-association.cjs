#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
function association({teamId,sha256,applicationId='de.feuerwehrwasser.h2o'}){
 if(!/^[A-Z0-9]{10}$/.test(teamId||''))throw Error('H2O_APPLE_TEAM_ID muss die echte zehnstellige Apple-Team-ID enthalten.');
 if(!/^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test(sha256||''))throw Error('H2O_ANDROID_SHA256 muss den SHA-256-Fingerabdruck des App-Signaturzertifikats enthalten.');
 if(applicationId!=='de.feuerwehrwasser.h2o')throw Error('Die App-Kennung muss zuerst in beiden nativen Projekten abgestimmt werden.');
 const appID=teamId+'.'+applicationId,androidOrigin='android:apk-key-hash:'+Buffer.from(sha256.replaceAll(':',''),'hex').toString('base64url');
 return {
  apple:{applinks:{details:[{appIDs:[appID],components:[{'/':'/home/deckel.html'},{'/':'/home/termin.html'}]}]},webcredentials:{apps:[appID]}},
  android:[{relation:['delegate_permission/common.handle_all_urls','delegate_permission/common.get_login_creds'],target:{namespace:'android_app',package_name:applicationId,sha256_cert_fingerprints:[sha256.toUpperCase()]}}],
  worker:{H2O_ANDROID_APP_ORIGINS:JSON.stringify([androidOrigin])}
 };
}
if(require.main===module){
 try{
  const result=association({teamId:process.env.H2O_APPLE_TEAM_ID,sha256:process.env.H2O_ANDROID_SHA256}),out=path.resolve('native/association/generated');
  fs.mkdirSync(path.join(out,'.well-known'),{recursive:true});
  fs.writeFileSync(path.join(out,'.well-known/apple-app-site-association'),JSON.stringify(result.apple,null,2)+'\n');
  fs.writeFileSync(path.join(out,'.well-known/assetlinks.json'),JSON.stringify(result.android,null,2)+'\n');
  fs.writeFileSync(path.join(out,'worker-native-origins.json'),JSON.stringify(result.worker,null,2)+'\n');
  fs.writeFileSync(path.join(out,'.nojekyll'),'');
  console.log('Zuordnungsdateien erzeugt. Sie sind noch nicht veröffentlicht.');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={association};
