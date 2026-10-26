/* Official source catalogue shared by the portal and its administration. */
(function(g){
'use strict';
const source='https://www.lfs-bw.de/themen/gesetzevorschriften/fwdv/';
const base='https://www.lfs-bw.de/fileadmin/LFS-BW/themen/gesetze_vorschriften/fwdv/dokumente/';
const entries=[
 ['003','FwDV 3','Einheiten im Lösch- und Hilfeleistungseinsatz','2008-02-15'],
 ['001','FwDV 1','Grundtätigkeiten, Lösch- und Hilfeleistungseinsatz','2026-08-28'],
 ['007','FwDV 7','Atemschutz','2005-04-01'],
 ['010','FwDV 10','Die tragbaren Leitern','2019-11-01'],
 ['100','FwDV 100','Führung und Leitung im Einsatz','1999-03-01'],
 ['002','FwDV 2','Ausbildung der Freiwilligen Feuerwehren','2012-01-01']
];
function defaults(){return entries.map(([id,label,title,sourceUpdated])=>({id,label,title,sourceUpdated,url:base+'FwDV_'+id+'.pdf'}));}
function pdfUrl(value){try{const u=new URL(value);return u.origin==='https://www.lfs-bw.de'&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/fileadmin\/LFS-BW\/[A-Za-z0-9_./-]+\.pdf$/.test(u.pathname)&&!u.pathname.includes('/../')?u.href:null;}catch{return null;}}
function validate(items){
 if(!Array.isArray(items)||items.length>20)throw Error('Bitte höchstens 20 Vorschriften hinterlegen.');
 const seen=new Set(),text=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n&&!/[<>\x00-\x1f]/.test(v);
 return items.map(item=>{
  if(!item||!text(item.id,60)||seen.has(item.id)||!text(item.label,40)||!text(item.title,180)||!/^\d{4}-\d{2}-\d{2}$/.test(item.sourceUpdated)||(!Number.isFinite(Date.parse(item.sourceUpdated))||new Date(item.sourceUpdated).toISOString().slice(0,10)!==item.sourceUpdated)||!pdfUrl(item.url))throw Error('Titel, Quellenstand oder offizieller PDF-Link ist ungültig.');
  seen.add(item.id);return {id:item.id,label:item.label.trim(),title:item.title.trim(),sourceUpdated:item.sourceUpdated,url:pdfUrl(item.url)};
 });
}
function bundledPdf(value){const url=pdfUrl(value),entry=entries.find(([id])=>url===base+'FwDV_'+id+'.pdf');return entry?'assets/regulations/fwdv-'+entry[0]+'.pdf':null;}
function bundledParts(value){const file=bundledPdf(value);return file?file.endsWith('fwdv-001.pdf')?['assets/regulations/fwdv-001-1.bin','assets/regulations/fwdv-001-2.bin']:[file]:null;}
g.RegulationsModel={source,defaults,validate,pdfUrl,bundledPdf,bundledParts};
})(globalThis);
