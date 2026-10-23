// DTD-deklarationen behövs inte för att läsa RSS. Ta bort den före XML-parsning
// utan att hämta externa DTD-filer eller expandera egna entiteter.
export function prepareRssXml(input){
 let cursor=0,i=0,output='',doctype=null,root=null,hasEntities=false;
 while(i<input.length){
  if(input.startsWith('<!--',i)){const end=input.indexOf('-->',i+4);if(end<0)throw Error('Källan innehåller ogiltig XML.');i=end+3;continue;}
  if(input.startsWith('<![CDATA[',i)){const end=input.indexOf(']]>',i+9);if(end<0)throw Error('Källan innehåller ogiltig XML.');i=end+3;continue;}
  if(input.startsWith('<?',i)){const end=input.indexOf('?>',i+2);if(end<0)throw Error('Källan innehåller ogiltig XML.');i=end+2;continue;}
  if(/^<!DOCTYPE\b/i.test(input.slice(i,i+10))){
   if(root||doctype)throw Error('DOCTYPE måste stå före XML-innehållet och får bara anges en gång.');
   const start=i;let quote='',depth=0,closed=false;i+=9;
   for(;i<input.length;i++){const c=input[i];if(quote){if(c===quote)quote='';continue;}if(input.startsWith('<!--',i)){const end=input.indexOf('-->',i+4);if(end<0)throw Error('Källan innehåller ogiltig XML.');i=end+2;continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='[')depth++;else if(c===']'){depth--;if(depth<0)throw Error('Källan innehåller ogiltig DOCTYPE.');}else if(c==='>'&&depth===0){closed=true;break;}}
   if(!closed)throw Error('Källan innehåller en ofullständig DOCTYPE.');
   const declaration=input.slice(start,i+1),name=declaration.match(/^<!DOCTYPE\s+([\w:.-]+)/i)?.[1];if(!name)throw Error('Källan innehåller ogiltig DOCTYPE.');doctype=name;hasEntities=hasEntities||/<!ENTITY\b/i.test(declaration.replace(/<!--[\s\S]*?-->/g,''));output+=input.slice(cursor,start);cursor=i+1;i++;continue;
  }
  if(/^<!ENTITY\b/i.test(input.slice(i,i+9)))hasEntities=true;
  if(!root&&input[i]==='<'&&/[A-Za-z_]/.test(input[i+1]||''))root=input.slice(i+1).match(/^[\w:.-]+/)?.[0]||null;
  i++;
 }
 if(root?.toLowerCase()==='html'){
  const title=input.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]||'';
  if(/client challenge|just a moment|access denied|verify.*human/i.test(title))throw Error('Källans robotskydd skickar en HTML-skyddssida i stället för RSS (Client Challenge).');
  throw Error('Källan svarar med en vanlig HTML-webbsida i stället för RSS eller Atom.');
 }
 if(doctype&&root&&doctype!==root)throw Error('DOCTYPE stämmer inte med XML-dokumentets rotelement.');
 if(hasEntities)throw Error('DOCTYPE tillåts, men egna entitetsdefinitioner stöds inte. Externa DTD-filer hämtas inte.');
 return output+input.slice(cursor);
}
