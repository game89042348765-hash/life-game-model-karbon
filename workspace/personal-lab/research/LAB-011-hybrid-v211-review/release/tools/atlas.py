#!/usr/bin/env python3
"""LifeGame Atlas Hybrid v2.1.1+lab.1 (LAB-006 foundation + v1_indep additions + LAB-008-R1 & LAB-010-R2 revisions):
Structural checks, total-packet-budgeted cross-domain functional sharding with bounded navigation index previews,
atomic no-overwrite blind-rating packet sterilization, anti-marketing L1-L6 layer support,
and deterministic multi-lane editorial selection.
Standard library only; no network/API calls; sys.dont_write_bytecode enforced.
"""
import argparse
import csv
import hashlib
import json
import math
import os
from pathlib import Path
import re
import statistics
import sys
import tempfile
from datetime import datetime, timezone
from urllib.parse import urlparse

sys.dont_write_bytecode = True

VERSION = "2.1.1+lab.1"
RUBRIC_VERSION = "2.1"
COMPATIBLE_VERSIONS = {"1.0", "2.0", "2.1", "2.1.1"}
TABLES = ("sources", "findings", "elements", "ratings", "merge_map", "relations", "decisions")
DIMS = ("value", "burden", "long_term", "adaptability", "agency", "composability")
WEIGHTS = dict(zip(DIMS, (.30, .15, .20, .10, .15, .10)))
PROFILES = {
    "equal": dict.fromkeys(DIMS, 1 / 6),
    "long_use": dict(zip(DIMS, (.25, .15, .30, .10, .15, .05))),
    "low_effort": dict(zip(DIMS, (.25, .30, .15, .10, .15, .05))),
}
KINDS = {
    "mechanism", "technique", "interaction_pattern", "quality_capability",
    "method_system", "product", "example", "anti_pattern"
}
RANKABLE = {"mechanism", "technique", "interaction_pattern", "quality_capability"}
EVIDENCE_GRADES = {
    "EVID_A_META_RCT", "EVID_B_THEORY_GROUNDED", "EVID_C_FIELD_PRACTICE",
    "EVID_D_ANECDOTAL_NICHE", "EVID_NONE_UNVERIFIED"
}
RESERVED_TEST_DOMAINS = {"example.invalid", "synthetic-example.invalid", "example.com", "example.org", "localhost"}
SAFE_CODE_RE = re.compile(r"^[A-Z0-9_]{1,100}$")
IGNORED_MANIFEST_NAMES = {"__pycache__", ".DS_Store"}


def fail(message):
    raise ValueError(message)


def parse_json(text):
    return json.loads(text, parse_constant=lambda x: fail("Non-finite JSON: " + x))


