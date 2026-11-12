#!/usr/bin/env python3
"""LAB-011 acceptance, not defect-expecting probes. Local fictional data only."""
import argparse
import copy
import errno
import hashlib
import importlib.util
import json
import multiprocessing
from pathlib import Path
import sys
import tempfile

sys.dont_write_bytecode = True


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def publish_worker(code, dataset, output, barrier, queue):
    atlas = module('concurrent_atlas', Path(code))
    original = atlas.os.link
    def synchronized(src, dest):
        barrier.wait(timeout=15)
        return original(src, dest)
    atlas.os.link = synchronized
    try:
        atlas.prepare_blind_packet(dataset, output)
        queue.put({'success':True})
    except ValueError as exc:
        queue.put({'success':False, 'error':str(exc)})
    finally:
        atlas.os.link = original


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--candidate', type=Path, default=Path(__file__).resolve().parents[1])
    ap.add_argument('--out', type=Path, required=True)
    args = ap.parse_args()
    assert not args.out.exists(), 'Choose a new report'
    root = args.candidate.resolve()
    atlas = module('accepted_atlas', root/'tools/atlas.py')
    fixture = module('accepted_fixture', root/'tools/verify_tools.py').fixture
    results = []

    def check(name, fn):
        try:
            evidence = fn()
            assert evidence['passed'], json.dumps(evidence, ensure_ascii=False)
            results.append({'check':name, **evidence})
            print('PASS', name, flush=True)
        except Exception as exc:
            results.append({'check':name, 'passed':False, 'error':str(exc)})
            print('FAIL', name, str(exc), flush=True)

    def refusal(fn):
        try:
            fn()
        except (ValueError, OSError) as exc:
            return str(exc)
        raise AssertionError('Expected refusal')

    with tempfile.TemporaryDirectory(prefix='lab011-acceptance-') as temporary:
        tmp = Path(temporary)
        def dataset(name, data):
            path = tmp/name
            atlas.write_data(path, data)
            return path
        def receipt(out):
            return json.loads((out/'shards_manifest.json').read_text())
        seed = fixture(1)
        source = dataset('seed', seed)

        def defaults():
            scoring = (root/'SCORING.md').read_text().strip()
            run = json.loads((root/'templates/RUN.json').read_text())
            texts = [(root/'PASTE'/p).read_text() for p in ['02-ANALYZE.txt','03-SELECT.txt','05-COORDINATE.txt']]
            passed = atlas.configuration()['rare_gems_quota']==run['selection']['rare_gems_quota']==0 and '(по умолчанию 25)' not in scoring and all(scoring in t for t in texts)
            return {'passed':passed, 'default':0, 'scoring_copied_to_three_prompts':True}
        check('01_current_default_and_paste', defaults)

        def long_description():
            data = {k:[] for k in atlas.TABLES}
            data['sources'] = copy.deepcopy(seed['sources'])
            data['findings'] = copy.deepcopy(seed['findings'])
            data['findings'][0]['description'] = 'Я'*150000
            inp = dataset('long-description', data)
            out = tmp/'long-index'
            atlas.shard_findings(inp, out, max_bytes=4096, index_max_records=1)
            m = receipt(out)
            part = next(iter(m['shards'].values()))
            row = json.loads((out/part['file']).read_text())
            index = m['index_parts'][0]
            text = (out/index['file']).read_text()
            passed = row['description'].encode()==data['findings'][0]['description'].encode() and index['bytes']<=4096 and index['contains_oversized_records'] and 'PREVIEW_TRUNCATED' in text and part['file'] in text
            return {'passed':passed, 'index_bytes':index['bytes'], 'original_description_bytes':300000, 'oversized_status':part['packet_status']}
        check('02_oversized_body_preserved_and_index_bounded', long_description)

        def source_budget():
            data = fixture(60)
            for k in ['elements','ratings','merge_map']:
                data[k] = []
            for s in data['sources']:
                s['notes'] = 'synthetic analysis note. '*250
            # Reuse one source in two findings to exercise deduplication too.
            data['findings'][1]['source_ids'].append(data['sources'][0]['id'])
            inp = dataset('source-heavy', data)
            out = tmp/'source-packets'
            atlas.shard_findings(inp, out, prompt_reserve_bytes=20000)
            m = receipt(out)
            ids = []
            for p in m['shards'].values():
                rows = [json.loads(line) for line in (out/p['file']).read_text().splitlines()]
                sources = [json.loads(line) for line in (out/p['sources_file']).read_text().splitlines()]
                expected = {s for r in rows for s in r['source_ids']}
                assert len(sources)==len({s['id'] for s in sources}) and {s['id'] for s in sources}==expected
                assert p['findings_bytes']==(out/p['file']).stat().st_size
                assert p['sources_bytes']==(out/p['sources_file']).stat().st_size
                assert p['total_bytes']==p['findings_bytes']+p['sources_bytes']+20000<=120000
                assert not p['oversized_single_record']
                ids.extend(r['id'] for r in rows)
            return {'passed':len(ids)==len(set(ids))==60, 'packets':len(m['shards']), 'largest_total_bytes':m['largest_standard_packet_total_bytes'], 'prompt_reserve_bytes':20000, 'sources_complete_and_deduplicated':True}
        check('03_total_budget_reserve_and_source_dedup', source_budget)

        def oversized_source():
            data = copy.deepcopy(seed)
            data['sources'][0]['notes'] = 'Z'*150000
            inp = dataset('large-source', data)
            out = tmp/'large-source-packet'
            atlas.shard_findings(inp, out)
            m = receipt(out)
            p = next(iter(m['shards'].values()))
            value = json.loads((out/p['sources_file']).read_text())['notes']
            return {'passed':p['packet_status']=='oversized_single_bundle' and p['total_bytes']>120000 and value==data['sources'][0]['notes'] and m['index_parts'][0]['contains_oversized_records'], 'total_bytes':p['total_bytes'], 'source_preserved':True}
        check('04_single_oversized_source_bundle', oversized_source)

        def late_writer():
            out = tmp/'late-publish.jsonl'
            original = atlas.os.link
            def intervening(src, dest):
                Path(dest).write_text('WINNER')
                return original(src, dest)
            atlas.os.link = intervening
            try:
                error = refusal(lambda:atlas.prepare_blind_packet(source, out))
            finally:
                atlas.os.link = original
            return {'passed':out.read_text()=='WINNER' and not list(tmp.glob('blind-pkt-*')), 'winner_preserved':True, 'error':error}
        check('05_late_publisher_and_staging_cleanup', late_writer)

        def simultaneous():
            ctx = multiprocessing.get_context('fork')
            barrier, queue = ctx.Barrier(2), ctx.Queue()
            out = tmp/'concurrent.jsonl'
            processes = [ctx.Process(target=publish_worker,args=(str(root/'tools/atlas.py'),str(source),str(out),barrier,queue)) for _ in range(2)]
            for p in processes:p.start()
            for p in processes:
                p.join(20)
                if p.is_alive():p.terminate();p.join();raise AssertionError('Concurrent publication timeout')
                assert p.exitcode==0
            statuses = [queue.get(timeout=2) for _ in processes]
            count = sum(s['success'] for s in statuses)
            rows = [json.loads(line) for line in out.read_text().splitlines()]
            return {'passed':count==1 and len(rows)==1 and not list(tmp.glob('blind-pkt-*')), 'successful_writers':count, 'writers':2, 'final_jsonl_records':len(rows)}
        check('06_two_real_processes_one_publication', simultaneous)

        def failed_fallback():
            out = tmp/'unsupported-links.jsonl'
            old_link, old_fdopen = atlas.os.link, atlas.os.fdopen
            def no_links(*args, **kwargs):raise OSError(errno.EOPNOTSUPP,'Injected unsupported hardlinks')
            class PartialWrite:
                def __init__(self, fd, *args, **kwargs):self.file=old_fdopen(fd,*args,**kwargs)
                def __enter__(self):return self
                def __exit__(self,*args):self.file.close()
                def write(self, text):
                    self.file.write(text[:17]);self.file.flush()
                    raise OSError(errno.ENOSPC,'Injected disk full after partial write')
            atlas.os.link, atlas.os.fdopen = no_links, PartialWrite
            try:
                error = refusal(lambda:atlas.prepare_blind_packet(source,out))
            finally:
                atlas.os.link, atlas.os.fdopen = old_link, old_fdopen
            exists = out.exists()
            return {'passed':not exists and not list(tmp.glob('blind-pkt-*')), 'final_output_exists_after_failure':exists, 'final_output_bytes':out.stat().st_size if exists else 0, 'error':error}
        check('07_unsupported_links_write_failure_leaves_no_final_output', failed_fallback)

        def staging_error():
            out = tmp/'failed-staging.jsonl'
            old = atlas.os.fsync
            def no_space(fd):raise OSError(errno.ENOSPC,'Injected staging sync failure')
            atlas.os.fsync = no_space
            try:
                error = refusal(lambda:atlas.prepare_blind_packet(source,out))
            finally:
                atlas.os.fsync = old
            return {'passed':not out.exists() and not list(tmp.glob('blind-pkt-*')), 'error':error}
        check('08_staging_sync_failure_is_clean', staging_error)

        def small_index():
            data = {k:[] for k in atlas.TABLES}
            data['sources'] = copy.deepcopy(seed['sources'])
            data['findings'] = copy.deepcopy(seed['findings'])
            data['findings'][0]['description'] = 'Описание проверенного действия. '*20
            inp = dataset('small-budget-input',data)
            out = tmp/'small-budget-index'
            try:
                atlas.shard_findings(inp,out,max_bytes=4096,index_max_bytes=512)
            except ValueError as exc:
                return {'passed':not out.exists() and 'index' in str(exc).lower(), 'outcome':'explicit clean refusal of insufficient index budget','error':str(exc)}
            m = receipt(out)
            largest = max(p['bytes'] for p in m['index_parts'])
            return {'passed':largest<=512, 'largest_index_part_bytes':largest, 'declared_index_limit':512}
        check('09_single_index_line_respects_declared_byte_limit', small_index)

    result = {'task':'LAB-011','candidate_directory':str(root),'tool_sha256':hashlib.sha256((root/'tools/atlas.py').read_bytes()).hexdigest(),'checks':results,'passed':sum(r['passed'] for r in results),'total':len(results),'accepted':all(r['passed'] for r in results),'scope':'technical fictional acceptance, no source research or app changes','python':sys.version.split()[0],'network_requests':0}
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:result[k] for k in ['passed','total','accepted']},ensure_ascii=False))
    return 0 if result['accepted'] else 1


if __name__ == '__main__':
    sys.exit(main())
