const {test}=require('node:test'),assert=require('node:assert/strict');
const {installURL,generate}=require('../scripts/create-ios-install-qr.cjs'),jsQR=require('../js/vendor/jsqr.js');
test('Installation card encodes the complete official Apple link with a quiet zone',()=>{
 for(const url of ['https://ffw-wasser.github.io/home/install.html','https://apps.apple.com/de/app/h2o-portal/id1234567890','https://testflight.apple.com/join/Ab12Cd34']){
  const card=generate(url),q=card.qr,n=q.getModuleCount(),cell=8,margin=4,size=(n+2*margin)*cell,data=new Uint8ClampedArray(size*size*4).fill(255);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(q.isDark(y,x))for(let yy=0;yy<cell;yy++)for(let xx=0;xx<cell;xx++){
   const i=(((y+margin)*cell+yy)*size+(x+margin)*cell+xx)*4;data[i]=data[i+1]=data[i+2]=0;
  }
  assert.equal(jsQR(data,size,size).data,url);assert.match(card.html,/keinen Mitgliederzugang/);assert.ok(card.svg.includes('<svg'));
 }
});
test('Installation QR rejects member invitations, credentials and unverified destinations',()=>{
 for(const url of ['http://apps.apple.com/app/id1','https://apps.apple.com.evil.test/app/id1','https://user:secret@apps.apple.com/app/id1','https://testflight.apple.com/join/Ab12Cd34#setup=secret','https://apps.apple.com/app/id1?token=secret','https://ffw-wasser.github.io/home/deckel.html#setup=secret','https://testflight.apple.com/join/missing','https://apps.apple.com:444/app/id1'])assert.throws(()=>installURL(url));
});
