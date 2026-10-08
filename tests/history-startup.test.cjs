const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const JSZip = require('../js/vendor/jszip.min.js');
const CsvEngine = require('../js/features/reports/csv-engine.js');
const syncSource = fs.readFileSync(require.resolve('../js/core/onedrive-sync.js'), 'utf8');
const historySource = fs.readFileSync(require.resolve('../js/features/history/onedrive-history-live.js'), 'utf8');

async function app({signedIn = true, remoteNewer = true, online = true} = {}) {
  const zip = new JSZip();
  zip.file('probe.csv', 'Datum;Uhrzeit;Name;Terminart;Status;Thema\n2026-10-08;18:00;Testperson;Sonderprobe;Anwesend;Funkübung');
  zip.file('probe.pdf', 'test-pdf');
  const bytes = await zip.generateAsync({type: 'uint8array'});
  const store = new Map(), events = {}, status = {hidden: true, textContent: ''};
  const calls = {callback: 0, read: 0, write: 0, apply: 0, list: 0, download: 0, statistics: 0, toast: []};
  const state = {signedIn, fail: false, empty: false, stateError: false, waitForList: null, version: '2026-10-08T18:00:00Z', size: 100, corrupt: false, downloadError: null};
  const context = vm.createContext({
    window: {}, CsvEngine, JSZip, URL, URLSearchParams, Blob, setTimeout, clearTimeout,
    navigator: {onLine: online}, csvArchive: [],
    localStorage: {getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value)},
    console: {error() {}},
    document: {hidden: false, getElementById: id => id === 'statisticsHistoryStatus' ? status : null,
      documentElement: {classList: {add() {}, remove() {}}}, addEventListener: (name, fn) => events[name] = fn},
    addEventListener: (name, fn) => events[name] = fn,
    renderHistory() {}, showToast(message) {calls.toast.push(message);}, historyDateFromItem: item => item.originalReportDate,
    renderStatistics() {calls.statistics++;}
  });
  vm.runInContext(syncSource, context);
  Object.assign(context, {
    byId: () => null, ensureOneDriveUi() {}, renderOneDriveDialog() {}, oneDriveStatus() {},
    oneDriveSignedIn: () => state.signedIn,
    oneDriveHandleCallback: async () => {calls.callback++;},
    oneDriveReadState: async () => {calls.read++; if (state.stateError) throw new Error('State unavailable'); return {updatedAt: remoteNewer ? '2099-01-01' : ''};},
    oneDriveWriteState: async () => {calls.write++;},
    applyOneDrivePayload: () => {calls.apply++;},
    oneDriveResolveSharedRoot: async () => ({driveId: 'test-drive', id: 'test-root'}),
    odFetch: async url => {
      if (url.includes('/children')) {
        calls.list++;
        if (state.waitForList) await state.waitForList;
        if (state.fail) throw new Error('Network unavailable');
        return {json: async () => ({value: state.empty ? [] : [{id: 'zip-1', name: 'probe.zip', file: {}, lastModifiedDateTime: state.version, size: state.size}]})};
      }
      calls.download++;
      if (state.fail) throw new Error('Download unavailable');
      if (state.downloadError) throw state.downloadError;
      return {blob: async () => state.corrupt ? new Uint8Array([1,2,3]) : bytes};
    }
  });
  vm.runInContext(historySource, context);
  return {context, calls, state, events, status};
}

for (const remoteNewer of [true, false]) {
  test(`App-Start lädt ZIP-Themen für Statistik, remoteNewer=${remoteNewer}`, async () => {
    const {context, calls, status} = await app({remoteNewer});
    await context.initCloudSync();
    assert.equal(calls.callback, 1);
    assert.equal(calls.list, 1);
    assert.equal(calls.download, 1);
    assert.equal(calls.apply, remoteNewer ? 1 : 0);
    assert.equal(calls.write, remoteNewer ? 0 : 1);
    assert.equal(context.csvArchive[0].topic, 'Funkübung');
    assert.equal(calls.statistics, 1);
    assert.equal(status.hidden, true);
  });
}

test('Neue Microsoft-Anmeldung ist vor dem Historienabruf abgeschlossen', async () => {
  const {context, state, calls} = await app({signedIn: false});
  context.oneDriveHandleCallback = async () => {await Promise.resolve(); state.signedIn = true;};
  await context.initCloudSync();
  assert.equal(calls.list, 1);
  assert.equal(context.csvArchive.length, 1);
});

test('Online, Rückkehr zur App und manuelle Synchronisierung aktualisieren die Berichte', async () => {
  const {context, calls, events} = await app();
  await context.initCloudSync();
  await events.online();
  context.document.hidden = true;
  await events.visibilitychange();
  assert.equal(calls.list, 2);
  context.document.hidden = false;
  await events.visibilitychange();
  await context.syncOneDrive({manual: true});
  assert.equal(calls.list, 4);
  await context.syncOneDrive(); // Speichern von Tagesdaten lädt nicht sämtliche ZIPs neu.
  assert.equal(calls.list, 4);
});

test('Ohne Anmeldung oder offline startet kein OneDrive-Abruf', async () => {
  for (const options of [{signedIn: false}, {online: false}]) {
    const {context, calls} = await app(options);
    await context.initCloudSync();
    assert.equal(calls.read, 0);
    assert.equal(calls.list, 0);
  }
});

