/* iOS-only entry action, bundled with the native app. No credentials cross the bridge. */
(function () {
  'use strict';
  if (window.top !== window || !['https://ffw-wasser.github.io', 'https://h2o-apple-review.522dn4fc5f.workers.dev'].includes(location.origin) ||
      !['/home/deckel.html', '/home/termin.html'].includes(location.pathname)) return;
  const setup = document.getElementById('identity-setup');
  if (!setup || document.getElementById('h2o-ios-invitation-scan')) return;
  const button = document.createElement('button');
  button.id = 'h2o-ios-invitation-scan';
  button.type = 'button';
  button.className = 'secondary';
  button.textContent = 'Einladung scannen';
  button.addEventListener('click', function (event) {
    if (!event.isTrusted || setup.closest('[hidden]') || window.H2OIdentity?.session?.()) return;
    window.webkit?.messageHandlers?.h2oInvitation?.postMessage('scan');
  });
  setup.append(button);
}());
