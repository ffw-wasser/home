/* Shared wording for connection failures; never marks an unconfirmed write as saved. */
(function(g){
 'use strict';
 function message(error){
  if(g.navigator?.onLine===false)return 'Offline. Bitte die Internetverbindung prüfen und erneut versuchen.';
  if(['TimeoutError','AbortError'].includes(error?.name))return 'Die Verbindung hat zu lange gedauert. Bitte erneut versuchen.';
  if(error instanceof TypeError||/load failed|failed to fetch|networkerror|network request failed/i.test(error?.message||''))return 'Die Verbindung wurde unterbrochen. Bitte erneut versuchen.';
  if(error?.name==='SyntaxError')return 'Der Dienst hat keine gültige Antwort geliefert. Bitte erneut versuchen.';
  return error?.message||'Der Dienst ist derzeit nicht erreichbar. Bitte erneut versuchen.';
 }
 g.ConnectionStatus={message};if(typeof module!=='undefined'&&module.exports)module.exports=g.ConnectionStatus;
})(globalThis);
