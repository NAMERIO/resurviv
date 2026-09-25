"""Prepare App Store signing on an ephemeral GitHub macOS runner; never log secrets."""

import base64
import datetime
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import secrets
import shutil
import subprocess
import sys

BUNDLE_ID = "biz.resurviv.app"


def required(name):
    value = os.environ.get(name, "")
    if not value:
        raise ValueError(f"Missing {name}; configure it in the ios-release GitHub environment")
    return value


def run(*args):
    return subprocess.check_output(args, stderr=subprocess.PIPE)


def private_file(path, content):
    path.write_bytes(content)
    path.chmod(0o600)


def decode_secret(name):
    return base64.b64decode("".join(required(name).split()), validate=True)


def metadata():
    version = required("IOS_APP_VERSION")
    if not re.fullmatch(r"\d+\.\d+(?:\.\d+)?", version):
        raise ValueError("App Store version must be X.Y or X.Y.Z")
    build = os.environ.get("IOS_BUILD_NUMBER") or (
        f'{required("GITHUB_RUN_NUMBER")}.{required("GITHUB_RUN_ATTEMPT")}'
    )
    if not re.fullmatch(r"[1-9]\d{0,3}(?:\.\d{1,2}){0,2}", build):
        raise ValueError("Build number must have 1-3 numeric parts (4, 2, 2 digits)")
    with open(required("GITHUB_OUTPUT"), "a") as output:
        output.write(f"version={version}\nbuild={build}\n")


def validate_profile(profile, team):
    if not re.fullmatch(r"[A-Z0-9]{10}", team):
        raise ValueError("APPLE_TEAM_ID must be the 10-character Apple Developer Team ID")
    entitlements = profile["Entitlements"]
    prefixes = profile.get("ApplicationIdentifierPrefix", [])
    if profile.get("TeamIdentifier") != [team]:
        raise ValueError("Provisioning profile belongs to a different team")
    if entitlements.get("application-identifier") not in [
        f"{prefix}.{BUNDLE_ID}" for prefix in prefixes
    ]:
        raise ValueError(f"Profile must explicitly match {BUNDLE_ID}, not a wildcard")
    if (entitlements.get("get-task-allow", False) or "ProvisionedDevices" in profile
            or profile.get("ProvisionsAllDevices", False)):
        raise ValueError("Use an App Store Connect distribution profile, not development/ad hoc/enterprise")
    if profile["ExpirationDate"] <= datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None):
        raise ValueError("Provisioning profile has expired")
    uuid = profile["UUID"]
    if not re.fullmatch(r"[A-Fa-f0-9-]{36}", uuid):
        raise ValueError("Invalid provisioning profile UUID")
    return uuid


