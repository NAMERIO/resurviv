"""Signing input validation can be exercised on Windows without Apple credentials."""

import copy
import datetime
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("ios_release", Path(__file__).with_name("ios-release.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseInputs(unittest.TestCase):
    def setUp(self):
        self.profile = {
            "TeamIdentifier": ["ABCDE12345"],
            # Legacy App ID prefixes may differ from the Team ID.
            "ApplicationIdentifierPrefix": ["OLDPREFIX1"],
            "Entitlements": {"application-identifier": "OLDPREFIX1.biz.resurviv.app", "get-task-allow": False},
            "ExpirationDate": datetime.datetime.now() + datetime.timedelta(days=1),
            "UUID": "01234567-0123-0123-0123-012345678901",
        }

    def test_explicit_store_profile(self):
        self.assertEqual(release.validate_profile(self.profile, "ABCDE12345"), self.profile["UUID"])

    def test_wrong_team(self):
        with self.assertRaisesRegex(ValueError, "different team"):
            release.validate_profile(self.profile, "OTHER12345")

    def test_development_ad_hoc_enterprise_profiles(self):
        for field, value in [("ProvisionedDevices", []), ("ProvisionsAllDevices", True)]:
            with self.subTest(field=field):
                profile = {**self.profile, field: value}
                with self.assertRaisesRegex(ValueError, "distribution profile"):
                    release.validate_profile(profile, "ABCDE12345")
        self.profile["Entitlements"]["get-task-allow"] = True
        with self.assertRaisesRegex(ValueError, "distribution profile"):
            release.validate_profile(self.profile, "ABCDE12345")

    def test_wrong_bundle_or_wildcard(self):
        for identifier in ["OLDPREFIX1.*", "OLDPREFIX1.biz.other.app", "WRONG.biz.resurviv.app"]:
            with self.subTest(identifier=identifier):
                profile = copy.deepcopy(self.profile)
                profile["Entitlements"]["application-identifier"] = identifier
                with self.assertRaisesRegex(ValueError, "explicitly match"):
                    release.validate_profile(profile, "ABCDE12345")

    def test_expired_profile(self):
        self.profile["ExpirationDate"] = datetime.datetime(2020, 1, 1)
        with self.assertRaisesRegex(ValueError, "expired"):
            release.validate_profile(self.profile, "ABCDE12345")

    def test_profile_uuid_cannot_escape_directory(self):
        self.profile["UUID"] = "../outside"
        with self.assertRaisesRegex(ValueError, "UUID"):
            release.validate_profile(self.profile, "ABCDE12345")

    def test_metadata_and_malicious_input(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "output"
            env = {"GITHUB_OUTPUT": str(output), "GITHUB_RUN_NUMBER": "12", "GITHUB_RUN_ATTEMPT": "2", "IOS_BUILD_NUMBER": "", "IOS_APP_VERSION": "1.0"}
            with patch.dict(os.environ, env):
                release.metadata()
                self.assertIn("version=1.0\n", output.read_text())
                self.assertIn("build=12.2\n", output.read_text())
                for invalid in ["$(echo unsafe)", "1\nbuild=2", "10000", "1.100", "0", "1.2.3.4"]:
                    with self.subTest(build=invalid), patch.dict(os.environ, {"IOS_BUILD_NUMBER": invalid}):
                        with self.assertRaises(ValueError):
                            release.metadata()
                for invalid in ["1.0-beta", "1.0\nbuild=2", "$(echo unsafe)", "1.2.3.4"]:
                    with self.subTest(version=invalid), patch.dict(os.environ, {"IOS_APP_VERSION": invalid}):
                        with self.assertRaises(ValueError):
                            release.metadata()


if __name__ == "__main__":
    unittest.main()
