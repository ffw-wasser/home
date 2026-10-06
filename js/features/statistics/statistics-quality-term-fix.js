(function(){
  "use strict";
  function install(){
    const workflow=globalThis.SmartWorkflow;
    if(!workflow||typeof workflow.statistics!=="function"||workflow.statistics.__termQualityFixed)return;
    const original=workflow.statistics;
    const fixed=function(){
      const temporary=[];
      try{
        (Array.isArray(globalThis.csvArchive)?globalThis.csvArchive:[]).forEach(item=>{
          if(item?.sessionType==="Einsatz")return;
          if(!String(item?.csvContent||"").trim()&&String(item?.content||"").trim()){
            temporary.push(item);
            item.csvContent=item.content;
          }
        });
        return original.apply(this,arguments);
      }finally{
        temporary.forEach(item=>delete item.csvContent);
      }
    };
    fixed.__termQualityFixed=true;
    workflow.statistics=fixed;
  }
  document.addEventListener("DOMContentLoaded",()=>setTimeout(install,0));
  if(document.readyState!=="loading")setTimeout(install,0);
})();
