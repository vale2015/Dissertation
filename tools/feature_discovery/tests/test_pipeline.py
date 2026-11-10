"""Synthetic fixtures only; no restaurant or live PM data is changed."""

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from tools.feature_discovery import pipeline


STAMP = "2026-11-09T10:00:00+00:00"


class PipelineTest(unittest.TestCase):
    def setUp(self):
        # Keep fixtures inside the repository so restricted local runtimes can write them.
        self.temporary = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent)
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.directory = self.root / "docs" / "knowledge"
        self.directory.mkdir(parents=True)
        source = Path(__file__).resolve().parents[3] / "docs" / "knowledge" / "sources.json"
        shutil.copyfile(source, self.directory / "sources.json")
        pipeline.init(self.root)
        self.sources = pipeline.read_json(self.directory / "sources.json")

    def source_results(self, failed_url=None):
        return [
            {"source_id": source["source_id"], "entry_url": url,
             "attempted_at": STAMP, "status": "failed" if url == failed_url else "success",
             "error": "fixture failure" if url == failed_url else None,
             "overflow": [], "processed_through": STAMP}
            for source in self.sources["sources"] for url in source["entry_urls"]
        ]

    def observation(self, key="item-one", summary="A documented capability", title="Evidence title"):
        return {"source_id": "AI-001", "publisher": "OpenAI",
                "canonical_url": "https://developers.openai.com/api/docs/changelog",
                "release_item_key": key, "title": title, "published_date": "2026-11-08",
                "summary": summary, "availability": "available", "constraints": [],
                "evidence_type": "release_note", "kind": "product_release"}

    def envelope(self, observations=None, failed_url=None):
        observations = observations if observations is not None else [self.observation()]
        first = observations[0]
        observation_id = pipeline.digest_id(
            "OBS-", first["source_id"],
            pipeline.canonical_url(first["canonical_url"], "url"), first["release_item_key"])
        return {"schema_version": 1, "run_id": "run-20261109", "started_at": STAMP,
                "scheduled_for": None, "base_repository_commit": "fixture-base",
                "source_results": self.source_results(failed_url),
                "observations": observations,
                "opportunity_proposals": [{
                    "capability_key": "manager-research", "title": "Research candidate",
                    "observation_ids": [observation_id], "problem": "Manager needs context",
                    "rfs_use": "Could inform a future manager workflow",
                    "existing_coverage": "unknown", "score_breakdown": {
                        "product_fit": 3, "user_benefit": 2,
                        "compatibility": 1, "evidence_clarity": 1},
                    "reason": "Directly related to a manager question", "research_confidence": "medium"}]}

    def run_envelope(self, envelope):
        path = self.root / "input.json"
        path.write_text(json.dumps(envelope), encoding="utf-8")
        pipeline.refresh(self.root, path)
        return pipeline.read_json(self.directory / "discoveries.json")

    def test_baseline_multiple_release_items_and_idempotent_retry(self):
        envelope = self.envelope([self.observation(), self.observation(key="item-two")])
        first = self.run_envelope(envelope)
        pipeline.validate(self.root)
        self.assertEqual(len(first["observations"]), 2)
        self.assertEqual(len(first["opportunities"]), 1)
        self.assertEqual(pipeline.read_json(self.directory / "scan_state.json")["coverage"], "complete")
        second = self.run_envelope(envelope)
        self.assertEqual(first, second)
        self.assertEqual(second["observations"][0]["revisions"], [])

    def test_decision_survives_revision_and_partial_scan(self):
        first = self.run_envelope(self.envelope())
        opportunity_id = first["opportunities"][0]["opportunity_id"]
        pipeline.write_json(self.directory / "review_decisions.json", {
            "schema_version": 1, "decisions": [{
                "decision_id": "PM-1", "opportunity_id": opportunity_id,
                "decision": "deferred", "scope": "none", "decided_by": "PM",
                "decided_at": STAMP, "instruction_text": "Defer this candidate"}]})
        with self.assertRaises(pipeline.ValidationError):
            pipeline.validate(self.root)  # A new decision changes the joint snapshot.
        failed_url = self.sources["sources"][1]["entry_urls"][0]
        envelope = self.envelope([self.observation(summary="A materially revised capability")], failed_url)
        envelope["run_id"] = "run-20261110"
        envelope["started_at"] = "2026-11-10T10:00:00+00:00"
        second = self.run_envelope(envelope)
        state = pipeline.read_json(self.directory / "scan_state.json")
        self.assertEqual(state["coverage"], "partial")
        failed = next(item for item in state["entries"] if item["entry_url"] == failed_url)
        self.assertEqual(failed["last_success_at"], STAMP)
        self.assertEqual(len(second["observations"][0]["revisions"]), 1)
        self.assertEqual(pipeline.read_json(self.directory / "review_decisions.json")["decisions"][0]["decision"], "deferred")
        pipeline.validate(self.root)

    def test_source_domain_and_calendar_date_are_validated(self):
        for change in ({"canonical_url": "https://example.org/phishing"},
                       {"published_date": "2026-99-99"}):
            with self.assertRaises(pipeline.ValidationError):
                self.run_envelope(self.envelope([self.observation() | change]))

    def test_success_cannot_hide_error_and_overflow_is_visible(self):
        bad = self.envelope()
        bad["source_results"][0]["error"] = "timeout"
        with self.assertRaises(pipeline.ValidationError):
            self.run_envelope(bad)
        partial = self.envelope()
        partial["source_results"][0]["overflow"] = ["https://developers.openai.com/api/docs/unprocessed"]
        self.run_envelope(partial)
        state = pipeline.read_json(self.directory / "scan_state.json")
        self.assertEqual(state["coverage"], "partial")
        self.assertEqual(state["entries"][0]["result"], "partial")
        review = (self.directory / "html-output" / "index.html").read_text(encoding="utf-8")
        self.assertIn("1 unprocessed", review)
        self.assertIn("Processed through", review)

    def test_rejects_unsafe_url_without_overwriting_valid_state(self):
        first = self.run_envelope(self.envelope())
        bad = self.envelope()
        bad["observations"][0]["canonical_url"] = "javascript:alert(1)"
        with self.assertRaises(pipeline.ValidationError):
            self.run_envelope(bad)
        self.assertEqual(first, pipeline.read_json(self.directory / "discoveries.json"))

    def test_escapes_external_text_in_html(self):
        self.run_envelope(self.envelope([self.observation(title="<script>alert(1)</script>")]))
        review = (self.directory / "html-output" / "index.html").read_text(encoding="utf-8")
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", review)
        self.assertNotIn("<script>alert(1)</script>", review)

    def test_rejects_tampered_html_even_with_matching_snapshot_id(self):
        self.run_envelope(self.envelope())
        page = self.directory / "html-output" / "index.html"
        page.write_text(page.read_text(encoding="utf-8") + "<!-- corrupted -->", encoding="utf-8")
        with self.assertRaises(pipeline.ValidationError):
            pipeline.validate(self.root)

    def test_issue_receiver_requires_the_limited_submitter_and_matching_run(self):
        envelope = self.envelope()
        event = {"action": "opened", "repository": {"full_name": "vale2015/Dissertation"},
                 "issue": {"title": "RFS research input run-20261109", "body":
                           pipeline.ISSUE_PREFIX + json.dumps(envelope),
                           "html_url": "https://github.com/vale2015/Dissertation/issues/123",
                           "user": {"login": "rfs-research-bot", "id": 12345}}}
        event_path = self.root / "event.json"
        output_path = self.root / "received.json"
        event_path.write_text(json.dumps(event), encoding="utf-8")
        with self.assertRaises(pipeline.ValidationError):
            pipeline.extract_issue(event_path, output_path, "someone-else", "12345", "vale2015/Dissertation")
        self.assertFalse(output_path.exists())
        with self.assertRaises(pipeline.ValidationError):
            pipeline.extract_issue(event_path, output_path, "rfs-research-bot", "99999", "vale2015/Dissertation")
        pipeline.extract_issue(event_path, output_path, "rfs-research-bot", "12345", "vale2015/Dissertation")
        self.assertEqual(pipeline.read_json(output_path)["submission_issue_url"], event["issue"]["html_url"])
        event["issue"]["title"] = "RFS research input wrong-run"
        event_path.write_text(json.dumps(event), encoding="utf-8")
        with self.assertRaises(pipeline.ValidationError):
            pipeline.extract_issue(event_path, output_path, "rfs-research-bot", "12345", "vale2015/Dissertation")

    def test_init_preserves_existing_records(self):
        first = self.run_envelope(self.envelope())
        pipeline.init(self.root)
        self.assertEqual(first, pipeline.read_json(self.directory / "discoveries.json"))


if __name__ == "__main__":
    unittest.main()