def dump(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def is_ignored_path(path_obj):
    for part in path_obj.parts:
        if part in IGNORED_MANIFEST_NAMES or part.endswith(".pyc") or part.endswith(".pyo"):
            return True
    return False


def ensure_safe_token(token, label):
    if not isinstance(token, str) or not SAFE_CODE_RE.match(token):
        fail(f"Unsafe or invalid {label} token: {token!r}")
    return token


def compute_triad_hash(element):
    triad = element.get("mechanism_triad") or {}
    if isinstance(triad, dict) and triad.get("trigger") and triad.get("core_rule"):
        norm = f"{triad.get('trigger', '').strip().lower()}|{triad.get('core_rule', '').strip().lower()}"
    else:
        norm = f"{element.get('name', '').strip().lower()}|{element.get('mechanism', '').strip().lower()}"
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()[:12]


def load(root, tolerant=False):
    data = {}
    malformed = []
    for table in TABLES:
        path = Path(root) / (table + ".jsonl")
        rows = []
        if path.exists():
            for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                stripped = line.strip()
                if stripped:
                    try:
                        row = parse_json(stripped)
                        if not isinstance(row, dict):
                            raise ValueError("expected JSON object")
                        rows.append(row)
                    except (ValueError, TypeError) as exc:
                        if tolerant:
                            malformed.append({"table": table, "line": n, "error": str(exc), "snippet": stripped[:120]})
                        else:
                            fail(f"{path.name}:{n}: {exc}")
        data[table] = rows
    return (data, malformed) if tolerant else data


def write_data(root, data):
    Path(root).mkdir(parents=True, exist_ok=True)
    for table in TABLES:
        rows = sorted(data[table], key=lambda r: r.get("id", r.get("raw_id", "")))
        (Path(root) / (table + ".jsonl")).write_text(
            "".join(json.dumps(r, ensure_ascii=False, sort_keys=True, allow_nan=False) + "\n" for r in rows),
            encoding="utf-8"
        )


def taxonomy(path):
    obj = parse_json(Path(path).read_text(encoding="utf-8"))
    if obj.get("version") not in COMPATIBLE_VERSIONS:
        fail("Unsupported taxonomy version")
    cats = [r["id"] for r in obj["categories"]]
    jobs = [r["id"] for r in obj["jobs"]]
    domains = [r["code"] for r in obj.get("domains_of_origin", [])]
    phases = [r["code"] for r in obj.get("action_lifecycle_phases", [])]
    frictions = [r["code"] for r in obj.get("target_user_frictions", [])]
    if len(cats) != len(set(cats)) or len(jobs) != len(set(jobs)):
        fail("Duplicate taxonomy ID")
    return set(cats), set(jobs), set(domains), set(phases), set(frictions)


def is_reserved_test_url(url_str):
    try:
        host = (urlparse(url_str).hostname or "").lower()
        return host in RESERVED_TEST_DOMAINS or host.endswith(".invalid")
    except ValueError:
        return True


def find_disagreeing_reviewers(ratings_for_element):
    """Возвращает (has_disagreement, disputed_reviewers) по ВСЕМ слепым оценкам (включая частичные с null в других полях),
    где разница между известными числовыми оценками по одному критерию >= 2."""
    disputed_reviewers = set()
    has_disagreement = False
    for d in DIMS:
        valid_r = [r for r in ratings_for_element if r.get("blind") is True and type(r.get("scores", {}).get(d)) is int]
        if len(valid_r) >= 2:
            vals = [r["scores"][d] for r in valid_r]
            lo, hi = min(vals), max(vals)
            if hi - lo >= 2:
                has_disagreement = True
                for r in valid_r:
                    if r["scores"][d] in (lo, hi):
                        disputed_reviewers.add(r["reviewer_id"])
    return has_disagreement, disputed_reviewers


def validate(data, cats, jobs, complete=False, domains=None, phases=None, frictions=None):
    errors = []
    indexes = {}
    domains = domains or set()
    phases = phases or set()
    frictions = frictions or set()

    def error(where, msg):
        errors.append(f"{where}: {msg}")

    def string(row, key, where):
        if not isinstance(row.get(key), str) or not row[key].strip():
            error(where, "nonempty string required: " + key)

    def strings(row, key, where, nonempty=False):
        value = row.get(key)
        if not isinstance(value, list) or any(not isinstance(v, str) or not v.strip() for v in value):
            error(where, "string list required: " + key)
        elif len(value) != len(set(value)):
            error(where, "duplicate list values: " + key)
        elif nonempty and not value:
            error(where, "nonempty list required: " + key)

    def enum(row, key, allowed, where):
        value = row.get(key)
        if not isinstance(value, str) or value not in allowed:
            error(where, "invalid " + key)

    all_ids = set()
    for table in TABLES:
        idx = {}
        for n, row in enumerate(data[table], 1):
            key = "raw_id" if table == "merge_map" else "id"
            where = f"{table}:{n}"
            string(row, key, where)
            identity = row.get(key)
            if isinstance(identity, str):
                if identity in idx or (table != "merge_map" and identity in all_ids):
                    error(where, "duplicate ID: " + identity)
                idx[identity] = row
                if table != "merge_map":
                    all_ids.add(identity)
        indexes[table] = idx

    for s in data["sources"]:
        w = s.get("id", "source")
        for key in ("url", "title", "owner", "origin_group", "language"):
            string(s, key, w)
        enum(s, "source_type", {"official_documentation", "source_code", "research", "practice_manual", "first_person_report", "review", "other"}, w)
        if type(s.get("accessed")) is not bool:
            error(w, "accessed must be boolean")
        if "retrieved_at" not in s:
            error(w, "retrieved_at field required, null if unviewed")
        if not isinstance(s.get("url"), str) or urlparse(s["url"]).scheme not in {"http", "https"} or not urlparse(s["url"]).netloc:
            error(w, "HTTP(S) URL required")
        when = s.get("retrieved_at")
        if when is not None:
            try:
                if not isinstance(when, str) or datetime.fromisoformat(when.replace("Z", "+00:00")).tzinfo is None:
                    raise ValueError("timezone missing")
            except ValueError:
                error(w, "invalid retrieved_at")
        elif s.get("accessed") is True:
            error(w, "accessed source requires retrieved_at")

    for f in data["findings"]:
        w = f.get("id", "finding")
        for key in ("task_id", "name", "description"):
            string(f, key, w)
        enum(f, "kind", KINDS, w)
        enum(f, "verification", {"verified", "lead", "inaccessible"}, w)
        strings(f, "category_ids", w, True)
        strings(f, "source_ids", w)
        if "domain_code" in f and f["domain_code"] is not None:
            if not isinstance(f["domain_code"], str) or not SAFE_CODE_RE.match(f["domain_code"]) or (domains and f["domain_code"] not in domains):
                error(w, "unknown domain_code: " + str(f["domain_code"]))
        if "phase_code" in f and f["phase_code"] is not None:
            if not isinstance(f["phase_code"], str) or not SAFE_CODE_RE.match(f["phase_code"]) or (phases and f["phase_code"] not in phases):
                error(w, "unknown phase_code: " + str(f["phase_code"]))
        if "primary_friction_code" in f and f["primary_friction_code"] is not None:
            if not isinstance(f["primary_friction_code"], str) or not SAFE_CODE_RE.match(f["primary_friction_code"]) or (frictions and f["primary_friction_code"] not in frictions):
                error(w, "unknown primary_friction_code: " + str(f["primary_friction_code"]))
        if not isinstance(f.get("claims"), list):
            error(w, "claims must be list")
        else:
            for claim in f["claims"]:
                if not isinstance(claim, dict):
                    error(w, "claim must be object")
                    continue
                for key in ("source_id", "locator", "text"):
                    string(claim, key, w)
                enum(claim, "type", {"existence", "benefit", "risk", "failure", "origin"}, w)
                enum(claim, "basis", {"quote", "paraphrase", "direct_observation"}, w)

    for e in data["elements"]:
        w = e.get("id", "element")
        for key in ("name", "description", "primary_category", "family_id", "mechanism", "benefit", "evidence_summary"):
            string(e, key, w)
        for key in ("category_ids", "jobs"):
            strings(e, key, w, True)
        for key in ("raw_ids", "source_ids", "contexts", "conditions", "costs", "risks", "alternatives", "questions"):
            strings(e, key, w)
        enum(e, "kind", KINDS, w)
        enum(e, "existence", {"verified", "unverified", "disputed"}, w)
        enum(e, "evidence_effect", {"unknown", "mixed", "supports", "no_effect", "adverse"}, w)
        enum(e, "review_status", {"pending", "accepted", "quarantined"}, w)
        enum(e, "risk_status", {"unassessed", "reviewed", "unresolved_high"}, w)
        enum(e, "selection_track", {"main", "reference", "hypothesis", "anti_pattern_warning"}, w)
        if "mechanism_triad" in e and e["mechanism_triad"] is not None:
            triad = e["mechanism_triad"]
            if not isinstance(triad, dict) or not all(isinstance(triad.get(k), str) and triad.get(k).strip() for k in ("trigger", "core_rule")):
                error(w, "mechanism_triad requires nonempty trigger and core_rule strings")
            if "psychological_loop" in triad and triad["psychological_loop"] is not None:
                if not isinstance(triad["psychological_loop"], str) or not triad["psychological_loop"].strip():
                    error(w, "mechanism_triad.psychological_loop must be nonempty string or null")
        if "evidence_grade" in e and e["evidence_grade"] is not None:
            enum(e, "evidence_grade", EVIDENCE_GRADES, w)
        if "domain_code" in e and e["domain_code"] is not None and domains and e["domain_code"] not in domains:
            error(w, "unknown domain_code: " + str(e["domain_code"]))
        if "phase_code" in e and e["phase_code"] is not None and phases and e["phase_code"] not in phases:
            error(w, "unknown phase_code: " + str(e["phase_code"]))
        if "target_frictions" in e and e["target_frictions"] is not None:
            strings(e, "target_frictions", w)
            if frictions and set(e.get("target_frictions", [])) - frictions:
                error(w, "unknown target_frictions")
        if "paradigm_novelty" in e and e["paradigm_novelty"] is not None:
            if type(e["paradigm_novelty"]) is not int or not 0 <= e["paradigm_novelty"] <= 3:
                error(w, "paradigm_novelty must be integer 0..3")

    for r in data["ratings"]:
        w = r.get("id", "rating")
        for key in ("element_id", "reviewer_id", "context_id", "rubric_version"):
            string(r, key, w)
        if r.get("rubric_version") not in COMPATIBLE_VERSIONS:
            error(w, "rubric_version mismatch")
        if type(r.get("blind")) is not bool:
            error(w, "blind must be boolean")
        for field in ("scores", "rationales"):
            if not isinstance(r.get(field), dict) or set(r[field]) != set(DIMS):
                error(w, field + " must contain exactly six criteria")
        if isinstance(r.get("scores"), dict):
            for val in r["scores"].values():
                if val is not None and (type(val) is not int or not 0 <= val <= 4):
                    error(w, "score must be integer 0..4 or null")
        if isinstance(r.get("rationales"), dict):
            for val in r["rationales"].values():
                if not isinstance(val, str) or not val.strip():
                    error(w, "rationale required, including unknown")
        if "source_ids" in r:
            strings(r, "source_ids", w)

    for m in data["merge_map"]:
        w = m.get("raw_id", "mapping")
        strings(m, "element_ids", w)
        string(m, "reason", w)
        enum(m, "decision", {"canonical", "merged_variant", "composite", "split", "quarantined", "out_of_scope"}, w)
        if isinstance(m.get("element_ids"), list):
            count = len(m["element_ids"])
            if m.get("decision") in {"canonical", "merged_variant", "composite"} and count != 1:
                error(w, "mapping requires one target")
            if m.get("decision") == "split" and count < 2:
                error(w, "split requires multiple targets")
            if m.get("decision") in {"quarantined", "out_of_scope"} and count != 0:
                error(w, "quarantined/out_of_scope mapping must have empty element_ids")

    for r in data["relations"]:
        w = r.get("id", "relation")
        for key in ("from_id", "to_id", "rationale"):
            string(r, key, w)
        enum(r, "type", {"complements", "alternative", "conflicts_with", "depends_on", "contains", "variant_of"}, w)
        enum(r, "status", {"documented", "hypothesis"}, w)

    for d in data["decisions"]:
        w = d.get("id", "decision")
        for key in ("type", "reason"):
            string(d, key, w)
        for key in ("reviewer_ids", "source_ids"):
            strings(d, key, w)
        if d.get("type") == "rating_resolution":
            string(d, "element_id", w)
            if d.get("resolved") is not True or len(d.get("reviewer_ids", [])) < 2:
                error(w, "rating resolution needs resolved=true and two reviewers")

    if errors:
        return errors

    def refs(values, table, where):
        for value in values:
            if value not in indexes[table]:
                error(where, "unknown " + table + " ID: " + value)

    for f in data["findings"]:
        w = f["id"]
        refs(f["source_ids"], "sources", w)
        for cat in f["category_ids"]:
            if cat not in cats:
                error(w, "unknown category " + cat)
        existence = False
        for c in f["claims"]:
            if c["source_id"] not in f["source_ids"]:
                error(w, "claim source missing from source_ids")
            s = indexes["sources"].get(c["source_id"], {})
            existence |= c["type"] == "existence" and s.get("accessed") is True
        if f["verification"] == "verified" and not existence:
            error(w, "verified finding lacks accessed existence claim")

    for e in data["elements"]:
        w = e["id"]
        refs(e["raw_ids"], "findings", w)
        refs(e["source_ids"], "sources", w)
        if e["primary_category"] not in e["category_ids"]:
            error(w, "primary_category not in category_ids")
        if set(e["category_ids"]) - cats or set(e["jobs"]) - jobs:
            error(w, "unknown category/job")
        if e["existence"] == "verified":
            linked = False
            for raw_id in e["raw_ids"]:
                f = indexes["findings"].get(raw_id, {})
                for c in f.get("claims", []):
                    s = indexes["sources"].get(c["source_id"], {})
                    linked |= f.get("verification") == "verified" and c["type"] == "existence" and c["source_id"] in e["source_ids"] and s.get("accessed") is True
            if not linked:
                error(w, "verified element lacks linked verified existence")

    seen_reviewers, seen_contexts = set(), set()
    ratings_by_element = {}
    for r in data["ratings"]:
        w = r["id"]
        refs([r["element_id"]], "elements", w)
        refs(r.get("source_ids", []), "sources", w)
        ratings_by_element.setdefault(r["element_id"], []).append(r)
        for seen, key in ((seen_reviewers, "reviewer_id"), (seen_contexts, "context_id")):
            pair = (r["element_id"], r[key])
            if pair in seen:
                error(w, "repeated evaluator/context for element: " + r[key])
            seen.add(pair)

    for m in data["merge_map"]:
        refs([m["raw_id"]], "findings", m["raw_id"])
        refs(m["element_ids"], "elements", m["raw_id"])
        for eid in m["element_ids"]:
            if m["raw_id"] not in indexes["elements"].get(eid, {}).get("raw_ids", []):
                error(m["raw_id"], "mapping missing reciprocal element.raw_ids")

    for e in data["elements"]:
        for raw_id in e["raw_ids"]:
            m = indexes["merge_map"].get(raw_id)
            if (complete or m is not None) and e["id"] not in (m or {}).get("element_ids", []):
                error(e["id"], "missing reciprocal merge_map for " + raw_id)

    if complete:
        for raw_id in indexes["findings"]:
            if raw_id not in indexes["merge_map"]:
                error(raw_id, "finding has no disposition")

    contains_from = set()
    for r in data["relations"]:
        refs([r["from_id"], r["to_id"]], "elements", r["id"])
        if r["from_id"] == r["to_id"]:
            error(r["id"], "self relation")
        if r["type"] == "contains":
            contains_from.add(r["from_id"])

    if complete:
        composite_targets = {
            eid for m in data["merge_map"] if m.get("decision") == "composite" for eid in m.get("element_ids", [])
        }
        for e in data["elements"]:
            if e["id"] in composite_targets and e["kind"] == "method_system" and e["id"] not in contains_from:
                error(e["id"], "composite method_system lacks contains relations to its component mechanisms")

    reviewers_by_element = {}
    for r in data["ratings"]:
        reviewers_by_element.setdefault(r["element_id"], set()).add(r["reviewer_id"])

    for d in data["decisions"]:
        refs(d["source_ids"], "sources", d["id"])
        if d.get("element_id"):
            refs([d["element_id"]], "elements", d["id"])
        if d["type"] == "rating_resolution":
            eid = d["element_id"]
            if set(d["reviewer_ids"]) - reviewers_by_element.get(eid, set()):
                error(d["id"], "resolution names unknown reviewers")
            else:
                has_dis, disputed_revs = find_disagreeing_reviewers(ratings_by_element.get(eid, []))
                if has_dis and not (disputed_revs <= set(d["reviewer_ids"])):
                    missing_revs = sorted(disputed_revs - set(d["reviewer_ids"]))
                    error(d["id"], f"resolution omits disagreeing reviewers: {', '.join(missing_revs)}")

    return errors


def configuration(path=None):
    config = {
        "target": 200,
        "core": 100,
        "rare_gems_quota": 0,
        "quality_floor": 60,
        "weights": WEIGHTS,
        "mode": "research"
    }
    if path:
        obj = parse_json(Path(path).read_text(encoding="utf-8"))
        if obj.get("rubric_version") not in COMPATIBLE_VERSIONS or obj.get("taxonomy_version") not in COMPATIBLE_VERSIONS:
            fail("RUN versions mismatch")
        config.update(obj.get("selection", {}))
    if config.get("mode") not in {"research", "synthetic_demo"}:
        fail("mode must be research or synthetic_demo")
    if type(config["target"]) is not int or not 100 <= config["target"] <= 300:
        fail("target must be integer 100..300")
    if type(config["core"]) is not int or not 1 <= config["core"] <= min(100, config["target"]):
        fail("core must be integer 1..100, no larger than target")
    rq = config.get("rare_gems_quota", 0)
    if type(rq) is not int or rq < 0 or rq > (config["target"] - config["core"]):
        fail(f"rare_gems_quota must be integer 0..{config['target'] - config['core']}")
    if type(config["quality_floor"]) not in {int, float} or type(config["quality_floor"]) is bool or not math.isfinite(config["quality_floor"]) or not 0 <= config["quality_floor"] <= 100:
        fail("quality_floor must be 0..100")
    w = config["weights"]
    if not isinstance(w, dict) or set(w) != set(DIMS) or any(type(v) not in {int, float} or type(v) is bool or not math.isfinite(v) or v < 0 for v in w.values()) or abs(sum(w.values()) - 1) > 1e-9:
        fail("weights must match six criteria and sum to one")
    return config


def score(values, weights):
    return round(25 * sum(weights[d] * values[d] for d in DIMS), 10)


def run_selection_for_pool(pool, config):
    selected, seen_jobs, seen_cats, seen_families = [], set(), set(), set()

    def add(row, tier, gain=None, utility=None, reason=None):
        e = row["element"]
        selected.append({
            "id": row["id"],
            "tier": tier,
            "Q": row["Q"],
            "G": gain,
            "U": utility,
            "reason": reason or ("quality_order" if tier == "core" else "quality_and_marginal_coverage")
        })
        seen_jobs.update(e["jobs"])
        seen_cats.update(e["category_ids"])
        seen_families.add(e["family_id"])

    for row in pool[:config["core"]]:
        add(row, "core")

    remaining = {r["id"]: r for r in pool[config["core"]:]}

    rare_quota = min(config.get("rare_gems_quota", 0), max(0, config["target"] - len(selected)))
    if rare_quota > 0:
        rare_candidates = [
            r for r in remaining.values()
            if r["element"].get("paradigm_novelty") == 3
        ]
        rare_candidates.sort(key=lambda r: (-r["Q"], r["id"]))
        for row in rare_candidates[:rare_quota]:
            if len(selected) >= config["target"]:
                break
            add(row, "rare_lateral_gem", None, row["Q"], "protected_rare_lateral_lane")
            del remaining[row["id"]]

    while remaining and len(selected) < config["target"]:
        best = None
        for row in remaining.values():
            e = row["element"]
            new_jobs, new_cats = set(e["jobs"]) - seen_jobs, set(e["category_ids"]) - seen_cats
            gap = bool(new_jobs or new_cats)
            job_gain = min(1.0, len(new_jobs))
            cat_gain = min(1.0, len(new_cats))
            fam_gain = 1.0 if e["family_id"] not in seen_families else 0.0
            gain = .50 * job_gain + .30 * cat_gain + .20 * fam_gain
            utility = .70 * row["Q"] + 30 * gain
            key = (-int(gap), -utility, -row["Q"], row["id"])
            if best is None or key < best[0]:
                best = (key, row, gain, utility, gap)
        _, row, gain, utility, gap = best
        add(row, "extension", gain, utility, "coverage_gap_first" if gap else "quality_and_marginal_coverage")
        del remaining[row["id"]]

    return selected, seen_jobs, seen_cats, seen_families


def calculate(data, cats, jobs, config):
    synthetic_flag = any(row.get("synthetic") is True for rows in data.values() for row in rows)
    reserved_url_flag = any(is_reserved_test_url(s.get("url", "")) for s in data["sources"])
    synthetic = synthetic_flag or reserved_url_flag
    if synthetic and config.get("mode") != "synthetic_demo":
        fail("Synthetic examples or reserved .invalid/example URLs cannot enter a research release; use a separate demo RUN")

    all_blind_by_element = {}
    complete_blind_by_element = {}
    for r in data["ratings"]:
        if r["blind"]:
            all_blind_by_element.setdefault(r["element_id"], []).append(r)
            if all(r["scores"][d] is not None for d in DIMS):
                complete_blind_by_element.setdefault(r["element_id"], []).append(r)

    resolved = {d["element_id"] for d in data["decisions"] if d["type"] == "rating_resolution" and d.get("resolved") is True}
    sources_idx = {s["id"]: s for s in data["sources"]}

    eligible, excluded = [], []
    single_origin_warnings = []
    anti_patterns_cataloged = []

    for e in sorted(data["elements"], key=lambda x: x["id"]):
        if e["kind"] == "anti_pattern" or e.get("selection_track") == "anti_pattern_warning":
            anti_patterns_cataloged.append(e["id"])

        reasons = []
        for condition, reason in (
            (e["kind"] not in RANKABLE, "unit_not_rankable"),
            (e["existence"] != "verified", "existence_not_verified"),
            (e["review_status"] != "accepted", "review_not_accepted"),
            (e["risk_status"] != "reviewed", "risks_not_reviewed"),
            (e["selection_track"] != "main", "not_main_track")
        ):
            if condition:
                reasons.append(reason)

        complete_rs = complete_blind_by_element.get(e["id"], [])
        all_blind_rs = all_blind_by_element.get(e["id"], [])

        if len(complete_rs) < 2:
            reasons.append("fewer_than_two_complete_blind_reviews")

        if len(complete_rs) >= 2:
            low = {d: min(r["scores"][d] for r in complete_rs) for d in DIMS}
            high = {d: max(r["scores"][d] for r in complete_rs) for d in DIMS}
            median = {d: statistics.median(r["scores"][d] for r in complete_rs) for d in DIMS}

        if len(all_blind_rs) >= 2:
            has_disagreement, _ = find_disagreeing_reviewers(all_blind_rs)
            if has_disagreement and e["id"] not in resolved:
                reasons.append("unresolved_rating_disagreement")

        origin_groups = {
            sources_idx[sid]["origin_group"]
            for sid in e.get("source_ids", [])
            if sid in sources_idx and sources_idx[sid].get("origin_group")
        }
        independent_origins_count = len(origin_groups)
        if len(e.get("source_ids", [])) > 1 and independent_origins_count == 1:
            single_origin_warnings.append({
                "element_id": e["id"],
                "source_count": len(e["source_ids"]),
                "single_origin_group": next(iter(origin_groups))
            })

        if reasons:
            excluded.append({"id": e["id"], "reasons": reasons})
        else:
            known_counts = {
                d: sum(1 for r in all_blind_rs if r["scores"][d] is not None)
                for d in DIMS
            }
            eligible.append({
                "id": e["id"],
                "element": e,
                "median": median,
                "low": low,
                "high": high,
                "reviewers": len(complete_rs),
                "known_scores_per_dim": known_counts,
                "independent_origins_count": independent_origins_count,
                "Q": score(median, config["weights"]),
                "Q_min": score(low, config["weights"]),
                "Q_max": score(high, config["weights"])
            })

    eligible.sort(key=lambda x: (-x["Q"], r["id"]) if False else (-x["Q"], x["id"]))
    pool = [r for r in eligible if r["Q"] >= config["quality_floor"]]
    selected, seen_jobs, seen_cats, seen_families = run_selection_for_pool(pool, config)

    base_core = {s["id"] for s in selected if s["tier"] == "core"}
    base_full = {s["id"] for s in selected}
    scenarios = {
        "baseline": (config["weights"], "median"),
        **{k: (v, "median") for k, v in PROFILES.items()},
        "opinions_low": (config["weights"], "low"),
        "opinions_high": (config["weights"], "high")
    }
    sensitivity = {}
    occurrences = dict.fromkeys((r["id"] for r in eligible), 0)
    full_atlas_occurrences = dict.fromkeys((r["id"] for r in eligible), 0)

    for name, (weights, field) in scenarios.items():
        scen_eligible = []
        for r in eligible:
            r_copy = dict(r)
            r_copy["Q"] = score(r[field], weights)
            scen_eligible.append(r_copy)
        scen_eligible.sort(key=lambda r: (-r["Q"], r["id"]))
        scen_pool = [r for r in scen_eligible if r["Q"] >= config["quality_floor"]]
        scen_selected, _, _, _ = run_selection_for_pool(scen_pool, config)

        core_ids = [s["id"] for s in scen_selected if s["tier"] == "core"]
        full_ids = [s["id"] for s in scen_selected]
        current_core = set(core_ids)
        current_full = set(full_ids)
        union_core = base_core | current_core
        union_full = base_full | current_full

        sensitivity[name] = {
            "core_ids": core_ids,
            "full_atlas_ids": full_ids,
            "jaccard_with_baseline": len(base_core & current_core) / len(union_core) if union_core else None,
            "full_atlas_jaccard_with_baseline": len(base_full & current_full) / len(union_full) if union_full else None
        }
        for eid in core_ids:
            occurrences[eid] += 1
        for eid in full_ids:
            full_atlas_occurrences[eid] += 1

    boundary = pool[min(config["core"], len(pool)) - 1]["Q"] if pool else None
    audit = {
        "tool_version": VERSION,
        "rubric_version": RUBRIC_VERSION,
        "config": config,
        "counts": {k: len(v) for k, v in data.items()},
        "eligible": len(eligible),
        "above_floor": len(pool),
        "selected": len(selected),
        "target_reached": len(selected) >= config["target"],
        "missing_categories": sorted(cats - seen_cats),
        "missing_jobs": sorted(jobs - seen_jobs),
        "single_origin_echo_warnings": single_origin_warnings,
        "anti_patterns_cataloged": anti_patterns_cataloged,
        "excluded": excluded,
        "below_quality_floor": [r["id"] for r in eligible if r["Q"] < config["quality_floor"]],
        "core_boundary_ties": [r["id"] for r in pool if r["Q"] == boundary],
        "sensitivity": sensitivity,
        "core_occurrences_in_declared_scenarios": occurrences,
        "full_atlas_occurrences_in_declared_scenarios": full_atlas_occurrences,
        "status": "draft_requires_content_and_source_audit",
        "not_checked": [
            "URL contents and truth",
            "semantic deduplication",
            "reviewer independence",
            "efficacy",
            "completeness of internet coverage"
        ]
    }
    audit["synthetic_input"] = synthetic
    audit["partial_or_unblinded_ratings"] = [
        r["id"] for r in data["ratings"] if not r["blind"] or any(r["scores"][d] is None for d in DIMS)
    ]
    if synthetic or config.get("mode") == "synthetic_demo":
        audit["status"] = "synthetic_demo_not_research"
    return eligible, selected, audit


def snapshot_hashes(root):
    return {p.name: sha(p) for p in sorted(Path(root).glob("*.jsonl"))}


def rank(root, out, cats, jobs, config, taxonomy_path, domains=None, phases=None, frictions=None):
    data = load(root)
    errors = validate(data, cats, jobs, complete=True, domains=domains, phases=phases, frictions=frictions)
    if errors:
        fail("\n".join(errors[:50]))
    eligible, selected, audit = calculate(data, cats, jobs, config)
    output = Path(out)
    if output.exists():
        fail("Output directory already exists; choose a new release path")
    output.mkdir(parents=True)
    with (output / "quality-ranked.csv").open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "order", "score_rank", "id", "name", "Q", "Q_min", "Q_max",
            *DIMS, "independent_origins", "category_ids", "jobs", "source_ids"
        ])
        score_rank, prior_score = 0, None
        for n, r in enumerate(eligible, 1):
            e = r["element"]
            if r["Q"] != prior_score:
                score_rank, prior_score = n, r["Q"]
            writer.writerow([
                n, score_rank, r["id"], e["name"], round(r["Q"], 4), round(r["Q_min"], 4), round(r["Q_max"], 4),
                *(r["median"][d] for d in DIMS), r["independent_origins_count"],
                "|".join(e["category_ids"]), "|".join(e["jobs"]), "|".join(e["source_ids"])
            ])
    audit["input_sha256"] = snapshot_hashes(root)
    audit["taxonomy_sha256"] = sha(taxonomy_path)
    audit["tool_sha256"] = sha(__file__)
    audit["generated_at"] = datetime.now(timezone.utc).isoformat()
    dump(output / "audit.json", audit)
    dump(output / "atlas-selection.json", {"status": audit["status"], "config": config, "selected": selected})
    lines = [
        "# Черновик атласа (Hybrid v2.1.1) — требуется содержательный аудит",
        "",
        "Это вывод по переданным оценкам. Источники и эффективность программой не проверены.",
        ""
    ]
    if audit["status"] == "synthetic_demo_not_research":
        lines.extend(["ТЕХНИЧЕСКИЙ ПРИМЕР: данные вымышлены, это не результаты исследования.", ""])
    elements = {e["id"]: e for e in data["elements"]}
    sources = {s["id"]: s for s in data["sources"]}
    for s in selected:
        e = elements[s["id"]]
        triad = e.get("mechanism_triad")
        if isinstance(triad, dict):
            ploop = triad.get("psychological_loop") or "не применимо (инфраструктурное свойство)"
            triad_line = f"Триада механизма: Триггер: {triad['trigger']} -> Правило: {triad['core_rule']} -> Контур: {ploop}"
        else:
            triad_line = "Механизм: " + e["mechanism"]
        vendor_claim = e.get("vendor_claim", "Не выделено отдельно")
        ev_grade = e.get("evidence_grade", "ungraded")
        lines.extend([
            f"## {e['id']} — {e['name']}",
            "",
            e["description"],
            "",
            triad_line,
            "",
            "Обещание авторов/маркетинга (L3): " + vendor_claim,
            "",
            "Возможная польза (суждение аналитика): " + e["benefit"],
            "",
            "Условия: " + "; ".join(e["conditions"]),
            "",
            "Риски и режимы срыва (L5): " + "; ".join(e["risks"]),
            "",
            f"Свидетельства эффекта (L4 [{ev_grade}]): " + e["evidence_effect"] + ". " + e["evidence_summary"],
            "",
            f"Отбор: {s['tier']} ({s['reason']}); Q={s['Q']:.2f}. ID оценок сохранены во входном снимке.",
            ""
        ])
        for sid in e["source_ids"]:
            lines.append(f"- {sid} ({sources[sid]['origin_group']}): {sources[sid]['url']}")
        lines.append("")
    (output / "ATLAS-DRAFT.md").write_text("\n".join(lines), encoding="utf-8")
    return {
        "eligible": len(eligible),
        "selected": len(selected),
        "target_reached": audit["target_reached"],
        "status": audit["status"]
    }