def signing():
    team = required("APPLE_TEAM_ID")
    directory = Path(required("RUNNER_TEMP")) / "resurviv-ios-signing"
    directory.mkdir(mode=0o700, exist_ok=True)
    certificate = directory / "distribution.p12"
    profile_file = directory / "distribution.mobileprovision"
    keychain = directory / "signing.keychain-db"
    private_file(certificate, decode_secret("IOS_CERTIFICATE_P12_BASE64"))
    private_file(profile_file, decode_secret("IOS_PROVISION_PROFILE_BASE64"))
    profile = plistlib.loads(run("security", "cms", "-D", "-i", str(profile_file)))
    uuid = validate_profile(profile, team)

    password = secrets.token_urlsafe(32)
    run("security", "create-keychain", "-p", password, str(keychain))
    run("security", "set-keychain-settings", "-lut", "21600", str(keychain))
    run("security", "unlock-keychain", "-p", password, str(keychain))
    run("security", "import", str(certificate), "-P", required("IOS_CERTIFICATE_PASSWORD"),
        "-A", "-t", "cert", "-f", "pkcs12", "-k", str(keychain))
    run("security", "set-key-partition-list", "-S", "apple-tool:,apple:,codesign:",
        "-k", password, str(keychain))
    previous = re.findall(r'"([^"]+)"', run("security", "list-keychains", "-d", "user").decode())
    private_file(directory / "previous-keychains.json", json.dumps(previous).encode())
    run("security", "list-keychains", "-d", "user", "-s", str(keychain), *previous)
    identities = run("security", "find-identity", "-v", "-p", "codesigning", str(keychain)).decode()
    allowed = {hashlib.sha1(cert).hexdigest().upper() for cert in profile["DeveloperCertificates"]}
    matches = [value for value in re.findall(r"\b[A-F0-9]{40}\b", identities) if value in allowed]
    if len(matches) != 1:
        raise ValueError("P12 must contain one valid signing identity included in the profile, with its private key")

    # Xcode 16+ provisioning profile location.
    profiles = Path.home() / "Library/Developer/Xcode/UserData/Provisioning Profiles"
    profiles.mkdir(parents=True, exist_ok=True)
    installed = profiles / f"{uuid}.mobileprovision"
    private_file(directory / "installed-profile.txt", str(installed).encode())
    shutil.copyfile(profile_file, installed)
    installed.chmod(0o600)
    with open(required("GITHUB_ENV"), "a") as output:
        output.write(f"RESURVIV_TEAM_ID={team}\nRESURVIV_PROFILE_UUID={uuid}\nRESURVIV_SIGNING_IDENTITY={matches[0]}\n")
    options = {
        "method": "app-store-connect",
        "destination": "export",
        "signingStyle": "manual",
        "teamID": team,
        "signingCertificate": matches[0],
        "provisioningProfiles": {BUNDLE_ID: uuid},
        "manageAppVersionAndBuildNumber": False,
        "uploadSymbols": True,
    }
    private_file(directory / "ExportOptions.plist", plistlib.dumps(options))


def upload_key():
    key_id = required("ASC_KEY_ID")
    issuer = required("ASC_ISSUER_ID")
    if not re.fullmatch(r"[A-Z0-9]{10}", key_id) or not re.fullmatch(r"[a-fA-F0-9-]{36}", issuer):
        raise ValueError("Use an App Store Connect team API key ID and issuer UUID")
    directory = Path(required("RUNNER_TEMP")) / "resurviv-ios-signing"
    private_file(directory / f"AuthKey_{key_id}.p8", decode_secret("ASC_PRIVATE_KEY_BASE64"))
    options = plistlib.loads((directory / "ExportOptions.plist").read_bytes())
    options["destination"] = "upload"
    private_file(directory / "UploadOptions.plist", plistlib.dumps(options))


def cleanup():
    directory = Path(required("RUNNER_TEMP")) / "resurviv-ios-signing"
    previous = directory / "previous-keychains.json"
    try:
        if previous.exists():
            run("security", "list-keychains", "-d", "user", "-s", *json.loads(previous.read_text()))
    finally:
        try:
            keychain = directory / "signing.keychain-db"
            if keychain.exists():
                run("security", "delete-keychain", str(keychain))
        finally:
            record = directory / "installed-profile.txt"
            if record.exists():
                profile = Path(record.read_text())
                expected = Path.home() / "Library/Developer/Xcode/UserData/Provisioning Profiles"
                if profile.parent == expected and profile.suffix == ".mobileprovision":
                    profile.unlink(missing_ok=True)
            if directory.exists():
                shutil.rmtree(directory)


if __name__ == "__main__":
    try:
        {"metadata": metadata, "signing": signing, "upload-key": upload_key, "cleanup": cleanup}[sys.argv[1]]()
    except subprocess.CalledProcessError as error:
        # Avoid echoing a security command's arguments (which contain passwords).
        sys.exit(f"Apple signing tool failed (exit {error.returncode}); verify the certificate, private key, password and profile")
    except (ValueError, KeyError) as error:
        sys.exit(str(error))
