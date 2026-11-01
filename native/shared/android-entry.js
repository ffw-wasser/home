/* Trusted Android container adapters. No session or capability crosses a bridge. */
(function () {
 'use strict';
 if (window !== window.top || location.origin !== 'https://ffw-wasser.github.io' || !['/home/deckel.html','/home/termin.html'].includes(location.pathname)) return;
 const handlers = {};
 if (typeof window.H2OWidget?.postMessage === 'function') handlers.h2oWidget = {postMessage: value => H2OWidget.postMessage(JSON.stringify(value))};
 if (typeof window.H2ONotifications?.postMessage === 'function') {
  handlers.h2oNotifications = {postMessage: value => H2ONotifications.postMessage(JSON.stringify(value))};
  H2ONotifications.onmessage = event => {
   try { const value = JSON.parse(event.data); if (typeof value.id === 'string') dispatchEvent(new CustomEvent('h2o-native-notifications', {detail:value})); } catch {}
  };
 }
 window.webkit = {messageHandlers:handlers};
}());