test('Fehlerhafte Datensynchronisierung verhindert die Statistik aus ZIPs nicht', async () => {
  const {context, state} = await app();
  state.stateError = true;
  await context.initCloudSync();
  assert.equal(context.csvArchive[0].topic, 'Funkübung');
});

test('Gleichzeitiger Aufruf aus Synchronisierung und Historie teilt den Abruf', async () => {
  const {context, calls, state, status} = await app();
  let release;
  state.waitForList = new Promise(resolve => release = resolve);
  const first = context.window.loadOneDriveHistory();
  const second = context.window.loadOneDriveHistory();
  assert.equal(first, second);
  assert.equal(status.hidden, false);
  release();
  assert.equal(await first, true);
  assert.equal(calls.list, 1);
  assert.equal(calls.statistics, 1);
});

test('Netzwerkfehler erhalten den letzten Bericht samt PDF; ein späterer Abruf funktioniert', async () => {
  const {context, state, status} = await app();
  await context.initCloudSync();
  const previous = context.csvArchive;
  const pdf = await context.window.loadOneDriveHistoryPdf(previous[0]);
  state.fail = true;
  assert.equal(await context.window.loadOneDriveHistory(), false);
  assert.equal(context.csvArchive, previous);
  assert.equal(await context.window.loadOneDriveHistoryPdf(previous[0]), pdf);
  assert.match(status.textContent, /zuletzt geladenen Stand/);
  state.fail = false;
  state.empty = true;
  assert.equal(await context.window.loadOneDriveHistory(), true);
  assert.equal(context.csvArchive.length, 0);
  assert.equal(await context.window.loadOneDriveHistoryPdf(previous[0]), null);
  assert.equal(status.hidden, true);
});


test('Unveränderte ZIPs werden nach erneutem Ordnerabruf ohne erneuten Download verwendet', async () => {
  const {context, calls, state} = await app();
  assert.equal(await context.window.loadOneDriveHistory(), true);
  const first = context.csvArchive[0];
  first.topic = 'lokal verändert';
  assert.equal(await context.window.loadOneDriveHistory(), true);
  assert.equal(calls.list, 2);assert.equal(calls.download, 1);
  assert.equal(context.csvArchive[0].topic, 'Funkübung');
  state.size++;
  assert.equal(await context.window.loadOneDriveHistory(), true);
  assert.equal(calls.download, 2);
  state.version = '2026-10-09T18:00:00Z';
  assert.equal(await context.window.loadOneDriveHistory(), true);
  assert.equal(calls.download, 3);
});

test('ZIPs ohne Versionsinformationen werden nicht als unverändert angenommen', async () => {
  const {context, calls, state} = await app();state.version='';
  await context.window.loadOneDriveHistory();await context.window.loadOneDriveHistory();
  assert.equal(calls.download, 2);
});

test('Geänderte defekte ZIP ersetzt weder bisherige Berichte noch PDFs', async () => {
  const {context, state, status, calls} = await app();
  await context.window.loadOneDriveHistory();const previous=context.csvArchive;
  const pdf=await context.window.loadOneDriveHistoryPdf(previous[0]);
  state.version='2026-10-09T18:00:00Z';state.corrupt=true;
  assert.equal(await context.window.loadOneDriveHistory(),false);
  assert.equal(context.csvArchive,previous);assert.equal(await context.window.loadOneDriveHistoryPdf(previous[0]),pdf);
  assert.match(status.textContent,/probe.zip/);assert.match(status.textContent,/ZIP-Paket ist nicht lesbar/);assert.equal(calls.toast.length,0);
  state.corrupt=false;assert.equal(await context.window.loadOneDriveHistory(),true);
});

test('Zugriffsfehler nennen Datei und Berechtigungen, manuell auch als Meldung', async () => {
  const {context, state, status, calls} = await app();
  state.downloadError=Object.assign(new Error('forbidden'),{status:403});
  assert.equal(await context.window.loadOneDriveHistory({manual:true}),false);
  assert.match(status.textContent,/probe.zip/);assert.match(status.textContent,/403/);
  assert.match(status.textContent,/Zugriffsrechte/);assert.equal(calls.toast.length,1);
  assert.equal(context.window.oneDriveHistoryLastError,status.textContent);
});

test('Offline-Historienaufruf erhält Daten und PDFs ohne Netzwerkabruf', async () => {
  const {context, calls, status} = await app();await context.window.loadOneDriveHistory();
  const previous=context.csvArchive;context.navigator.onLine=false;
  assert.equal(await context.window.loadOneDriveHistory(),false);
  assert.equal(context.csvArchive,previous);assert.equal(calls.list,1);assert.match(status.textContent,/Offline/);
});

test('Gelöschte ZIP entfernt den Sitzungszwischenspeicher; erneut angelegte ZIP wird geladen', async () => {
  const {context, calls, state} = await app();await context.window.loadOneDriveHistory();
  state.empty=true;await context.window.loadOneDriveHistory();assert.equal(context.csvArchive.length,0);
  state.empty=false;await context.window.loadOneDriveHistory();assert.equal(calls.download,2);
});
