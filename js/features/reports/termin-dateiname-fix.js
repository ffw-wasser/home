(function(){
  "use strict";
  let nextPackageFileName="";
  const cleanDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))?String(value):"";
  function currentTerminDate(operationData){
    if(operationData)return cleanDate(operationData.date)||systemToday();
    const entries=typeof todayEntries==="function"?todayEntries():[];
    return cleanDate(entries?.[0]?.date)||cleanDate(globalThis.currentProbeDate)||systemToday();
  }
  function normalizedBase(packageType,operationData,oldBase){
    const date=currentTerminDate(operationData);
    if(packageType==="Einsatz")return `FFW-Wasser_${date}_Einsatz`;
    const match=String(oldBase||"").match(/^FFW-Wasser_\d{4}-\d{2}-\d{2}_(.+)$/);
    const type=(match?.[1]||"Termin").replace(/^\d{2}-\d{2}_/,"");
    return `FFW-Wasser_${date}_${type}`;
  }
  const originalBuild=globalThis.buildTerminPackage;
  if(typeof originalBuild==="function"){
    globalThis.buildTerminPackage=async function(options){
      const base=normalizedBase(options?.packageType,options?.operationData,options?.baseName);
      nextPackageFileName=`${base}.zip`;
      return originalBuild.call(this,{...options,baseName:base,csvName:`${base}.csv`,pdfName:`${base}.pdf`});
    };
  }
  const originalSave=globalThis.saveTerminPackage;
  if(typeof originalSave==="function"){
    globalThis.saveTerminPackage=async function(fileName,blob,overwriteRequired=false){
      const corrected=nextPackageFileName||fileName;
      nextPackageFileName="";
      return originalSave.call(this,corrected,blob,overwriteRequired);
    };
  }
})();
