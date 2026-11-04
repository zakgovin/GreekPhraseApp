"""Regenerate only approved exercise excerpts from separately stored source recordings."""
import argparse
import hashlib
import json
import pathlib
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("source_directory", type=pathlib.Path, help="Directory with the original A2_2017.mp3 and A2_2018.mp3, outside public/")
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parents[1]
manifest = json.loads((root / "src/data/audio-clips.json").read_text())
output = root / "public/audio"
output.mkdir(exist_ok=True)
for clip in manifest.values():
    source = args.source_directory / clip["sourceFile"]
    with source.open("rb") as file:
        assert hashlib.file_digest(file, "sha256").hexdigest() == clip["sourceSha256"], "Unexpected source recording"
    destination = output / clip["file"]
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-ss", str(clip["startSeconds"]), "-i", str(source),
        "-t", str(clip["endSeconds"] - clip["startSeconds"]), "-map_metadata", "-1", "-vn",
        "-ac", "1", "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "64k", str(destination),
    ], check=True)
    with destination.open("rb") as file:
        digest = hashlib.file_digest(file, "sha256").hexdigest()
    assert digest == clip["sha256"], "Generated audio differs; inspect it before updating the approved manifest"
    print("Prepared", clip["file"])
