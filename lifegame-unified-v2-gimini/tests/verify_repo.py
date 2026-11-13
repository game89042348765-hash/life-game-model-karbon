#!/usr/bin/env python3
import hashlib, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
manifest_path = os.path.join(ROOT, "audit-manifest.json")
manifest = json.load(open(manifest_path, encoding="utf-8"))

errors = []
for entry in manifest["files"]:
    p = os.path.join(ROOT, entry["path"])
    if not os.path.exists(p):
        errors.append(f"Missing file: {entry['path']}")
        continue
    data = open(p, "rb").read()
    sha = hashlib.sha256(data).hexdigest()
    if sha != entry["sha256"] or len(data) != entry["bytes"]:
        errors.append(f"Mismatch: {entry['path']}")

# Verify every SHELL asset in sw.js exists on disk
sw_text = open(os.path.join(ROOT, "sw.js"), encoding="utf-8").read()
m = re.search(r"const SHELL = (\[.*?\]);", sw_text, re.S)
if not m:
    errors.append("Cannot parse SHELL array in sw.js")
else:
    shell_items = json.loads(m.group(1))
    for item in shell_items:
        if item == "./":
            continue
        rel = item[2:] if item.startswith("./") else item
        if not os.path.exists(os.path.join(ROOT, rel)):
            errors.append(f"SW SHELL missing file on disk: {rel}")

# Run Node E2E runtime suite if node is installed
res = subprocess.run(["node", os.path.join(ROOT, "tests", "runtime_e2e.js")], capture_output=True, text=True)
if res.returncode != 0:
    errors.append("Node E2E failed: " + res.stderr)

print(json.dumps({
    "status": "passed" if not errors else "failed",
    "verified_files": len(manifest["files"]),
    "runtime": res.stdout.strip(),
    "errors": errors
}, ensure_ascii=False, indent=2))
sys.exit(0 if not errors else 1)
