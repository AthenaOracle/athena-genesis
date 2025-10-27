#!/usr/bin/env python3
"""
🜂 Athena Genesis — Automated Epoch Runner (Final, Epoch Report edition)
-------------------------------------------------
This script wraps brain.py to generate epoch reports,
append a UTC timestamp, and export the Merkle root
to GitHub Actions for autonomous operation.
-------------------------------------------------
"""

import subprocess
import os
import json
import sys
from datetime import datetime

# -------------------------------------------------
# Configuration
# -------------------------------------------------
EPOCH = os.getenv("EPOCH", "0")       # Provided by workflow or defaults to 0
POOL = "10000"                        # ATA pool per epoch (configurable)
REPORT_DIR = "Epoch Report"           # ✅ use your actual folder name
REPORT_PATH = f"{REPORT_DIR}/epoch_{EPOCH}_report.json"

# Ensure the folder exists
os.makedirs(REPORT_DIR, exist_ok=True)

# -------------------------------------------------
# Run brain.py
# -------------------------------------------------
cmd = [
    "python", "brain.py",
    "--epoch", EPOCH,
    "--pool", POOL,
    "--emit-proofs",
    "--report", REPORT_PATH
]

print(f"🜂 Running Athena Epoch {EPOCH} (pool {POOL} ATA)...\n")

start = datetime.utcnow()
result = subprocess.run(cmd, capture_output=True, text=True)
end = datetime.utcnow()

print(result.stdout)

if result.returncode != 0:
    print("❌ brain.py failed:\n")
    print(result.stderr)
    sys.exit(result.returncode)

print(f"✅ brain.py completed successfully in {(end - start).seconds}s\n")

# -------------------------------------------------
# Parse report, append timestamp, and export root
# -------------------------------------------------
try:
    with open(REPORT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Add timestamp for self-proving reports
    data["generatedAt"] = datetime.utcnow().isoformat() + "Z"

    # Save updated report (overwrite)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    root = data.get("merkleRoot") or data.get("merkle_root")
    if not root:
        raise KeyError("Missing merkleRoot field in report")

    print(f"✅ Merkle root extracted: {root}\n")

    # Export to GitHub Actions output
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as f:
            print(f"MERKLE_ROOT={root}", file=f)
        print("📤 Exported MERKLE_ROOT for workflow steps.\n")
    else:
        print("⚠️ GITHUB_OUTPUT not found — likely running locally.\n")

except Exception as e:
    print(f"⚠️ Could not parse or export Merkle root: {e}")
    sys.exit(1)

# -------------------------------------------------
# Summary
# -------------------------------------------------
print("🜂 Athena Epoch Summary ---------------------------")
print(f"Epoch:        {EPOCH}")
print(f"Pool:         {POOL} ATA")
print(f"Merkle Root:  {root}")
print(f"Report File:  {REPORT_PATH}")
print(f"Generated At: {data['generatedAt']}")
print("----------------------------------------------------\n")

print("🎉 Epoch complete. Ready for IPFS pin or on-chain publish.\n")
