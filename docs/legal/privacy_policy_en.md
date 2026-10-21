# Privacy Policy

**Detective Solitaire: World Case Files**

Effective date: October 21, 2026

---

This Privacy Policy is provided by 마이브 (Maibeu) ("22FAM Studio," "we," "us," or "our"). It explains how we handle personal information when you ("you" or "the user") play our mobile game **Detective Solitaire: World Case Files** (the "Game").

It covers what information the Game processes and why, how long it is kept, who processes it on our behalf, and what rights you have.

> **At a glance**
>
> - There is no sign-up or login screen. The first time you open the Game, an **anonymous user ID** is created automatically so we can tell players apart.
> - Your game progress (gold, items, case progress, settings, nickname, etc.) is stored **on your device**. If you use cloud save, it is also stored in **your own Google Play Games storage**. We do not keep your progress on a separate game server.
> - We do not ask for your real name, phone number, address, or date of birth.
> - We do not sell your personal information.
> - You can delete your account at any time in **Settings → [Manage] → [Delete account]**.

---

## 1. Information We Process and How We Collect It

### 1-1. Identifying players (Google Firebase Authentication)

| Type | Information | When / how |
| --- | --- | --- |
| Required | Anonymous user ID (Firebase UID) | Created automatically when you first open the Game |
| Optional | Email address, name (display name), profile photo URL, and Google account identifier of the Google account you link | Only if you tap **Settings → [Manage] → [Link Google account]** |
| Automatic | Device and connection information processed by Google during authentication (IP address, app information, etc.) | Processed by Google Firebase when an authentication request is made |

### 1-2. Cloud save (Google Play Games Services)

| Type | Information | When / how |
| --- | --- | --- |
| Optional | Google Play Games profile (player ID, gamer name) | If you sign in to Play Games |
| Optional | Saved game data (progress, currency and items, settings, nickname, save time) | If you use cloud save. Uploaded to your Play Games storage when the app goes to the background, at regular intervals, or when you tap [Save now] |

### 1-3. Downloading game content (CDN)

| Type | Information | When / how |
| --- | --- | --- |
| Automatic | IP address, request time, device and app information (User-Agent) | Processed as server access records when the Game downloads artwork and sound files from Google Cloud Storage on first launch or after an update |

### 1-4. Customer support (email)

| Type | Information | When / how |
| --- | --- | --- |
| Optional | Your email address, message, and any attachments you add (screenshots, etc.) | When you email us through **Settings → [Contact Us]** |
| Optional | Game nickname, user ID, device information (device, OS, and browser engine), app version | Filled in automatically in the email body when you tap [Contact Us]. You can review or delete it before sending |

### 1-5. Advertising

| Type | Information | When / how |
| --- | --- | --- |
| Automatic | Advertising ID (Android Advertising ID), IP address, device and OS information, ad impressions, clicks and views in the Game, approximate location (based on IP) | Collected by the ad SDK (Google AdMob) when ads (rewarded ads, interstitial ads, etc.) are shown in the Game |

### 1-6. In-app purchases

| Type | Information | When / how |
| --- | --- | --- |
| Automatic | Order number, purchased item, purchase time, payment status, purchase token, price, currency, and store country | When you buy an item through Google Play |
| Automatic | User ID (identifier used to verify purchases), device, OS and app version, IP address | When the Game communicates with our purchase management service (RevenueCat) to verify or restore purchases |

Your payment details (card number, etc.) are **processed directly by Google Play**. We never receive them.

### 1-7. Information stored only on your device (not sent to us)

- Game progress data (gold, items, level, win streak, case and stage records, purchase history), nickname, sound and language settings
- Stored in the app's private storage (`save_data.json`) and the app's internal storage (localStorage)
- Where Firebase is not available, a random identifier generated on the device

This information is not sent to our servers. It is deleted when you uninstall the Game or clear the app's data (**App info → Storage → Clear data**). If you use cloud save, a copy is also kept in your own Play Games storage, as described in 1-2.