def merge(inputs, output, cats, jobs, domains=None, phases=None, frictions=None):
    dest = Path(output)
    if dest.exists():
        fail("Merge output already exists")
    merged = {k: {} for k in TABLES}
    receipts = []
    for root in inputs:
        data = load(root)
        receipts.append({"input": str(root), "sha256": snapshot_hashes(root)})
        for table in TABLES:
            key = "raw_id" if table == "merge_map" else "id"
            for row in data[table]:
                identity = row.get(key)
                if not isinstance(identity, str) or not identity.strip():
                    fail("Missing ID in merge input: " + table)
                old = merged[table].get(identity)
                if old is not None and old != row:
                    fail("Conflicting ID, explicit revision required: " + identity)
                merged[table][identity] = row
    data = {k: list(v.values()) for k, v in merged.items()}
    errors = validate(data, cats, jobs, domains=domains, phases=phases, frictions=frictions)
    if errors:
        fail("\n".join(errors[:50]))
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="atlas-merge-", dir=dest.parent) as temporary:
        staged = Path(temporary) / "snapshot"
        write_data(staged, data)
        dump(staged / "MERGE.json", {"inputs": receipts, "semantic_deduplication": "not_performed"})
        if dest.exists():
            fail("Output appeared during merge")
        os.rename(staged, dest)
    return {k: len(v) for k, v in data.items()}


