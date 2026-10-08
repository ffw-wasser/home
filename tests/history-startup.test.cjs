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
  const calls = {callback: 0, read: 0, write: 0, apply: 0, list: 0, download: 0, statistics: 0};
  const state = {signedIn, fail: false, empty: false, stateError: false, waitForList: null};
  const context = vm.createContext({
    window: {}, CsvEngine, JSZip, URL, URLSearchParams, Blob, setTimeout, clearTimeout,
    navigator: {onLine: online}, csvArchive: [],
    localStorage: {getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value)},
    console: {error() {}},
    document: {hidden: false, getElementById: id => id === 'statisticsHistoryStatus' ? status : null,
      documentElement: {classList: {add() {}, remove() {}}}, addEventListener: (name, fn) => events[name] = fn},
    addEventListener: (name, fn) => events[name] = fn,
    renderHistory() {}, showToast() {}, historyDateFromItem: item => item.originalReportDate,
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
        return {json: async () => ({value: state.empty ? [] : [{id: 'zip-1', name: 'probe.zip', file: {}, lastModifiedDateTime: '2026-10-08T18:00:00Z'}]})};
      }
      calls.download++;
      if (state.fail) throw new Error('Download unavailable');
      return {blob: async () => bytes};
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
