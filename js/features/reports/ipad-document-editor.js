"use strict";
(function(){
  let editor=null;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
  const angle=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
  const normalizeAngle=value=>{while(value>180)value-=360;while(value<-180)value+=360;return value;};
  const currentSource=page=>page.editedBlob||page.blob||page.file||page.originalFile;
  const originalSource=page=>page.originalFile||page.file||page.blob;
  function ensureOriginal(page){if(!page.originalFile)page.originalFile=page.file||page.blob;}
  function editorDialog(){
    let dialog=byId("ipadDocumentEditor");if(dialog)return dialog;
    dialog=document.createElement("dialog");dialog.id="ipadDocumentEditor";dialog.className="ipad-document-editor";
    dialog.innerHTML=`<div class="ipad-editor-shell"><header><div><small>Dokumentseite bearbeiten</small><h2>Auf DIN A4 ausrichten</h2></div><button type="button" class="outline-button" data-editor-cancel>Zurück</button></header><p class="ipad-editor-help"><b>Ein Finger:</b> verschieben · <b>Zwei Finger:</b> zoomen und drehen · Der grüne Rahmen ist der spätere PDF-Ausschnitt.</p><div class="ipad-editor-stage" data-editor-stage><canvas data-editor-canvas></canvas><div class="ipad-editor-crop-label" data-editor-crop-label>PDF-AUSSCHNITT</div><div class="ipad-editor-crop-frame" aria-hidden="true"><span>DIN A4</span></div></div><div class="ipad-editor-status" aria-live="polite"><span data-editor-scale>100 %</span><span data-editor-rotation>0°</span></div><div class="ipad-editor-tools"><button type="button" class="outline-button" data-rotate-left>↶ 90° links</button><button type="button" class="outline-button" data-rotate-right>90° rechts ↷</button><button type="button" class="outline-button" data-editor-cover>Rahmen vollständig füllen</button><button type="button" class="outline-button" data-editor-fit>Ganzes Foto anzeigen</button><button type="button" class="outline-button" data-editor-reset>Änderungen verwerfen</button><button type="button" class="outline-button editor-enhance-active" data-editor-enhance>Auto: Helligkeit & Kontrast</button><button type="button" class="outline-button" data-editor-original>Originalfoto herstellen</button></div><footer><button type="button" class="outline-button" data-editor-cancel>Zurück ohne Änderung</button><button type="button" class="primary-button" data-editor-apply>Änderung übernehmen</button></footer></div>`;
    document.body.appendChild(dialog);
    const stage=dialog.querySelector("[data-editor-stage]");
    ["pointerdown","pointermove","pointerup","pointercancel"].forEach(type=>stage.addEventListener(type,handlePointer,{passive:false}));
    dialog.querySelectorAll("[data-editor-cancel]").forEach(button=>button.onclick=()=>closeEditor());
    dialog.querySelector("[data-rotate-left]").onclick=()=>rotateBy(-90);
    dialog.querySelector("[data-rotate-right]").onclick=()=>rotateBy(90);
    dialog.querySelector("[data-editor-cover]").onclick=coverEditor;
    dialog.querySelector("[data-editor-fit]").onclick=fitEditor;
    dialog.querySelector("[data-editor-reset]").onclick=()=>restoreSnapshot(editor.openSnapshot);
    dialog.querySelector("[data-editor-enhance]").onclick=toggleEnhancement;
    dialog.querySelector("[data-editor-original]").onclick=restoreOriginal;
    dialog.querySelector("[data-editor-apply]").onclick=applyEditor;
    dialog.oncancel=event=>{event.preventDefault();closeEditor();};
    dialog.onclick=event=>{if(event.target===dialog)closeEditor();};
    return dialog;
  }
  function enhancementFilter(){return editor?.enhance?`brightness(${editor.enhancement.brightness}) contrast(${editor.enhancement.contrast}) saturate(${editor.enhancement.saturation})`:"none";}
  function updateEnhancementButton(){const button=editor?.dialog?.querySelector("[data-editor-enhance]");if(!button)return;button.classList.toggle("editor-enhance-active",editor.enhance);button.textContent=editor.enhance?"Auto-Optimierung: EIN":"Auto-Optimierung: AUS";}
  function analyzeBitmap(bitmap){
    const sample=document.createElement("canvas"),max=320,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));sample.width=Math.max(1,Math.round(bitmap.width*scale));sample.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=sample.getContext("2d",{willReadFrequently:true});ctx.drawImage(bitmap,0,0,sample.width,sample.height);const data=ctx.getImageData(0,0,sample.width,sample.height).data,values=[];
    let sum=0,sumSq=0;for(let i=0;i<data.length;i+=16){const y=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];values.push(y);sum+=y;sumSq+=y*y;}
    values.sort((a,b)=>a-b);const n=Math.max(1,values.length),mean=sum/n,std=Math.sqrt(Math.max(0,sumSq/n-mean*mean)),low=values[Math.floor(n*.04)]||0,high=values[Math.floor(n*.96)]||255,range=Math.max(25,high-low);
    const brightness=clamp(1+(178-mean)/420,.9,1.22),contrast=clamp(175/range,.98,1.38),saturation=clamp(1.04+(55-std)/450,1,1.12);
    return {brightness:brightness.toFixed(3),contrast:contrast.toFixed(3),saturation:saturation.toFixed(3)};
  }
  function toggleEnhancement(){editor.enhance=!editor.enhance;updateEnhancementButton();drawEditor();}
  function stageMetrics(){
    const stage=editor.dialog.querySelector("[data-editor-stage]"),rect=stage.getBoundingClientRect();
    const width=Math.max(1,rect.width),height=Math.max(1,rect.height),pad=Math.max(12,Math.min(width,height)*.035),a4=210/297;
    const availableWidth=Math.max(1,width-pad*2),availableHeight=Math.max(1,height-pad*2);
    let cropWidth=availableWidth,cropHeight=cropWidth/a4;
    if(cropHeight>availableHeight){cropHeight=availableHeight;cropWidth=cropHeight*a4;}
    const crop={x:(width-cropWidth)/2,y:(height-cropHeight)/2,width:cropWidth,height:cropHeight};
    const frame=editor.dialog.querySelector(".ipad-editor-crop-frame");
    Object.assign(frame.style,{left:`${crop.x}px`,top:`${crop.y}px`,width:`${crop.width}px`,height:`${crop.height}px`,inset:"auto"});
    const label=editor.dialog.querySelector("[data-editor-crop-label]");
    if(label){label.style.left=`${crop.x}px`;label.style.top=`${Math.max(6,crop.y-label.offsetHeight-8)}px`;label.style.width=`${crop.width}px`;}
    return {stage,rect,width,height,crop};
  }
  function rotatedSize(){const rad=editor.rotation*Math.PI/180,c=Math.abs(Math.cos(rad)),s=Math.abs(Math.sin(rad));return {width:editor.bitmap.width*c+editor.bitmap.height*s,height:editor.bitmap.width*s+editor.bitmap.height*c};}
  function drawEditor(){
    if(!editor)return;const {width,height}=stageMetrics(),canvas=editor.canvas,dpr=Math.min(2,devicePixelRatio||1);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;
    const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle="#d9dfe2";ctx.fillRect(0,0,width,height);
    ctx.save();ctx.filter=enhancementFilter();ctx.translate(width/2+editor.x,height/2+editor.y);ctx.rotate(editor.rotation*Math.PI/180);ctx.scale(editor.scale,editor.scale);ctx.drawImage(editor.bitmap,-editor.bitmap.width/2,-editor.bitmap.height/2);ctx.restore();ctx.filter="none";
    // Der Ausschnitt wird vollständig im Canvas markiert. Das ist auf iPad/Safari
    // zuverlässiger als eine separate HTML-Ebene über einem GPU-Canvas.
    const {crop}=stageMetrics();ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle="rgba(0,0,0,.48)";
    ctx.fillRect(0,0,width,crop.y);ctx.fillRect(0,crop.y+crop.height,width,height-crop.y-crop.height);
    ctx.fillRect(0,crop.y,crop.x,crop.height);ctx.fillRect(crop.x+crop.width,crop.y,width-crop.x-crop.width,crop.height);
    const inset=5,x=crop.x+inset,y=crop.y+inset,w=Math.max(1,crop.width-inset*2),h=Math.max(1,crop.height-inset*2);
    ctx.shadowColor="rgba(0,0,0,.95)";ctx.shadowBlur=8;ctx.strokeStyle="#ffffff";ctx.lineWidth=12;ctx.strokeRect(x,y,w,h);
    ctx.shadowBlur=0;ctx.strokeStyle="#00ff66";ctx.lineWidth=7;ctx.strokeRect(x,y,w,h);
    const corner=Math.min(46,w*.13,h*.13);ctx.strokeStyle="#efff00";ctx.lineWidth=9;ctx.beginPath();
    [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]].forEach(([cx,cy,dx,dy])=>{ctx.moveTo(cx,cy+dy*corner);ctx.lineTo(cx,cy);ctx.lineTo(cx+dx*corner,cy);});ctx.stroke();
    ctx.restore();
    editor.dialog.querySelector("[data-editor-scale]").textContent=`${Math.round(editor.scale*100)} %`;editor.dialog.querySelector("[data-editor-rotation]").textContent=`${Math.round(normalizeAngle(editor.rotation))}°`;
  }
  function fitEditor(){const {crop}=stageMetrics(),r=rotatedSize();editor.scale=Math.min(crop.width/r.width,crop.height/r.height);editor.x=0;editor.y=0;editor.mode="contain";drawEditor();}
  function coverEditor(){const {crop}=stageMetrics(),r=rotatedSize();editor.scale=Math.max(crop.width/r.width,crop.height/r.height);editor.x=0;editor.y=0;editor.mode="cover";drawEditor();}
  function rotateBy(degrees){editor.rotation=normalizeAngle(editor.rotation+degrees);editor.mode==="contain"?fitEditor():coverEditor();}
  function snapshot(){return {x:editor.x,y:editor.y,scale:editor.scale,rotation:editor.rotation,source:editor.source,mode:editor.mode,enhance:editor.enhance};}
  async function replaceBitmap(source){editor.bitmap.close?.();editor.source=source;editor.bitmap=await createImageBitmap(source);editor.enhancement=analyzeBitmap(editor.bitmap);}
  async function restoreSnapshot(data){if(!data)return;if(data.source&&data.source!==editor.source)await replaceBitmap(data.source);editor.x=data.x;editor.y=data.y;editor.scale=data.scale;editor.rotation=data.rotation;editor.mode=data.mode||"cover";editor.enhance=data.enhance!==false;updateEnhancementButton();drawEditor();}
  async function restoreOriginal(){await replaceBitmap(originalSource(editor.page));editor.rotation=0;editor.mode="cover";coverEditor();}
  function pointerPoint(event){const rect=editor.stage.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};}
  function beginGesture(){const pts=[...editor.pointers.values()];if(pts.length===1)editor.gesture={mode:"pan",start:pts[0],x:editor.x,y:editor.y};else if(pts.length>=2){const a=pts[0],b=pts[1];editor.gesture={mode:"pinch",distance:Math.max(1,distance(a,b)),angle:angle(a,b),scale:editor.scale,rotation:editor.rotation,center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},x:editor.x,y:editor.y};}}
  function handlePointer(event){
    if(!editor)return;event.preventDefault();const points=editor.pointers;
    if(event.type==="pointerdown"){editor.stage.setPointerCapture?.(event.pointerId);points.set(event.pointerId,pointerPoint(event));beginGesture();return;}
    if(event.type==="pointermove"&&points.has(event.pointerId)){
      points.set(event.pointerId,pointerPoint(event));const pts=[...points.values()],g=editor.gesture;
      if(pts.length===1&&g?.mode==="pan"){editor.x=g.x+pts[0].x-g.start.x;editor.y=g.y+pts[0].y-g.start.y;}
      else if(pts.length>=2&&g?.mode==="pinch"){
        const a=pts[0],b=pts[1],center={x:(a.x+b.x)/2,y:(a.y+b.y)/2},newScale=clamp(g.scale*distance(a,b)/g.distance,.02,12),scaleRatio=newScale/g.scale;
        editor.scale=newScale;editor.rotation=g.rotation+normalizeAngle(angle(a,b)-g.angle);
        editor.x=center.x+(g.x-g.center.x)*scaleRatio;editor.y=center.y+(g.y-g.center.y)*scaleRatio;editor.mode="free";
      }
      drawEditor();return;
    }
    if(event.type==="pointerup"||event.type==="pointercancel"){points.delete(event.pointerId);beginGesture();}
  }
  async function makeOutputBlob(){
    const {crop,width,height}=stageMetrics(),out=document.createElement("canvas");out.width=1800;out.height=Math.round(1800*297/210);
    const rx=out.width/crop.width,ry=out.height/crop.height,ctx=out.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,out.width,out.height);ctx.save();ctx.filter=enhancementFilter();ctx.scale(rx,ry);ctx.translate(width/2+editor.x-crop.x,height/2+editor.y-crop.y);ctx.rotate(editor.rotation*Math.PI/180);ctx.scale(editor.scale,editor.scale);ctx.drawImage(editor.bitmap,-editor.bitmap.width/2,-editor.bitmap.height/2);ctx.restore();ctx.filter="none";
    return new Promise((resolve,reject)=>out.toBlob(blob=>blob?resolve(blob):reject(new Error("Bild konnte nicht erzeugt werden")),"image/jpeg",.94));
  }
  async function applyEditor(){
    const button=editor.dialog.querySelector("[data-editor-apply]");button.disabled=true;button.textContent="Wird übernommen …";
    try{const blob=await makeOutputBlob(),page=editor.page,bitmap=await createImageBitmap(blob);URL.revokeObjectURL(page.url);page.editedBlob=blob;page.blob=blob;page.url=URL.createObjectURL(blob);page.width=bitmap.width;page.height=bitmap.height;bitmap.close?.();page.manual=true;page.crop={x:0,y:0,width:page.width,height:page.height};page.rotation=normalizeAngle(editor.rotation);page.editTransform={x:editor.x,y:editor.y,scale:editor.scale,rotation:editor.rotation,mode:editor.mode,enhance:editor.enhance};closeEditor();renderDocumentReportPages();documentReportReady=false;showToast("Bildbearbeitung wurde übernommen.");}
    catch(error){console.error(error);showToast("Bildbearbeitung konnte nicht übernommen werden.","error");}
    finally{button.disabled=false;button.textContent="Änderung übernehmen";}
  }
  function closeEditor(){if(!editor)return;editor.bitmap.close?.();const dialog=editor.dialog;editor=null;document.documentElement.classList.remove("document-editor-open");try{dialog.close();}catch{dialog.removeAttribute("open");}}
  window.closeIpadDocumentEditor=closeEditor;
  window.openIpadDocumentCrop=window.openManualDocumentCrop=async function(index){
    const page=documentReportPages[index];if(!page)return;ensureOriginal(page);const dialog=editorDialog(),source=currentSource(page),bitmap=await createImageBitmap(source);
    editor={index,page,dialog,stage:dialog.querySelector("[data-editor-stage]"),canvas:dialog.querySelector("[data-editor-canvas]"),source,bitmap,x:0,y:0,scale:1,rotation:0,mode:"cover",enhance:true,enhancement:analyzeBitmap(bitmap),pointers:new Map(),gesture:null};
    dialog.showModal();document.documentElement.classList.add("document-editor-open");await new Promise(resolve=>requestAnimationFrame(resolve));updateEnhancementButton();coverEditor();editor.openSnapshot=snapshot();
  };
  const style=document.createElement("style");style.textContent=`.document-editor-open{overflow:hidden}.ipad-document-editor{width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:#111;color:#fff}.ipad-editor-shell{height:100%;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto auto auto}.ipad-editor-shell header,.ipad-editor-shell footer{display:flex;gap:12px;justify-content:space-between;align-items:center;padding:12px 16px;background:#191919}.ipad-editor-shell h2{margin:2px 0 0}.ipad-editor-shell small{color:#ccc}.ipad-editor-help{margin:0;padding:9px 16px;background:#272727;text-align:center}.ipad-editor-stage{position:relative;min-height:0;overflow:hidden;touch-action:none;user-select:none;background:#d9dfe2}.ipad-editor-stage canvas{position:relative;z-index:1;display:block;width:100%;height:100%;opacity:1}.ipad-editor-crop-frame{position:absolute!important;z-index:999!important;display:none!important;visibility:hidden!important;opacity:0!important;border:7px solid #00e676!important;outline:3px solid #fff!important;box-shadow:0 0 0 100vmax rgba(25,35,40,.18),0 0 18px rgba(0,200,83,.75);pointer-events:none}.ipad-editor-crop-frame span{position:absolute;top:8px;left:8px;padding:5px 8px;border-radius:6px;background:#00a844;color:#fff;font-weight:900;font-size:.78rem}.ipad-editor-status{display:flex;justify-content:center;gap:24px;padding:7px;background:#222;font-weight:800}.ipad-editor-tools{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:10px 16px;background:#191919}.ipad-editor-tools .editor-enhance-active{border-color:#4fdb7d!important;background:#164d2b!important;color:#fff!important;box-shadow:inset 0 0 0 2px #4fdb7d}.ipad-editor-tools button,.ipad-editor-shell footer button,.ipad-editor-shell header button{min-height:48px}.ipad-editor-shell footer{justify-content:flex-end}.ipad-editor-crop-label{position:absolute;z-index:30;box-sizing:border-box;padding:6px 10px;text-align:center;border-radius:7px;background:#00a844;color:#fff;font-size:.8rem;font-weight:950;letter-spacing:.04em;pointer-events:none}.ipad-editor-shell header{grid-area:header}.ipad-editor-help{grid-area:help}.ipad-editor-stage{grid-area:stage}.ipad-editor-status{grid-area:status}.ipad-editor-tools{grid-area:tools}.ipad-editor-shell footer{grid-area:footer}@media(orientation:landscape) and (min-width:700px){.ipad-editor-shell{grid-template-columns:minmax(0,1fr) 310px;grid-template-rows:auto auto auto minmax(0,1fr) auto;grid-template-areas:"header header" "stage help" "stage status" "stage tools" "stage footer"}.ipad-editor-stage{min-height:calc(100vh - 66px)}.ipad-editor-help{text-align:left;padding:14px}.ipad-editor-tools{grid-template-columns:1fr;padding:10px 14px;align-content:start;overflow-y:auto}.ipad-editor-shell footer{display:grid;grid-template-columns:1fr;padding:12px 14px;align-content:end}.ipad-editor-shell footer button{width:100%}}@media(max-width:850px) and (orientation:portrait){.ipad-editor-tools{grid-template-columns:repeat(2,minmax(0,1fr))}.ipad-editor-shell footer{display:grid;grid-template-columns:1fr 1fr}.ipad-editor-help{font-size:.88rem}}`;
  document.head.appendChild(style);
})();