def shard_findings(
    directory,
    out_dir,
    taxonomy_path=None,
    max_records=60,
    max_bytes=120000,
    max_findings_bytes=None,
    prompt_reserve_bytes=0,
    index_max_records=250,
    index_max_bytes=60000,
    preview_chars=160
):
    """LAB-010-R2 (R02 & R03 Fixes):
    - Полный бюджет автономного пакета (`max_bytes`) охватывает `findings_bytes + sources_bytes + prompt_reserve_bytes`
      (где источники внутри каждой части дедуплицированы по `source_id`).
    - Дополнительно проверяется потолок только на файл находок `max_findings_bytes` (по умолчанию равен `max_bytes`).
    - Если одна обязательная связка (1 находка + её обязательные источники + резерв промта) превышает бюджет пакета,
      она не маскируется под обычный пакет и не обрезается, а выделяется в отдельную часть со статусом
      `packet_status="oversized_single_bundle"` (`oversized_single_record=True`) и заносится в `oversized_single_records`.
    - Навигационный индекс (`compact_findings_index_partNNN.txt`) ограничен КАК по числу строк (`index_max_records`),
      ТАК и по объёму в байтах (`index_max_bytes`, адаптивно `<= max_bytes`). Каждая строка индекса содержит короткое
      превью (`preview_chars` символов) с явной пометкой `[PREVIEW_TRUNCATED_AT_...; FULL_IN=...]` при сокращении,
      адрес полного файла части (`part_file`) и явный маркер `[OVERSIZED_BUNDLE:...]` для исключительных находок."""
    if type(max_records) is not int or max_records < 1:
        fail("max_records must be positive integer")
    if type(max_bytes) is not int or max_bytes < 1024:
        fail("max_bytes must be integer >= 1024")
    if max_findings_bytes is None:
        max_findings_bytes = max_bytes
    if type(max_findings_bytes) is not int or not (512 <= max_findings_bytes <= max_bytes):
        fail("max_findings_bytes must be integer between 512 and max_bytes")
    if type(prompt_reserve_bytes) is not int or not (0 <= prompt_reserve_bytes < max_bytes):
        fail("prompt_reserve_bytes must be integer 0 <= reserve < max_bytes")
    if type(index_max_records) is not int or index_max_records < 1:
        fail("index_max_records must be positive integer")
    if type(index_max_bytes) is not int or index_max_bytes < 512:
        fail("index_max_bytes must be integer >= 512")
    if type(preview_chars) is not int or preview_chars < 32:
        fail("preview_chars must be integer >= 32")

    effective_index_max_bytes = min(index_max_bytes, max_bytes)

    in_root = Path(directory).resolve()
    dest = Path(out_dir)
    if dest.exists() or dest.is_symlink():
        fail("Shard output directory already exists; choose a new path")
    dest_resolved = dest.resolve()
    if dest_resolved == in_root or dest_resolved.is_relative_to(in_root) or in_root.is_relative_to(dest_resolved):
        fail("Shard output directory must be separate from input dataset directory")

    tax_file = Path(taxonomy_path) if taxonomy_path else (Path(__file__).resolve().parent.parent / "taxonomy.json")
    cats, jobs, domains, phases, frictions = taxonomy(tax_file)
    data = load(in_root)
    errors = validate(data, cats, jobs, complete=False, domains=domains, phases=phases, frictions=frictions)
    if errors:
        fail("Invalid input dataset for sharding:\n" + "\n".join(errors[:50]))

    sources_by_id = {s["id"]: s for s in data["sources"]}
    source_line_bytes = {
        sid: len((json.dumps(s, ensure_ascii=False, sort_keys=True) + "\n").encode("utf-8"))
        for sid, s in sources_by_id.items()
    }

    groups = {}
    for f in sorted(data["findings"], key=lambda x: x["id"]):
        phase = f.get("phase_code") or (f["category_ids"][0] if f.get("category_ids") else "UNASSIGNED")
        friction = f.get("primary_friction_code") or "GENERAL"
        ensure_safe_token(phase, "phase_code")
        ensure_safe_token(friction, "primary_friction_code")
        if phase != "UNASSIGNED" and phase not in phases and phase not in cats:
            fail(f"Unknown phase/category token: {phase}")
        if friction != "GENERAL" and friction not in frictions:
            fail(f"Unknown friction token: {friction}")

        gkey = f"SHARD_{phase}__{friction}"
        groups.setdefault(gkey, []).append(f)

    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="atlas-shard-", dir=dest.parent) as temporary:
        staged = Path(temporary) / "shards_out"
        staged.mkdir(parents=True, exist_ok=True)
        staged_resolved = staged.resolve()

        manifest_shards = {}
        oversized_findings = []
        accounted_ids = []
        index_records = []

        for gkey, rows in sorted(groups.items()):
            ensure_safe_token(gkey, "shard_group_key")
            part_num = 1
            current_rows = []
            current_f_bytes = 0
            current_sids = set()
            current_s_bytes = 0

            def flush_part(rows_to_write, pnum, is_oversized=False, oversize_reason=None):
                part_id = f"{gkey}__part{pnum:03d}"
                fname = f"{part_id}.jsonl"
                fpath = (staged / fname).resolve()
                if fpath.parent != staged_resolved or not fpath.is_relative_to(staged_resolved):
                    fail("Unsafe shard output path detected")
                f_serialized = "".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in rows_to_write)
                fpath.write_text(f_serialized, encoding="utf-8")
                f_bytes = len(f_serialized.encode("utf-8"))

                req_sids = sorted({sid for r in rows_to_write for sid in r.get("source_ids", []) if sid in sources_by_id})
                sname = f"{part_id}.sources.jsonl"
                spath = (staged / sname).resolve()
                s_serialized = "".join(
                    json.dumps(sources_by_id[sid], ensure_ascii=False, sort_keys=True) + "\n" for sid in req_sids
                )
                spath.write_text(s_serialized, encoding="utf-8")
                s_bytes = len(s_serialized.encode("utf-8"))
                tot_bytes = f_bytes + s_bytes + prompt_reserve_bytes

                fids = [r["id"] for r in rows_to_write]
                accounted_ids.extend(fids)
                p_status = "oversized_single_bundle" if is_oversized else "standard_bounded_packet"
                manifest_shards[part_id] = {
                    "group": gkey,
                    "part": pnum,
                    "packet_status": p_status,
                    "oversize_reason": oversize_reason,
                    "count": len(rows_to_write),
                    "bytes": f_bytes,
                    "findings_bytes": f_bytes,
                    "sources_bytes": s_bytes,
                    "prompt_reserve_bytes": prompt_reserve_bytes,
                    "total_bytes": tot_bytes,
                    "finding_ids": fids,
                    "source_ids": req_sids,
                    "file": fname,
                    "sources_file": sname,
                    "oversized_single_record": is_oversized
                }

                # R02 Fix: Build bounded navigation index lines with explicit preview truncation and full-material pointer
                for r in rows_to_write:
                    phase_val = r.get("phase_code") or (r["category_ids"][0] if r.get("category_ids") else "UNASSIGNED")
                    fric_val = r.get("primary_friction_code") or "GENERAL"
                    raw_desc = r["description"].replace("\n", " ").strip()
                    full_desc_chars = len(r["description"])
                    if len(raw_desc) > preview_chars:
                        preview = (
                            f"{raw_desc[:preview_chars]}... "
                            f"[PREVIEW_TRUNCATED_AT_{preview_chars}_OF_{full_desc_chars}_CHARS; FULL_IN={fname}]"
                        )
                        is_truncated_preview = True
                    else:
                        preview = f"{raw_desc} [FULL_IN={fname}]"
                        is_truncated_preview = False

                    status_tag = f"OVERSIZED_BUNDLE:{oversize_reason}" if is_oversized else "STANDARD"
                    idx_line = (
                        f"{r['id']} | {phase_val} | {fric_val} | {r['kind']} | {status_tag} | "
                        f"part={fname} | sources={sname} | {r['name']} :: {preview}"
                    )
                    index_records.append({
                        "finding_id": r["id"],
                        "line": idx_line,
                        "bytes": len((idx_line + "\n").encode("utf-8")),
                        "oversized_single_record": is_oversized,
                        "preview_truncated": is_truncated_preview,
                        "part_file": fname
                    })

            for r in rows:
                f_line_bytes = len((json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n").encode("utf-8"))
                r_sids = {sid for sid in r.get("source_ids", []) if sid in sources_by_id}
                r_solo_s_bytes = sum(source_line_bytes[sid] for sid in r_sids)
                r_solo_total_bytes = f_line_bytes + r_solo_s_bytes + prompt_reserve_bytes

                # Check if this single record + its required sources exceeds either findings budget or total packet budget
                if f_line_bytes > max_findings_bytes or r_solo_total_bytes > max_bytes:
                    if current_rows:
                        flush_part(current_rows, part_num, is_oversized=False)
                        part_num += 1
                        current_rows = []
                        current_f_bytes = 0
                        current_sids = set()
                        current_s_bytes = 0
                    reasons = []
                    if f_line_bytes > max_findings_bytes:
                        reasons.append("finding_exceeds_max_findings_bytes")
                    if r_solo_total_bytes > max_bytes:
                        reasons.append("bundle_with_sources_exceeds_max_packet_bytes")
                    reason_str = "+".join(reasons)
                    flush_part([r], part_num, is_oversized=True, oversize_reason=reason_str)
                    oversized_findings.append({
                        "id": r["id"],
                        "findings_bytes": f_line_bytes,
                        "sources_bytes": r_solo_s_bytes,
                        "prompt_reserve_bytes": prompt_reserve_bytes,
                        "total_bytes": r_solo_total_bytes,
                        "reason": reason_str,
                        "part_id": f"{gkey}__part{part_num:03d}"
                    })
                    part_num += 1
                    continue

                # Calculate incremental bytes if added to current_rows (deduplicating shared sources!)
                added_sids = r_sids - current_sids
                added_s_bytes = sum(source_line_bytes[sid] for sid in added_sids)
                candidate_f_bytes = current_f_bytes + f_line_bytes
                candidate_s_bytes = current_s_bytes + added_s_bytes
                candidate_total_bytes = candidate_f_bytes + candidate_s_bytes + prompt_reserve_bytes

                if current_rows and (
                    len(current_rows) >= max_records
                    or candidate_f_bytes > max_findings_bytes
                    or candidate_total_bytes > max_bytes
                ):
                    flush_part(current_rows, part_num, is_oversized=False)
                    part_num += 1
                    current_rows = []
                    current_f_bytes = 0
                    current_sids = set()
                    current_s_bytes = 0
                    added_sids = r_sids
                    added_s_bytes = r_solo_s_bytes

                current_rows.append(r)
                current_f_bytes += f_line_bytes
                current_sids |= added_sids
                current_s_bytes += added_s_bytes

            if current_rows:
                flush_part(current_rows, part_num, is_oversized=False)

        # R02 Fix: Partition navigation index by BOTH index_max_records AND effective_index_max_bytes
        index_parts = []
        cur_idx_items = []
        cur_idx_bytes = 0
        ip_num = 1

        def flush_index_part(items, num):
            ip_name = f"compact_findings_index_part{num:03d}.txt"
            ip_path = (staged / ip_name).resolve()
            ip_text = "\n".join(it["line"] for it in items) + ("\n" if items else "")
            ip_path.write_text(ip_text, encoding="utf-8")
            oversized_in_idx = [it["finding_id"] for it in items if it["oversized_single_record"]]
            truncated_in_idx = sum(1 for it in items if it["preview_truncated"])
            index_parts.append({
                "file": ip_name,
                "records": len(items),
                "bytes": len(ip_text.encode("utf-8")),
                "contains_oversized_records": bool(oversized_in_idx),
                "oversized_record_ids": oversized_in_idx,
                "truncated_previews_count": truncated_in_idx
            })

        for item in index_records:
            if item["bytes"] > effective_index_max_bytes:
                fail(
                    f"A single index entry ({item['finding_id']}) needs {item['bytes']} bytes, "
                    f"exceeding index_max_bytes={effective_index_max_bytes}; "
                    "increase the index budget or shorten preview_chars. No shard output was published."
                )
            if cur_idx_items and (
                len(cur_idx_items) >= index_max_records
                or cur_idx_bytes + item["bytes"] > effective_index_max_bytes
            ):
                flush_index_part(cur_idx_items, ip_num)
                ip_num += 1
                cur_idx_items = []
                cur_idx_bytes = 0
            cur_idx_items.append(item)
            cur_idx_bytes += item["bytes"]

        if cur_idx_items or not index_parts:
            flush_index_part(cur_idx_items, ip_num)

        all_input_ids = sorted(f["id"] for f in data["findings"])
        if sorted(accounted_ids) != all_input_ids or len(accounted_ids) != len(set(accounted_ids)):
            fail("Shard accounting mismatch: lost or duplicated finding IDs")

        largest_part_count = max((v["count"] for v in manifest_shards.values()), default=0)
        largest_std_f_bytes = max(
            (v["findings_bytes"] for v in manifest_shards.values() if not v["oversized_single_record"]),
            default=0
        )
        largest_std_tot_bytes = max(
            (v["total_bytes"] for v in manifest_shards.values() if not v["oversized_single_record"]),
            default=0
        )

        dump(staged / "shards_manifest.json", {
            "schema_version": VERSION,
            "input_sha256": snapshot_hashes(in_root),
            "limits": {
                "max_records_per_shard": max_records,
                "max_packet_total_bytes": max_bytes,
                "max_findings_bytes_per_shard": max_findings_bytes,
                "prompt_reserve_bytes": prompt_reserve_bytes,
                "index_max_records": index_max_records,
                "index_max_bytes": effective_index_max_bytes,
                "preview_chars": preview_chars
            },
            "total_findings": len(data["findings"]),
            "total_shard_parts": len(manifest_shards),
            "largest_part_records": largest_part_count,
            "largest_standard_part_bytes": largest_std_f_bytes,
            "largest_standard_packet_total_bytes": largest_std_tot_bytes,
            "oversized_single_records": oversized_findings,
            "index_parts": index_parts,
            "shards": manifest_shards
        })

        if dest.exists():
            fail("Shard output directory appeared during execution")
        os.rename(staged, dest)

    return {
        "total_findings": len(data["findings"]),
        "shards_count": len(manifest_shards),
        "largest_part_records": largest_part_count,
        "largest_standard_packet_total_bytes": largest_std_tot_bytes,
        "oversized_records_count": len(oversized_findings),
        "index_parts_count": len(index_parts)
    }


def prepare_blind_packet(directory, out_file, taxonomy_path=None):
    """LAB-010-R2 (R04 Fix):
    Исключает окно перезаписи при конкурирующей публикации (TOCTOU race between exists() and os.replace()).
    Использует атомарный примитив ядра ОС без перезаписи: `os.link(temp_path, out)`,
    который гарантированно завершается с `FileExistsError`, если целевое имя `out` было создано другим процессом
    в любой момент до публикации, и всегда удаляет временный staging-файл в блоке `finally`."""
    in_root = Path(directory).resolve()
    out = Path(out_file)
    if out.exists() or out.is_symlink():
        fail("Blind packet output path already exists; refusing to overwrite")
    if out.parent.is_symlink():
        fail("Blind packet output parent directory cannot be a symlink")
    out_resolved = out.resolve()
    if out_resolved == in_root or out_resolved.is_relative_to(in_root):
        fail("Blind packet output path cannot be inside or equal to the input dataset directory")

    tax_file = Path(taxonomy_path) if taxonomy_path else (Path(__file__).resolve().parent.parent / "taxonomy.json")
    cats, jobs, domains, phases, frictions = taxonomy(tax_file)
    data = load(in_root)
    errors = validate(data, cats, jobs, complete=False, domains=domains, phases=phases, frictions=frictions)
    if errors:
        fail("Invalid input dataset for blind packet preparation:\n" + "\n".join(errors[:50]))

    blind_elements = []
    for e in sorted(data["elements"], key=lambda x: x["id"]):
        if e["kind"] in RANKABLE and e["review_status"] == "accepted":
            clean = {
                "id": e["id"],
                "name": e["name"],
                "kind": e["kind"],
                "primary_category": e["primary_category"],
                "category_ids": e["category_ids"],
                "jobs": e["jobs"],
                "description": e["description"],
                "mechanism": e["mechanism"],
                "mechanism_triad": e.get("mechanism_triad"),
                "vendor_claim": e.get("vendor_claim"),
                "evidence_effect": e["evidence_effect"],
                "evidence_grade": e.get("evidence_grade"),
                "evidence_summary": e["evidence_summary"],
                "contexts": e["contexts"],
                "conditions": e["conditions"],
                "costs": e["costs"],
                "risks": e["risks"],
                "source_ids": e["source_ids"]
            }
            blind_elements.append(clean)

    payload = "".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in blind_elements)
    out.parent.mkdir(parents=True, exist_ok=True)
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=out.parent, prefix="blind-pkt-", delete=False) as tf:
            temp_path = Path(tf.name)
            tf.write(payload)
            tf.flush()
            os.fsync(tf.fileno())
        try:
            # Atomic no-overwrite publication: os.link fails atomically with FileExistsError if `out` exists
            os.link(temp_path, out)
        except FileExistsError:
            fail("Blind packet output appeared concurrently during execution; refusing to overwrite")
        except OSError as exc:
            # A direct O_EXCL write would expose an incomplete final file on failure.
            fail(
                "Atomic no-overwrite publication requires hardlink support and write permission "
                "on this filesystem; no output was published. Use a supported local directory. "
                + str(exc)
            )
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)

    return {"blind_elements_prepared": len(blind_elements), "output": str(out)}


