# Publishing on Google Play — step by step

Everything below is ready except the items marked **You**.

## 0. Before you start (You)
- Personal Play developer account created and identity verified.
- ✅ Privacy policy is live at **https://farmers-choice-privacy.vercel.app**
  (Vercel project `farmers-choice-privacy`, team `nanis-projects-377b5c6b`) and
  linked from the app (Profile → About). To change it: edit
  `docs/privacy-policy.md`, run `python3 tools/privacy-html.py`, copy
  `docs/privacy-policy.html` to an empty folder named `farmers-choice-privacy`
  as `index.html`, and run there:
  `vercel deploy --prod --yes --scope nanis-projects-377b5c6b`.
- 12 testers' Gmail addresses (personal accounts must run a closed test with
  12+ testers opted in for 14 days before production).
- Production API deployed (PR #1 merged, `OPENWEATHER_KEY` set on Render).

## 1. Create the upload key (You, once)
Run this and choose a strong password when it asks. **Back up the `.jks` file and
the password** (password manager + a copy off this Mac). With Play App Signing,
a lost upload key can be reset through Google support, but it takes days.

```bash
mkdir -p ~/keys && keytool -genkeypair -v -keystore ~/keys/farmers-choice-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Then add these four lines to `~/.gradle/gradle.properties` (create the file if
needed) — this file is outside the repo, so the password never gets committed:

```
FC_UPLOAD_STORE_FILE=/Users/apple/keys/farmers-choice-upload.jks
FC_UPLOAD_STORE_PASSWORD=your-password
FC_UPLOAD_KEY_ALIAS=upload
FC_UPLOAD_KEY_PASSWORD=your-password
```

## 2. Build the bundle (Claude can do this once step 1 is done)
```bash
cd apps/mobile && CI=1 npx expo prebuild --platform android --no-install && npm run build:aab
```
Output: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`.
The build refuses to run without the upload key, so a debug-signed bundle can't
be uploaded by mistake. Every upload needs a higher `versionCode` in
`apps/mobile/app.json`.

## 3. Create the app in Play Console
**All apps → Create app**
- App name: Farmer's Choice · Default language: English (India) — add Telugu
  (te-IN) as a translation for the listing.
- App or game: **App** · Free or paid: **Free**
- Accept the declarations.

## 4. App content (Policy → App content)
| Section | Answer |
|---|---|
| Privacy policy | https://farmers-choice-privacy.vercel.app |
| App access | All functionality is available without special access (no login) |
| Ads | **Yes, my app contains ads** |
| Content rating | Fill the questionnaire: category **Reference, News, or Educational** (or "All other app types"); answer **No** to violence, sexual content, drugs, gambling, user-generated content and sharing location with other users. Expected rating: Everyone / 3+ |
| Target audience | **18 and over** (also fine: 13+). Not designed for children |
| News app | No |
| Government apps | **No** — it is not an official government app (the listing and the About screen say it is not affiliated) |
| Financial features | None |
| Health | None |
| Data safety | See the table below |

### Data safety answers
**Does your app collect or share any of the required user data types?** Yes.
**Is all collected data encrypted in transit?** Yes (HTTPS only).
**Do you provide a way for users to request deletion?** Nothing is stored on our
server; say users can uninstall to delete on-device data and contact you by email.

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Location → **Approximate location** | Yes | Yes (OpenWeather via our server, Open-Meteo, Google place names) | App functionality | Yes, users can deny location |
| Device or other IDs (advertising ID) | Yes — by AdMob SDK | Yes — Google | Advertising or marketing, Fraud prevention | No |
| App activity → App interactions | Yes — by AdMob SDK | Yes — Google | Advertising, Analytics, Fraud prevention | No |
| App info and performance → Diagnostics | Yes — by AdMob SDK | Yes — Google | Advertising, Fraud prevention | No |

Not collected: name, email, phone, precise location (land-measurement GPS stays
on the phone), photos, files, contacts, messages, financial info.
Check Google's current list for the Mobile Ads SDK before submitting:
https://developers.google.com/admob/android/privacy/play-data-disclosure

## 5. Store listing (Grow → Store presence → Main store listing)
Copy from `docs/play-store-listing.md`; upload `docs/store/icon-512.png`,
`docs/store/feature-graphic.png` and the screenshots in `docs/store/screenshots/`.
Category: **Productivity** (or Tools). Contact email: vanaisolution@gmail.com.

## 6. Closed testing (Test and release → Testing → Closed testing)
1. Create a track (e.g. "Pilot"), add testers by email list (12+).
2. Create a release, upload the `.aab`, accept **Play App Signing**.
3. Send testers the opt-in link. Each must open it, tap "Become a tester",
   then install from Play. Phones with the old sideloaded APK must uninstall it
   first (different signing key).
4. Keep 12+ testers opted in for 14 days in a row, then apply for production
   access from the Dashboard.

## 7. After it's live
- AdMob → Apps → link the app to its Play listing; add `app-ads.txt` to your
  website (AdMob shows the exact line).
- Watch Play Console → Android vitals for crashes.
