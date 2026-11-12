#!/usr/bin/env python3
"""Technical and acceptance checks for LifeGame Atlas Hybrid v2.1.1 (LAB-008-R1 & LAB-010-R2).
Uses invented data only. Verifies all 23 previous checks PLUS 4 dedicated acceptance checks for R01-R04
with reversed expectations (errors rejected, packet & index budgets enforced, concurrent blind output preserved)."""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import random
import subprocess
import sys
import tempfile
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("atlas", HERE / "atlas.py")
atlas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(atlas)


def fixture(n):
    data = {k: [] for k in atlas.TABLES}
    for i in range(n):
        suffix = f"DEMO-{i:05d}"
        sid, fid, eid = "S-" + suffix, "F-" + suffix, "E-" + suffix
        cat, job = f"C{i % 32 + 1:02d}", f"J{i % 12 + 1:02d}"
        data["sources"].append({
            "id": sid,
            "url": "https://example.invalid/" + suffix,
            "title": "Вымышленный источник для проверки программы",
            "owner": "synthetic_fixture",
            "origin_group": "SYNTHETIC-" + suffix,
            "source_type": "other",
            "language": "ru",
            "retrieved_at": "2026-11-12T00:00:00+00:00",
            "accessed": True,
            "synthetic": True
        })
        data["findings"].append({
            "id": fid,
            "task_id": "SYNTHETIC-DEMO",
            "name": "Вымышленная находка " + suffix,
            "description": "Технические данные, не результат поиска.",
            "kind": "mechanism",
            "category_ids": [cat],
            "domain_code": "D08_GAME_CORE_ECONOMY",
            "phase_code": "P6_RECOVERY_ADAPTATION",
            "primary_friction_code": "F5_RELAPSE_SPIRAL",
            "source_ids": [sid],
            "verification": "verified",
            "claims": [{
                "type": "existence",
                "source_id": sid,
                "locator": "synthetic fixture",
                "text": "Этот факт вымышлен и используется только в тесте.",
                "basis": "paraphrase"
            }],
            "synthetic": True
        })
        data["elements"].append({
            "id": eid,
            "name": "Вымышленный механизм " + suffix,
            "description": "Пример структуры, не существующая рекомендация.",
            "kind": "mechanism",
            "primary_category": cat,
            "category_ids": [cat],
            "jobs": [job],
            "domain_code": "D08_GAME_CORE_ECONOMY",
            "phase_code": "P6_RECOVERY_ADAPTATION",
            "target_frictions": ["F5_RELAPSE_SPIRAL"],
            "paradigm_novelty": 3 if i % 10 == 0 else 2,
            "family_id": f"FAM-DEMO-{i // 2:05d}",
            "raw_ids": [fid],
            "source_ids": [sid],
            "mechanism": "Условное правило технического примера.",
            "mechanism_triad": {
                "trigger": "Синтетический триггер " + suffix,
                "core_rule": "Синтетическое правило " + suffix,
                "psychological_loop": "Синтетический контур " + suffix
            },
            "vendor_claim": "Вымышленное обещание автора L3 (изолировано от доказательств).",
            "benefit": "Не проверялась; вымышленное аналитическое поле.",
            "evidence_effect": "unknown",
            "evidence_grade": "EVID_B_THEORY_GROUNDED",
            "evidence_summary": "Реальные источники не изучались.",
            "contexts": ["synthetic"],
            "conditions": ["Только проверка формата"],
            "costs": [],
            "risks": ["Нельзя выдавать за исследование"],
            "alternatives": [],
            "questions": [],
            "existence": "verified",
            "review_status": "accepted",
            "risk_status": "reviewed",
            "selection_track": "main",
            "synthetic": True
        })
        data["merge_map"].append({
            "raw_id": fid,
            "element_ids": [eid],
            "decision": "canonical",
            "reason": "Соответствие один к одному только для технического теста."
        })
        for reviewer in ("A", "B"):
            scores = dict.fromkeys(atlas.DIMS, 3)
            scores["value"] = i % 4 + 1
            data["ratings"].append({
                "id": "R-" + reviewer + "-" + suffix,
                "element_id": eid,
                "reviewer_id": "synthetic-" + reviewer,
                "context_id": "synthetic-context-" + reviewer,
                "rubric_version": "2.1",
                "blind": True,
                "scores": scores,
                "rationales": dict.fromkeys(atlas.DIMS, "Заданное тестовое значение, не экспертная оценка."),
                "source_ids": [sid],
                "synthetic": True
            })
    return data


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--report")
    args = p.parse_args()
    cats, jobs, domains, phases, frictions = atlas.taxonomy(HERE.parent / "taxonomy.json")
    config = atlas.configuration()
    config.update({"mode": "synthetic_demo", "core": 3, "rare_gems_quota": 2, "target": 100})
    results = []

    def check(name, action):
        start = time.perf_counter()
        details = action()
        results.append({
            "check": name,
            "passed": True,
            "seconds": round(time.perf_counter() - start, 4),
            "details": details
        })

    def raises(action, text):
        try:
            action()
        except ValueError as exc:
            assert text in str(exc), f"Expected {text!r} in {str(exc)!r}"
        else:
            raise AssertionError("Expected failure: " + text)

    data = fixture(12)
    with tempfile.TemporaryDirectory(prefix="hybrid-v211-technical-") as temporary:
        root = Path(temporary)
        source = root / "dataset"
        atlas.write_data(source, data)

        def valid():
            assert atlas.validate(data, cats, jobs, True, domains, phases, frictions) == []
            return {"elements": 12, "ratings": 24}
        check("01_complete_schema_and_provenance_links", valid)

        def cli():
            run = root / "RUN.demo.json"
            atlas.dump(run, {"rubric_version": "2.1", "taxonomy_version": "2.1", "selection": config})
            before = atlas.snapshot_hashes(source)
            process = subprocess.run(
                [sys.executable, "-B", str(HERE / "atlas.py"), "rank", str(source), "--config", str(run), "--out", str(root / "release")],
                capture_output=True, text=True, timeout=60
            )
            assert process.returncode == 0, process.stderr
            result = json.loads(process.stdout)
            assert result["status"] == "synthetic_demo_not_research"
            assert result["selected"] == 12 and result["target_reached"] is False
            audit = json.loads((root / "release/audit.json").read_text())
            assert len(audit["sensitivity"]) == 6
            assert "full_atlas_jaccard_with_baseline" in audit["sensitivity"]["baseline"]
            assert "full_atlas_ids" in audit["sensitivity"]["baseline"]
            assert atlas.snapshot_hashes(source) == before
            assert "ТЕХНИЧЕСКИЙ ПРИМЕР" in (root / "release/ATLAS-DRAFT.md").read_text()
            return result
        check("02_real_cli_outputs_hashes_and_incomplete_target", cli)

        def unknown():
            changed = copy.deepcopy(data)
            changed["ratings"][0]["scores"]["value"] = None
            assert not atlas.validate(changed, cats, jobs, True, domains, phases, frictions)
            ranked, selected, audit = atlas.calculate(changed, cats, jobs, config)
            eid = changed["elements"][0]["id"]
            assert eid not in {r["id"] for r in ranked}
            assert any(r["id"] == eid and "fewer_than_two_complete_blind_reviews" in r["reasons"] for r in audit["excluded"])
            return "null stays unknown; candidate not promoted"
        check("03_unknown_not_zero_or_imputed", unknown)

        def invalid():
            cases = []
            changed = copy.deepcopy(data)
            changed["elements"][0]["source_ids"] = ["MISSING"]
            cases.append(changed)
            changed = copy.deepcopy(data)
            changed["merge_map"].pop()
            cases.append(changed)
            changed = copy.deepcopy(data)
            changed["sources"][0]["accessed"] = False
            cases.append(changed)
            changed = copy.deepcopy(data)
            changed["ratings"][0]["scores"]["value"] = True
            cases.append(changed)
            for changed in cases:
                assert atlas.validate(changed, cats, jobs, True, domains, phases, frictions)
            return "missing source, lost disposition, unviewed existence, boolean score rejected"
        check("04_critical_invalid_inputs_rejected", invalid)

        def independence():
            for key in ("reviewer_id", "context_id"):
                changed = copy.deepcopy(data)
                changed["ratings"][1][key] = changed["ratings"][0][key]
                assert atlas.validate(changed, cats, jobs, True, domains, phases, frictions)
            changed = copy.deepcopy(data)
            changed["ratings"][0]["rubric_version"] = "9.0"
            assert atlas.validate(changed, cats, jobs, True, domains, phases, frictions)
            return "duplicate reviewer/context and wrong rubric rejected"
        check("05_review_identity_and_version", independence)

        def gates():
            changed = copy.deepcopy(data)
            changed["elements"][0]["kind"] = "method_system"
            changed["elements"][1]["selection_track"] = "reference"
            changed["elements"][2]["risk_status"] = "unresolved_high"
            changed["elements"][3]["existence"] = "disputed"
            for r in changed["ratings"]:
                if r["element_id"] == changed["elements"][4]["id"]:
                    r["scores"] = dict.fromkeys(atlas.DIMS, 0)
            assert not atlas.validate(changed, cats, jobs, True, domains, phases, frictions)
            ranked, selected, audit = atlas.calculate(changed, cats, jobs, config)
            excluded = {r["id"] for r in audit["excluded"]}
            assert {e["id"] for e in changed["elements"][:4]} <= excluded
            assert changed["elements"][4]["id"] in audit["below_quality_floor"]
            assert changed["elements"][4]["id"] not in {s["id"] for s in selected}
            return "composites, reference, unresolved risks and disputed existence blocked; low quality not used as filler"
        check("06_eligibility_and_quality_floor", gates)

        def disagreement():
            changed = copy.deepcopy(data)
            changed["ratings"][0]["scores"]["value"] = 1
            changed["ratings"][1]["scores"]["value"] = 4
            eid = changed["elements"][0]["id"]
            _, _, audit = atlas.calculate(changed, cats, jobs, config)
            assert any(e["id"] == eid and "unresolved_rating_disagreement" in e["reasons"] for e in audit["excluded"])
            changed["decisions"].append({
                "id": "D-SYNTHETIC",
                "element_id": eid,
                "type": "rating_resolution",
                "resolved": True,
                "reason": "Технический пример фиксации разрешённого расхождения.",
                "reviewer_ids": ["synthetic-A", "synthetic-B"],
                "source_ids": []
            })
            assert not atlas.validate(changed, cats, jobs, True, domains, phases, frictions)
            ranked, _, _ = atlas.calculate(changed, cats, jobs, config)
            row = next(r for r in ranked if r["id"] == eid)
            assert row["Q_min"] < row["Q_max"]
            return "resolution required; original range retained"
        check("07_disagreement_gate_and_auditable_resolution", disagreement)

        def stable():
            baseline = atlas.calculate(data, cats, jobs, config)
            changed = copy.deepcopy(data)
            rng = random.Random(20261112)
            for rows in changed.values():
                rng.shuffle(rows)
            result = atlas.calculate(changed, cats, jobs, config)
            assert baseline[1] == result[1]
            assert [r["id"] for r in baseline[0]] == [r["id"] for r in result[0]]
            assert baseline[2]["sensitivity"] == result[2]["sensitivity"]
            return "rank, selection and sensitivity independent of input row order"
        check("08_deterministic_with_shuffled_input", stable)

        def merging():
            merged = root / "merged"
            result = atlas.merge([source, source], merged, cats, jobs, domains, phases, frictions)
            assert result["elements"] == 12
            changed = copy.deepcopy(data)
            changed["elements"][0]["description"] = "CONFLICT"
            other = root / "conflict"
            atlas.write_data(other, changed)
            refused = root / "refused"
            raises(lambda: atlas.merge([source, other], refused, cats, jobs, domains, phases, frictions), "Conflicting ID")
            assert not refused.exists()
            return "exact IDs coalesced; conflicting revision stops without output"
        check("09_merge_no_silent_overwrite", merging)

        def integrity():
            bundle = root / "bundle"
            bundle.mkdir()
            (bundle / "a.txt").write_text("original", encoding="utf-8")
            atlas.manifest(bundle, "FILES.json")
            assert atlas.manifest(bundle, "FILES.json", True)["verified_files"] == 1
            (bundle / "a.txt").write_text("changed", encoding="utf-8")
            raises(lambda: atlas.manifest(bundle, "FILES.json", True), "Integrity mismatch")
            raises(lambda: atlas.calculate(data, cats, jobs, atlas.configuration()), "Synthetic examples")
            d_no_flag = copy.deepcopy(data)
            for tbl in d_no_flag.values():
                for row in tbl:
                    row.pop("synthetic", None)
            raises(lambda: atlas.calculate(d_no_flag, cats, jobs, atlas.configuration()), "reserved .invalid/example URLs")
            return "byte change caught; synthetic fixtures and .invalid URLs blocked from research mode"
        check("10_integrity_and_demo_separation", integrity)

        def partial_rating_disagreement_caught():
            changed = copy.deepcopy(data)
            eid = changed["elements"][0]["id"]
            changed["ratings"].append({
                "id": "R-C-PARTIAL",
                "element_id": eid,
                "reviewer_id": "synthetic-C",
                "context_id": "synthetic-context-C",
                "rubric_version": "2.1",
                "blind": True,
                "scores": {"value": 4, "burden": 3, "long_term": 3, "adaptability": 3, "agency": 3, "composability": None},
                "rationales": dict.fromkeys(atlas.DIMS, "Partial review with sharp disagreement on value"),
                "source_ids": [changed["sources"][0]["id"]],
                "synthetic": True
            })
            _, _, audit = atlas.calculate(changed, cats, jobs, config)
            assert any(e["id"] == eid and "unresolved_rating_disagreement" in e["reasons"] for e in audit["excluded"])
            changed["decisions"].append({
                "id": "D-FAKE-RES",
                "element_id": eid,
                "type": "rating_resolution",
                "resolved": True,
                "reason": "Omitted C",
                "reviewer_ids": ["synthetic-A", "synthetic-B"],
                "source_ids": []
            })
            errs = atlas.validate(changed, cats, jobs, True, domains, phases, frictions)
            assert any("resolution omits disagreeing reviewers: synthetic-C" in err for err in errs), str(errs)
            return "P0 Fixes #1 & #2 verified: partial blind rating disagreement caught; incomplete resolution rejected"
        check("11_partial_blind_disagreement_and_strict_resolution_gate", partial_rating_disagreement_caught)

        def non_penalizing_multilabel_and_rare_lane():
            changed = copy.deepcopy(data)
            changed["elements"][4]["jobs"] = ["J12"]
            changed["elements"][5]["jobs"] = ["J12", "J01", "J02"]
            _, selected, _ = atlas.calculate(changed, cats, jobs, config)
            tiers = {s["id"]: s["tier"] for s in selected}
            assert "rare_lateral_gem" in tiers.values()
            return "P0 Fix #3 & P1 Rare Lane verified: protected rare_lateral_gem tier active and multi-label elements not penalized"
        check("12_protected_rare_gems_lane_and_non_penalizing_gain", non_penalizing_multilabel_and_rare_lane)

        def composite_and_quarantine_strictness():
            changed = copy.deepcopy(data)
            changed["merge_map"][0]["decision"] = "quarantined"
            errs1 = atlas.validate(changed, cats, jobs, True, domains, phases, frictions)
            assert any("quarantined/out_of_scope mapping must have empty element_ids" in e for e in errs1)

            changed2 = copy.deepcopy(data)
            changed2["elements"][0]["kind"] = "method_system"
            changed2["merge_map"][0]["decision"] = "composite"
            errs2 = atlas.validate(changed2, cats, jobs, True, domains, phases, frictions)
            assert any("composite method_system lacks contains relations" in e for e in errs2)
            return "P0 Fix #4a/4b verified: quarantined non-empty targets and unlinked composite method_systems rejected"
        check("13_quarantine_and_composite_contains_enforcement", composite_and_quarantine_strictness)

        def sharding_and_blind_packet_prep():
            shard_out = root / "shards"
            s_res = atlas.shard_findings(source, shard_out, HERE.parent / "taxonomy.json")
            assert s_res["total_findings"] == 12 and s_res["shards_count"] >= 1
            assert (shard_out / "compact_findings_index_part001.txt").exists()

            blind_out = root / "blind_elements.jsonl"
            b_res = atlas.prepare_blind_packet(source, blind_out, HERE.parent / "taxonomy.json")
            assert b_res["blind_elements_prepared"] == 12
            first_blind = json.loads(blind_out.read_text(encoding="utf-8").splitlines()[0])
            assert "scores" not in first_blind and "benefit" not in first_blind
            return "P1 Sharding & Blind Packet preparation verified"
        check("14_cross_domain_sharding_and_blind_packet_sterilization", sharding_and_blind_packet_prep)

        def tolerant_truncated_jsonl_handling():
            trunc_dir = root / "trunc_dataset"
            atlas.write_data(trunc_dir, data)
            with (trunc_dir / "findings.jsonl").open("a", encoding="utf-8") as f:
                f.write('{"id": "F-TRUNC", "name": "Оборванная строка без закрытия...\n')
            loaded, malformed = atlas.load(trunc_dir, tolerant=True)
            assert len(loaded["findings"]) == 12 and len(malformed) == 1
            assert malformed[0]["table"] == "findings"
            return "P1 Tolerant JSONL loader verified: 12 valid rows preserved, 1 truncated line isolated"
        check("15_tolerant_truncated_jsonl_recovery", tolerant_truncated_jsonl_handling)

        def scale():
            large = fixture(10000)
            assert atlas.validate(large, cats, jobs, True, domains, phases, frictions) == []
            cfg = atlas.configuration()
            cfg["mode"] = "synthetic_demo"
            ranked, selected, audit = atlas.calculate(large, cats, jobs, cfg)
            assert len(ranked) == 10000 and len(selected) == 200
            assert len({s["id"] for s in selected}) == 200
            assert not audit["missing_categories"] and not audit["missing_jobs"]
            return {"synthetic_elements": 10000, "synthetic_ratings": 20000, "selected": 200, "real_web_sources": 0}
        check("16_ten_thousand_synthetic_elements_hybrid_v2", scale)

        def h1_manifest_ignores_pycache():
            bundle_dir = root / "h1_bundle"
            (bundle_dir / "tools" / "__pycache__").mkdir(parents=True)
            (bundle_dir / "tools" / "atlas.py").write_text("# code\n", encoding="utf-8")
            (bundle_dir / "tools" / "__pycache__" / "atlas.cpython-311.pyc").write_bytes(b"\x00\x01\x02")
            atlas.manifest(bundle_dir, "BUNDLE_MANIFEST.json", checking=False)
            (bundle_dir / "tools" / "__pycache__" / "atlas.cpython-311.pyc").unlink()
            (bundle_dir / "tools" / "__pycache__").rmdir()
            ver = atlas.manifest(bundle_dir, "BUNDLE_MANIFEST.json", checking=True)
            assert ver["verified_files"] == 1
            return "H1 fixed: __pycache__ never enters BUNDLE_MANIFEST.json; clean unpacked archive verifies with exit 0"
        check("17_H1_unpacked_zip_manifest_integrity", h1_manifest_ignores_pycache)

        def h2_aggregation_unity():
            d_h2 = fixture(1)
            d_h2["ratings"][0]["scores"] = dict.fromkeys(atlas.DIMS, 3)
            d_h2["ratings"][0]["scores"]["value"] = 2
            d_h2["ratings"][1]["scores"] = dict.fromkeys(atlas.DIMS, 3)
            d_h2["ratings"][1]["scores"]["value"] = 3
            r_part = copy.deepcopy(d_h2["ratings"][0])
            r_part.update(id="R-PART", reviewer_id="reviewer-C", context_id="context-C")
            r_part["scores"] = dict.fromkeys(atlas.DIMS, 3)
            r_part["scores"]["value"] = 3
            r_part["scores"]["composability"] = None
            d_h2["ratings"].append(r_part)

            ranked, _, _ = atlas.calculate(d_h2, cats, jobs, config)
            assert ranked[0]["Q"] == 71.25, f"Expected 71.25, got {ranked[0]['Q']}"
            assert ranked[0]["known_scores_per_dim"]["value"] == 3
            assert ranked[0]["known_scores_per_dim"]["composability"] == 2
            return {"Q": ranked[0]["Q"], "known_scores_per_dim": ranked[0]["known_scores_per_dim"]}
        check("18_H2_aggregation_policy_unity", h2_aggregation_unity)

        def h3_bounded_sharding_10k_and_oversized():
            raw_10k = {k: [] for k in atlas.TABLES}
            seed = fixture(1)
            raw_10k["sources"] = copy.deepcopy(seed["sources"])
            for i in range(10000):
                f = copy.deepcopy(seed["findings"][0])
                f["id"] = f"F-RAW-{i:05d}"
                if i == 500:
                    f["description"] = "Длинное описание без потери смысла. " * 2000
                raw_10k["findings"].append(f)
            ds_10k = root / "raw_10k"
            atlas.write_data(ds_10k, raw_10k)
            out_10k = root / "shards_10k"
            summary = atlas.shard_findings(
                ds_10k, out_10k, HERE.parent / "taxonomy.json",
                max_records=100, max_bytes=60000, index_max_records=1000
            )
            receipt = json.loads((out_10k / "shards_manifest.json").read_text(encoding="utf-8"))
            assert summary["total_findings"] == 10000
            assert summary["shards_count"] >= 100
            assert receipt["largest_part_records"] <= 100
            assert receipt["largest_standard_packet_total_bytes"] <= 60000
            assert len(receipt["oversized_single_records"]) == 1
            assert receipt["oversized_single_records"][0]["id"] == "F-RAW-00500"
            all_ids = [fid for part in receipt["shards"].values() for fid in part["finding_ids"]]
            assert len(all_ids) == 10000 and len(set(all_ids)) == 10000
            first_part = next(iter(receipt["shards"].values()))
            assert (out_10k / first_part["sources_file"]).exists()
            return {
                "total_findings": 10000,
                "shard_parts": summary["shards_count"],
                "largest_part_records": receipt["largest_part_records"],
                "oversized_isolated": len(receipt["oversized_single_records"])
            }
        check("19_H3_bounded_shards_10k_same_bucket_and_oversized", h3_bounded_sharding_10k_and_oversized)

        def h4_h5_shard_safety_and_path_containment():
            existing_out = root / "shards"
            index_part = existing_out / "compact_findings_index_part001.txt"
            before_bytes = index_part.read_bytes()
            raises(
                lambda: atlas.shard_findings(source, existing_out, HERE.parent / "taxonomy.json"),
                "Shard output directory already exists"
            )
            assert index_part.read_bytes() == before_bytes

            unsafe = copy.deepcopy(fixture(1))
            unsafe["findings"][0]["phase_code"] = "X/../../escaped"
            unsafe["findings"][0]["primary_friction_code"] = "GENERAL"
            unsafe_dir = root / "unsafe_data"
            atlas.write_data(unsafe_dir, unsafe)
            target = root / "unsafe_output"
            (target / "SHARD_X").mkdir(parents=True)
            marker = root / "escaped__GENERAL.jsonl"
            marker.write_text("CONTROLLED TEMPORARY MARKER", encoding="utf-8")
            raises(
                lambda: atlas.shard_findings(unsafe_dir, target, HERE.parent / "taxonomy.json"),
                "Shard output directory already exists"
            )
            target2 = root / "unsafe_output_new"
            raises(
                lambda: atlas.shard_findings(unsafe_dir, target2, HERE.parent / "taxonomy.json"),
                "Invalid input dataset for sharding"
            )
            assert not target2.exists()
            assert marker.read_text(encoding="utf-8") == "CONTROLLED TEMPORARY MARKER"
            return "H4 & H5 fixed: existing output refused; path traversal rejected; marker untouched"
        check("20_H4_H5_shard_no_overwrite_and_path_containment", h4_h5_shard_safety_and_path_containment)

        def h6_prepare_blind_safety():
            el_path = source / "elements.jsonl"
            before_bytes = el_path.read_bytes()
            raises(
                lambda: atlas.prepare_blind_packet(source, el_path, HERE.parent / "taxonomy.json"),
                "already exists"
            )
            raises(
                lambda: atlas.prepare_blind_packet(source, source / "new_blind_inside_input.jsonl", HERE.parent / "taxonomy.json"),
                "cannot be inside or equal to the input dataset directory"
            )
            assert el_path.read_bytes() == before_bytes
            return "H6 fixed: prepare-blind refuses existing files and paths inside input dataset"
        check("21_H6_prepare_blind_refuses_overwrite_and_aliasing", h6_prepare_blind_safety)

        def h7_rare_quota_validation():
            for bad_val in (-1, -5, True, False, 1.5, "10", 150):
                bad_run = root / f"bad_quota_{bad_val}.json"
                atlas.dump(bad_run, {
                    "rubric_version": "2.1",
                    "taxonomy_version": "2.1",
                    "selection": {"mode": "synthetic_demo", "core": 10, "target": 100, "rare_gems_quota": bad_val}
                })
                raises(lambda: atlas.configuration(bad_run), "rare_gems_quota must be integer")

            zero_run = root / "zero_quota.json"
            atlas.dump(zero_run, {
                "rubric_version": "2.1",
                "taxonomy_version": "2.1",
                "selection": {"mode": "synthetic_demo", "core": 3, "target": 100, "rare_gems_quota": 0}
            })
            cfg_zero = atlas.configuration(zero_run)
            _, sel_zero, _ = atlas.calculate(data, cats, jobs, cfg_zero)
            assert sum(1 for s in sel_zero if s["tier"] == "rare_lateral_gem") == 0
            return "H7 fixed: negative, boolean, float, string, and oversized quotas rejected; 0 quota yields 0 rare seats"
        check("22_H7_rare_gems_quota_strict_validation", h7_rare_quota_validation)

        def h8_instructions_and_paste_sync():
            pkg_root = HERE.parent
            scoring_txt = (pkg_root / "SCORING.md").read_text(encoding="utf-8").strip()
            dc_txt = (pkg_root / "DATA_CONTRACT.md").read_text(encoding="utf-8").strip()
            assert "для последних двух возможен пустой список" not in dc_txt
            assert "список `element_ids` обязан быть строго пустым (`[]`)" in dc_txt
            for paste_name in ("02-ANALYZE.txt", "03-SELECT.txt", "05-COORDINATE.txt"):
                ptxt = (pkg_root / "PASTE" / paste_name).read_text(encoding="utf-8")
                assert scoring_txt in ptxt, f"SCORING.md out of sync in PASTE/{paste_name}"
                assert dc_txt in ptxt, f"DATA_CONTRACT.md out of sync in PASTE/{paste_name}"
            for st_path in sorted((pkg_root / "starter_tasks").glob("*.json")):
                st = json.loads(st_path.read_text(encoding="utf-8"))
                assert st["protocol_version"] == "2.1"
                for rel_file, expected_sha in st["input_hashes"].items():
                    actual_sha = hashlib.sha256((pkg_root / rel_file).read_bytes()).hexdigest()
                    assert actual_sha == expected_sha, f"Hash mismatch in {st_path.name} for {rel_file}"
            return "H8 fixed: PASTE/*.txt, DATA_CONTRACT.md, SCORING.md, and starter_tasks hashes 100% synchronized"
        check("23_H8_shared_instructions_and_paste_sync", h8_instructions_and_paste_sync)

        # --- NEW LAB-010-R2 ACCEPTANCE CHECKS (24 to 27) WITH REVERSED EXPECTATIONS ---
        def r01_single_default_quota_in_scoring_and_paste():
            pkg_root = HERE.parent
            scoring_txt = (pkg_root / "SCORING.md").read_text(encoding="utf-8")
            assert "(по умолчанию 25)" not in scoring_txt
            assert "по умолчанию `0` до калибровки" in scoring_txt
            for paste_name in ("02-ANALYZE.txt", "03-SELECT.txt", "05-COORDINATE.txt"):
                ptxt = (pkg_root / "PASTE" / paste_name).read_text(encoding="utf-8")
                assert "(по умолчанию 25)" not in ptxt
                assert "по умолчанию `0` до калибровки" in ptxt
            assert atlas.configuration()["rare_gems_quota"] == 0
            return "R01 fixed: single default 0 in SCORING.md, PASTE/*.txt, RUN.json, and configuration()"
        check("24_R01_single_default_quota_in_scoring_and_paste", r01_single_default_quota_in_scoring_and_paste)

        def r02_bounded_index_preview_and_oversized_marker():
            seed = fixture(1)
            large = {k: [] for k in atlas.TABLES}
            large["sources"] = copy.deepcopy(seed["sources"])
            large["findings"] = copy.deepcopy(seed["findings"])
            full_text = "Я" * 150000
            large["findings"][0]["description"] = full_text
            large_input = root / "r02_oversized_input"
            atlas.write_data(large_input, large)
            large_out = root / "r02_oversized_shards"
            atlas.shard_findings(
                large_input, large_out, HERE.parent / "taxonomy.json",
                max_bytes=4096, index_max_records=1, index_max_bytes=4096, preview_chars=160
            )
            receipt = json.loads((large_out / "shards_manifest.json").read_text(encoding="utf-8"))
            assert len(receipt["oversized_single_records"]) == 1
            idx_part = receipt["index_parts"][0]
            assert idx_part["bytes"] <= 4096, f"Index part exceeded budget: {idx_part['bytes']}"
            assert idx_part["contains_oversized_records"] is True
            assert idx_part["oversized_record_ids"] == ["F-DEMO-00000"]
            assert idx_part["truncated_previews_count"] == 1
            idx_text = (large_out / idx_part["file"]).read_text(encoding="utf-8")
            assert "OVERSIZED_BUNDLE:" in idx_text
            assert "[PREVIEW_TRUNCATED_AT_160_OF_150000_CHARS; FULL_IN=" in idx_text
            # Verify raw description in shard JSONL is preserved byte-for-byte without any truncation
            part_info = next(iter(receipt["shards"].values()))
            saved_finding = json.loads((large_out / part_info["file"]).read_text(encoding="utf-8").splitlines()[0])
            assert saved_finding["description"] == full_text
            return {
                "index_part_bytes": idx_part["bytes"],
                "contains_oversized_records": idx_part["contains_oversized_records"],
                "raw_description_chars_preserved": len(saved_finding["description"])
            }
        check("25_R02_bounded_index_preview_and_oversized_marker", r02_bounded_index_preview_and_oversized_marker)

        def r03_total_packet_budget_including_sources_and_oversized_bundle():
            source_heavy = fixture(60)
            source_heavy["elements"] = []
            source_heavy["ratings"] = []
            source_heavy["merge_map"] = []
            for s in source_heavy["sources"]:
                s["notes"] = "synthetic analysis note. " * 250
            heavy_input = root / "r03_source_heavy_input"
            atlas.write_data(heavy_input, source_heavy)
            heavy_out = root / "r03_source_heavy_shards"
            atlas.shard_findings(
                heavy_input, heavy_out, HERE.parent / "taxonomy.json",
                max_records=60, max_bytes=120000, prompt_reserve_bytes=2000
            )
            receipt = json.loads((heavy_out / "shards_manifest.json").read_text(encoding="utf-8"))
            assert len(receipt["shards"]) >= 4
            assert receipt["oversized_single_records"] == []
            for part_id, part in receipt["shards"].items():
                f_bytes = (heavy_out / part["file"]).stat().st_size
                s_bytes = (heavy_out / part["sources_file"]).stat().st_size
                assert part["findings_bytes"] == f_bytes
                assert part["sources_bytes"] == s_bytes
                assert part["total_bytes"] == f_bytes + s_bytes + 2000
                assert part["total_bytes"] <= 120000, f"Part {part_id} exceeded total packet budget: {part['total_bytes']}"

            # Also test 1 small finding linked to 1 huge source (> 120,000 bytes) -> must be flagged oversized_single_bundle
            huge_src_data = fixture(1)
            huge_src_data["elements"] = []
            huge_src_data["ratings"] = []
            huge_src_data["merge_map"] = []
            huge_src_data["sources"][0]["notes"] = "HUGE_SOURCE_NOTE " * 10000
            huge_src_in = root / "r03_huge_source_in"
            atlas.write_data(huge_src_in, huge_src_data)
            huge_src_out = root / "r03_huge_source_out"
            atlas.shard_findings(huge_src_in, huge_src_out, HERE.parent / "taxonomy.json", max_bytes=120000)
            rec2 = json.loads((huge_src_out / "shards_manifest.json").read_text(encoding="utf-8"))
            assert len(rec2["oversized_single_records"]) == 1
            assert rec2["oversized_single_records"][0]["reason"] == "bundle_with_sources_exceeds_max_packet_bytes"
            return {
                "source_heavy_parts": len(receipt["shards"]),
                "max_standard_total_bytes": receipt["largest_standard_packet_total_bytes"],
                "oversized_source_bundle_flagged": True
            }
        check("26_R03_total_packet_budget_including_sources_and_oversized_bundle", r03_total_packet_budget_including_sources_and_oversized_bundle)

        def r04_atomic_no_overwrite_blind_publication_and_cleanup():
            race_out = root / "r04_race_blind.jsonl"
            original_link = atlas.os.link
            marker = "NEWER_CONCURRENT_RELEASE"

            def concurrent_link(src, dst):
                Path(dst).write_text(marker, encoding="utf-8")
                return original_link(src, dst)

            atlas.os.link = concurrent_link
            try:
                raises(
                    lambda: atlas.prepare_blind_packet(source, race_out, HERE.parent / "taxonomy.json"),
                    "Blind packet output appeared concurrently during execution; refusing to overwrite"
                )
            finally:
                atlas.os.link = original_link

            # Winner's content must be preserved and staging file must be cleaned up
            assert race_out.read_text(encoding="utf-8") == marker
            leftover_staging = list(root.glob("blind-pkt-*"))
            assert leftover_staging == [], f"Leftover staging files found: {leftover_staging}"
            return "R04 fixed: concurrent output preserved; atomic os.link refused overwrite; staging cleaned up"
        check("27_R04_atomic_no_overwrite_blind_publication_and_staging_cleanup", r04_atomic_no_overwrite_blind_publication_and_cleanup)

    report = {
        "status": "technical_checks_only_not_research",
        "version": atlas.VERSION + "-hybrid",
        "rubric_version": "2.1",
        "checks_passed": len(results),
        "checks": results,
        "tool_sha256": atlas.sha(HERE / "atlas.py"),
        "verifier_sha256": atlas.sha(__file__),
        "python": sys.version.split()[0],
        "network_requests": 0
    }
    if args.report:
        path = Path(args.report)
        atlas.dump(path, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
