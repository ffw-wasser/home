/* Google Apps Script colour reader for H2O. No titles, notes, guests or writes. */
function doPost(event) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const secret = properties.getProperty('H2O_SECRET');
    const calendarId = properties.getProperty('H2O_CALENDAR_ID');
    const request = JSON.parse(event.postData.contents);
    if (!secret || !/^[A-Za-z0-9_-]{32,128}$/.test(secret) || request.secret !== secret || request.calendarId !== calendarId) throw Error('Access denied');
    const from = Date.parse(request.from), to = Date.parse(request.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 740 * 86400000) throw Error('Invalid range');
    const definitions = Calendar.Colors.get();
    const calendar = Calendar.Calendars.get(calendarId);
    const ownCalendar = Calendar.CalendarList.get(calendarId, {colorRgbFormat: true});
    const base = ownCalendar.backgroundColor || definitions.calendar[ownCalendar.colorId].background;
    const labels = new Map(((calendar.labelProperties || {}).eventLabels || []).map(label => [label.id, label.backgroundColor]));
    const events = []; let pageToken;
    do {
      const options = {timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), singleEvents: true, maxResults: 2500, eventLabelVersion: 1};
      if (pageToken) options.pageToken = pageToken;
      const page = Calendar.Events.list(calendarId, options);
      for (const item of page.items || []) {
        if (item.status === 'cancelled' || !item.iCalUID || !item.start) continue;
        const color = labels.get(item.eventLabelId) || (item.colorId && definitions.event[item.colorId] || {}).background || base;
        if (!/^#[0-9a-f]{6}$/i.test(color)) throw Error('Invalid colour');
        events.push({uid: item.iCalUID, ...(item.start.date ? {day: item.start.date} : {start: Date.parse(item.start.dateTime)}), color});
        if (events.length > 5000) throw Error('Too many events');
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
    return json_({version: 1, calendarId, events});
  } catch (error) {
    // Never echo the access key, request, calendar details or provider error.
    return json_({error: 'Colour access unavailable'});
  }
}
function doGet() { return json_({service: 'H2O calendar colours',version: 1}); }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
