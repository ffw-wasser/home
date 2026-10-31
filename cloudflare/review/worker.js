/* Dedicated, synthetic H2O Apple Review Worker. Never bind production D1 or secrets.
   Install only on the separately created h2o-apple-review Worker.
   Configure encrypted secrets H2O_REVIEW_INVITE_CODE and H2O_REVIEW_SESSION_KEY.
*/
const HTML = "<!doctype html>\n<html lang=\"de\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<meta name=\"robots\" content=\"noindex,nofollow\"><meta name=\"referrer\" content=\"no-referrer\"><title>H₂O Portal · Apple-Demo</title>\n<style nonce=\"__NONCE__\">\n:root{color-scheme:dark;font:16px system-ui,-apple-system,sans-serif;background:#101c2c;color:#f5f7fa}\n*{box-sizing:border-box}body{margin:0;min-height:100vh}header{background:#651b32;padding:20px 18px;text-align:center;font-weight:750;font-size:1.35rem}\nmain{max-width:570px;margin:auto;padding:18px 16px 50px}.note{font-size:.88rem;color:#cfdfec}.card{background:#f1f7f2;color:#15263a;border-radius:18px;margin:16px 0;padding:20px;box-shadow:0 6px 22px #0004}\n.card h2{font-size:1.14rem;margin:0 0 13px}.item{margin:9px 0}.date{font-size:.92rem;color:#5d3449}.status{font-weight:700}\nbutton{cursor:pointer;border:0;border-radius:12px;padding:12px 14px;background:#6a2541;color:white;font-size:1rem;font-weight:650}\nbutton:focus-visible,input:focus-visible{outline:3px solid #e6a532;outline-offset:2px}\ninput{font-size:1rem;padding:12px;width:100%;margin:8px 0 13px;border:1px solid #8598aa;border-radius:10px}\n.actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}.actions button{flex:1;min-width:120px;background:#e2e6ee;color:#243448}\n.actions button[aria-pressed=true]{background:#387a51;color:white}.muted{color:#526476;font-size:.9rem}\n.error{color:#a6001b;font-weight:650}.ok{color:#2e6b43;font-weight:700}\nfooter{text-align:center;color:#b8c9d9;font-size:.82rem;padding:20px}\n[hidden]{display:none!important}\n</style></head>\n<body><header>Feuerwehr Wasser · H₂O</header><main>\n<p class=\"note\">Apple-Prüfversion · ausschließlich erfundene Daten · keine Verbindung zum Mitgliederportal</p>\n<section id=\"identity-setup\" class=\"card\"><h2>Demo-Anmeldung</h2>\n<p>Den bereitgestellten Apple-Demo-Code eingeben.</p>\n<form id=\"login\"><label for=\"code\">Demo-Code</label><input id=\"code\" name=\"code\" type=\"password\" autocomplete=\"off\" required minlength=\"16\" maxlength=\"128\">\n<button type=\"submit\">Demo öffnen</button></form><p id=\"login-error\" role=\"alert\" class=\"error\" hidden></p>\n</section>\n<section id=\"terms\" hidden><div class=\"card\"><h2>Nächste Termine</h2><p class=\"muted\">Nur Beispieldaten für Apple. Rückmeldungen werden ausschließlich in der Demo-Datenbank gespeichert.</p><div id=\"events\"></div></div>\n<div class=\"card\"><button id=\"refresh\" type=\"button\">Aktualisieren</button> <button id=\"logout\" type=\"button\">Abmelden</button><p id=\"status\" role=\"status\" class=\"muted\"></p></div></section>\n</main><footer>H₂O Portal · Apple Review · Demo</footer>\n<script nonce=\"__NONCE__\">\n(function(){\n'use strict';\nvar sessionKey='h2o-review-session-v1';\nvar setup=document.getElementById('identity-setup'),terms=document.getElementById('terms'),loginError=document.getElementById('login-error'),status=document.getElementById('status');\nvar token=sessionStorage.getItem(sessionKey)||'';\nvar events=[];\nfunction widget(message){try{window.webkit?.messageHandlers?.h2oWidget?.postMessage(message)}catch(_){}}\nfunction clear(){widget({action:'clear'})}\nfunction eventWidget(){var now=Date.now(),e=events.filter(function(x){return x.end>now}).sort(function(a,b){return a.start-b.start})[0];if(!e){widget({action:'empty'});return}\nwidget({action:'update',event:{title:e.title,start:e.start,end:e.end,location:e.location,clothing:e.clothing,status:e.status||'open',allDay:false}})}\nfunction showLogin(message){token='';sessionStorage.removeItem(sessionKey);setup.hidden=false;terms.hidden=true;clear();if(message){loginError.textContent=message;loginError.hidden=false}}\nasync function request(path,body){var headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;\nvar response=await fetch('/api/'+path,{method:'POST',headers:headers,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',body:JSON.stringify(body||{})});\nvar result=await response.json();if(!response.ok)throw Error(result.error||'Demo nicht erreichbar');return result}\nfunction germanTime(ms){return new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ms))+' Uhr'}\nfunction render(){var root=document.getElementById('events');root.replaceChildren();\nevents.forEach(function(e){var box=document.createElement('article');box.className='card';var heading=document.createElement('h2');heading.textContent=e.title;var when=document.createElement('p');when.className='date';when.textContent=germanTime(e.start);var where=document.createElement('p');where.className='item';where.textContent='Ort: '+e.location;var clothing=document.createElement('p');clothing.className='item';clothing.textContent='Kleidung: '+e.clothing;var reply=document.createElement('p');reply.className='status';reply.textContent='Rückmeldung: '+({yes:'Dabei',excused:'Entschuldigt',maybe:'Unsicher',open:'Offen'}[e.status]||'Offen');var actions=document.createElement('div');actions.className='actions';\n[['yes','Dabei'],['excused','Entschuldigt'],['maybe','Unsicher']].forEach(function(pair){var b=document.createElement('button');b.type='button';b.textContent=pair[1];b.setAttribute('aria-pressed',String(e.status===pair[0]));b.addEventListener('click',async function(){b.disabled=true;try{var result=await request('reply',{id:e.id,status:pair[0]});events=result.events;render();eventWidget();status.textContent='Rückmeldung gespeichert'}catch(err){status.textContent=err.message}finally{b.disabled=false}});actions.append(b)});\nbox.append(heading,when,where,clothing,reply,actions);root.append(box)});}\nasync function load(){try{var result=await request('events');events=result.events;setup.hidden=true;terms.hidden=false;render();eventWidget();status.textContent='Demo-Daten aktualisiert'}catch(e){showLogin(e.message)}}\ndocument.getElementById('login').addEventListener('submit',async function(e){e.preventDefault();loginError.hidden=true;try{var code=document.getElementById('code').value;var result=await request('login',{code:code});token=result.token;sessionStorage.setItem(sessionKey,token);document.getElementById('code').value='';await load()}catch(err){loginError.textContent=err.message;loginError.hidden=false}});\ndocument.getElementById('refresh').addEventListener('click',load);document.getElementById('logout').addEventListener('click',function(){showLogin()});\nvar match=/^#setup=([A-Za-z0-9_-]{16,128})$/.exec(location.hash);\nif(match){history.replaceState(null,'',location.pathname);document.getElementById('code').value=match[1];document.getElementById('login').requestSubmit()}\nelse if(token){load()}else{clear()}\n})();\n</script></body></html>";

