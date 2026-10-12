/* Private question bank. Public code contains no questions or solution keys. */
(function(global){
  'use strict';
  const uuid=value=>typeof value==='string'&&/^[-a-zA-Z0-9]{8,150}$/.test(value);
  const text=(value,max,label,required=true)=>{if(typeof value!=='string'||value.length>max||required&&!value.trim())throw Error(label+' fehlt oder ist zu lang.');return value;};
  function question(q){
    if(!q||!uuid(q.id)||!Number.isSafeInteger(q.version)||q.version<1||typeof q.active!=='boolean'||!Number.isFinite(Date.parse(q.updatedAt)))throw Error('Eine Frage ist nicht lesbar.');
    text(q.category,80,'Kategorie');text(q.text,800,'Frage');text(q.explanation,2000,'Erklärung',false);text(q.source,500,'Quelle / Stand',false);
    if(!Array.isArray(q.answers)||q.answers.length!==4)throw Error('Bitte vier Antwortmöglichkeiten angeben.');
    q.answers.forEach(a=>text(a,300,'Antwort'));if(new Set(q.answers.map(a=>a.trim().normalize('NFC').toLocaleLowerCase('de-DE'))).size!==4)throw Error('Die vier Antworten müssen unterschiedlich sein.');
    if(!Number.isSafeInteger(q.correct)||q.correct<0||q.correct>3)throw Error('Bitte die richtige Antwort auswählen.');
    return {id:q.id,version:q.version,category:q.category,text:q.text,answers:q.answers.slice(),correct:q.correct,explanation:q.explanation,source:q.source,active:q.active,updatedAt:q.updatedAt};
  }
  function validate(bank){
    if(!bank||bank.schemaVersion!==1||!uuid(bank.revision)||!Number.isFinite(Date.parse(bank.updatedAt))||!Array.isArray(bank.questions)||bank.questions.length>1000)throw Error('Die Fragenbank ist nicht lesbar.');
    const questions=bank.questions.map(question);if(new Set(questions.map(q=>q.id)).size!==questions.length)throw Error('Eine Frage ist doppelt vorhanden.');
    return {schemaVersion:1,revision:bank.revision,updatedAt:bank.updatedAt,questions};
  }
  function empty(){return {schemaVersion:1,revision:null,updatedAt:null,questions:[]};}
  function prepare(bank,input,id=null){
    if(bank.revision!==null)validate(bank);
    const old=id?bank.questions.find(q=>q.id===id):null;if(id&&!old)throw Error('Die Frage wurde inzwischen entfernt. Bitte neu laden.');
    const now=new Date().toISOString(),q=question({id:old?.id||crypto.randomUUID(),version:(old?.version||0)+1,category:input.category.trim(),text:input.text.trim(),answers:input.answers.map(a=>a.trim()),correct:input.correct,explanation:input.explanation.trim(),source:input.source.trim(),active:input.active,updatedAt:now});
    return validate({schemaVersion:1,revision:crypto.randomUUID(),updatedAt:now,questions:old?bank.questions.map(x=>x.id===old.id?q:x):[...bank.questions,q]});
  }
  function remove(bank,id){validate(bank);if(!bank.questions.some(q=>q.id===id))throw Error('Die Frage wurde bereits entfernt. Bitte neu laden.');return validate({...bank,revision:crypto.randomUUID(),updatedAt:new Date().toISOString(),questions:bank.questions.filter(q=>q.id!==id)});}
  function importQuestions(bank,data){
    if(bank.revision!==null)validate(bank);
    if(!data||data.schemaVersion!==1||!Array.isArray(data.questions)||!data.questions.length||data.questions.length>1000)throw Error('Keine gültige Fragen-Importdatei.');
    const incoming=data.questions.map(question),key=q=>(q.category+'\n'+q.text).trim().normalize('NFC').toLocaleLowerCase('de-DE'),seen=new Set(bank.questions.map(key)),now=new Date().toISOString(),added=[];
    for(const q of incoming){if(seen.has(key(q)))continue;seen.add(key(q));added.push({...q,id:crypto.randomUUID(),version:1,active:false,updatedAt:now});}
    if(bank.questions.length+added.length>1000)throw Error('Die Fragenbank darf höchstens 1000 Fragen enthalten.');
    return {added:added.length,skipped:incoming.length-added.length,bank:added.length?validate({schemaVersion:1,revision:crypto.randomUUID(),updatedAt:now,questions:[...bank.questions,...added]}):bank};
  }
  global.DrinksQuizModel={question,validate,empty,prepare,remove,importQuestions};
})(typeof window==='undefined'?globalThis:window);
