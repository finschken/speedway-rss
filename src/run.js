import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {getFirestore,doc,getDoc,runTransaction,setDoc,serverTimestamp,terminate} from 'firebase/firestore';
import {firebaseConfig} from './firebase-config.js';
import {fetchText} from './http.js';
import {importConfiguredFeeds} from './importer.js';
const email=process.env.RSS_IMPORT_EMAIL,password=process.env.RSS_IMPORT_PASSWORD;
if(!email||!password){console.error('Lägg till RSS_IMPORT_EMAIL och RSS_IMPORT_PASSWORD som GitHub Actions Secrets.');process.exitCode=1;}
else {
 const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
 try{
  const signed=await signInWithEmailAndPassword(auth,email,password),token=await signed.user.getIdTokenResult(true);
  if(token.claims.rssImporter!==true)throw new Error('Importkontot saknar custom claim rssImporter: true.');
  const portal=await getDoc(doc(db,'portal','content')),feeds=portal.data()?.feeds||[];
  const store={
   getStatus:async id=>(await getDoc(doc(db,'rssFeedStatus',id))).data(),
   saveStatus:async(id,status)=>setDoc(doc(db,'rssFeedStatus',id),status,{merge:true}),
   createArticle:async item=>runTransaction(db,async transaction=>{const ref=doc(db,'rssArticles',item.id),existing=await transaction.get(ref);if(existing.exists())return false;transaction.set(ref,{...item,createdAt:serverTimestamp()});return true;})
  };
  const result=await importConfiguredFeeds({feeds,fetchText,store});
  for(const r of result.results){let host;try{host=new URL(r.url).hostname;}catch{host='Ogiltig källa';}console.log(host+': '+(r.error?'FEL – '+r.error:r.unchanged?'Oförändrat flöde':r.added+' nya, '+r.duplicates+' dubbletter, '+r.matched+' matchningar'));}
  console.log('Totalt: '+result.added+' nya artiklar från '+result.results.length+' aktiva källor.');
  if(result.errors)process.exitCode=1;
 }catch(error){console.error('RSS-importen misslyckades: '+(error.code||error.message));process.exitCode=1;}
 finally{await signOut(auth).catch(()=>{});await terminate(db).catch(()=>{});await deleteApp(app).catch(()=>{});}
}
