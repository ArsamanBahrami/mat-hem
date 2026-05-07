# Mat-hem — instruktioner för Claude Code

## Projekt
Mat-hem är en mobil-first PWA för familjen Bahrami att hantera recept, veckomenyer och inköpslistor.
Stack: React + Vite + Tailwind CSS + Supabase + Netlify.

## Allmänna regler
- Allt UI och alla texter ska vara på svenska
- Mobilfirst — max-width 430px, testa alltid på mobilbredd
- Kör alltid `npm run build` efter ändringar för att verifiera att bygget är rent
- Committa och pusha till GitHub efter varje godkänd fas eller fix — Netlify deployer automatiskt
- Fråga inte om tillstånd för: npm-kommandon, filredigering, git add/commit/push, Supabase SQL-körningar via API

## Supabase
- Project URL: https://ovnvvelxvdwzhijhimba.supabase.co
- Tabeller: households, profiles, recipes (fas 2), weekly_menus (fas 4), shopping_lists (fas 5)
- RLS är aktiverat — använd alltid SECURITY DEFINER-funktioner för operationer som kräver elevated access
- Kör aldrig DROP TABLE eller DELETE utan explicit instruktion

## Kod
- Supabase-klienten är en singleton i src/lib/supabase.js — skapa aldrig nya instanser
- Använd alltid supabase.rpc() för känsliga databasoperationer
- Komponenter ligger i src/components/, sidor i src/pages/
- Tailwind för all styling — inga inline styles eller CSS-filer

## Deploy
- GitHub repo: https://github.com/ArsamanBahrami/mat-hem
- Netlify site: https://mat-hem.netlify.app
- Auto-deploy från main-branchen är aktiverat
- Miljövariabler sätts i Netlify dashboard — lägg aldrig API-nycklar i kod eller .env som committas

## Fas-status
- Fas 1 ✅ Grund, auth, PWA, routing
- Fas 2 ✅ Receptbank med manuell inmatning
- Fas 3 ⏳ AI-bildtolkning (nästa)
- Fas 4 ✅ Menygenerator
- Fas 5 ✅ Inköpslista
- Fas 6 ⌛ PWA-polish
