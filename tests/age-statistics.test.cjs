const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CsvEngine = require('../js/features/reports/csv-engine.js');
const JSZip = require('../js/vendor/jszip.min.js');
const source = fs.readFileSync(require.resolve('../js/features/statistics/statistics.js'), 'utf8');
const age = {id: 'age', firstName: 'Person', lastName: 'Test', ageDepartment: true};
const active = {id: 'active', firstName: 'Aktiv', lastName: 'Beispiel', ageDepartment: false};
const name = m => `${m.lastName}, ${m.firstName}`;
function report(type, status, rowName = name(age), date = '2026-10-08') {
  const rows = [[date, '18:00', name(active), type, 'Anwesend', 'GF', 'Funk']];
  if (status) rows.push([date, '18:00', rowName, type, status, '', 'Funk']);
  return {createdAt: date, sessionType: type, content: CsvEngine.serialize(rows)};
}
function app(archive = []) {
  const nodes = new Map();
  const byId = id => {
    if (!nodes.has(id)) {
      const node = {value: '', textContent: '', hidden: false, section: {hidden: false},
        closest() {return this.section;}, querySelector() {return null;}};
      Object.defineProperty(node, 'innerHTML', {get() {return this.html || '';}, set(v) {this.html = v; if (id === 'individualMemberSelect') this.value = '';}});
      nodes.set(id, node);
    }
    return nodes.get(id);
  };
  const context = vm.createContext({CsvEngine, JSZip, members: [active, age], csvArchive: archive,
    byId, nameForStorage: name, nameForTile: name, escapeHtml: String, AVAILABLE_ROLES: ['GF'],
    formatDisplayDate: String, getRoleTargets: () => ({GF: 2}), getMemberRoles: () => ['GF'],
    isAtmOrAtgQualified: () => false, window: {}, console, setTimeout,
    document: {body: {classList: {add() {}, remove() {}}}},
  });
  vm.runInContext(source, context);
  for (const fn of ['renderSeparatedOperationStatistics', 'renderStatisticsCharts', 'renderDriverLicenseStatistics', 'arrangeStatisticsPage', 'ensureCollapsedStatisticsPanels', 'renderIndividualBreathingClearance', 'renderIndividualOperationStatistics', 'renderIndividualStatisticsCharts']) context[fn] = () => {};
  vm.runInContext('selectedStatisticsYear="2026"', context);
  return {context, byId};
}

test('Alterskameraden auswählbar; Auswahl bleibt nach Aktualisierung erhalten', () => {
  const {context, byId} = app();
  byId('individualMemberSelect').value = age.id;
  context.populateIndividualMemberSelect();
  assert.match(byId('individualMemberSelect').innerHTML, /optgroup label="Alterskameraden"/);
  assert.match(byId('individualMemberSelect').innerHTML, /value="age"/);
  assert.match(byId('individualMemberSelect').innerHTML, /value="active"/);
  assert.equal(byId('individualMemberSelect').value, age.id);
});

test('Gruppen- und Einzelstatistik zählen gleich; Betrifft nicht wird nicht als Fehlt gewertet', () => {
  const {context, byId} = app([
    report('Allgemeine Probe', 'Anwesend'), report('Sonderprobe', 'Entschuldigt'),
    report('Unterricht', null), report('Sonderprobe', 'Betrifft nicht'),
    report('Ausschuss Sitzung', 'Anwesend'), report('Einsatz', 'Anwesend'),
    report('Allgemeine Probe', 'Anwesend', name(age), '2025-10-08')
  ]);
  context.renderStatistics();
  assert.equal(byId('ageAttendanceRate').textContent, '33,3 %');
  assert.equal(byId('ageAttendanceDetail').textContent, '1 anwesend von 3 möglichen Teilnahmen');
  assert.match(byId('ageAttendanceRanking').innerHTML, /1 Teilnahme/);
  assert.equal(byId('yearAttendanceRate').textContent, '100,0 %');
  context.renderIndividualStatistics(age.id);
  assert.equal(byId('individualStatisticsPreview').hidden, false);
  assert.equal(byId('individualStatisticsPdfButton').disabled, false);
  assert.equal(byId('individualAttendanceRate').textContent, '33,3 %');
  assert.equal(byId('individualPresentCount').textContent, 1);
  assert.equal(byId('individualExcusedCount').textContent, 1);
  assert.equal(byId('individualMissingCount').textContent, 1);
  assert.equal(byId('individualRoleTargets').section.hidden, true);
  assert.equal(byId('individualOperationStatistics').hidden, true);
  assert.doesNotMatch(byId('individualRecentVisits').innerHTML, /Einsatz|Ausschuss/);
  context.renderIndividualStatistics(active.id);
  assert.equal(byId('individualRoleTargets').section.hidden, false);
  assert.equal(byId('individualOperationStatistics').hidden, false);
  assert.equal(byId('individualPresentCount').textContent, 6);
});

