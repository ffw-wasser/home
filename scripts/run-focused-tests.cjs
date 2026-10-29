#!/usr/bin/env node
'use strict';
// Quick local regression selection. The full suite remains mandatory in CI.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const testDir = path.join(root, 'tests');

// Deliberately broad first-pass selections, not a dependency graph.
const groups = {
  kalender: [/^(year-plan|calendar|portal-calendar|portal-reply|portal-priority|portal-sync|portal-settings|term-)/],
  einsatz: [/^(operation-|report-|termin-package-|document-report|tactics-|archive-step2)/],
  geraetehaus: [/^(attendance-|tactics-|term-|termin-package-|operation-|smart-flows|startup)/],
  historie: [/^(history-|archive-|operation-correction|operation-overwrite|backup-)/],
  deckel: [/^(deckel|drinks)(-|\.test)/],
  theater: [/^theater(-|\.test)/],
  portal: [/^portal\.test/, /^(portal|calendar)-/, /^member-(evidence|subscriptions)/],
  sicherheit: [/^portal-identity\.test/,/^portal\.test/, /^(private-|admin-|setup-|termin-package-|onedrive-|member-|deckel-encrypted|portal-sync|portal-settings|calendar-invitations)/],
  cloudflare: [/^portal-identity\.test/,/^portal\.test/, /^deckel-challenge\.test/, /^(deckel-push|drinks-central|drinks-phone-sync|portal-sync|portal-reply|portal-calendar|calendar-invitations|portal-settings|member-evidence|member-subscriptions|theater-phone-flow|drinks-challenge)/],
  basis: [/^app-(update|release)\.test/, /^(build-assets|release-consistency|plausibility|consolidation|startup|usability|home-icons|backup-integrity)/]
};
const names = Object.keys(groups);
const files = fs.readdirSync(testDir).filter(name => name.endsWith('.test.cjs')).sort();
const matches = group => files.filter(file => groups[group].some(pattern => pattern.test(file)));

function usage() {
  console.log('Aufruf: node scripts/run-focused-tests.cjs <bereich> [weiterer-bereich ...]');
  console.log('Fachbereiche: ' + names.join(', '));
  console.log('Alle Tests: node --test tests/*.test.cjs');
}
const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  usage();
  process.exitCode = args.length === 0 ? 2 : 0;
} else if (args.length === 1 && args[0] === '--list') {
  console.log('Verfügbare Testgruppen (nur erste Testschleife):');
  for (const name of names) {
    const count = matches(name).length;
    console.log('  ' + name.padEnd(13) + count + ' Testdateien');
    if (!count) process.exitCode = 1;
  }
} else if (args.some(arg => !Object.prototype.hasOwnProperty.call(groups, arg))) {
  console.error('Unbekannter Bereich: ' + args.filter(arg => !Object.prototype.hasOwnProperty.call(groups, arg)).join(', '));
  usage();
  process.exitCode = 2;
} else {
  const targets = new Set(args.flatMap(matches));
  const selected = files.filter(file => targets.has(file));
  if (!selected.length) {
    console.error('Keine Testdatei ausgewählt; Abbruch.');
    process.exitCode = 1;
  } else {
    console.log('Gezielte Tests für ' + [...new Set(args)].join(' + ') + ': ' + selected.length + ' Dateien');
    const result = spawnSync(process.execPath, ['--test', ...selected.map(file => path.join('tests', file))], {
      cwd: root,
      stdio: 'inherit'
    });
    if (result.error) console.error(result.error.message);
    process.exitCode = result.status === null ? 1 : result.status;
  }
}