### 1-8. Information we do not process

The Game does not collect:

- Real name, phone number, postal address, date of birth, or government identification numbers
- Contacts, photos, precise location (GPS), camera, or microphone
- Sensitive information (such as health or political views)

The only device permissions the Game requests are **internet access, network state, Google Play billing, and the advertising ID and ad measurement (Android ad services)**, plus background-task permissions used by the ad SDK. None of these require you to grant access. The Game currently does not use separate behavioral analytics or crash-reporting tools.

---

## 2. Why We Process Personal Information

We process personal information only for the purposes below. If a purpose changes, we will tell you in advance and ask for consent where required.

1. **Identifying players and managing accounts**: creating user IDs; linking, switching, signing out of, and deleting Google accounts
2. **Providing the Game**: saving and loading progress, restoring progress on another device or after reinstalling (cloud save), downloading game artwork and sounds
3. **Providing paid items**: verifying purchases, delivering items, handling refunds and payment inquiries
4. **Advertising**: showing ads, granting rewards for rewarded ads, limiting ad frequency, preventing fraud, and (with your consent) personalized ads
5. **Customer support**: reviewing inquiries, investigating errors, and replying
6. **Safe operation**: preventing abuse and tampering with save data, keeping the service stable, and meeting legal obligations

---

## 3. How Long We Keep Information

| Information | Retention period |
| --- | --- |
| Anonymous user ID and linked Google account information | **Until you delete your account** (deleted without delay on request) |
| Game data stored on your device | Until you uninstall the Game or clear its data (we do not keep it) |
| Play Games cloud save data | Until you delete it in Google Play Games (stored in your own Google account) |
| Customer support records | **3 years** after the inquiry is resolved (Korean Act on Consumer Protection in Electronic Commerce: records of consumer complaints and disputes) |
| Payment and purchase records | **5 years** (same Act: records of payments and supply of goods) |
| CDN access records | According to Google Cloud's default retention (we do not keep them unless we separately enable access logging) |
| Advertising information | According to Google AdMob's policies |

Information that must be kept by law is stored separately for the required period and used for no other purpose.

---

## 4. Sharing with Third Parties

We **do not provide or sell** your personal information to third parties.

The only exceptions are:

- When you have agreed in advance
- When required by law, or when law enforcement requests it following procedures set by law

---

## 5. Service Providers and International Transfers

We use the service providers below to run the Game. Their servers are located outside Korea, so when you open the Game or use these features, your personal information is **transferred abroad over the network**.

