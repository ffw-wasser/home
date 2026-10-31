"""Validate both member-pilot distribution profiles without printing their contents."""
import importlib.util
from pathlib import Path
import plistlib
import subprocess
import sys

spec = importlib.util.spec_from_file_location("ios_signing", Path(__file__).with_name("ios-signing.py"))
signing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(signing)

def validate(directory):
    directory = Path(directory)
    identities = subprocess.check_output(["security", "find-identity", "-v", "-p", "codesigning"], text=True)
    with Path("native/ios/H2OPortal/H2OPortal.entitlements").open("rb") as stream:
        domains = plistlib.load(stream)["com.apple.developer.associated-domains"]
    certificates = []
    for label, bundle, required_domains in [
        ("app", "de.feuerwehrwasser.h2o", domains),
        ("widget", "de.feuerwehrwasser.h2o.widget", []),
    ]:
        with (directory / f"h2o-{label}.plist").open("rb") as stream:
            profile = plistlib.load(stream)
        signing.BUNDLE = bundle
        _, certificate = signing.validate_profile(profile, identities, required_domains)
        if label == "app" and profile.get("Entitlements", {}).get("aps-environment") != "production":
            raise ValueError("Push Notifications fehlen im App-Store-Profil. Bei Apple für die App-ID aktivieren und das Haupt-App-Profil neu erzeugen.")
        if "group.de.feuerwehrwasser.h2o" not in profile.get("Entitlements", {}).get("com.apple.security.application-groups", []):
            raise ValueError(f"App Group fehlt im {label}-Profil. Profil nach Aktivierung bei Apple neu erzeugen.")
        certificates.append(certificate)
    if certificates[0] != certificates[1]:
        raise ValueError("App und Widget benötigen dasselbe Distribution-Zertifikat.")
    print("Member pilot: both distribution profiles, certificates, App Group and Associated Domains validated.")

if __name__ == "__main__":
    try:
        validate(sys.argv[1])
    except (ValueError, KeyError, OSError, plistlib.InvalidFileException, subprocess.CalledProcessError) as error:
        sys.exit(f"Mitglieder-Build nicht signiert: {error}")
