// Kör i en betrodd Cloud Shell-miljö med Firebase Admin SDK installerad.
// Sätt bara det dedikerade importkontot, inte ditt vanliga adminkonto.
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const uid=process.argv[2];
if(!uid){console.error('Användning: node grant-importer.cjs IMPORTKONTOTS_UID');process.exit(1);}
initializeApp({credential:applicationDefault(),projectId:'speedway-6c7b7'});
(async()=>{const user=await getAuth().getUser(uid);if(user.customClaims?.admin===true)throw new Error('Detta konto är admin. Skapa ett separat importkonto.');await getAuth().setCustomUserClaims(uid,{...user.customClaims,rssImporter:true});console.log('Begränsad RSS-importbehörighet tillagd.');})().catch(error=>{console.error(error.message);process.exitCode=1;});