test('Ältere Namensformen und Leerzeichen zählen in der Rangliste', () => {
  const {context, byId} = app([report('Unterricht', 'Anwesend', ' Person  Test '), report('Sonderprobe', 'Anwesend', ' Test , Person ')]);
  context.renderStatistics();
  assert.equal(byId('ageAttendanceRate').textContent, '100,0 %');
  assert.match(byId('ageAttendanceRanking').innerHTML, /2 Teilnahmen/);
});

test('Mehrdeutige Namen werden keiner Person automatisch zugeordnet', () => {
  const {context} = app();
  context.members.push({...age, id: 'duplicate'});
  assert.equal(context.statisticsRowMatchesMember({name: name(age)}, age), false);
});

test('Keine Berichte: Alterskamerad bleibt auswählbar und PDF-Vorschau zeigt keine Daten', () => {
  const {context, byId} = app();
  context.renderIndividualStatistics(age.id);
  assert.equal(byId('individualAttendanceRate').textContent, '–');
  assert.equal(byId('individualAttendanceDetail').textContent, 'Noch keine Daten');
  assert.equal(byId('individualPresentCount').textContent, 0);
});

test('Geladener OneDrive-ZIP-Bericht aktualisiert auch die ausgewählte Alterskameraden-Statistik', async () => {
  const {context, byId} = app();
  byId('individualMemberSelect').value = age.id;
  const zip = new JSZip();
  zip.file('probe.csv', report('Unterricht', 'Anwesend').content);
  const bytes = await zip.generateAsync({type: 'uint8array'});
  Object.assign(context, {
    oneDriveSignedIn: () => true, oneDriveResolveSharedRoot: async () => ({driveId: 'test', id: 'root'}),
    odFetch: async url => url.includes('/children') ? {json: async () => ({value: [{id: 'zip', name: 'probe.zip', file: {}, lastModifiedDateTime: '2026-10-08T18:00:00Z'}]})} : {blob: async () => bytes},
    renderHistory() {}, showToast() {}, historyDateFromItem: item => item.originalReportDate,
  });
  context.document.getElementById = () => null;
  context.document.documentElement = {classList: {add() {}, remove() {}}};
  vm.runInContext(fs.readFileSync(require.resolve('../js/features/history/onedrive-history-live.js'), 'utf8'), context);
  await context.window.loadOneDriveHistory();
  assert.equal(context.csvArchive.length, 1);
  assert.equal(byId('individualMemberSelect').value, age.id);
  assert.equal(byId('ageAttendanceRate').textContent, '100,0 %');
  assert.equal(byId('individualPresentCount').textContent, 1);
});

test('PDF-Ausgabe lässt sich für einen Alterskameraden auslösen', () => {
  const {context, byId} = app([report('Unterricht', 'Anwesend')]);
  let printed = false;
  context.setTimeout = fn => fn();
  context.window.addEventListener = () => {};
  context.window.removeEventListener = () => {};
  context.window.print = () => {printed = true;};
  byId('individualMemberSelect').value = age.id;
  context.exportIndividualStatisticsPdf();
  assert.equal(printed, true);
  assert.equal(byId('individualPresentCount').textContent, 1);
});
