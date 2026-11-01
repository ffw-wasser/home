# App Review notes – prepared text, not yet ready to submit

H2O Portal is a membership app for the Wasser division of the Emmendingen volunteer fire brigade. Access is provisioned by the local administrators following an identity check. Installing the app does not create an entitlement to access member data.

Member features include appointments and attendance responses, personal evidence expiry dates, a personal beverage ledger, training material and authorised contacts. The companion WidgetKit extension shows only the next personally available event and response status. It receives no account credentials. The app also integrates native PDF presentation and optional native notifications. It is not an emergency dispatch or public emergency reporting service.

The app is intended for unlisted App Store distribution to this limited audience. We will submit the separate unlisted distribution request. The app still enforces individual membership authentication for anyone who obtains the installation link.

Build 1021 adds an integrated demonstration using the same member interface and an isolated ephemeral WebKit store. In build 1023 or later, open “Brauchst du Hilfe?” on the membership login screen and tap “Apple-Prüfdemo öffnen”, then confirm the switch. The review entry is not displayed after member sign-in. No invitation, real member account or private hardware is needed. The demo starts signed in as Alex Beispiel (Demo). For password confirmation, use “demo”; after signing out, the synthetic username and password are both “demo”. These values grant no access to any production service.

The demo supports appointments and responses, evidence dates and self-reported updates, the beverage ledger and synthetic bookings, training, public PDF regulations, contacts, the annual plan and sample theatre orders. “Demo zurücksetzen” restores its initial data. To test deletion: More → Account & Security → Account → Delete portal account, enter the demo password and confirm. Only synthetic local state changes. “Demo verlassen · Mitgliederanmeldung” returns to the normal membership login using a separate WebKit store.

No real PayPal payment, push registration, reminder delivery or calendar subscription is performed in demo mode. Public regulations are loaded from the app's existing public assets. The isolated historical calendar-only Worker is no longer the required review entry.

Before submission, complete the secure App Review account fields and verify:

- All relevant member features are accessible to the reviewer without private hardware or a real member account.
- Any restrictions and role-dependent features are explained accurately.
- Account deletion: More → Account & Security → Account → Delete portal account. The member confirms the action and authenticates again. Portal credentials, sessions, push registrations, calendar subscription and attendance responses are removed in one server transaction. Independently administered membership, evidence records, documents, orders and the beverage ledger remain. The retention purposes and legal basis still need confirmation; do not describe all remaining data as legally required without that confirmation.
- The privacy policy and support URLs are public and functional.
- The final version has been tested on the actual devices and OS versions listed in the submission.

The integrated demo must pass its browser and iOS CI checks and be verified in the final signed build before these notes are submitted. App Store Connect is currently signed out; these revised notes have not been saved there.
