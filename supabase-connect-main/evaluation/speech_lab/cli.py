from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from .canonical_text import load_canonical_verses_from_supabase
from .corpus import chapter_by_id
from .comparison import GoldenReferenceComparator, load_transcripts
from .golden import GoldenReferenceManager
from .golden_importer import GoldenReferenceSpreadsheetImporter
from .models import ModelSpec
from .providers.faster_whisper_provider import FasterWhisperProvider, resolve_audio_path
from .reports import ComparisonReportGenerator
from .runner import SpeechEvaluationRunner
from .supabase_store import DEFAULT_EVALUATION_ENV_FILE, EvaluationSupabaseStore
from .biblica_reference import (
    DEFAULT_REFERENCE_ROOT,
    TARGET_CHAPTERS,
    compare_existing_to_biblica,
    extract_required_source,
    rescore_existing_models,
    validate_zip_paths,
    write_chapter_references,
    write_reference_source_comparison_report,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="AI speech evaluation laboratory")
    subcommands = parser.add_subparsers(dest="command", required=True)

    subcommands.add_parser("init-golden", help="Create placeholder golden references for benchmark chapters")

    import_parser = subcommands.add_parser("import-golden", help="Import manually corrected golden references")
    import_parser.add_argument("--input", required=True, help="Path to .xlsx or .csv golden reference file")
    import_parser.add_argument("--local", action="store_true", help="Write local golden JSON files")
    import_parser.add_argument("--supabase", action="store_true", help="Upsert golden references to Supabase evaluation tables")
    import_parser.add_argument(
        "--env-file",
        default=None,
        help=f"Evaluation env file. Defaults to {DEFAULT_EVALUATION_ENV_FILE}",
    )
    import_parser.add_argument("--imported-by", default=None, help="Importer label stored with Supabase rows")

    list_parser = subcommands.add_parser("list-golden", help="List Supabase golden references")
    list_parser.add_argument("--env-file", default=None, help=f"Evaluation env file. Defaults to {DEFAULT_EVALUATION_ENV_FILE}")

    compare_parser = subcommands.add_parser("compare-output-file", help="Compare captured model output JSON against golden references")
    compare_parser.add_argument("--input", required=True, help="Transcript JSON file or {'transcripts': [...]} payload")
    compare_parser.add_argument("--model-id", required=True)
    compare_parser.add_argument("--model-name", required=True)
    compare_parser.add_argument("--provider", default="captured-output")
    compare_parser.add_argument("--run-id", default=None)
    compare_parser.add_argument("--supabase", action="store_true", help="Load golden references from Supabase instead of local JSON")
    compare_parser.add_argument("--env-file", default=None, help=f"Evaluation env file. Defaults to {DEFAULT_EVALUATION_ENV_FILE}")

    run_parser = subcommands.add_parser("run", help="Run metrics against captured model outputs")
    run_parser.add_argument("--model", action="append", dest="models", help="Model id to evaluate. Repeatable.")
    run_parser.add_argument("--chapter", action="append", dest="chapters", help="Chapter id such as JHN_003. Repeatable.")
    run_parser.add_argument("--run-id", default=None, help="Report run id. Defaults to UTC timestamp.")

    transcribe_parser = subcommands.add_parser("transcribe", help="Capture a transcript JSON with a runnable provider")
    transcribe_parser.add_argument("--provider", required=True, choices=["faster-whisper"])
    transcribe_parser.add_argument("--model", default="small", help="Provider model name. Defaults to small.")
    transcribe_parser.add_argument("--chapter", required=True, help="Chapter id such as GEN_001")
    transcribe_parser.add_argument("--audio", default=None, help="Audio file. If omitted, use the benchmark audio mapping.")
    transcribe_parser.add_argument("--output", required=True, help="Transcript JSON output path")
    transcribe_parser.add_argument("--language", default="sw", help="Transcription language. Defaults to sw.")
    transcribe_parser.add_argument("--device", default=None, choices=["cpu", "cuda"], help="Override device selection")
    transcribe_parser.add_argument("--compute-type", default=None, help="Override Faster-Whisper compute type")

    align_parser = subcommands.add_parser("align-verses", help="Align transcript words to canonical chapter verses")
    align_parser.add_argument("--input", required=True, help="Raw transcript JSON input path")
    align_parser.add_argument("--chapter", required=True, help="Chapter id such as GEN_001")
    align_parser.add_argument("--supabase", action="store_true", help="Load canonical verse text from Supabase")
    align_parser.add_argument("--env-file", default=None, help=f"Evaluation env file. Defaults to {DEFAULT_EVALUATION_ENV_FILE}")
    align_parser.add_argument("--translation-code", default="sw-biblica")
    align_parser.add_argument("--output", required=True, help="Aligned transcript JSON output path")

    review_parser = subcommands.add_parser("create-spoken-review-workbook", help="Create the spoken reference review workbook")
    review_parser.add_argument("--output", default="evaluation/speech_lab/golden/golden_reference_spoken_text_review_template.xlsx")
    review_parser.add_argument("--env-file", default=str(DEFAULT_EVALUATION_ENV_FILE))

    validate_review_parser = subcommands.add_parser("validate-spoken-review-workbook", help="Validate a spoken reference review workbook")
    validate_review_parser.add_argument("--input", required=True)

    cleanup_parser = subcommands.add_parser("cleanup-audit", help="Audit evaluation cache cleanup options")
    cleanup_parser.add_argument("--dry-run", action="store_true")
    cleanup_parser.add_argument("--remove-python-cache", action="store_true")
    cleanup_parser.add_argument("--remove-temp-downloads", action="store_true")
    cleanup_parser.add_argument("--remove-model", action="append", default=[])

    biblica_extract_parser = subcommands.add_parser(
        "extract-biblica-reference",
        help="Safely extract the Biblica/Open Kiswahili source archive for evaluation-only reference use",
    )
    biblica_extract_parser.add_argument("--zip-path", required=True)
    biblica_extract_parser.add_argument("--output-root", default=str(DEFAULT_REFERENCE_ROOT))
    biblica_extract_parser.add_argument("--dry-run", action="store_true")

    reference_compare_parser = subcommands.add_parser(
        "compare-reference-sources",
        help="Compare existing canonical Supabase chapter text against the Biblica/Open Kiswahili candidate source",
    )
    reference_compare_parser.add_argument("--chapters", nargs="+", default=list(TARGET_CHAPTERS))
    reference_compare_parser.add_argument("--env-file", default=str(DEFAULT_EVALUATION_ENV_FILE))
    reference_compare_parser.add_argument("--reference-root", default=str(DEFAULT_REFERENCE_ROOT))
    reference_compare_parser.add_argument("--output-root", default="evaluation/speech_lab/reports")
    reference_compare_parser.add_argument("--dry-run", action="store_true")

    rescore_parser = subcommands.add_parser(
        "rescore-existing",
        help="Rescore existing ASR outputs against an evaluation-only reference source without retranscribing",
    )
    rescore_parser.add_argument("--reference-source", required=True, choices=["biblica_open_kiswahili"])
    rescore_parser.add_argument("--models", nargs="+", required=True)
    rescore_parser.add_argument("--chapters", nargs="+", default=list(TARGET_CHAPTERS))
    rescore_parser.add_argument("--reference-root", default=str(DEFAULT_REFERENCE_ROOT))
    rescore_parser.add_argument("--model-outputs-root", default="evaluation/speech_lab/model_outputs")
    rescore_parser.add_argument("--output-root", default="evaluation/speech_lab/reports")
    rescore_parser.add_argument("--dry-run", action="store_true")

    psalm_parser = subcommands.add_parser(
        "diagnose-psalm-23",
        help="Run the PSA_023 three-reference diagnostic without invoking ASR",
    )
    psalm_parser.add_argument(
        "--spoken-workbook",
        default="evaluation/speech_lab/golden/golden_reference_spoken_text_review_psa_023.xlsx",
    )
    psalm_parser.add_argument("--models", nargs="+", default=["small", "medium"])
    psalm_parser.add_argument("--output-dir", default="evaluation/speech_lab/reports")
    psalm_parser.add_argument("--model-outputs-root", default="evaluation/speech_lab/model_outputs")
    psalm_parser.add_argument("--overwrite", action="store_true", help="Overwrite diagnostic report paths instead of creating unique names")
    psalm_parser.add_argument("--dry-run", action="store_true")

    psalm_forensic_parser = subcommands.add_parser(
        "psa23-forensics",
        help="Generate PSA_023 transcript forensic analysis from existing outputs only",
    )
    psalm_forensic_parser.add_argument(
        "--spoken-workbook",
        default="evaluation/speech_lab/golden/golden_reference_spoken_text_review_psa_023.xlsx",
    )
    psalm_forensic_parser.add_argument("--output-dir", default="evaluation/speech_lab/reports")
    psalm_forensic_parser.add_argument("--model-outputs-root", default="evaluation/speech_lab/model_outputs")
    psalm_forensic_parser.add_argument("--overwrite", action="store_true")

    psalm_opt_parser = subcommands.add_parser(
        "psa23-medium-optimization",
        help="Run PSA_023-only Faster-Whisper Medium decoding experiments",
    )
    psalm_opt_parser.add_argument(
        "--spoken-workbook",
        default="evaluation/speech_lab/golden/golden_reference_spoken_text_review_psa_023.xlsx",
    )
    psalm_opt_parser.add_argument("--audio", default=None)
    psalm_opt_parser.add_argument("--output-dir", default="evaluation/speech_lab/reports")
    psalm_opt_parser.add_argument("--model-outputs-root", default="evaluation/speech_lab/model_outputs")
    psalm_opt_parser.add_argument(
        "--optimization-output-root",
        default="evaluation/speech_lab/model_outputs/faster-whisper-medium-psa23-optimization",
    )
    psalm_opt_parser.add_argument("--overwrite", action="store_true")
    psalm_opt_parser.add_argument("--dry-run", action="store_true")

    large_preflight_parser = subcommands.add_parser(
        "psa23-large-model-preflight",
        help="Preflight PSA_023 large-model candidates without loading or downloading models",
    )
    large_preflight_parser.add_argument("--models", nargs="+", default=["large-v3", "large-v3-turbo"])
    large_preflight_parser.add_argument("--output-dir", default="evaluation/speech_lab/reports")
    large_preflight_parser.add_argument("--device", default=None, choices=["cpu", "cuda"])
    large_preflight_parser.add_argument("--compute-type", default=None)
    large_preflight_parser.add_argument("--allow-download", action="store_true")
    large_preflight_parser.add_argument("--skip-download", action="store_true")
    large_preflight_parser.add_argument("--overwrite", action="store_true")

    large_compare_parser = subcommands.add_parser(
        "psa23-large-model-compare",
        help="Compare PSA_023 medium_vad_tuned, large-v3, and large-v3-turbo against human spoken reference",
    )
    large_compare_parser.add_argument(
        "--spoken-workbook",
        default="evaluation/speech_lab/golden/golden_reference_spoken_text_review_psa_023.xlsx",
    )
    large_compare_parser.add_argument("--models", nargs="+", default=["medium_vad_tuned", "large-v3", "large-v3-turbo"])
    large_compare_parser.add_argument("--audio", default=None)
    large_compare_parser.add_argument("--output-dir", default="evaluation/speech_lab/reports")
    large_compare_parser.add_argument("--model-outputs-root", default="evaluation/speech_lab/model_outputs")
    large_compare_parser.add_argument("--device", default=None, choices=["cpu", "cuda"])
    large_compare_parser.add_argument("--compute-type", default=None)
    large_compare_parser.add_argument("--allow-download", action="store_true")
    large_compare_parser.add_argument("--skip-download", action="store_true")
    large_compare_parser.add_argument("--preflight-only", action="store_true")
    large_compare_parser.add_argument("--dry-run", action="store_true")
    large_compare_parser.add_argument("--overwrite", action="store_true")

    mini_parser = subcommands.add_parser(
        "mini-validate-large-models",
        help="Run low-cost verse-range validation for cached large models only",
    )
    mini_parser.add_argument("--chapters", nargs="+", default=["GEN_001", "MAT_005", "ROM_008"])
    mini_parser.add_argument("--verse-range", nargs=2, type=int, default=[1, 10])
    mini_parser.add_argument("--models", nargs="+", default=["medium_vad_tuned", "large-v3", "large-v3-turbo"])
    mini_parser.add_argument("--output-dir", default="evaluation/speech_lab/reports")
    mini_parser.add_argument("--skip-existing", action="store_true")
    mini_parser.add_argument("--dry-run", action="store_true")
    mini_parser.add_argument("--overwrite", action="store_true")

    elevenlabs_pilot_parser = subcommands.add_parser(
        "elevenlabs-pilot",
        help="Plan or invoke one controlled ElevenLabs pilot sample without bulk Bible generation",
    )
    elevenlabs_pilot_parser.add_argument("--test-id", required=True)
    elevenlabs_pilot_parser.add_argument("--text-file", required=True)
    elevenlabs_pilot_parser.add_argument("--env-file", default="supabase/functions/.env.local")
    elevenlabs_pilot_parser.add_argument("--function-url", default=None)
    elevenlabs_pilot_parser.add_argument("--access-token", default=None)
    elevenlabs_pilot_parser.add_argument("--local-pilot-token", default=None)
    elevenlabs_pilot_parser.add_argument("--dry-run", action="store_true")
    elevenlabs_pilot_parser.add_argument("--diagnostic", action="store_true", help="Ask the Edge Function to report resolved voice/model config without provider calls")
    elevenlabs_pilot_parser.add_argument("--confirm-billable-generation", action="store_true")

    args = parser.parse_args()

    if args.command == "init-golden":
        paths = GoldenReferenceManager().initialize_placeholders()
        for path in paths:
            print(path)
        return 0

    if args.command == "import-golden":
        transcripts = GoldenReferenceSpreadsheetImporter().import_file(args.input)
        if not args.local and not args.supabase:
            raise SystemExit("Choose at least one import target: --local or --supabase")
        if args.local:
            manager = GoldenReferenceManager()
            for transcript in transcripts:
                print(f"local: {manager.save(transcript)}")
        if args.supabase:
            store = _store(args.env_file)
            for transcript in transcripts:
                row = store.upsert_golden_reference(transcript, imported_by=args.imported_by)
                print(f"supabase: {row['chapter_id']}")
        return 0

    if args.command == "list-golden":
        for row in _store(args.env_file).list_golden_references():
            print(f"{row['chapter_id']}: {row['book']} {row['chapter']} ({row['translation_code']})")
        return 0

    if args.command == "compare-output-file":
        run_id = args.run_id or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        store = _store(args.env_file) if args.supabase else None
        comparator = GoldenReferenceComparator(store=store)
        model = ModelSpec(id=args.model_id, name=args.model_name, provider=args.provider)
        results = comparator.compare_output_file(args.input, model)
        paths = ComparisonReportGenerator().generate(results, run_id=run_id)
        if store is not None:
            store.store_results(run_id, results)
        for kind, path in paths.items():
            print(f"{kind}: {path}")
        return 0

    if args.command == "run":
        run_id = args.run_id or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        runner = SpeechEvaluationRunner()
        results = runner.run(model_ids=set(args.models) if args.models else None, chapter_ids=set(args.chapters) if args.chapters else None)
        paths = ComparisonReportGenerator().generate(results, run_id=run_id)
        for kind, path in paths.items():
            print(f"{kind}: {path}")
        return 0

    if args.command == "transcribe":
        chapter = chapter_by_id(args.chapter)
        provider = FasterWhisperProvider(
            model_name=args.model,
            device=args.device,
            compute_type=args.compute_type,
            language=args.language,
        )
        audio_path = resolve_audio_path(chapter.id, args.audio)
        print(
            "transcribe: "
            f"provider=faster-whisper; "
            f"model={provider.runtime.model_name}; "
            f"resolved_model={provider.runtime.resolved_model_name}; "
            f"device={provider.runtime.device}; "
            f"compute_type={provider.runtime.compute_type}; "
            f"language={provider.runtime.language}; "
            f"model_cached={provider.runtime.cached}; "
            f"audio={audio_path}"
        )
        transcript = provider.transcribe(chapter, audio_path)
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(transcript.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"output: {output}")
        print(f"transcription_runtime_seconds: {transcript.metadata.get('transcription_runtime_seconds'):.3f}")
        return 0

    if args.command == "align-verses":
        if not args.supabase:
            raise SystemExit("align-verses currently requires --supabase for canonical verse text loading")
        from .verse_alignment import align_transcript_to_verses

        transcripts = load_transcripts(args.input)
        if len(transcripts) != 1:
            raise SystemExit("align-verses expects exactly one transcript input")
        transcript = transcripts[0]
        if transcript.chapter_id != args.chapter:
            raise SystemExit(f"Input transcript chapter_id {transcript.chapter_id} does not match --chapter {args.chapter}")
        canonical_verses = load_canonical_verses_from_supabase(
            args.chapter,
            env_file=args.env_file,
            translation_code=args.translation_code,
        )
        aligned = align_transcript_to_verses(transcript, canonical_verses)
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(aligned.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        alignment_metadata = aligned.metadata.get("verse_alignment", {})
        print(f"output: {output}")
        print(f"aligned_verses: {alignment_metadata.get('aligned_verses')}")
        print(f"unresolved_verses: {alignment_metadata.get('unresolved_verses')}")
        return 0

    if args.command == "create-spoken-review-workbook":
        from .spoken_review import create_review_workbook

        print(create_review_workbook(args.output, env_file=args.env_file))
        return 0

    if args.command == "validate-spoken-review-workbook":
        from .spoken_review import validate_review_workbook

        result = validate_review_workbook(args.input)
        print(json.dumps(result, indent=2))
        return 0 if not result["errors"] else 1

    if args.command == "cleanup-audit":
        from dataclasses import asdict
        from .cleanup import audit_cleanup, cleanup, free_space

        items = audit_cleanup(
            remove_python_cache=args.remove_python_cache,
            remove_temp_downloads=args.remove_temp_downloads,
            remove_models=set(args.remove_model),
        )
        recoverable = sum(item.size_bytes for item in items if item.safe_to_remove)
        print(json.dumps({
            "dry_run": args.dry_run,
            "free_space_before_bytes": free_space(),
            "recoverable_bytes": recoverable,
            "expected_free_space_after_removal_bytes": free_space() + recoverable,
            "items": [asdict(item) for item in items],
        }, indent=2))
        cleanup(items, dry_run=args.dry_run)
        return 0

    if args.command == "extract-biblica-reference":
        names = validate_zip_paths(args.zip_path)
        print(f"zip_path: {Path(args.zip_path).resolve()}")
        print(f"output_root: {Path(args.output_root)}")
        print(f"safe_archive_entries: {len(names)}")
        if args.dry_run:
            print("dry_run: true")
            return 0
        source_root = extract_required_source(args.zip_path, args.output_root)
        print(f"source_root: {source_root}")
        for path in write_chapter_references(args.output_root):
            print(f"chapter_reference: {path}")
        return 0

    if args.command == "compare-reference-sources":
        chapters = [str(chapter_id) for chapter_id in args.chapters]
        print(f"reference_root: {Path(args.reference_root)}")
        print(f"output_root: {Path(args.output_root)}")
        print(f"chapters: {', '.join(chapters)}")
        if args.dry_run:
            print("dry_run: true")
            return 0
        canonical_by_chapter = {
            chapter_id: {
                verse.verse: verse.text
                for verse in load_canonical_verses_from_supabase(chapter_id, env_file=args.env_file)
            }
            for chapter_id in chapters
        }
        rows = compare_existing_to_biblica(canonical_by_chapter, root=args.reference_root, chapters=tuple(chapters))
        for row in rows:
            row["spoken_reference_status"] = "unavailable"
        paths = write_reference_source_comparison_report(rows, reports_root=args.output_root)
        for path in paths:
            print(f"report: {path}")
        return 0

    if args.command == "rescore-existing":
        print(f"reference_source: {args.reference_source}")
        print(f"reference_root: {Path(args.reference_root)}")
        print(f"model_outputs_root: {Path(args.model_outputs_root)}")
        print(f"output_root: {Path(args.output_root)}")
        print(f"models: {', '.join(args.models)}")
        print(f"chapters: {', '.join(args.chapters)}")
        result = rescore_existing_models(
            models=[str(model) for model in args.models],
            chapters=[str(chapter) for chapter in args.chapters],
            root=args.reference_root,
            model_outputs_root=args.model_outputs_root,
            reports_root=args.output_root,
            dry_run=args.dry_run,
        )
        for output in result["aligned_outputs"]:
            print(f"aligned_output: {output}")
        for path in result["reports"]:
            print(f"report: {path}")
        if args.dry_run:
            print("dry_run: true")
        return 0

    if args.command == "diagnose-psalm-23":
        from .psa23_diagnostic import run_psalm23_diagnostic

        result = run_psalm23_diagnostic(
            spoken_workbook=args.spoken_workbook,
            models=[str(model) for model in args.models],
            output_dir=args.output_dir,
            model_outputs_root=args.model_outputs_root,
            overwrite=args.overwrite,
            dry_run=args.dry_run,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    if args.command == "psa23-forensics":
        from .psa23_forensics import run_psa23_forensic_analysis

        result = run_psa23_forensic_analysis(
            spoken_workbook=args.spoken_workbook,
            output_dir=args.output_dir,
            model_outputs_root=args.model_outputs_root,
            overwrite=args.overwrite,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    if args.command == "psa23-medium-optimization":
        from .psa23_forensics import run_medium_optimization

        result = run_medium_optimization(
            spoken_workbook=args.spoken_workbook,
            output_dir=args.output_dir,
            model_outputs_root=args.model_outputs_root,
            optimization_output_root=args.optimization_output_root,
            audio=args.audio,
            overwrite=args.overwrite,
            dry_run=args.dry_run,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    if args.command == "psa23-large-model-preflight":
        from .psa23_large_model import run_preflight

        result = run_preflight(
            models=[str(model) for model in args.models],
            output_dir=args.output_dir,
            device=args.device,
            compute_type=args.compute_type,
            allow_download=args.allow_download,
            skip_download=args.skip_download,
            overwrite=args.overwrite,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    if args.command == "psa23-large-model-compare":
        from .psa23_large_model import run_large_model_compare

        result = run_large_model_compare(
            spoken_workbook=args.spoken_workbook,
            models=[str(model) for model in args.models],
            output_dir=args.output_dir,
            model_outputs_root=args.model_outputs_root,
            audio=args.audio,
            device=args.device,
            compute_type=args.compute_type,
            allow_download=args.allow_download,
            skip_download=args.skip_download,
            preflight_only=args.preflight_only,
            dry_run=args.dry_run,
            overwrite=args.overwrite,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    if args.command == "mini-validate-large-models":
        from .mini_validation import run_mini_validation

        result = run_mini_validation(
            chapters=[str(chapter) for chapter in args.chapters],
            verse_range=(int(args.verse_range[0]), int(args.verse_range[1])),
            models=[str(model) for model in args.models],
            output_dir=args.output_dir,
            dry_run=args.dry_run,
            skip_existing=args.skip_existing,
            overwrite=args.overwrite,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    if args.command == "elevenlabs-pilot":
        from .elevenlabs_pilot import (
            ElevenLabsPilotError,
            build_plan,
            invoke_edge_function,
            plan_to_safe_dict,
            request_payload,
        )

        try:
            dry_run = bool(args.dry_run or args.diagnostic)
            plan = build_plan(
                test_id=args.test_id,
                text_file=args.text_file,
                env_file=args.env_file,
                dry_run=dry_run,
            )
            payload = request_payload(
                plan,
                confirm_billable_generation=bool(args.confirm_billable_generation),
                diagnostic=bool(args.diagnostic),
            )
            result = {
                "pilot_plan": plan_to_safe_dict(plan),
                "edge_payload_preview": {key: value for key, value in payload.items() if key != "text"},
            }
            if args.function_url:
                result["function_url"] = args.function_url
            if args.dry_run and not args.diagnostic:
                result["status"] = "dry_run_no_provider_request"
                print(json.dumps(result, ensure_ascii=False, indent=2))
                return 0
            if args.diagnostic:
                if not args.function_url or not args.access_token:
                    raise ElevenLabsPilotError("--function-url and --access-token are required for Edge Function diagnostic mode")
                result["status"] = "about_to_call_edge_function_diagnostic"
                result["edge_response"] = invoke_edge_function(
                    function_url=args.function_url,
                    access_token=args.access_token,
                    payload=payload,
                    local_pilot_token=args.local_pilot_token,
                )
                print(json.dumps(result, ensure_ascii=False, indent=2))
                return 0
            if not args.confirm_billable_generation:
                raise ElevenLabsPilotError("Refusing generation without --confirm-billable-generation")
            if not args.function_url or not args.access_token:
                raise ElevenLabsPilotError("--function-url and --access-token are required for actual pilot generation")
            print(json.dumps({**result, "status": "about_to_call_edge_function"}, ensure_ascii=False, indent=2))
            result["edge_response"] = invoke_edge_function(
                function_url=args.function_url,
                access_token=args.access_token,
                payload=payload,
                local_pilot_token=args.local_pilot_token,
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0
        except ElevenLabsPilotError as error:
            raise SystemExit(str(error)) from error

    return 1


def _store(env_file: str | None) -> EvaluationSupabaseStore:
    if env_file:
        return EvaluationSupabaseStore.from_env_file(env_file)
    return EvaluationSupabaseStore()


if __name__ == "__main__":
    raise SystemExit(main())
