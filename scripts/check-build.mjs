import {readFile,stat} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {domain,pages} from './content.mjs';
const file=p=>new URL('../dist/'+p,import.meta.url),titles=new Set(),descs=new Set();let links=0;
const headers=await readFile(file('_headers'),'utf8');for(const line of headers.split('\n'))assert.ok(line.length<=2000,'header exceeds Cloudflare limit');
for(const p of pages){const target=p.slug==='404'?'404.html':p.slug?p.slug+'/index.html':'index.html',html=await readFile(file(target),'utf8');
 const title=html.match(/<title>(.*?)<\/title>/s)?.[1],desc=html.match(/<meta name="description" content="([^"]+)"/)?.[1];assert.ok(title&&!titles.has(title),'unique title '+target);titles.add(title);assert.ok(desc&&!descs.has(desc),'unique desc '+target);descs.add(desc);
 assert.equal((html.match(/<h1[ >]/g)||[]).length,1);assert.ok(html.includes(`href="${domain}${p.slug==='404'?'/404.html':p.slug?'/'+p.slug+'/':'/'}"`));
 assert.equal(html.includes('name="robots" content="noindex"'),p.slug==='404');const schema=html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1];assert.ok(schema);JSON.parse(schema);assert.ok(headers.includes('sha256-'+createHash('sha256').update(schema).digest('base64')));
 assert.ok(!/adsbygoogle|pagead2|googlesyndication|gtag\(/i.test(html),'no active ads or analytics');
 assert.ok(!/href="http:\/\/(127\.0\.0\.1|localhost)/.test(html),'no localhost link in static publishable HTML');
 for(const [,href]of html.matchAll(/(?:href|src)="(\/[^"#]*)(?:#[^"]*)?"/g)){if(!href)continue;const to=href==='/'?'index.html':href.slice(1)+(href.endsWith('/')?'index.html':'');assert.ok((await stat(file(to))).isFile(),target+' broken '+href);links++;}
}
const sitemap=await readFile(file('sitemap.xml'),'utf8');assert.equal((sitemap.match(/<loc>/g)||[]).length,pages.length-1);assert.ok(!sitemap.includes('404'));assert.ok((await readFile(file('robots.txt'),'utf8')).includes(domain+'/sitemap.xml'));
assert.ok(headers.includes("connect-src 'self'"));assert.ok(headers.includes('camera=()'));assert.ok(headers.includes('https://:version.:project.pages.dev/*'));assert.ok((await readFile(file('licenses.txt'),'utf8')).includes('Apache'));
console.log(`Static check passed: ${pages.length} pages, ${pages.length-1} sitemap URLs, ${links} local links, unique metadata, valid JSON-LD/CSP, no active ads/analytics.`);
