import https from 'node:https';
import http from 'node:http';
import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import {MAX_BYTES} from './rss.js';
export function isPublicAddress(address){try{const ip=ipaddr.process(address);return ip.range()==='unicast';}catch{return false;}}
export function validateFeedUrl(raw){let url;try{url=new URL(raw);}catch{throw new Error('Ange en giltig webb- eller RSS-adress.');}if(!['http:','https:'].includes(url.protocol)||url.username||url.password||(url.port&&!['80','443'].includes(url.port)))throw new Error('Endast vanliga http/https-adresser utan inloggningsuppgifter stöds.');if(!url.hostname||url.hostname.length>253||url.href.length>2048)throw new Error('Adressen är för lång.');url.hash='';return url;}
export async function fetchText(raw,{redirects=3,deadline=Date.now()+15000,conditional={}}={}){
 const url=validateFeedUrl(raw),hostname=url.hostname.replace(/^\[|\]$/g,'');
 const addresses=await dns.lookup(hostname,{all:true});
 if(!addresses.length||addresses.some(a=>!isPublicAddress(a.address)))throw new Error('Källan måste vara en publik webbplats. Lokala och privata adresser tillåts inte.');
 const pinned=addresses.find(a=>a.family===4)||addresses[0];
 const remaining=deadline-Date.now();if(remaining<=0)throw new Error('Källan svarade inte inom 15 sekunder.');
 const response=await new Promise((resolve,reject)=>{
  const transport=url.protocol==='https:'?https:http;
  const request=transport.get(url,{lookup:(_h,opts,cb)=>opts?.all?cb(null,[pinned]):cb(null,pinned.address,pinned.family),headers:{'User-Agent':'SvenskSpeedwayRSS/1.0','Accept':'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html','Accept-Encoding':'identity',...(conditional.etag?{'If-None-Match':conditional.etag.slice(0,1024)}:{}),...(conditional.lastModified?{'If-Modified-Since':conditional.lastModified.slice(0,1024)}:{})}},res=>{
   if([301,302,303,307,308].includes(res.statusCode)){res.resume();resolve({redirect:res.headers.location});return;}
   if(res.statusCode===304){res.resume();resolve({notModified:true,url:url.href});return;}if(res.statusCode!==200){res.resume();reject(new Error('Källan svarade med HTTP '+res.statusCode+'.'));return;}
   if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.resume();reject(new Error('Källan skickade komprimerad data trots begäran om vanlig text.'));return;}
   let bytes=0;const chunks=[];res.on('data',chunk=>{bytes+=chunk.length;if(bytes>MAX_BYTES){request.destroy(new Error('Källan är större än 2 MB.'));return;}chunks.push(chunk);});res.on('end',()=>resolve({text:Buffer.concat(chunks).toString('utf8'),url:url.href,etag:String(res.headers.etag||''),lastModified:String(res.headers['last-modified']||'')}));res.on('error',reject);
  });const timer=setTimeout(()=>request.destroy(new Error('Källan svarade inte inom 15 sekunder.')),remaining);request.on('close',()=>clearTimeout(timer));request.on('error',reject);
 });
 if('redirect' in response){if(!response.redirect||redirects<=0)throw new Error('För många eller ogiltiga omdirigeringar.');return fetchText(new URL(response.redirect,url).href,{redirects:redirects-1,deadline,conditional});}
 return response;
}
