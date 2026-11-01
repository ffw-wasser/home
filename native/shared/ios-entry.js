/* Native entry navigation only. App installation and camera enrollment are separate. */
(function () {
  'use strict';
  if (window.top !== window || !['https://ffw-wasser.github.io', 'https://h2o-apple-review.522dn4fc5f.workers.dev'].includes(location.origin) ||
      !['/home/deckel.html', '/home/termin.html', '/home/review.html'].includes(location.pathname)) return;
  const entry = new URL(location.href);
  if (entry.searchParams.get('nativePage') === 'terms') {
    entry.searchParams.delete('nativePage');
    history.replaceState(null, '', entry.pathname + entry.search + entry.hash);
    window.DeckelMobile?.jump('portal-section');
  }
}());
