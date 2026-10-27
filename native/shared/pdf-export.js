/* Bundled native-container adapter. No tokens, arbitrary URLs or file reads. */
(function () {
  'use strict';
  if (window !== window.top || window.__h2oPdfExport || location.origin !== 'https://ffw-wasser.github.io' || !['/home/deckel.html','/home/termin.html'].includes(location.pathname)) return;
  const post = window.webkit?.messageHandlers?.h2oPdf
    ? value => window.webkit.messageHandlers.h2oPdf.postMessage(value)
    : typeof window.H2OPdf?.postMessage === 'function' ? value => window.H2OPdf.postMessage(JSON.stringify(value)) : null;
  if (!post) return;
  window.__h2oPdfExport = true;
  const maxBytes = 10 * 1024 * 1024;
  let busy = false;
  function name(value) {
    let result = String(value || 'H2O-Dokument.pdf').replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 120);
    if (!/^[A-Za-z0-9]/.test(result)) result = 'H2O-' + result;
    if (!/\.pdf$/i.test(result)) result += '.pdf';
    return result;
  }
  async function pdf(url, signal) {
    const response = await fetch(url, {credentials:'omit', cache:'no-store', signal});
    if (!response.ok || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/pdf') throw Error('Nur PDF-Dateien können so exportiert werden.');
    const reader = response.body.getReader(), chunks = [];
    let size = 0;
    try {
      for (;;) {
        const {value,done} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) throw Error('Die PDF ist größer als 10 MB. Bitte über den Browser speichern.');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const blob = new Blob(chunks, {type:'application/pdf'});
    if (await blob.slice(0,5).text() !== '%PDF-') throw Error('Die Datei ist keine bestätigte PDF.');
    return new Promise((resolve,reject) => {
      const file = new FileReader();
      file.onload = () => resolve(String(file.result).split(',')[1]);
      file.onerror = () => reject(Error('Die PDF konnte nicht gelesen werden.'));
      file.readAsDataURL(blob);
    });
  }
  document.addEventListener('click', async event => {
    if (!event.isTrusted || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor) return;
    if (anchor.type && anchor.type.split(';')[0].trim().toLowerCase() !== 'application/pdf') return;
    if (/\.[A-Za-z0-9]{1,8}$/.test(anchor.download || '') && !/\.pdf$/i.test(anchor.download)) return;
    let url; try { url = new URL(anchor.href); } catch { return; }
    if (url.protocol !== 'blob:' || url.origin !== location.origin) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (busy) return;
    busy = true; anchor.setAttribute('aria-busy','true');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
    try { post({name:name(anchor.download), mime:'application/pdf', data:await pdf(url.href, controller.signal)}); }
    catch (error) { alert(error.name === 'AbortError' ? 'Die PDF-Vorbereitung hat zu lange gedauert. Bitte erneut versuchen.' : error.message); }
    finally { clearTimeout(timer); busy = false; anchor.removeAttribute('aria-busy'); }
  }, true);
})();
