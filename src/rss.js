import {XMLParser, XMLValidator} from 'fast-xml-parser';
import {createHash} from 'node:crypto';
export const MAX_BYTES=2*1024*1024;
export const hash=s=>createHash('sha256').update(s).digest('hex');
const arr=v=>v==null?[]:Array.isArray(v)?v:[v];
const value=v=>typeof v==='object'?(v?.['#text']??''):v??'';
export function plainText(input){return String(value(input)).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';}).replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,x)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[x])).replace(/\s+/g,' ').trim();}
export function canonicalUrl(input,base){try{const u=new URL(String(input),base);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;u.hash='';for(const key of [...u.searchParams.keys()])if(/^utm_/i.test(key)||['fbclid','gclid'].includes(key))u.searchParams.delete(key);u.searchParams.sort();return u.href;}catch{return null;}}
export function classify(title,summary){const text=(title+' '+summary).toLocaleLowerCase('sv');if(/rykte|rykten|ryktas|spekulation|uppges|kan lämna/.test(text))return 'Rykten';if(/förläng|stannar|fortsätter i|nytt kontrakt/.test(text))return 'Förlängningar';if(/lämnar|avsked|klubbbyte|byter klubb/.test(text))return 'Klubbyten och avsked';if(/nyförvärv|värvar|värvning|klar för|ansluter/.test(text))return 'Nyförvärv';return 'Resultat och övriga nyheter';}
export function keywordMatch(item,keywords='speedway',excludeWords=''){const words=(String(keywords).trim()||'speedway').split(',').map(s=>s.trim().toLocaleLowerCase('sv')).filter(Boolean),excluded=String(excludeWords||'').split(',').map(s=>s.trim().toLocaleLowerCase('sv')).filter(Boolean),text=(item.title+' '+item.summary).toLocaleLowerCase('sv');return words.some(w=>text.includes(w))&&!excluded.some(w=>text.includes(w));}
export function parseFeed(xml,feedUrl,now=new Date()){
 if(Buffer.byteLength(xml)>MAX_BYTES)throw new Error('Flödet är för stort (max 2 MB).');
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('XML med DOCTYPE eller entitetsdefinitioner stöds inte.');
 if(XMLValidator.validate(xml)!==true)throw new Error('Källan innehåller ogiltig XML.');
 const parsed=new XMLParser({ignoreAttributes:false,parseTagValue:false,removeNSPrefix:true,processEntities:false,maxNestedTags:100}).parse(xml);
 const channel=parsed.rss?.channel||parsed.RDF,atom=parsed.feed;
 if(!channel&&!atom)throw new Error('Adressen är inte ett RSS- eller Atom-flöde.');
 const source=plainText((channel||atom).title)||new URL(feedUrl).hostname;
 const entries=arr(channel?.item||atom?.entry||parsed.RDF?.item).slice(0,500);
 const items=[],seen=new Set();
 for(const entry of entries){
  const title=plainText(entry.title).slice(0,240);
  const rawLink=atom?arr(entry.link).find(l=>!l['@_rel']||l['@_rel']==='alternate')?.['@_href']:value(entry.link);
  const url=canonicalUrl(rawLink,feedUrl);if(!title||!rawLink||!url||seen.has(url))continue;seen.add(url);
  const summary=plainText(entry.description||entry.summary||entry.encoded||entry.content).slice(0,280);
  const date=new Date(value(entry.pubDate||entry.published||entry.updated||entry.date));
  const dateKnown=Number.isFinite(date.getTime());if(dateKnown&&date.getTime()>now.getTime()+86400000)continue;
  items.push({id:hash(url),title,summary,source:source.slice(0,160),url,publishedAt:dateKnown?date.toISOString():now.toISOString(),publishedDateKnown:dateKnown,category:classify(title,summary),categoryAutomatic:true,verification:'Ej redaktionellt verifierad',feedUrl,demo:false,importedAt:now.toISOString()});
 }
 return {source,items,total:entries.length};
}
export function discoverLinks(html,pageUrl){
 const urls=[];
 for(const tag of html.match(/<link\b[^>]{0,4096}>/gi)||[]){const attrs={};for(const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[match[1].toLowerCase()]=match[2]??match[3]??match[4];if(/\balternate\b/i.test(attrs.rel||'')&&/application\/(?:rss|atom)\+xml/i.test(attrs.type||'')){const url=canonicalUrl(plainText(attrs.href),pageUrl);if(url)urls.push(url);}}
 return [...new Set(urls)].slice(0,6);
}
