# GreekPhraseApp

Use the existing checkout. The deliverable is an installable Android APK; read README.md, SPEC.md, docs/ANDROID.md and docs/VALIDATION.md.

Preserve reviewed phrase IDs, personal facts and progress compatibility. Original uploaded exam PDFs and full MP3s are analysis-only: never include them in Git, public assets or APK. Run the existing media guards; only the reviewed crops and two approved audio excerpts belong in the app.

## Android signing

Read docs/SIGNING.md before building or publishing an APK. From 0.4.0 the signing certificate is pinned in android/signing-certificate.json. The user allowed a one-time reinstall from 0.3.1 after its key was lost; this does not authorize future signing changes or progress loss.

- Run npm run android:key:check before building. Use npm run android:build, which verifies the key and APK certificate.
- If the private key is missing, restore it from the private backup or decrypt android/signing-key.backup.json with the separately stored recovery file. Never generate a substitute or edit the pinned fingerprint to bypass a failure.
- Private key: /workspace/android-tools/signing/frasi.keystore, or FRASI_ANDROID_KEYSTORE. Keep it outside Git with mode 0600. Never print key bytes, the recovery passphrase or private archive contents.
- A filesystem snapshot is only durable after the user publishes the prepared environment. Saving draft instructions alone is not proof of publication or restoration. Keep the encrypted backup in Git and provide a separate private recovery backup to the user.

Run npm test, npm run format:check and relevant Playwright checks. Record native runtime checks honestly; browser success does not prove device microphone, file picker or installation behavior.