| Recipient | Country | Purpose | Information transferred | Retention |
| --- | --- | --- | --- | --- |
| Google LLC — Firebase Authentication | United States and other countries where Google has data centers | Identifying players, linking and authenticating Google accounts | User ID; if linked, Google account email, name, and profile photo URL; IP address; device information | Until account deletion |
| Google LLC — Google Play Games Services | United States, etc. | Sign-in, cloud save | Player ID, gamer name, saved game data | Until you delete it |
| Google LLC — Google Cloud Storage | United States (us-west1, Oregon) | Delivering game artwork and sound files (CDN) | IP address, request time, device and app information | According to Google Cloud's policies |
| Google LLC — Google AdMob | United States, etc. | Showing and measuring ads, verifying rewarded-ad rewards | Advertising ID, IP address, device information, ad interaction records | According to Google's policies |
| Google LLC — Google Play billing | United States, etc. | Processing in-app payments, verifying purchases | Order number, item and time of purchase, purchase token | According to applicable law and Google's policies |
| RevenueCat, Inc. (<https://www.revenuecat.com>, privacy@revenuecat.com) | United States | Server-side receipt validation, managing purchase history, restoring purchases | User ID; order number; item, time, price, and currency of purchase; purchase token; device, OS, and app version; IP address | For the retention period of payment records (5 years), then deleted |

- **When and how**: transferred over the network each time you use the relevant feature
- **Google contact**: <https://support.google.com/policies>. Privacy inquiries: <https://support.google.com/policies/contact/general_privacy_form>
- **Google Privacy Policy**: <https://policies.google.com/privacy>
- **How Google uses data as an advertising partner**: <https://policies.google.com/technologies/partner-sites>

**If you do not want your information transferred abroad**

- Linking a Google account and signing in to Play Games or using cloud save are optional. If you do not use them, that information is not transferred.
- You can opt out of personalized ads as described in Section 6.
- However, player identification (anonymous user ID), downloading game content, and showing ads are needed to provide the Game. If you do not want these, you may not be able to use the Game.

We manage our service providers through their contracts and terms of service so that personal information is handled securely. If our providers change, we will update this policy.

---

## 6. Advertising and Advertising IDs

The Game is free to play. It may show **rewarded ads** for some features (refilling Hearts, key hints, extra cards, etc.) and **interstitial ads** on some screens. Ads are provided by Google AdMob, which processes advertising IDs and other information to show ads and measure their performance.

**How to opt out of personalized ads**

- **Android**: Settings → Google → Ads (or Privacy → Ads) → **Delete advertising ID** or turn off **ad personalization**.
- After you delete your advertising ID or opt out, you may still see ads, but they will not be based on your interests.
- For users in regions where consent is legally required (such as the European Economic Area, the UK, and Switzerland), we show Google's consent screen when the Game starts to ask about personalized ads, and you can change your choice later in settings.

If you buy a **Remove Ads** item, interstitial and banner ads will no longer be shown. Rewarded ads, which you choose to watch, remain available.

---

## 7. In-App Purchases

Paid items are sold through the **Google Play billing system**.

- Payment information (card numbers, bank accounts, etc.) is processed by Google. We cannot see it.
- To deliver items and handle refunds, we check only the order number, item, purchase time, and purchase token.
- Our purchase management service, **RevenueCat**, checks each purchase directly with Google Play (server-side receipt validation). Items are delivered only for purchases that pass this check.
- **Restoring purchases**: One-time items such as Remove Ads can be restored on the same Google account with **[Restore purchases]** at the bottom of the shop or in Settings → [Manage]. Consumable rewards that came with them, such as gold, are not granted again.
- Refunds follow Google Play's refund policy. You can request one through Google Play or by contacting us.

---

## 8. How We Delete Information

- **Process**: Information whose retention period has ended, or whose purpose has been fulfilled, is deleted without delay. Information that must be kept by law is stored separately and deleted when that period ends.
- **Method**: Electronic files are deleted in a way that cannot be recovered. Paper documents are shredded or incinerated.
- **When you delete your account**: Tapping [Delete account] in the Game permanently deletes your user ID and linked Google account information stored in Firebase. Game data stored on your device can be removed by clearing the app's data or uninstalling the Game.

---

## 9. Your Rights and How to Exercise Them

You can ask at any time to **access, correct, delete, or stop the processing of** your personal information, or **withdraw your consent**.

| What you want to do | How |
| --- | --- |
| Delete your account (user ID and linked Google information) | In the Game: **Settings → [Manage] → [Delete account]** |
| Unlink your Google account | **Settings → [Manage] → [Sign out]** (you get a new guest user ID) |
| Delete game data stored on your device | Uninstall the Game, or go to your phone's **Settings → Apps → Detective Solitaire → Storage → Clear data** |
| Delete cloud save data | Delete it in the Google Play Games app or in your Google Account settings (Data & privacy → app data) |
| Opt out of personalized ads | See Section 6 |
| Any other request to access, correct, delete, or stop processing | Email us at the address in Section 11. We will handle it **within 10 days** after verifying your identity |

- You can ask us by email to delete your account and data even if you can no longer access the Game. Please include your **user ID**, shown in Settings → [Manage].
- You may also exercise your rights through a legal guardian or an authorized agent. We may ask for proof of authority, such as a power of attorney.
- Information that other laws require us to keep cannot be deleted on request.

---

## 10. Children's Privacy

The Game is not primarily directed at children.

- We do not knowingly collect personal information from children under 14 in Korea, under 13 in the United States, or under the age set by local law in other countries.
- A child under 14 needs a parent's or legal guardian's consent to use features that process personal information, such as linking a Google account.
- If we learn that we have collected a child's personal information without parental consent, we will delete it immediately. Parents and guardians can contact us to access or delete it.

---

## 11. Privacy Officer and Contact

For privacy questions, complaints, or remedies, please contact us. We will respond and act without delay, usually within 3 to 10 business days.

| | |
| --- | --- |
| Company | 마이브 (Maibeu), operating as 22FAM Studio |
| Privacy Officer | [Name] / [Title] |
| Email | dong2kids@gmail.com |
| In the Game | Settings → [Contact Us] |

---

## 12. Remedies in Korea

If you need advice or dispute resolution regarding a privacy violation, you can contact the following Korean authorities:

- Personal Information Dispute Mediation Committee: 1833-6972 (in Korea) · <https://www.kopico.go.kr>
- Personal Information Infringement Report Center (KISA): 118 (in Korea) · <https://privacy.kisa.or.kr>
- Supreme Prosecutors' Office, Cyber Investigation Division: 1301 (in Korea) · <https://www.spo.go.kr>
- Korean National Police Agency, Cyber Bureau: 182 (in Korea) · <https://ecrm.police.go.kr>

---

## 13. How We Keep Information Secure

We take the following measures to protect personal information:

- **Minimal collection**: We process only what is needed to play the Game and never ask for your real name or contact details.
- **Encrypted transmission**: Authentication, cloud save, content downloads, payments, and ad communications use encrypted connections (HTTPS/TLS).
- **Restricted access**: We keep access to admin consoles such as Firebase to a minimum and use two-step verification.
- **Protected save data**: Game save files on your device are kept in the app's private storage, which other apps cannot read, and are checked for tampering.
- **Trusted providers**: We use Google services that hold international security certifications.

---

## 14. Cookies and Similar Technologies

- The Game does not use web cookies.
- Game progress and settings are stored in the app's private storage on your device (see 1-7).
- The ad SDK uses advertising IDs. See Section 6 for how to opt out.

---

## 15. Additional Information by Region

**Users in the European Economic Area (EEA) and the UK**

- **Legal bases**: performance of a contract (providing the Game, delivering purchased items), legitimate interests (security, fraud prevention, improving the service), consent (personalized ads), and legal obligations (keeping payment records).
- **Your rights**: access, rectification, erasure, restriction, portability, objection, and withdrawal of consent. You may also lodge a complaint with the supervisory authority in your country.
- **Transfers**: Transfers outside the EEA (such as to the United States) rely on appropriate safeguards adopted by Google, such as the Standard Contractual Clauses (SCCs).

**Users in California and other U.S. states**

- We **do not sell** personal information and do not share it for money. You can opt out of processing for personalized ads as described in Section 6.
- You have the right to know the categories and specific pieces of personal information we have collected, and to request deletion or correction. You will not be discriminated against for exercising these rights.
- You can make requests by emailing the address in Section 11.

**Users in Japan**

- We handle personal information in accordance with Japan's Act on the Protection of Personal Information (APPI). Entrustment to a third party in a foreign country (Google LLC, in the United States and elsewhere) is described in Section 5.
- You can ask us, by email at the address in Section 11, to notify you of the purposes of use of your retained personal data, or to disclose, correct, or stop using it.

---

## 16. Changes to This Policy

We may update this policy when laws, our practices, or the Game's features change.

- We will announce changes on this page and in the Game at least **7 days** before they take effect.
- For significant changes to your rights, such as new categories of information, new purposes, or sharing with third parties, we will give **30 days'** notice and ask for your consent again where required.

---

- Published: October 21, 2026
- Effective: October 21, 2026

If there is any inconsistency between this English version and the Korean version, the Korean version prevails.
