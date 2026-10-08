const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../service-worker.js'), 'utf8');
const root = 'https://ffw-wasser.github.io/home/';

function worker({offline = false, responseOk = true, cached = undefined} = {}) {
  const events = {}, writes = [], reads = [], deleted = [];
  const context = vm.createContext({URL, Promise,
    self: {registration: {scope: root}, clients: {claim: async () => {}}, skipWaiting: async () => {}, addEventListener: (name, fn) => events[name] = fn},
    caches: {keys: async () => ['ffw-wasser-final-v8-1-pending-lock-20261006', 'other-app-cache', 'ffw-wasser-topics-private-cache-20261008'], delete: async key => deleted.push(key), open: async () => ({addAll: async () => {}, put: async (key, response) => writes.push(key), match: async key => {reads.push(key); return cached;}})},
    fetch: async request => {if (offline) throw new Error('offline'); return {ok: responseOk, type: 'basic', url: request.url, clone(){return this;}};}
  });
  vm.runInContext(source, context);
  const request = (url, options = {}) => {
    let result;
    events.fetch({request: {url, method: options.method || 'GET', mode: options.mode || 'cors', headers: {has: name => options.auth && name === 'Authorization'}}, respondWith: p => result = p});
    return result;
  };
  return {events, request, writes, reads, deleted};
}

test('OneDrive, OAuth und persönliche Dateien gelangen nicht in den Cache', () => {
  const w = worker();
  for (const url of ['https://graph.microsoft.com/v1.0/me/drive/items/x/content', 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize', root + 'feuerwehr-wasser-daten.json', root + 'Berichte/sonderprobe.zip', root + 'Berichte/bericht.pdf']) {
    assert.equal(w.request(url), undefined);
  }
  assert.equal(w.request(root + 'js/core/config.js', {auth: true}), undefined);
  assert.equal(w.request(root + 'js/core/config.js', {method: 'PUT'}), undefined);
  assert.deepEqual(w.writes, []);
});

test('Öffentliche App-Dateien und bereinigte Navigation sind offline verfügbar', async () => {
  const w = worker();
  await w.request(root + 'js/core/config.js?v=test');
  await w.request(root + '?code=private-code&state=private-state', {mode: 'navigate'});
  assert.equal(w.writes.length, 2);
  assert.equal(w.writes[1], root + 'index.html');
  const cached = {ok: true};
  const offline = worker({offline: true, cached});
  assert.equal(await offline.request(root, {mode: 'navigate'}), cached);
});

test('Fehlende Skripte bekommen kein HTML als Ersatz; HTTP-Fehler werden nicht gespeichert', async () => {
  const offline = worker({offline: true});
  await assert.rejects(offline.request(root + 'js/missing.js'), /offline/);
  assert.deepEqual(offline.reads.map(key => typeof key === 'string' ? key : key.url), [root + 'js/missing.js']);
  const failed = worker({responseOk: false});
  await failed.request(root + 'js/missing.js');
  assert.deepEqual(failed.writes, []);
});

test('Update entfernt alte OneDrive-haltige App-Caches', async () => {
  const w = worker();
  let activation;
  w.events.activate({waitUntil: p => activation = p});
  await activation;
  assert.deepEqual(w.deleted, ['ffw-wasser-final-v8-1-pending-lock-20261006']);
});

test('Startseite öffnet ohne Passwort und verändert keine Nutzdaten', () => {
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  const app = fs.readFileSync(require.resolve('../js/app/app.js'), 'utf8');
  assert.match(html, /<div id="protectedAppContent">/);
  assert.doesNotMatch(html, /pageAccessGate|pageAccessForm|page-access-pending/);
  assert.doesNotMatch(app, /setupInitialPageAccess|fw_page_unlocked/);
  assert.match(app, /members = loadArray\(KEYS.members, DEFAULT_MEMBERS\)/);
});
