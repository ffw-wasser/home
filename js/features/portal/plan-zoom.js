/* Local PDF rendering with viewport-sized canvases, pinch zoom and pan. */
(function(g){
'use strict';
let library;
function create(host,bytes,{pageNumber=1,label:documentLabel='Hydrantenplan'}={}){
 let disposed=false,task=null,pdf=null,page=null,render=null,timer=0,drawId=0;
 let width=0,height=0,fit=1,scale=1,x=0,y=0,gesture=null;
 const points=new Map(),surface=document.createElement('div'),label=document.createElement('output');
 surface.className='plan-zoom-surface';label.className='plan-zoom-label';host.replaceChildren(surface,label);host.hidden=false;host.dataset.noSwipe='';host.tabIndex=0;
 host.setAttribute('role','region');host.setAttribute('aria-label',documentLabel+'. Mit zwei Fingern zoomen, mit einem Finger verschieben. Tastatur: Plus, Minus und Pfeiltasten.');
 const point=e=>{const r=host.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
 const clamp=()=>{const v=page.getViewport({scale});x=v.width<=width?(width-v.width)/2:Math.min(0,Math.max(width-v.width,x));y=v.height<=height?(height-v.height)/2:Math.min(0,Math.max(height-v.height,y));label.value=Math.round(scale/fit*100)+' %';host.dataset.zoom=String(scale/fit);};
 function draw(){
  if(disposed||!page||!width||!height)return;const id=++drawId;render?.cancel();
  const canvas=document.createElement('canvas'),ratio=Math.min(g.devicePixelRatio||1,2);canvas.width=Math.ceil(width*ratio);canvas.height=Math.ceil(height*ratio);canvas.style.width=width+'px';canvas.style.height=height+'px';
  const started={scale,x,y};render=page.render({canvasContext:canvas.getContext('2d'),viewport:page.getViewport({scale}),transform:[ratio,0,0,ratio,x*ratio,y*ratio],background:'#ffffff'});
  render.promise.then(()=>{if(disposed||id!==drawId){canvas.width=canvas.height=0;return;}const old=surface.firstChild;surface.replaceChildren(canvas);if(old)old.width=old.height=0;surface.style.transform='';host._planRendered=started;}).catch(error=>{canvas.width=canvas.height=0;if(!disposed&&error.name!=='RenderingCancelledException')label.value='Darstellung nicht verfügbar. Bitte Plan groß öffnen.';});
 }
 function schedule(){
  drawId++;render?.cancel();
  const shown=host._planRendered;if(shown)surface.style.transform=`translate(${x-shown.x*scale/shown.scale}px,${y-shown.y*scale/shown.scale}px) scale(${scale/shown.scale})`;
  clearTimeout(timer);timer=setTimeout(draw,75);
 }
 function resize(){
  if(disposed||!page||host.clientWidth<1||host.clientHeight<1)return;
  const oldFit=fit,oldW=width,oldH=height,oldScale=scale;const base=page.getViewport({scale:1});
  width=host.clientWidth;height=host.clientHeight;fit=Math.min(width/base.width,height/base.height);scale=fit*(oldW?oldScale/oldFit:1);
  x=oldW?width/2-(oldW/2-x)*scale/oldScale:0;y=oldH?height/2-(oldH/2-y)*scale/oldScale:0;clamp();draw();
 }
 function rebase(){const p=[...points.values()];gesture=p.length>=2?{kind:'pinch',distance:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),mid:{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2},scale,x,y}:p.length?{kind:'pan',point:p[0],x,y}:null;}
 function down(e){if(!page||disposed||e.button>0)return;e.stopPropagation();e.preventDefault();host.setPointerCapture(e.pointerId);points.set(e.pointerId,point(e));rebase();}
 function move(e){if(!points.has(e.pointerId)||!gesture)return;e.stopPropagation();e.preventDefault();points.set(e.pointerId,point(e));const p=[...points.values()];
  if(gesture.kind==='pinch'&&p.length>=2){const mid={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2},distance=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y);scale=Math.min(fit*32,Math.max(fit,gesture.scale*distance/Math.max(1,gesture.distance)));x=mid.x-(gesture.mid.x-gesture.x)*scale/gesture.scale;y=mid.y-(gesture.mid.y-gesture.y)*scale/gesture.scale;}
  else{x=gesture.x+p[0].x-gesture.point.x;y=gesture.y+p[0].y-gesture.point.y;}
  clamp();schedule();
 }
 function up(e){if(!points.has(e.pointerId))return;e.stopPropagation();points.delete(e.pointerId);rebase();schedule();}
 function key(e){if(!page)return;const before=scale;if(['+','=','-','0'].includes(e.key)){scale=e.key==='0'?fit:Math.min(fit*32,Math.max(fit,scale*(e.key==='-'?1/1.5:1.5)));x=width/2-(width/2-x)*scale/before;y=height/2-(height/2-y)*scale/before;}else if(e.key==='ArrowLeft')x+=60;else if(e.key==='ArrowRight')x-=60;else if(e.key==='ArrowUp')y+=60;else if(e.key==='ArrowDown')y-=60;else return;e.preventDefault();e.stopPropagation();clamp();schedule();}
 for(const [name,handler] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['lostpointercapture',up],['keydown',key]])host.addEventListener(name,handler);
 const observer=new ResizeObserver(resize);observer.observe(host);
 const ready=(async()=>{
  library??=import(new URL('js/vendor/pdfjs/pdf-5.4.624.min.mjs',document.baseURI).href);const lib=await library;if(disposed)return;
  lib.GlobalWorkerOptions.workerSrc=new URL('js/vendor/pdfjs/pdf.worker-5.4.624.min.mjs',document.baseURI).href;
  task=lib.getDocument({data:bytes.slice(),isEvalSupported:false,enableXfa:false,useWasm:false});pdf=await task.promise;if(disposed)return;
  page=await pdf.getPage(pageNumber);if(disposed)return;resize();
 })();
 function destroy(){
  if(disposed)return;disposed=true;drawId++;clearTimeout(timer);points.clear();observer.disconnect();render?.cancel();task?.destroy().catch(()=>{});
  for(const [name,handler] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['lostpointercapture',up],['keydown',key]])host.removeEventListener(name,handler);
  for(const canvas of surface.querySelectorAll('canvas'))canvas.width=canvas.height=0;host.replaceChildren();host.hidden=true;delete host.dataset.zoom;delete host._planRendered;
 }
 return {ready,destroy};
}
g.PlanZoom={create};
})(globalThis);
