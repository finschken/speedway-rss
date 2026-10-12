# Automatisk RSS för Svensk Speedway

För `finschken/speedway-rss` och Firebase-projektet `speedway-6c7b7`.

GitHub Actions hämtar och publicerar nyheter på minuterna **17 och 47 varje timme**. Det fungerar även när administratören är utloggad och datorn är avstängd. Webbplatsen och databasen ligger kvar på Firebase Spark. Ingen Blaze-plan eller privat service account-nyckel behövs.

## Första installationen

Följ stegen nedan i ordning. Jobbet blir inte aktivt förrän koden finns på repositoryts standardbranch, importkontot fått behörighet, GitHub Secrets lagts in och Firestore-reglerna publicerats.

### 1. Lägg filerna i GitHub

Repositoryts rot ska innehålla `.github/workflows/rss.yml`, `package.json`, `package-lock.json`, `src`, `test`, `setup` och denna README. Ladda inte upp en ZIP-fil som enda fil: GitHub kör inte filerna inuti ZIP:en.

Du kan använda GitHub Upload files för src/test/setup/package-filerna. Skapa workflowfilen via **Add file → Create new file**, med exakt sökväg `.github/workflows/rss.yml`, och klistra in innehållet från paketet. Commit till standardbranchen (normalt main). Behåll repositoryt publikt för kostnadsfria standardkörningar.

Alternativt, använd git i Cloud Shell: klona repositoryt, kopiera in de uppackade filerna, commit och push. GitHub-inloggning krävs för push. En GitHub-anslutning i ChatGPT kan användas för att lägga in koden åt dig när den är ansluten; länken ensam ger inte skrivåtkomst.

### 2. Skapa ett separat importkonto i Firebase

I Firebase Console → Authentication → Users → Add user:

- Skapa ett nytt e-post-/lösenordskonto för RSS-jobbet. Använd en annan användare än ditt vanliga adminkonto.
- Välj ett långt unikt lösenord.
- Kopiera importkontots UID.

Email/Password ska redan vara aktiverat, som för admininloggningen. Lösenordet ska inte läggas i någon fil, i repositoryt eller i ChatGPT.

### 3. Ge endast RSS-behörighet

Importkontot ska få custom claim `rssImporter: true`, inte `admin: true`.

I Cloud Shell använder du samma betrodda miljö som vid tidigare admin-setup. Exempel om repositoryt är uppackat/klonat till `~/speedway-rss`:

```bash
mkdir -p ~/speedway-admin-tools
cd ~/speedway-admin-tools
npm install firebase-admin
cp ~/speedway-rss/setup/grant-importer.cjs ./grant-importer.cjs
node grant-importer.cjs IMPORTKONTOTS_UID
```

Ersätt IMPORTKONTOTS_UID med det nya kontots UID. Skriptet använder Application Default Credentials i Cloud Shell. Det lägger inte till privata nyckelfiler. Om din Cloud Shell saknar behörighet, stoppa där och felsök IAM/inloggning; gör inte databasen öppet skrivbar.

### 4. Uppdatera webbplatsens regler och admininformation

I Firebase-uppdateringspaketet följer `firestore.rules`, `public/app.js` och `public/style.css` med. Reglerna lägger till en separat roll som endast får skapa RSS-artiklar samt läsa/skriva RSS-källstatus. Den får inte ändra portaldata, förare, klubbar eller delade lag, och inte skriva över befintliga RSS-artiklar.

Behåll din firebase-config.js och integrera reglerna med eventuell annan data. Publicera från `~/Speedway`:

```bash
firebase deploy --only hosting,firestore:rules --project speedway-6c7b7
```

Inga Functions publiceras. Den nya adminrutan länkar till GitHub Actions och visar om en GitHub-hämtning faktiskt registrerats.

### 5. Lägg in GitHub Secrets

Öppna:
https://github.com/finschken/speedway-rss/settings/secrets/actions

Välj **New repository secret** och lägg in exakt:

| Namn | Värde |
| --- | --- |
| RSS_IMPORT_EMAIL | Importkontots e-postadress |
| RSS_IMPORT_PASSWORD | Importkontots lösenord |

Endast e-post och lösenord behövs. Den offentliga Firebase-webbkonfigurationen ligger redan i src/firebase-config.js. Ingen service account JSON behövs.

### 6. Testa manuellt innan du litar på schemat

