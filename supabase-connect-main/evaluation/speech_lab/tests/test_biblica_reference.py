import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from evaluation.speech_lab.biblica_reference import (
    BiblicaReferenceError,
    BiblicaReferenceLoader,
    BiblicaVerse,
    align_existing_transcript_to_biblica,
    extract_required_source,
    load_chapter_reference,
    parse_usx_chapter,
    rescore_aligned_transcript,
    validate_verses,
    validate_zip_paths,
    write_chapter_references,
    write_reference_source_comparison_report,
)
from evaluation.speech_lab.cli import main
from evaluation.speech_lab.models import Transcript, WordTiming


class BiblicaReferenceTests(unittest.TestCase):
    def test_zip_traversal_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "unsafe.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("../evil.usx", "bad")

            with self.assertRaises(BiblicaReferenceError):
                validate_zip_paths(archive_path)

    def test_heading_is_preserved_separately_from_verse_text(self):
        with tempfile.TemporaryDirectory() as directory:
            usx = Path(directory) / "GEN.usx"
            usx.write_text(
                """<usx version="3.0">
<book code="GEN" style="id">GEN</book>
<chapter number="1" style="c" sid="GEN 1"/>
<para style="s1">Siku sita za uumbaji</para>
<para style="p"><verse number="1" style="v" sid="GEN 1:1"/>Hapo mwanzo Mungu aliumba.<verse eid="GEN 1:1"/></para>
<chapter eid="GEN 1"/>
</usx>""",
                encoding="utf-8",
            )

            chapter = parse_usx_chapter(usx, "GEN_001")

            self.assertEqual(chapter.introductions[0].text, "Siku sita za uumbaji")
            self.assertEqual(chapter.verses[0].text, "Hapo mwanzo Mungu aliumba.")

    def test_unicode_and_punctuation_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            usx = Path(directory) / "MAT.usx"
            usx.write_text(
                """<usx version="3.0">
<book code="MAT" style="id">MAT</book>
<chapter number="5" style="c" sid="MAT 5"/>
<para style="p"><verse number="1" style="v" sid="MAT 5:1"/>Yesu alisema, “Heri walio maskini wa roho.”<verse eid="MAT 5:1"/></para>
<chapter eid="MAT 5"/>
</usx>""",
                encoding="utf-8",
            )

            chapter = parse_usx_chapter(usx, "MAT_005")

            self.assertIn("“Heri", chapter.verses[0].text)
            self.assertTrue(chapter.verses[0].text.endswith(".”"))

    def test_validation_rejects_missing_or_out_of_order_verses(self):
        with self.assertRaises(BiblicaReferenceError):
            validate_verses([BiblicaVerse(1, "moja"), BiblicaVerse(3, "tatu")], "GEN_001")

    def test_missing_chapter_file_reports_requested_chapter(self):
        with tempfile.TemporaryDirectory() as directory:
            loader = BiblicaReferenceLoader(directory)

            with self.assertRaises(BiblicaReferenceError) as raised:
                loader.chapter("GEN_001")

            self.assertIn("GEN_001", str(raised.exception))

    def test_reference_serialization_round_trip(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._write_minimal_reference_root(directory)
            paths = write_chapter_references(root, chapters=("GEN_001",))
            restored = load_chapter_reference(paths[0])

            self.assertEqual(restored.chapter_id, "GEN_001")
            self.assertEqual(restored.source_name, "biblica_open_kiswahili")

    def test_rescoring_does_not_transcribe(self):
        with tempfile.TemporaryDirectory() as directory:
            raw_path = Path(directory) / "GEN_001.json"
            aligned_path = Path(directory) / "GEN_001.biblica-aligned-v2.json"
            root = self._write_minimal_reference_root(directory)
            biblica = BiblicaReferenceLoader(root).chapter("GEN_001")
            raw_path.write_text(
                json.dumps(
                    Transcript(
                        chapter_id="GEN_001",
                        text="Hapo mwanzo Mungu",
                        words=[
                            WordTiming("Hapo", 1000, 1100),
                            WordTiming("mwanzo", 1100, 1200),
                            WordTiming("Mungu", 1200, 1300),
                        ],
                    ).to_dict()
                ),
                encoding="utf-8",
            )

            aligned, written = align_existing_transcript_to_biblica(raw_path, biblica, aligned_path)
            scored = rescore_aligned_transcript(written, biblica)

            self.assertEqual(aligned.verses[0].text_reference_mode, "biblica_source")
            self.assertEqual(scored["biblica_wer"], 0)

    def test_report_generation_writes_unique_outputs(self):
        with tempfile.TemporaryDirectory() as directory:
            rows = [
                {
                    "chapter_id": "GEN_001",
                    "verse": 1,
                    "existing_canonical_text": "A",
                    "biblica_reference_text": "B",
                    "exact_match": False,
                    "normalized_similarity": 0.0,
                    "notes": "word_substitution",
                    "spoken_reference_status": "unavailable",
                }
            ]

            first = write_reference_source_comparison_report(rows, reports_root=directory)
            second = write_reference_source_comparison_report(rows, reports_root=directory)

            self.assertNotEqual(first[0], second[0])
            self.assertTrue(first[0].exists())
            self.assertTrue(second[0].exists())

    def test_cli_extract_biblica_reference_dry_run(self):
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "safe.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("metadata.xml", "<metadata/>")
            argv = ["cli", "extract-biblica-reference", "--zip-path", str(archive_path), "--dry-run"]

            with patch.object(sys, "argv", argv):
                exit_code = main()

            self.assertEqual(exit_code, 0)

    def test_real_psalm_23_extraction_when_archive_is_available(self):
        archive_path = Path(r"C:\Users\HP\Downloads\0cd52ddc726e2ee6-rev2-release.zip")
        if not archive_path.exists():
            self.skipTest("Biblica archive is not available on this machine")
        with tempfile.TemporaryDirectory() as directory:
            extract_required_source(archive_path, directory)
            psalm = BiblicaReferenceLoader(directory).chapter("PSA_023")

            self.assertEqual(len(psalm.verses), 6)
            self.assertTrue(any("mchungaji" in verse.text.casefold() for verse in psalm.verses))

    def _write_minimal_reference_root(self, directory: str) -> Path:
        root = Path(directory) / "reference"
        usx_dir = root / "source" / "release" / "USX_1"
        usx_dir.mkdir(parents=True)
        (usx_dir / "GEN.usx").write_text(
            """<usx version="3.0">
<book code="GEN" style="id">GEN</book>
<chapter number="1" style="c" sid="GEN 1"/>
<para style="s1">Siku sita za uumbaji</para>
<para style="p"><verse number="1" style="v" sid="GEN 1:1"/>Hapo mwanzo Mungu<verse eid="GEN 1:1"/></para>
<chapter eid="GEN 1"/>
</usx>""",
            encoding="utf-8",
        )
        return root


if __name__ == "__main__":
    unittest.main()
