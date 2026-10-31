const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const script=fs.readFileSync('native/shared/ios-entry.js','utf8');
function run(href){const changes=[],jumps=[],url=new URL(href),c=vm.createContext({URL,location:url,history:{replaceState:(...args)=>changes.push(args[2])},DeckelMobile:{jump:id=>jumps.push(id)}});c.window=c;c.top=c;vm.runInContext(script,c);return {changes,jumps};}
test('Native entry opens terms and removes only its navigation parameter without a camera or install action',()=>{
 const f=run('https://ffw-wasser.github.io/home/deckel.html?nativePage=terms&x=1');assert.deepEqual(f.jumps,['portal-section']);assert.deepEqual(f.changes,['/home/deckel.html?x=1']);
});
test('Normal native login requires no scanner controls or extra Home installation',()=>{
 const f=run('https://ffw-wasser.github.io/home/deckel.html');assert.deepEqual(f,{changes:[],jumps:[]});
});
test('Native entry rejects unrelated hosts and pages',()=>{
 for(const url of ['https://evil.test/home/deckel.html?nativePage=terms','https://ffw-wasser.github.io/home/index.html?nativePage=terms'])assert.deepEqual(run(url),{changes:[],jumps:[]});
});

test('Native calendar destination preserves event focus while opening complete portal navigation',()=>{
 const event='a'.repeat(43),f=run('https://ffw-wasser.github.io/home/deckel.html?nativePage=terms&event='+event);
 assert.deepEqual(f.jumps,['portal-section']);assert.deepEqual(f.changes,['/home/deckel.html?event='+event]);
});