- Spara minst en aktiv, fungerande RSS-källa i portalens admin med till exempel sökordet speedway.
- Gå till https://github.com/finschken/speedway-rss/actions .
- Välj Hämta speedwaynyheter → Run workflow → Run workflow.
- Öppna körningen. Kontrollera att steget Hämta och publicera nyheter är grönt och vilka källor som hämtades.
- Ladda om portalens Nyheter. Nya matchande artiklar ska visas direkt från Firestore utan hostingpublicering.
- Kör jobbet igen. Samma artikellänkar ska inte ge nya dokument.
- Stäng admin. Nästa schemakörning ska ändå registreras på GitHub och i källstatus.

Stäng gärna av extra webbläsarautomatiken i admin när GitHub-jobbet fungerar. Manuell Förhandsgranska/Hämta i admin finns kvar som alternativ. Båda importvägarna använder samma artikel-ID och skriver inte över befintliga artiklar.

## Hur det fungerar

Jobbet loggar in som det begränsade importkontot, läser `portal/content.feeds`, hoppar över pausade källor och hämtar aktiva flöden direkt från källan. Det använder inga gratis CORS-reläer: de behövs bara i webbläsaren.

RSS/Atom parsas med sökordsfilter och automatisk kategorisering. Artikel-ID är SHA-256 av normaliserad originallänk, samma som i webbappen. Firestore-transaktioner gör skapandet atomiskt. En artikel som redan finns skrivs aldrig över. ETag/Last-Modified och ett innehållsdigest undviker upprepad behandling av oförändrade flöden.

Nyheterna publiceras direkt, utan granskningskö. De är märkta RSS · AUTO och Ej redaktionellt verifierad. Rykten får inte status bekräftad.

## Begränsningar

- Max 12 aktiva källor. Upp till 500 poster läses per flöde; de senaste 60 matchande behandlas per körning.
- Bara rubrik, kort sammanfattning (280 tecken), källa, datum, kategori och originallänk sparas. Inga fulla artiklar eller bilder hämtas.
- Källan måste vara publik och åtkomlig. Privat nät, metadataadresser, URL-lösenord och privata token-parametrar tillåts inte. Max 2 MB, begränsad tid och omdirigeringar.
- Firebase Spark-kvoter gäller fortfarande. Oförändrade flöden hoppas över för att minska läsningar. Kvotfel stoppar importen och aktiverar inte betalning.
- GitHub kan fördröja eller hoppa över schemakörningar vid hög belastning. I publika repositoryn kan schemat stängas av efter 60 dagar utan repositoryaktivitet. Kontrollera Actions ibland och aktivera det igen vid behov.
- Standardkörningar i publika repositoryn är kostnadsfria enligt GitHubs dokumentation. Privata repositoryn har begränsad inkluderad användning. Inga betalaktiveringar görs av denna kod.

## Felsökning

- Secrets saknas: lägg in exakt RSS_IMPORT_EMAIL och RSS_IMPORT_PASSWORD.
- auth/invalid-credential: kontrollera kontots e-post/lösenord och att Email/Password är aktiverat.
- rssImporter-behörighet saknas: kör grant-importer.cjs på importkontots UID.
- permission-denied: publicera de uppdaterade Firestore-reglerna. Ge aldrig importkontot generell adminbehörighet för att kringgå detta.
- HTTP/timeout: källan är blockerad eller felaktig. Jobbet försöker de andra källorna och markerar körningen som misslyckad om något källfel kvarstår, så att felet syns.
- 0 aktiva källor: spara källorna i portalens admin, inte lokalt i demoläge.
- Schemat syns inte: workflowfilen måste finnas på standardbranchen och GitHub Actions måste vara aktiverat.

## Tester och leveransstatus

```bash
npm ci
npm test
```

18 tester passerar för parser, säker hämtning, filtrering, kategorier, dubbletter, pauser, 304/oförändrat flöde, ändrade sökord, felstatus och mängdgräns. Skrivbehörighet och verkliga Firebase-/GitHub-körningar behöver testas efter aktivering. Inga Firebase-lösenord har lagrats i denna leverans. Jobbet har inte körts mot din databas i byggmiljön.

Officiella källor:
https://docs.github.com/en/billing/concepts/product-billing/github-actions
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
https://firebase.google.com/docs/auth/admin/custom-claims
https://firebase.google.com/docs/firestore/security/rules-conditions
