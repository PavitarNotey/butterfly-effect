"""Stage a standalone API and verify its startup without a model call."""

import argparse
import hashlib
import json
import os
import shutil
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

BACKEND = Path(__file__).resolve().parent
SCENARIOS = ("invisible-run.json", "missed-chance.json", "untouched-pass.json")


def package(output: Path) -> None:
    """Use an explicit allowlist so environments, tests and secrets cannot leak."""
    output.mkdir(parents=True, exist_ok=False)
    for name in ("main.py", "config.py"):
        shutil.copyfile(BACKEND / name, output / name)
    for name in ("ai", "league", "tactics"):
        target = output / name
        target.mkdir()
        for source in (BACKEND / name).glob("*.py"):
            shutil.copyfile(source, target / source.name)
    shutil.copyfile(BACKEND / "league/catalog.json", output / "league/catalog.json")
    (output / "scenarios").mkdir()
    for name in SCENARIOS:
        source = BACKEND.parent / "frontend/src/replay" / name
        target = output / "scenarios" / name
        shutil.copyfile(source, target)
        assert (
            hashlib.sha256(source.read_bytes()).digest()
            == hashlib.sha256(target.read_bytes()).digest()
        )


def smoke(app_dir: Path, python: Path) -> None:
    """Run the production command in an isolated artifact, with AI forced offline."""
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    env = {
        **os.environ,
        "PORT": str(port),
        "AI_PROVIDER": "mock",
        "AI_PAID_GENERATION_ENABLED": "false",
        "PYTHONPATH": "",
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    with tempfile.TemporaryFile(mode="w+") as log:
        process = subprocess.Popen(
            [
                "bash",
                "-c",
                'exec "$1" -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}',
                "startup",
                str(python.absolute()),
            ],
            cwd=app_dir.resolve(),
            env=env,
            stdout=log,
            stderr=log,
        )
        try:
            deadline = time.monotonic() + 30
            while True:
                try:
                    with urlopen(f"http://127.0.0.1:{port}/health", timeout=1) as r:
                        assert json.load(r)["status"] == "ok"
                    break
                except (URLError, TimeoutError):
                    if process.poll() is not None or time.monotonic() >= deadline:
                        log.seek(0)
                        raise RuntimeError(f"Packaged startup failed:\n{log.read()}")
                    time.sleep(0.1)
            paths = ["/api/fixtures", "/api/standings", "/api/scenarios"]
            paths += [
                f"/api/scenarios/{scenario}/evidence"
                for scenario in (
                    "the-invisible-run",
                    "the-missed-chance",
                    "the-untouched-pass",
                )
            ]
            for path in paths:
                with urlopen(f"http://127.0.0.1:{port}{path}", timeout=10) as r:
                    assert r.status == 200
                    assert json.load(r)
            with urlopen(f"http://127.0.0.1:{port}/api/ai/status", timeout=5) as r:
                assert json.load(r)["provider"] == "mock"
            print(
                "Packaged startup, league, all scenario evidence and offline AI verified."
            )
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    build = commands.add_parser("package")
    build.add_argument("--output", type=Path, required=True)
    check = commands.add_parser("smoke")
    check.add_argument("--app-dir", type=Path, required=True)
    check.add_argument("--python", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "package":
        package(args.output)
    else:
        smoke(args.app_dir, args.python)


if __name__ == "__main__":
    main()
