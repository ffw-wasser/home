/* Pure selection/description model. No accounts, network, member lists or tokens. */
var H2OCalendarAddonModel = (function () {
  'use strict';
  const types = ['Probe', 'Sonderprobe', 'Unterricht', 'Ausschusssitzung', 'Veranstaltung', 'Information'];
  const outfits = ['Einsatzkleidung', 'Tagesdienst', 'Uniform', 'T-Shirt/Fest', 'Zivil'];
  const property = 'h2oDescriptionSuffixV1';
  const control = /^\s*(Terminart|Gruppen?|Kleidung|Freigabe)\s*:\s*(.*?)\s*$/i;
  function fail(text) { throw Error(text); }
  function plain(value) {
    const entities = {amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' '};
    return String(value || '').replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/<\s*(?:br|\/p|\/div|\/li)\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '')
      .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, function (all, key) {
        if (key[0] !== '#') return entities[key.toLowerCase()];
        const hex = key[1].toLowerCase() === 'x', n = parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
        return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
      }).replace(/\r\n?/g, '\n').trim();
  }
  function groups(raw) {
    let list; try { list = JSON.parse(raw); } catch (_) { fail('H2O_GROUP_NAMES muss eine JSON-Liste von Gruppennamen enthalten.'); }
    if (!Array.isArray(list) || !list.length || list.length > 30) fail('Bitte 1 bis 30 Gruppennamen konfigurieren.');
    const names = new Set();
    return list.map(function (name) {
      if (typeof name !== 'string' || !name.trim() || name.length > 80 || /[;<>\x00-\x1f\x7f]/.test(name)) fail('Ungültiger Gruppenname. Keine Semikolons, HTML-Zeichen oder Zeilenumbrüche verwenden.');
      name = name.trim(); const key = name.toLocaleLowerCase('de');
      if (names.has(key)) fail('Gruppennamen dürfen nicht doppelt vorkommen.'); names.add(key); return name;
    });
  }
  function read(description, knownGroups, title) {
    const fields = {};
    plain(description).split('\n').forEach(function (line) {
      const match = control.exec(line); if (!match) return;
      const key = /^gruppe/i.test(match[1]) ? 'group' : match[1].toLocaleLowerCase('de');
      if (Object.prototype.hasOwnProperty.call(fields, key) || !match[2]) fail('Doppelte oder leere H₂O-Angaben bitte zuerst in der Google-Beschreibung korrigieren.');
      fields[key] = match[2];
    });
    const aliases = {'allgemeine probe':'Probe', 'ausschuss sitzung':'Ausschusssitzung', 'weitere termine':'Veranstaltung', 'sonstiges':'Veranstaltung', 'info':'Information'};
    const fallback = /^\s*INFO\s*:/i.test(title || '') ? 'Information' : /(?:^|[\s:-])unterricht(?:$|[\s:,-])/i.test(title || '') ? 'Unterricht' : /ausschuss[\s-]*sitzung/i.test(title || '') ? 'Ausschusssitzung' : !/sonderprobe/i.test(title || '') && /(?:^|[\s-])probe(?:$|[\s:,-])|gesamtprobe|hauptprobe|übungsprobe/i.test(title || '') ? 'Probe' : 'Sonderprobe';
    const raw = fields.terminart || fallback, type = types.find(function (t) { return t.toLocaleLowerCase('de') === raw.toLocaleLowerCase('de'); }) || aliases[raw.toLocaleLowerCase('de')];
    if (!type) fail('Unbekannte Terminart bitte zuerst in der Google-Beschreibung korrigieren.');
    const selected = fields.group === undefined ? [] : (knownGroups.includes(fields.group) ? [fields.group] : fields.group.split(';').map(function (x) { return x.trim(); }));
    if (selected.some(function (name) { return !knownGroups.includes(name); })) fail('Vorhandene Gruppe fehlt in H2O_GROUP_NAMES. Erst die Auswahlliste aktualisieren.');
    if (fields.freigabe !== undefined && !/^(ja|nein)$/i.test(fields.freigabe)) fail('Freigabe muss Ja oder Nein sein.');
    if ((fields.kleidung || '').length > 120) fail('Kleidung ist zu lang.');
    return {type:type, clothing:fields.kleidung || (type === 'Probe' ? 'Einsatzkleidung' : 'Tagesdienst'), mode:fields.group === undefined ? 'automatic' : 'selected', groups:selected, release:/^ja$/i.test(fields.freigabe || '')};
  }
  function build(event, selection, knownGroups) {
    if (!types.includes(selection.type) || !['automatic', 'selected'].includes(selection.mode) || typeof selection.release !== 'boolean') fail('Bitte Terminart, Gruppenauswahl und Freigabe prüfen.');
    if (typeof selection.clothing !== 'string' || !selection.clothing.trim() || selection.clothing.length > 120 || /[<>\x00-\x1f\x7f]/.test(selection.clothing)) fail('Bitte eine Kleidungsangabe mit höchstens 120 Zeichen verwenden.');
    if (!Array.isArray(selection.groups) || new Set(selection.groups).size !== selection.groups.length || selection.groups.some(function (name) { return !knownGroups.includes(name); })) fail('Die Gruppenauswahl ist nicht mehr gültig.');
    if (selection.mode === 'selected' && !selection.groups.length) fail('Bitte mindestens eine Gruppe wählen oder die automatische Zuordnung verwenden.');
    let base = String(event.description || '');
    const old = (event.extendedProperties || {}).shared || {}, suffix = old[property];
    if (suffix !== undefined) {
      if (typeof suffix !== 'string' || !suffix || suffix.length > 900 || plain(suffix).split('\n').some(function (line) { return !control.test(line); })) fail('Die gespeicherte H₂O-Kennung ist ungültig. Bitte die Erweiterung prüfen lassen.');
      if (base.endsWith(suffix)) {
        base = base.slice(0, -suffix.length);
        if (plain(base).split('\n').some(function (line) { return control.test(line); })) fail('Zusätzliche H₂O-Steuerzeilen außerhalb der gespeicherten Auswahl gefunden. Bitte zuerst in Google bereinigen.');
      } else if (/<[^>]+>/.test(base) && plain(base).split('\n').some(function (line) { return control.test(line); })) {
        fail('Die formatierten H₂O-Steuerzeilen wurden in Google verändert. Diese Steuerzeilen zuerst in Google entfernen; der übrige Text bleibt erhalten.');
      } else if (!/<[^>]+>/.test(base)) {
        base = base.split(/\r?\n/).filter(function (line) { return !control.test(line); }).join('\n');
      }
    } else if (/<[^>]+>/.test(base)) {
      if (plain(base).split('\n').some(function (line) { return control.test(line); })) fail('Vorhandene H₂O-Steuerzeilen in formatierter Beschreibung bitte zuerst in Google entfernen. Der übrige Text bleibt erhalten.');
    } else {
      base = base.split(/\r?\n/).filter(function (line) { return !control.test(line); }).join('\n');
    }
    const lines = ['Terminart: ' + selection.type, 'Kleidung: ' + selection.clothing.trim()];
    if (selection.mode === 'selected') lines.push('Gruppen: ' + selection.groups.join('; '));
    lines.push('Freigabe: ' + (selection.release ? 'Ja' : 'Nein'));
    // Escape text inside HTML descriptions without touching the original rich text.
    const html = /<[^>]+>/.test(base), escape = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    const next = (base ? html ? '<br><br>' : '\n\n' : '') + lines.map(function (s) { return html ? escape(s) : s; }).join(html ? '<br>' : '\n');
    if (next.length > 900 || base.length + next.length > 4000) fail('Die Beschreibung oder Gruppenauswahl ist zu lang. Bitte kürzen.');
    return {description:base + next, extendedProperties:{shared:Object.assign({}, old, {[property]:next})}};
  }
  return {types:types, outfits:outfits, property:property, groups:groups, read:read, build:build};
})();
