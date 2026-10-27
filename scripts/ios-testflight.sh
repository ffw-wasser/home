#!/bin/bash
# Only called by the manually dispatched, main-branch TestFlight workflow.
set -euo pipefail
umask 077
signing_dir="${RUNNER_TEMP:?}/h2o-ios-signing"
keychain_path="$signing_dir/signing.keychain-db"
archive_path="${RUNNER_TEMP}/H2OPortal.xcarchive"
export_path="${RUNNER_TEMP}/h2o-ios-export"

# macOS may import a usable identity, then report an already-existing bag.
# Only that specific error is tolerated; the profile/key check still follows.
import_signing_item() {
  if security import "$@" > /dev/null 2> "$signing_dir/import-error.txt"; then
    return 0
  fi
  if grep -Fq 'The specified item already exists in the keychain.' "$signing_dir/import-error.txt"; then
    echo 'Bereits vorhandener Zertifikatseintrag; die passende Signaturidentität wird separat geprüft.'
    return 0
  fi
  cat "$signing_dir/import-error.txt" >&2
  return 1
}

case "${1:-}" in
  prepare)
    for name in BUILD_CERTIFICATE_BASE64 P12_PASSWORD BUILD_PROVISION_PROFILE_BASE64; do
      if [ -z "${!name:-}" ]; then
        echo "::error::GitHub-Secret $name fehlt oder ist leer."
        exit 1
      fi
    done
    mkdir -p "$signing_dir"
    printf '%s' "$BUILD_CERTIFICATE_BASE64" | base64 --decode > "$signing_dir/certificate.p12"
    printf '%s' "$BUILD_PROVISION_PROFILE_BASE64" | base64 --decode > "$signing_dir/profile.mobileprovision"
    keychain_password="$(openssl rand -hex 32)"
    echo "::add-mask::$keychain_password"
    security create-keychain -p "$keychain_password" "$keychain_path"
    security set-keychain-settings -lut 3600 "$keychain_path"
    security unlock-keychain -p "$keychain_password" "$keychain_path"
    echo 'Importiere das Distribution-Zertifikat mit privatem Schlüssel.'
    import_signing_item "$signing_dir/certificate.p12" -P "$P12_PASSWORD" -t cert -f pkcs12 \
      -T /usr/bin/codesign -T /usr/bin/security -k "$keychain_path"
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s \
      -k "$keychain_password" "$keychain_path" > /dev/null
    security list-keychains -d user -s "$keychain_path" "$HOME/Library/Keychains/login.keychain-db"
    # A Windows EndEntityCertOnly export does not include Apple's intermediate.
    curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
      https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer \
      --output "$signing_dir/wwdr.cer"
    echo 'Ergänze das Apple-WWDR-Zwischenzertifikat.'
    import_signing_item "$signing_dir/wwdr.cer" -k "$keychain_path"
    security find-identity -v -p codesigning "$keychain_path" > "$signing_dir/identities.txt"
    security cms -D -i "$signing_dir/profile.mobileprovision" > "$signing_dir/profile.plist"
    python3 scripts/ios-signing.py "$signing_dir"
    profile_uuid="$(cat "$signing_dir/profile-uuid.txt")"
    profile_dir="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
    mkdir -p "$profile_dir"
    cp "$signing_dir/profile.mobileprovision" "$profile_dir/$profile_uuid.mobileprovision"
    rm "$signing_dir/certificate.p12" "$signing_dir/identities.txt"
    ;;
  build)
    xcodebuild archive -project native/ios/H2OPortal.xcodeproj -scheme H2OPortal \
      -configuration Release -destination 'generic/platform=iOS' -archivePath "$archive_path" \
      DEVELOPMENT_TEAM=VKL57X3H6F CODE_SIGN_STYLE=Manual \
      CODE_SIGN_IDENTITY="${H2O_SIGN_IDENTITY:?}" \
      PROVISIONING_PROFILE_SPECIFIER="${H2O_PROFILE_UUID:?}" \
      CURRENT_PROJECT_VERSION="${H2O_IOS_BUILD:?}"
    xcodebuild -exportArchive -archivePath "$archive_path" \
      -exportOptionsPlist "$signing_dir/export.plist" -exportPath "$export_path"
    test -s "$export_path/H2OPortal.ipa"
    ;;
  upload)
    if [ "${GITHUB_EVENT_NAME:-}" != workflow_dispatch ] || [ "${GITHUB_REF:-}" != refs/heads/main ] || \
      [ "${H2O_UPLOAD_TESTFLIGHT:-}" != true ]; then
      echo '::error::TestFlight-Upload erfordert einen manuellen Start auf main mit aktivierter Upload-Option.'
      exit 1
    fi
    for name in APPSTORE_API_KEY_ID APPSTORE_ISSUER_ID APPSTORE_API_PRIVATE_KEY; do
      if [ -z "${!name:-}" ]; then
        echo "::error::GitHub-Secret $name fehlt oder ist leer."
        exit 1
      fi
    done
    [[ "$APPSTORE_API_KEY_ID" =~ ^[A-Za-z0-9]{10}$ ]] || { echo 'Ungültige Key ID.'; exit 1; }
    [[ "$APPSTORE_ISSUER_ID" =~ ^[0-9A-Fa-f]{8}(-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}$ ]] || \
      { echo 'Ungültige Issuer ID.'; exit 1; }
    api_key_path="$signing_dir/AuthKey_${APPSTORE_API_KEY_ID}.p8"
    printf '%s\n' "$APPSTORE_API_PRIVATE_KEY" > "$api_key_path"
    openssl pkey -in "$api_key_path" -noout
    unset APPSTORE_API_PRIVATE_KEY
    # Xcode uploads the signed archive; it does not submit an App Store review
    # or add testers. Manual signing prevents creation/rotation of certificates.
    xcodebuild -exportArchive -archivePath "$archive_path" \
      -exportOptionsPlist "$signing_dir/upload.plist" -exportPath "$RUNNER_TEMP/h2o-ios-upload" \
      -authenticationKeyPath "$api_key_path" -authenticationKeyID "$APPSTORE_API_KEY_ID" \
      -authenticationKeyIssuerID "$APPSTORE_ISSUER_ID"
    ;;
  cleanup)
    if [ -f "$signing_dir/profile-uuid.txt" ]; then
      profile_uuid="$(cat "$signing_dir/profile-uuid.txt")"
      if [[ "$profile_uuid" =~ ^[0-9A-Fa-f]{8}(-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}$ ]]; then
        rm -f "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles/$profile_uuid.mobileprovision"
      fi
    fi
    if [ -f "$keychain_path" ]; then
      security delete-keychain "$keychain_path" || true
    fi
    rm -rf "$signing_dir"
    ;;
  *) echo 'Aufruf: ios-testflight.sh prepare|build|upload|cleanup' >&2; exit 2 ;;
esac
