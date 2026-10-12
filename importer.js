import {parseFeed,keywordMatch,hash} from './rss.js';
import {validateFeedUrl} from './http.js';
export function feedConfig(feed){const url=validateFeedUrl(feed?.url).href;const u=new URL(url);for(const k of u.searchParams.keys())if(/^(key|api_key|token|access_token|auth|password|secret)$/i.test(k))throw new Error('Källadressen får inte innehålla privata inloggningsuppgifter.');return {url,keywords:(String(feed.keywords||'speedway').trim()||'speedway').slice(0,400)};}
export async function importConfiguredFeeds({feeds,fetchText,store,now=()=>new Date()}){
 const active=feeds.filter(f=>f.enabled!==false).slice(0,12),results=[];
 for(const feed of active){let url=String(feed?.url||''),statusId;
  try{
   const config=feedConfig(feed);url=config.url;statusId=hash(url);const previous=await store.getStatus(statusId)||{};
   const conditional=previous.keywords===config.keywords?previous:{};
   const response=await fetchText(url,{conditional}),attempt=now().toISOString();
   if(response.notModified){const result={url,keywords:config.keywords,added:0,duplicates:0,unchanged:true,lastAttemptAt:attempt,lastSuccessAt:attempt,error:null,transport:'GitHub Actions – direkt hämtning'};await store.saveStatus(statusId,result);results.push(result);continue;}
   const signature=hash(response.text+'|'+config.keywords);
   if(previous.contentDigest===signature){const result={url,keywords:config.keywords,added:0,duplicates:0,unchanged:true,lastAttemptAt:attempt,lastSuccessAt:attempt,error:null,transport:'GitHub Actions – direkt hämtning'};await store.saveStatus(statusId,result);results.push(result);continue;}
   const parsed=parseFeed(response.text,response.url||url,now()),matches=parsed.items.filter(i=>keywordMatch(i,config.keywords)).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)),items=matches.slice(0,60);let added=0,duplicates=0;
   for(const item of items){if(await store.createArticle({...item,feedUrl:url}))added++;else duplicates++;}
   const result={url,keywords:config.keywords,source:parsed.source,total:parsed.total,matched:matches.length,processed:items.length,added,duplicates,etag:response.etag||'',lastModified:response.lastModified||'',contentDigest:signature,lastAttemptAt:attempt,lastSuccessAt:attempt,error:null,transport:'GitHub Actions – direkt hämtning'};
   await store.saveStatus(statusId,result);results.push(result);
  }catch(error){const result={url,added:0,error:error.message,lastAttemptAt:now().toISOString()};if(statusId){try{await store.saveStatus(statusId,result);}catch{result.error+=' · Källstatus kunde inte sparas.';}}results.push(result);}
 }
 return {results,added:results.reduce((n,r)=>n+r.added,0),errors:results.filter(r=>r.error).length};
}
