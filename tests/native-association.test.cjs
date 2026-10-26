const test=require('node:test'),assert=require('node:assert/strict');
const {association}=require('../scripts/prepare-native-association.cjs');
test('Native Domain-Zuordnung bindet die exakten Kennungen und beide Portalpfade',()=>{
 const result=association({teamId:'TESTTEAM01',sha256:Array(32).fill('07').join(':')});
 assert.deepEqual(result.apple.webcredentials.apps,['TESTTEAM01.de.feuerwehrwasser.h2o']);
 assert.deepEqual(result.apple.applinks.details[0].components,[{'/':'/home/deckel.html'},{'/':'/home/termin.html'}]);
 assert.equal(result.android[0].target.package_name,'de.feuerwehrwasser.h2o');
 assert.deepEqual(JSON.parse(result.worker.H2O_ANDROID_APP_ORIGINS),['android:apk-key-hash:'+Buffer.alloc(32,7).toString('base64url')]);
});
test('Fehlende und ungültige Store-Kennungen erzeugen keine Zuordnungsdateien',()=>{
 for(const options of [{},{teamId:'UNKNOWN',sha256:Array(32).fill('07').join(':')},{teamId:'TESTTEAM01',sha256:'07:08'},{teamId:'TESTTEAM01',sha256:Array(32).fill('07').join(':'),applicationId:'evil.app'}])assert.throws(()=>association(options));
});
