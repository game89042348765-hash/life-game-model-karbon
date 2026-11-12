const CACHE='lifegame-personal-shell-v5';
const SHELL=['./','./index.html','./app.js','./planning.js','./persistence.js','./style.css','./pwa.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./fonts/golos-text-cyrillic-wght-normal.woff2','./fonts/golos-text-latin-wght-normal.woff2','./fonts/tektur-cyrillic-wght-normal.woff2','./fonts/tektur-latin-wght-normal.woff2','./fonts/jetbrains-mono-cyrillic-wght-normal.woff2','./fonts/jetbrains-mono-latin-wght-normal.woff2','./fonts/nunito-cyrillic-wght-normal.woff2','./fonts/nunito-latin-wght-normal.woff2','./fonts/unbounded-cyrillic-wght-normal.woff2','./fonts/unbounded-latin-wght-normal.woff2','./fonts/rubik-cyrillic-wght-normal.woff2','./fonts/rubik-latin-wght-normal.woff2','./fonts/dela-gothic-one-cyrillic-400-normal.woff2','./fonts/dela-gothic-one-latin-400-normal.woff2'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lifegame-personal-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url),scope=new URL(self.registration.scope);
  if(event.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match(new URL('./index.html',scope).href))));return}
  if(SHELL.some(p=>new URL(p,scope).pathname===url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(hit=>hit||fetch(event.request)));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const all=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const client=all.find(c=>c.url.startsWith(self.registration.scope));
    if(client){await client.focus();client.postMessage({type:'OPEN_CALENDAR'})}
    else await self.clients.openWindow(new URL('./?view=calendar',self.registration.scope).href);
  })());
});
