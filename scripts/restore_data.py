"""Recover the existing project samples without adding CSVs to Git."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
if __name__ == "__main__":
    (ROOT / "data").mkdir(exist_ok=True)
    for kind in ("Fake", "True"):
        target = ROOT / "data" / f"{kind}.csv"
        if target.exists():
            print(f"Keeping existing {target.name}")
            continue
        content = subprocess.check_output(["git", "show", f"afe1eb8:Small_{kind}.csv"], cwd=ROOT)
        target.write_bytes(content)
        print(f"Restored {target.name} ({len(content):,} bytes)")
