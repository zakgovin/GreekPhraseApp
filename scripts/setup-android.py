"""Install the pinned Linux x86_64 toolchain in a workspace, with checksum verification."""
import hashlib
import os
import pathlib
import shutil
import subprocess
import tarfile
import urllib.parse
import urllib.request
import zipfile

root = pathlib.Path(os.environ.get("FRASI_ANDROID_TOOLS", "/workspace/android-tools"))
cache = root / "downloads"
cache.mkdir(parents=True, exist_ok=True)


def download(url, destination, algorithm, checksum):
    def digest(path):
        with path.open("rb") as file:
            return hashlib.file_digest(file, algorithm).hexdigest()

    if destination.exists() and digest(destination) == checksum:
        print("Verified cached", destination.name, flush=True)
        return
    partial = destination.with_suffix(destination.suffix + ".part")
    with urllib.request.urlopen(url, timeout=90) as source, partial.open("wb") as output:
        shutil.copyfileobj(source, output, 1024 * 1024)
    if digest(partial) != checksum:
        raise RuntimeError("Checksum mismatch: " + destination.name)
    partial.replace(destination)
    print("Downloaded and verified", destination.name, flush=True)


jdk = cache / "temurin-21.tar.gz"
download(
    "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13%2B9/"
    "OpenJDK21U-jdk_x64_linux_hotspot_21.0.13_9.tar.gz",
    jdk, "sha256", "d7f5d5cf865a2902b70ff549b97586a7d3f234e016f041ab447ea740c7d66d1c",
)
if not (root / "jdk/bin/javac").exists():
    staging = root / "jdk-extract"
    staging.mkdir(exist_ok=True)
    with tarfile.open(jdk) as archive:
        archive.extractall(staging, filter="data")
    next(staging.iterdir()).rename(root / "jdk")
    staging.rmdir()

cli = cache / "cmdline-tools-19.zip"
# SHA-1 is the checksum published for this archive in Google's repository2-3.xml.
download(
    "https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip",
    cli, "sha1", "5fdcc763663eefb86a5b8879697aa6088b041e70",
)
target = root / "sdk/cmdline-tools/19.0"
if not (target / "bin/sdkmanager").exists():
    with zipfile.ZipFile(cli) as archive:
        for info in archive.infolist():
            relative = pathlib.PurePosixPath(info.filename).relative_to("cmdline-tools")
            if ".." in relative.parts:
                raise RuntimeError("Unsafe archive path")
            path = target / relative
            if info.is_dir():
                path.mkdir(parents=True, exist_ok=True)
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(archive.read(info))
                path.chmod(0o755 if relative.parts[0] == "bin" else 0o644)

env = os.environ.copy()
env.update(JAVA_HOME=str(root / "jdk"), ANDROID_HOME=str(root / "sdk"),
           ANDROID_SDK_ROOT=str(root / "sdk"), ANDROID_USER_HOME=str(root / "user"))
(root / "user").mkdir(exist_ok=True)
if pathlib.Path("/etc/ssl/certs/java/cacerts").exists():
    env["JAVA_OPTS"] = env.get("JAVA_OPTS", "") + " -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts"
command = [str(target / "bin/sdkmanager"), "--sdk_root=" + str(root / "sdk")]
proxy = env.get("HTTPS_PROXY") or env.get("https_proxy")
if proxy:
    parsed = urllib.parse.urlsplit(proxy)
    command += ["--proxy=http", "--proxy_host=" + parsed.hostname, "--proxy_port=" + str(parsed.port or 80)]
for args in [["--licenses"], ["platform-tools", "platforms;android-36", "build-tools;36.0.0"]]:
    subprocess.run(command + args, input="y\n" * 200, text=True, env=env, check=True)
print("Android toolchain ready:", root, flush=True)
