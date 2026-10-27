"""Synthetic provisioning profiles only; no Apple account or signing keys needed."""
import copy
import datetime as dt
import hashlib
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("ios_signing", Path(__file__).parents[1] / "scripts/ios-signing.py")
signing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(signing)


class SigningProfileTests(unittest.TestCase):
    def setUp(self):
        self.now = dt.datetime(2026, 10, 27, tzinfo=dt.timezone.utc)
        self.domains = ["webcredentials:ffw-wasser.github.io", "applinks:ffw-wasser.github.io"]
        self.certificate = b"synthetic Apple certificate, never a real credential"
        self.fingerprint = hashlib.sha1(self.certificate).hexdigest().upper()
        self.identities = f'1) {self.fingerprint} "Synthetic test identity"\n1 valid identities found'
        self.profile = {
            "UUID": "12345678-1234-1234-1234-123456789abc",
            "TeamIdentifier": [signing.TEAM],
            "ExpirationDate": dt.datetime(2027, 10, 27),
            "DeveloperCertificates": [self.certificate],
            "Entitlements": {
                "application-identifier": f"{signing.TEAM}.{signing.BUNDLE}",
                "com.apple.developer.team-identifier": signing.TEAM,
                "get-task-allow": False,
                "com.apple.developer.associated-domains": ["*"],
            },
        }

    def validate(self, profile=None, identities=None):
        return signing.validate_profile(self.profile if profile is None else profile,
                                        self.identities if identities is None else identities,
                                        self.domains, self.now)

    def test_matching_app_store_profile_and_private_key(self):
        self.assertEqual(self.validate(), (self.profile["UUID"], self.fingerprint))

    def test_explicit_associated_domains_are_supported(self):
        self.profile["Entitlements"]["com.apple.developer.associated-domains"] = self.domains
        self.validate()

    def test_wrong_team_bundle_or_entitlement_rejected(self):
        for field, value in [("application-identifier", f"{signing.TEAM}.other.app"),
                             ("application-identifier", f"OTHERTEAM1.{signing.BUNDLE}"),
                             ("com.apple.developer.team-identifier", "OTHERTEAM1")]:
            with self.subTest(field=field, value=value):
                profile = copy.deepcopy(self.profile)
                profile["Entitlements"][field] = value
                with self.assertRaises(ValueError):
                    self.validate(profile)
        self.profile["TeamIdentifier"] = ["OTHERTEAM1"]
        with self.assertRaises(ValueError):
            self.validate()

    def test_expired_or_missing_expiry_rejected(self):
        for expiry in [None, "2027-01-01", self.now.replace(tzinfo=None)]:
            self.profile["ExpirationDate"] = expiry
            with self.subTest(expiry=expiry), self.assertRaises(ValueError):
                self.validate()

    def test_development_adhoc_and_enterprise_rejected(self):
        for mutation in [{"ProvisionedDevices": ["synthetic-device"]},
                         {"ProvisionedDevices": []}, {"ProvisionsAllDevices": True}]:
            profile = {**self.profile, **mutation}
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                self.validate(profile)
        self.profile["Entitlements"]["get-task-allow"] = True
        with self.assertRaises(ValueError):
            self.validate()

    def test_missing_or_partial_domain_permissions_rejected(self):
        for allowed in [[], [self.domains[0]], "*", ["applinks:other.example"]]:
            self.profile["Entitlements"]["com.apple.developer.associated-domains"] = allowed
            with self.subTest(allowed=allowed), self.assertRaises(ValueError):
                self.validate()

    def test_certificate_without_matching_valid_private_key_rejected(self):
        for identities in ["0 valid identities found", '1) ' + 'A' * 40 + ' "other key"']:
            with self.subTest(identities=identities), self.assertRaises(ValueError):
                self.validate(identities=identities)
        self.profile["DeveloperCertificates"] = []
        with self.assertRaises(ValueError):
            self.validate()

    def test_unsafe_profile_uuid_rejected(self):
        for uuid in ["../../other-profile", "uuid\nINJECTED=value", "", "abc"]:
            self.profile["UUID"] = uuid
            with self.subTest(uuid=uuid), self.assertRaises(ValueError):
                self.validate()

    def test_upload_requires_manual_main_branch_and_explicit_option(self):
        script = Path(__file__).parents[1] / "scripts/ios-testflight.sh"
        for event, ref, upload in [("pull_request", "refs/heads/main", "true"),
                                   ("workflow_dispatch", "refs/heads/feature/test", "true"),
                                   ("workflow_dispatch", "refs/heads/main", "false")]:
            with self.subTest(event=event, ref=ref, upload=upload), tempfile.TemporaryDirectory() as temp:
                result = subprocess.run(["bash", str(script), "upload"], capture_output=True, text=True,
                                        env={**os.environ, "RUNNER_TEMP": temp,
                                             "GITHUB_EVENT_NAME": event, "GITHUB_REF": ref,
                                             "H2O_UPLOAD_TESTFLIGHT": upload})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("manuellen Start", result.stdout)
                self.assertEqual(list(Path(temp).iterdir()), [])


if __name__ == "__main__":
    unittest.main()
