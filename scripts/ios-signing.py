"""Check manually supplied Apple signing assets before building H2O for TestFlight."""
import datetime as dt
import hashlib
import os
from pathlib import Path
import plistlib
import re
import sys

TEAM = "VKL57X3H6F"
BUNDLE = "de.feuerwehrwasser.h2o"


def validate_profile(profile, identities, domains, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    entitlements = profile.get("Entitlements", {})
    if profile.get("TeamIdentifier") != [TEAM]:
        raise ValueError("Das Profil gehört nicht zum hinterlegten Apple-Team.")
    if entitlements.get("application-identifier") != f"{TEAM}.{BUNDLE}":
        raise ValueError("Das Profil gehört nicht zur H2O-App-ID.")
    if entitlements.get("com.apple.developer.team-identifier") != TEAM:
        raise ValueError("Die Team-Berechtigung des Profils stimmt nicht.")
    expiry = profile.get("ExpirationDate")
    if not isinstance(expiry, dt.datetime) or expiry.replace(tzinfo=dt.timezone.utc) <= now:
        raise ValueError("Das Profil ist abgelaufen oder enthält kein Ablaufdatum.")
    if entitlements.get("get-task-allow", False) is not False:
        raise ValueError("Ein Entwicklungsprofil ist für TestFlight nicht geeignet.")
    if "ProvisionedDevices" in profile or profile.get("ProvisionsAllDevices", False):
        raise ValueError("Benötigt wird ein App-Store-Profil, kein Ad-hoc-/Enterprise-Profil.")
    allowed = entitlements.get("com.apple.developer.associated-domains", [])
    if not isinstance(allowed, list) or ("*" not in allowed and not set(domains).issubset(allowed)):
        raise ValueError("Associated Domains fehlen im Profil; Profil bei Apple neu erzeugen.")
    uuid = profile.get("UUID", "")
    if not re.fullmatch(r"[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}", uuid):
        raise ValueError("Das Profil enthält keine gültige UUID.")
    available = set(re.findall(r"\b[0-9A-Fa-f]{40}\b", identities.upper()))
    certificates = profile.get("DeveloperCertificates", [])
    matches = [hashlib.sha1(cert).hexdigest().upper() for cert in certificates
               if isinstance(cert, bytes) and hashlib.sha1(cert).hexdigest().upper() in available]
    if not matches:
        raise ValueError("Kein gültiges Signaturzertifikat mit privatem Schlüssel passt zum Profil.")
    return uuid, matches[0]


def main(directory):
    directory = Path(directory)
    with (directory / "profile.plist").open("rb") as stream:
        profile = plistlib.load(stream)
    with Path("native/ios/H2OPortal/H2OPortal.entitlements").open("rb") as stream:
        domains = plistlib.load(stream)["com.apple.developer.associated-domains"]
    uuid, identity = validate_profile(profile, (directory / "identities.txt").read_text(), domains)
    for destination in ("export", "upload"):
        options = {
            "method": "app-store-connect", "destination": destination,
            "teamID": TEAM, "signingStyle": "manual", "signingCertificate": identity,
            "provisioningProfiles": {BUNDLE: uuid},
            "manageAppVersionAndBuildNumber": False,
            "uploadSymbols": True,
        }
        with (directory / f"{destination}.plist").open("wb") as stream:
            plistlib.dump(options, stream)
    (directory / "profile-uuid.txt").write_text(uuid)
    run = int(os.environ["GITHUB_RUN_NUMBER"])
    attempt = int(os.environ["GITHUB_RUN_ATTEMPT"])
    if not 0 < run < 9000 or not 0 < attempt < 100:
        raise ValueError("Die Build-Nummer muss vor weiteren Uploads angepasst werden.")
    with open(os.environ["GITHUB_ENV"], "a") as stream:
        stream.write(f"H2O_PROFILE_UUID={uuid}\nH2O_SIGN_IDENTITY={identity}\n")
        stream.write(f"H2O_IOS_BUILD={1000 + run}.{attempt}\n")


if __name__ == "__main__":
    try:
        main(sys.argv[1])
    except (ValueError, KeyError, OSError, plistlib.InvalidFileException) as error:
        sys.exit(f"Signaturprüfung fehlgeschlagen: {error}")
