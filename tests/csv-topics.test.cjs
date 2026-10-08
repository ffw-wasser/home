const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CsvEngine = require('../js/features/reports/csv-engine.js');
const JSZip = require('../js/vendor/jszip.min.js');

const shortHeader = 'Datum;Uhrzeit;Name;Terminart;Status;Thema';
function reportCsv(type, topic) {
  return '\ufeff' + shortHeader + '\r\n' + ['2026-10-08', '18:00', 'Test, Person', type, 'Anwesend', topic].map(CsvEngine.cell).join(';');
}

for (const type of ['Sonderprobe', 'Unterricht', 'Ausschuss Sitzung']) {
  test(`${type}: Thema ohne Funktionsspalte`, () => {
    const rows = CsvEngine.parse(reportCsv(type, 'Funk; Übung "Nord"\nTeil 2'));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].topic, 'Funk; Übung "Nord"\nTeil 2');
    assert.equal(rows[0].role, '');
    assert.equal(rows[0].sessionType, type);
  });
}

test('Bestehende sieben Spalten und Korrekturexporte bleiben lesbar', () => {
  const row = ['2026-10-08', '18:00', 'Test, Person', 'Allgemeine Probe', 'Anwesend', 'ATF', 'Löschangriff'];
  const parsed = CsvEngine.parse(CsvEngine.serialize([row]))[0];
  assert.equal(parsed.role, 'ATF');
  assert.equal(parsed.topic, 'Löschangriff');
});

test('Spaltenreihenfolge, Überschriften und leere Themen', () => {
  const row = CsvEngine.parse(' thema ; NAME; STATUS; TERMINART; DATUM; UHRZEIT\n;Test, Person;Entschuldigt;Sonderprobe;2026-10-08;18:00')[0];
  assert.equal(row.name, 'Test, Person');
  assert.equal(row.role, '');
  assert.equal(row.topic, '');
  assert.equal(row.status, 'Entschuldigt');
  assert.deepEqual(CsvEngine.parse(''), []);
  assert.deepEqual(CsvEngine.parse(shortHeader), []);
});

test('Vorhandenes OneDrive-ZIP erhält Thema in Archiv und Statistik', async () => {
  const zip = new JSZip();
  zip.file('sonderprobe.csv', reportCsv('Sonderprobe', 'Funkübung'));
  zip.file('paket-info.json', JSON.stringify({csvName: 'sonderprobe.csv', type: 'Probe'}));
  const bytes = await zip.generateAsync({type: 'uint8array'});
  const statsSource = fs.readFileSync(require.resolve('../js/features/statistics/statistics.js'), 'utf8');
  const historySource = fs.readFileSync(require.resolve('../js/features/history/onedrive-history-live.js'), 'utf8');
  const context = vm.createContext({
    CsvEngine, JSZip, Set, Map, console, csvArchive: [],
    window: {}, document: {getElementById: () => null, documentElement: {classList: {add(){}, remove(){}}}},
    oneDriveSignedIn: () => true,
    oneDriveResolveSharedRoot: async () => ({driveId: 'test-drive', id: 'test-root'}),
    odFetch: async url => url.includes('/children')
      ? {json: async () => ({value: [{id: 'test-zip', name: 'sonderprobe.zip', file: {}, lastModifiedDateTime: '2026-10-08T18:00:00Z'}]})}
      : {blob: async () => bytes},
    historyDateFromItem: item => item.originalReportDate,
    renderHistory(){}, renderStatistics(){}, showToast(){}
  });
  vm.runInContext(historySource, context);
  await context.window.loadOneDriveHistory();
  // Lesende Statistikfunktionen verwenden genau dieselben importierten Daten.
  vm.runInContext(statsSource.slice(0, statsSource.indexOf('function renderMetric')), context);
  assert.equal(context.csvArchive[0].topic, 'Funkübung');
  const data = vm.runInContext('statisticsArchiveData()', context);
  assert.equal(data[0].rows[0].topic, 'Funkübung');
  assert.equal(data[0].rows[0].role, '');
  assert.equal(data[0].rows[0].date, '2026-10-08');
  assert.equal(data[0].rows[0].status, 'Anwesend');
});
