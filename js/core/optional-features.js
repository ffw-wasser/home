/* Product rollout policy, shared by the shipped pages and Worker. See docs/BACKLOG.md.
 * Pure model tests can omit this policy to exercise retained future functionality.
 * Production entry points must load this file before any feature module. */
(function(g){
 'use strict';
 g.H2OFeatures=Object.freeze({rewards:false,challenge:false});
 if(typeof document!=='undefined')document.documentElement.dataset.loyalty='paused';
})(globalThis);
