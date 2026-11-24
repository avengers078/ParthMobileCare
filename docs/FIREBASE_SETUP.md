# Firebase setup

The mobile app is configured for Firebase project `parthmobilecare-a474d`. Firebase Authentication uses Email/Password, and business records sync through Cloud Firestore. Face embeddings remain on-device.

## One-time Firebase Console setup

1. In **Authentication → Sign-in method**, enable **Email/Password**.
2. In **Authentication → Users**, create the first administrator account and note its UID.
3. Create a **Cloud Firestore** database in Native mode.
4. In the `users` collection, create a document whose document ID is the administrator's Auth UID. The document fields must include:

   ```json
   {
     "id": "<same Firebase Auth UID>",
     "name": "Administrator name",
     "email": "admin@example.com",
     "phone": "9876543210",
     "role": "admin",
     "designation": "Store Owner & Admin",
     "joinedDate": "2026-01-01",
     "basicSalary": 0,
     "monthlyTarget": 0,
     "isActive": true
   }
   ```

   Use the real account details and UID. Firestore rules use this profile to determine the account's role.
5. For each manager or staff member, create an Email/Password Auth user and a corresponding `users/<Auth UID>` profile with the same required fields and `role` set to `manager` or `staff`.
6. From this repository, install or use the Firebase CLI, authenticate with an account that can deploy rules, then run:

   ```powershell
   firebase login
   firebase deploy --only firestore:rules
   ```

   `firebase.json` and `.firebaserc` target this project's checked-in `firestore.rules`.

## Existing device data

After signing in, the app pulls cloud collections into its local cache. Existing local-only records are retained. The **Profile → Sync All to Cloud** action uploads local records; review the local data first because older app installs may still contain sample/demo records.

## Optional file storage

Firebase Storage is not required for sign-in, attendance, or ordinary Firestore records. The current app keeps face templates on-device. If photos or signatures should be uploaded to the cloud, enable Firebase Storage and add scoped Storage rules before wiring those upload calls into the relevant forms.
