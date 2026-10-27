/* iOS-only entry action, bundled with the native app. No credentials cross the bridge. */
(function () {
  'use strict';
  if (window.top !== window || location.origin !== 'https://ffw-wasser.github.io' ||
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
