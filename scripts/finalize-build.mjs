import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadEnv } from 'vite';

const outDir = process.env.ATLAS_OUT_DIR || 'dist';
const base = (process.env.ATLAS_BASE_PATH || '/').replace(/\/?$/, '/');
if (!base.startsWith('/') || base.includes('..') || !/^\/[a-zA-Z0-9/_-]*$/.test(base))
  throw new Error('ATLAS_BASE_PATH must be an absolute URL path with a trailing slash.');
const html = await readFile(join(outDir, 'index.html'), 'utf8');
const buildEnv = loadEnv('production', process.cwd(), 'VITE_');
const measurementId = process.env.VITE_ANALYTICS_ID ?? buildEnv.VITE_ANALYTICS_ID ?? '';
function httpsOrigin(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.origin === value.replace(/\/$/, '')
      ? url.origin
      : '';
  } catch {
    return '';
  }
}
const analyticsOrigin = httpsOrigin(
  process.env.VITE_ANALYTICS_ORIGIN ?? buildEnv.VITE_ANALYTICS_ORIGIN,
);
const parentOrigin = httpsOrigin(
  process.env.VITE_ANALYTICS_PARENT_ORIGIN ?? buildEnv.VITE_ANALYTICS_PARENT_ORIGIN,
);
const validMeasurementId =
  /^G-[A-Z0-9]{6,20}$/.test(measurementId) &&
  analyticsOrigin &&
  parentOrigin &&
  analyticsOrigin !== parentOrigin
    ? measurementId
    : '';
await writeFile(
  join(outDir, 'analytics.html'),
  `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="referrer" content="no-referrer"><title>Atlas anonymous measurement</title><script defer src="${base}analytics-bootstrap.js"></script></head><body></body></html>`,
);
await writeFile(
  join(outDir, 'analytics-bootstrap.js'),
  `(function(){
  var id=${JSON.stringify(validMeasurementId)},expectedOrigin=${JSON.stringify(analyticsOrigin)},parentOrigin=${JSON.stringify(parentOrigin)},base=${JSON.stringify(base)};
  // Only the dedicated, different origin may run the tag, and only inside a frame.
  if(!id||!expectedOrigin||!parentOrigin||expectedOrigin===parentOrigin||window.parent===window||window.origin!==expectedOrigin||location.origin!==expectedOrigin)return;
  // An empty hidden page must not manufacture Enhanced Measurement scroll events.
  document.body.style.minHeight='10000px';
  var configured=false,revoked=false;
  function send(type){window.parent.postMessage({type:type},parentOrigin);}
  function revoke(){
    revoked=true;window['ga-disable-'+id]=true;
    ['atlas_ga','atlas_ga_'+id.slice(2)].forEach(function(name){document.cookie=name+'=; Max-Age=0; Path='+base+'; SameSite=Lax; Secure';});
    send('atlas:analytics:revoked');
  }
  window.addEventListener('message',function(event){
    if(event.source!==window.parent||event.origin!==parentOrigin||!event.data||typeof event.data!=='object'||Array.isArray(event.data))return;
    var data=event.data;
    if(data.type==='atlas:analytics:revoke'&&Object.keys(data).length===1){revoke();return;}
    if(configured||revoked||data.type!=='atlas:analytics:configure'||data.consent!=='granted'||Object.keys(data).length!==2)return;
    configured=true;
    window.dataLayer=[];function gtag(){window.dataLayer.push(arguments);}
    gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    gtag('js',new Date());
    var safeLocation=parentOrigin+base;
    gtag('config',id,{send_page_view:false,cookie_domain:'none',cookie_path:base,cookie_prefix:'atlas',cookie_flags:'SameSite=Lax;Secure',page_location:safeLocation,page_referrer:'',allow_google_signals:false,allow_ad_personalization_signals:false});
    gtag('event','page_view',{page_title:'Leonida Atlas',page_location:safeLocation,page_referrer:''});
    var script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+id;document.head.appendChild(script);
  });
  send('atlas:analytics:ready');
})();`,
);
const pages = ['about', 'documentation', 'credits', 'contributing', 'changelog', 'licenses'];
const regions = [
  'vice-city',
  'leonida-keys',
  'grassrivers',
  'port-gellhorn',
  'ambrosia',
  'mount-kalaga-national-park',
];
const routes = [
  ...pages,
  'gta6-leonida-atlas',
  'gta6-leonida-atlas/app',
  'tools/street-leonida',
  ...pages.map((p) => `gta6-leonida-atlas/${p}`),
  ...regions.flatMap((slug) => [
    `gta6-leonida-atlas/app/place/${slug}`,
    `gta6-leonida-atlas/app/viewpoint/${slug}-regional-entry`,
  ]),
];
for (const route of routes) {
  await mkdir(join(outDir, route), { recursive: true });
  await writeFile(join(outDir, route, 'index.html'), html);
}
const assets = (await readdir(join(outDir, 'assets')))
  .filter((name) => /\.(?:js|css|woff2)$/.test(name))
  .map((name) => `${base}assets/${name}`);
const precache = [
  base,
  `${base}index.html`,
  `${base}favicon.svg`,
  ...assets,
  `${base}assets/gta6-leonida-atlas/basemap.svg`,
  `${base}assets/street-leonida/maps/gtadb-landmarks-7c3f8c2.json`,
];
const contentHash = createHash('sha256').update(html + JSON.stringify(precache));
for (const url of precache) {
  if (url !== base) contentHash.update(await readFile(join(outDir, url.slice(base.length))));
}
const revision = contentHash.digest('hex').slice(0, 12);
const prefix = `atlas-${createHash('sha256').update(base).digest('hex').slice(0, 8)}-`;
const worker = `// Generated per release; never cache external analytics, APIs, or private data.
const CACHE=${JSON.stringify(prefix + revision)}, PREFIX=${JSON.stringify(prefix)}, BASE=${JSON.stringify(base)};
const CORE=${JSON.stringify(precache)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;
  if(url.pathname===BASE+'analytics.html'||url.pathname===BASE+'analytics-bootstrap.js')return;
  const navigation=request.mode==='navigate';
  const publicOptional=url.pathname.startsWith(BASE+'assets/street-leonida/')&&/\\.(?:webp|jpg|png|svg|json)$/.test(url.pathname);
  const asset=CORE.includes(url.pathname)||publicOptional;
  if(request.headers.has('authorization')||(!navigation&&url.search))return;
  if(!navigation&&!asset)return;
  if(navigation){event.respondWith(fetch(request).then(response=>response.ok?response:caches.match(BASE+'index.html')).catch(()=>caches.match(BASE+'index.html')));return;}
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(request);if(cached)return cached;
    const response=await fetch(request);
    if(response.ok&&response.type==='basic'&&!/private|no-store/i.test(response.headers.get('cache-control')||'')){
      // Bound optional 3D asset caching; the app shell and public data remain pinned.
      try {
        const keys=await cache.keys();const extras=keys.filter(key=>!CORE.includes(new URL(key.url).pathname));
        if(extras.length>=200)await cache.delete(extras[0]);
        await cache.put(request,response.clone());
      } catch { /* Cache quota must not discard a successful network response. */ }
    }
    return response;
  }).catch(()=>fetch(request)));
});
`;
await writeFile(join(outDir, 'sw.js'), worker);
await writeFile(join(outDir, '_redirects'), `${base}* ${base}index.html 200\n`);
await writeFile(
  join(outDir, '_headers'),
  `${base}*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n${base}sw.js\n  Cache-Control: no-cache\n`,
);
console.log(
  `Static routes: ${routes.length}; offline core: ${precache.length} files; base: ${base}`,
);