const encoder = new TextEncoder();
const replyValues = new Set(["yes", "excused", "maybe"]);
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store, max-age=0",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()"
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...securityHeaders, "Content-Type": "application/json; charset=utf-8" }
});
const toB64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const fromB64 = value => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
const secureEqual = async (a, b) => {
  const [aa, bb] = await Promise.all([crypto.subtle.digest("SHA-256", encoder.encode(a)), crypto.subtle.digest("SHA-256", encoder.encode(b))]);
  const left = new Uint8Array(aa), right = new Uint8Array(bb);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
};
async function signingKey(env) {
  return crypto.subtle.importKey("raw", encoder.encode(env.H2O_REVIEW_SESSION_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function issueSession(env) {
  const expiry = Math.floor(Date.now() / 1000) + 7 * 86400;
  const random = crypto.randomUUID();
  const payload = expiry + "." + random;
  const signature = await crypto.subtle.sign("HMAC", await signingKey(env), encoder.encode("review|" + payload));
  return payload + "." + toB64(signature);
}
async function validSession(env, header) {
  if (!header || !header.startsWith("Bearer ")) return false;
  const token = header.slice(7), parts = token.split(".");
  if (parts.length !== 3 || !/^\d{10}$/.test(parts[0]) || !/^[0-9a-f-]{36}$/.test(parts[1]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[2])) return false;
  const now = Math.floor(Date.now() / 1000), expiry = Number(parts[0]);
  if (expiry <= now || expiry > now + 7 * 86400 + 60) return false;
  try {
    return await crypto.subtle.verify("HMAC", await signingKey(env), fromB64(parts[2]), encoder.encode("review|" + parts[0] + "." + parts[1]));
  } catch { return false; }
}
async function readBody(request) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json") || Number(request.headers.get("Content-Length") || 0) > 1024) throw Error("invalid body");
  const text = await request.text();
  if (text.length > 1024) throw Error("invalid body");
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw Error("invalid body");
  return obj;
}
function berlinEventStart(daysFromToday, hour) {
  const timeZone = "Europe/Berlin";
  const day = new Intl.DateTimeFormat("sv-SE", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
  const [year, month, date] = day.split("-").map(Number);
  // Interpret 18:00 as 18:00 Germany local time, not 18:00 UTC.
  const naive = Date.UTC(year, month - 1, date + daysFromToday, hour);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(naive)).map(p => [p.type, p.value]));
  const offset = Date.UTC(Number(parts.year), Number(parts.month) - 1,
    Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) - naive;
  return naive - offset;
}
function syntheticEvents(rows) {
  const data = [
    { id: "demo-probe", title: "Probe · Fahrzeugkunde", days: 2, hour: 18, clothing: "Einsatzkleidung" },
    { id: "demo-unterricht", title: "Unterricht · Digitalfunk", days: 6, hour: 18, clothing: "Tagesdienst" },
    { id: "demo-sonderprobe", title: "Sonderprobe · Wasserentnahme", days: 13, hour: 17, clothing: "Einsatzkleidung" }
  ];
  return data.map(e => ({
    id: e.id, title: e.title, start: berlinEventStart(e.days, e.hour),
    end: berlinEventStart(e.days, e.hour) + 2 * 3600000,
    location: "Gerätehaus Wasser (Demo)", clothing: e.clothing,
    status: rows.get(e.id) || "open"
  }));
}
async function getEvents(env) {
  const query = await env.DB.prepare("SELECT event_id, status FROM review_replies").all();
  const map = new Map((query.results || []).map(r => [r.event_id, r.status]));
  return syntheticEvents(map);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.hostname.endsWith(".workers.dev") || url.hostname !== "h2o-apple-review.522dn4fc5f.workers.dev") return json({ error: "Unbekannte Demo-Adresse" }, 403);
    if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, environment: "synthetic-review", configured: Boolean(env.DB && env.H2O_REVIEW_INVITE_CODE && env.H2O_REVIEW_SESSION_KEY) });
    if (request.method === "GET" && url.pathname === "/home/deckel.html") {
      const nonce = crypto.randomUUID().replaceAll("-", "");
      const policy = "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'; script-src 'nonce-" + nonce + "'; style-src 'nonce-" + nonce + "'";
      return new Response(HTML.replaceAll("__NONCE__", nonce), { headers: { ...securityHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": policy } });
    }
    if (request.method !== "POST" || !["/api/login", "/api/events", "/api/reply"].includes(url.pathname)) return json({ error: "Nicht gefunden" }, 404);
    if (!env.DB || typeof env.H2O_REVIEW_INVITE_CODE !== "string" || env.H2O_REVIEW_INVITE_CODE.length < 24 ||
        typeof env.H2O_REVIEW_SESSION_KEY !== "string" || env.H2O_REVIEW_SESSION_KEY.length < 32) return json({ error: "Demo noch nicht eingerichtet" }, 503);
    if (request.headers.get("Origin") !== url.origin) return json({ error: "Ungueltiger Ursprung" }, 403);
    let body;
    try { body = await readBody(request); } catch { return json({ error: "Ungueltige Eingabe" }, 400); }
    if (url.pathname === "/api/login") {
      if (typeof body.code !== "string" || body.code.length > 128 || !await secureEqual(body.code, env.H2O_REVIEW_INVITE_CODE)) return json({ error: "Demo-Code nicht gueltig" }, 401);
      return json({ token: await issueSession(env) });
    }
    if (!await validSession(env, request.headers.get("Authorization"))) return json({ error: "Demo-Sitzung abgelaufen. Bitte erneut anmelden." }, 401);
    try {
      if (url.pathname === "/api/events") return json({ events: await getEvents(env) });
      if (typeof body.id !== "string" || !["demo-probe", "demo-unterricht", "demo-sonderprobe"].includes(body.id) || !replyValues.has(body.status)) return json({ error: "Ungueltige Rueckmeldung" }, 400);
      await env.DB.prepare("INSERT INTO review_replies(event_id,status,updated_at) VALUES(?,?,?) ON CONFLICT(event_id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at")
        .bind(body.id, body.status, Date.now()).run();
      return json({ events: await getEvents(env) });
    } catch { return json({ error: "Demo-Datenbank nicht eingerichtet oder nicht erreichbar" }, 503); }
  }
};