def manifest(root, name, checking=False):
    root = Path(root).resolve()
    if Path(name).name != name:
        fail("Manifest must be a filename")
    target = root / name
    if checking:
        obj = parse_json(target.read_text(encoding="utf-8"))
        seen = set()
        for record in obj["files"]:
            rel = Path(record["path"])
            path = root / rel
            if rel.is_absolute() or ".." in rel.parts or path.is_symlink() or not path.resolve().is_relative_to(root) or str(rel) in seen:
                fail("Unsafe/duplicate manifest path")
            seen.add(str(rel))
            if not path.is_file() or path.stat().st_size != record["bytes"] or sha(path) != record["sha256"]:
                fail("Integrity mismatch: " + str(rel))
        return {"verified_files": len(seen), "meaning": "byte integrity, not authenticity or research quality"}
    if target.exists():
        fail("Manifest already exists")
    files = []
    for path in sorted(root.rglob("*")):
        if path == target or is_ignored_path(path.relative_to(root)):
            continue
        if path.is_symlink():
            fail("Symlinks are not allowed in bundle")
        if path.is_file():
            files.append({"path": path.relative_to(root).as_posix(), "bytes": path.stat().st_size, "sha256": sha(path)})
    dump(target, {"schema_version": VERSION, "files": files})
    return {"files": len(files), "manifest": name}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--taxonomy", default=str(Path(__file__).resolve().parent.parent / "taxonomy.json"))
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("validate")
    p.add_argument("directory")
    p.add_argument("--complete", action="store_true")
    p.add_argument("--tolerant", action="store_true", help="Report truncated/malformed JSONL lines without crashing")
    p = sub.add_parser("merge")
    p.add_argument("--out", required=True)
    p.add_argument("inputs", nargs="+")
    p = sub.add_parser("rank")
    p.add_argument("directory")
    p.add_argument("--out", required=True)
    p.add_argument("--config")
    p = sub.add_parser("shard")
    p.add_argument("directory")
    p.add_argument("--out", required=True)
    p.add_argument("--max-records", type=int, default=60)
    p.add_argument("--max-bytes", type=int, default=120000)
    p.add_argument("--max-findings-bytes", type=int, default=None)
    p.add_argument("--prompt-reserve-bytes", type=int, default=0)
    p.add_argument("--index-max-records", type=int, default=250)
    p.add_argument("--index-max-bytes", type=int, default=60000)
    p.add_argument("--preview-chars", type=int, default=160)
    p = sub.add_parser("prepare-blind")
    p.add_argument("directory")
    p.add_argument("--out", required=True)
    for command in ("seal", "verify"):
        p = sub.add_parser(command)
        p.add_argument("directory")
        p.add_argument("--manifest", default="BUNDLE_MANIFEST.json")
    args = parser.parse_args()
    try:
        if args.command in {"seal", "verify"}:
            result = manifest(args.directory, args.manifest, args.command == "verify")
        else:
            cats, jobs, domains, phases, frictions = taxonomy(args.taxonomy)
            if args.command == "validate":
                if args.tolerant:
                    data, malformed = load(args.directory, tolerant=True)
                else:
                    data, malformed = load(args.directory), []
                errors = validate(data, cats, jobs, args.complete, domains, phases, frictions)
                result = {
                    "valid_structure": not errors and not malformed,
                    "complete_normalization_required": args.complete,
                    "counts": {k: len(v) for k, v in data.items()},
                    "malformed_lines": malformed,
                    "errors": errors,
                    "source_truth_checked": False
                }
                print(json.dumps(result, ensure_ascii=False, indent=2))
                return 1 if (errors or malformed) else 0
            elif args.command == "merge":
                result = merge(args.inputs, args.out, cats, jobs, domains, phases, frictions)
            elif args.command == "shard":
                result = shard_findings(
                    args.directory, args.out, args.taxonomy,
                    max_records=args.max_records,
                    max_bytes=args.max_bytes,
                    max_findings_bytes=args.max_findings_bytes,
                    prompt_reserve_bytes=args.prompt_reserve_bytes,
                    index_max_records=args.index_max_records,
                    index_max_bytes=args.index_max_bytes,
                    preview_chars=args.preview_chars
                )
            elif args.command == "prepare-blind":
                result = prepare_blind_packet(args.directory, args.out, args.taxonomy)
            else:
                result = rank(args.directory, args.out, cats, jobs, configuration(args.config), args.taxonomy, domains, phases, frictions)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (ValueError, OSError, KeyError, TypeError) as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
