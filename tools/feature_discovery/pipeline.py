"""Validate and publish the RFS research review from a scheduled-agent input.

The collector supplies evidence. This deterministic tool never fetches pages, calls a
model, changes PM decisions, or implements a suggestion. It uses stdlib only so it
can run in a clean GitHub Actions Python environment.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import html
import json
import os
import re
import sys
import tempfile
from datetime import date, datetime
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


SCHEMA_VERSION = 1
RUN_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{2,79}$")
AVAILABILITY = {"announced", "testing", "preview", "beta", "available", "deprecated", "unclear"}
EVIDENCE_TYPES = {"technical_documentation", "release_note", "vendor_announcement", "engineering_article", "research_article", "documented_method"}
KINDS = {"product_release", "technique", "research", "case_study", "deprecation"}
DECISIONS = {"approved", "rejected", "deferred", "needs_information"}
COVERAGE = {"not_scanned", "complete", "partial", "failed"}
SOURCE_STATUSES = {"success", "partial", "failed"}
SCORE_LIMITS = {"product_fit": 4, "user_benefit": 3, "compatibility": 2, "evidence_clarity": 1}
TRACKING_PARAMS = {"fbclid", "gclid", "mc_cid", "mc_eid"}
ISSUE_PREFIX = "RFS-KNOWLEDGE-INPUT-V1\n"


class ValidationError(ValueError):
    """Input is invalid; the last valid output must be left untouched."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def iso_time(value: object, field: str) -> str:
    require(isinstance(value, str) and bool(value), f"{field}: timezone-aware ISO time required")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValidationError(f"{field}: invalid ISO time") from exc
    require(parsed.tzinfo is not None and parsed.utcoffset() is not None, f"{field}: timezone required")
    return value


def http_url(value: object, field: str) -> str:
    require(isinstance(value, str) and len(value) <= 2048, f"{field}: HTTP(S) URL required")
    parsed = urlsplit(value)
    require(parsed.scheme in {"http", "https"} and bool(parsed.hostname), f"{field}: HTTP(S) URL required")
    require(not parsed.username and not parsed.password, f"{field}: credentials in URL are forbidden")
    return value


def canonical_url(value: object, field: str) -> str:
    parsed = urlsplit(http_url(value, field))
    query = [(key, val) for key, val in parse_qsl(parsed.query, keep_blank_values=True)
             if not key.lower().startswith("utm_") and key.lower() not in TRACKING_PARAMS]
    path = parsed.path or "/"
    return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), path, urlencode(query), ""))


def publisher_url(value: object, source: dict, field: str) -> str:
    url = canonical_url(value, field)
    host = urlsplit(url).hostname or ""
    allowed = source["allowed_domains"]
    require(any(host == domain or host.endswith("." + domain) for domain in allowed),
            f"{field}: URL host is not approved for {source['publisher']}")
    return url


def text_field(value: object, field: str, maximum: int = 4000) -> str:
    require(isinstance(value, str) and bool(value.strip()) and len(value) <= maximum,
            f"{field}: nonempty text up to {maximum} characters required")
    return value.strip()


def published_date(value: object, field: str) -> None:
    if value is None:
        return
    require(isinstance(value, str) and bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", value)),
            f"{field}: YYYY-MM-DD or null required")
    try:
        date.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError(f"{field}: invalid calendar date") from exc


def read_json(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValidationError(f"{path}: cannot read valid JSON: {exc}") from exc
    require(isinstance(data, dict) and data.get("schema_version") == SCHEMA_VERSION,
            f"{path}: schema_version must be 1")
    return data


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)
        os.replace(tmp_name, path)
    finally:
        if os.path.exists(tmp_name):
            os.unlink(tmp_name)


def write_json(path: Path, data: dict) -> None:
    atomic_write(path, json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n")


def extract_issue(event_path: Path, output_path: Path, actor: str, user_id: str, repository: str) -> None:
    """Convert an untrusted public issue into a bounded JSON input, never code."""
    require(bool(actor) and isinstance(user_id, str) and user_id.isdecimal() and bool(repository),
            "issue receiver: trusted actor ID and repository required")
    try:
        event = json.loads(event_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValidationError("issue event: invalid JSON") from exc
    require(isinstance(event, dict) and event.get("action") == "opened", "issue event: opened action required")
    require(event.get("repository", {}).get("full_name") == repository,
            "issue event: unexpected repository")
    issue = event.get("issue")
    require(isinstance(issue, dict) and not issue.get("pull_request"), "issue event: issue required")
    require(issue.get("user", {}).get("login") == actor, "issue event: unapproved submitter")
    require(str(issue.get("user", {}).get("id")) == user_id, "issue event: unapproved submitter ID")
    title = issue.get("title")
    require(isinstance(title, str) and title.startswith("RFS research input "),
            "issue event: research title required")
    body = issue.get("body")
    require(isinstance(body, str) and body.startswith(ISSUE_PREFIX) and len(body) <= 200_000,
            "issue event: bounded research JSON body required")
    try:
        envelope = json.loads(body[len(ISSUE_PREFIX):])
    except json.JSONDecodeError as exc:
        raise ValidationError("issue body: invalid JSON") from exc
    require(isinstance(envelope, dict) and envelope.get("schema_version") == SCHEMA_VERSION,
            "issue body: schema_version must be 1")
    run_id = envelope.get("run_id")
    require(isinstance(run_id, str) and RUN_ID.fullmatch(run_id) is not None and
            title == f"RFS research input {run_id}", "issue title and run_id must match")
    issue_url = http_url(issue.get("html_url"), "issue URL")
    require(urlsplit(issue_url).hostname == "github.com", "issue URL must be on GitHub")
    envelope["submission_issue_url"] = issue_url
    write_json(output_path, envelope)


def knowledge(root: Path) -> Path:
    directory = (root / "docs" / "knowledge").resolve()
    require(directory.is_dir(), f"{directory}: knowledge folder not found")
    return directory


def validate_sources(data: dict) -> list[tuple[str, str]]:
    sources = data.get("sources")
    require(isinstance(sources, list) and len(sources) > 0, "sources: nonempty list required")
    ids: set[str] = set()
    entries: list[tuple[str, str]] = []
    for index, source in enumerate(sources):
        field = f"sources[{index}]"
        require(isinstance(source, dict), f"{field}: object required")
        source_id = text_field(source.get("source_id"), f"{field}.source_id", 40)
        require(source_id not in ids, f"{field}: duplicate source_id {source_id}")
        ids.add(source_id)
        text_field(source.get("publisher"), f"{field}.publisher", 100)
        domains = source.get("allowed_domains")
        require(isinstance(domains, list) and bool(domains), f"{field}.allowed_domains: nonempty list required")
        for domain in domains:
            require(isinstance(domain, str) and bool(re.fullmatch(r"[a-z0-9.-]+", domain))
                    and "." in domain and not domain.startswith(".") and not domain.endswith("."),
                    f"{field}.allowed_domains: invalid hostname")
        require(source.get("category") in {"ai_platform", "hospitality"}, f"{field}.category: invalid")
        require(isinstance(source.get("enabled"), bool), f"{field}.enabled: boolean required")
        urls = source.get("entry_urls")
        require(isinstance(urls, list) and bool(urls), f"{field}.entry_urls: nonempty list required")
        for url in urls:
            normalized = publisher_url(url, source, f"{field}.entry_urls")
            require((source_id, normalized) not in entries, f"{field}: duplicate entry URL")
            if source["enabled"]:
                entries.append((source_id, normalized))
        require(isinstance(source.get("topics"), list), f"{field}.topics: list required")
    return entries


def digest_id(prefix: str, *parts: str) -> str:
    payload = "\x1f".join(parts).encode("utf-8")
    return prefix + hashlib.sha256(payload).hexdigest()[:20]


def fingerprint(item: dict) -> str:
    fields = {key: item.get(key) for key in
              ("title", "summary", "availability", "constraints", "evidence_type", "kind", "method_details")}
    raw = json.dumps(fields, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def blank_state(entries: list[tuple[str, str]]) -> dict:
    return {
        "schema_version": 1, "snapshot_id": None, "last_run_id": None,
        "last_attempt_at": None, "last_complete_success_at": None,
        "coverage": "not_scanned",
        "entries": [{"source_id": source_id, "entry_url": url,
                     "last_attempt_at": None, "last_success_at": None,
                     "result": "not_scanned", "processed_through": None,
                     "overflow": [], "error": None} for source_id, url in entries],
    }


def init(root: Path) -> None:
    directory = knowledge(root)
    entries = validate_sources(read_json(directory / "sources.json"))
    initial = {
        "discoveries.json": {"schema_version": 1, "snapshot_id": None, "generated_at": None,
                             "observations": [], "opportunities": [], "proposed_sources": []},
        "review_decisions.json": {"schema_version": 1, "decisions": []},
        "scan_state.json": blank_state(entries),
    }
    for name, content in initial.items():
        path = directory / name
        if not path.exists():
            write_json(path, content)
    (directory / "scan_history").mkdir(exist_ok=True)
    (directory / "html-output").mkdir(exist_ok=True)
    print("Initialized missing knowledge records without replacing existing data.")


def validate_decisions(data: dict, known_opportunities: set[str]) -> None:
    decisions = data.get("decisions")
    require(isinstance(decisions, list), "decisions: list required")
    ids: set[str] = set()
    for index, decision in enumerate(decisions):
        field = f"decisions[{index}]"
        require(isinstance(decision, dict), f"{field}: object required")
        decision_id = text_field(decision.get("decision_id"), f"{field}.decision_id", 100)
        require(decision_id not in ids, f"{field}: duplicate decision ID")
        ids.add(decision_id)
        require(decision.get("opportunity_id") in known_opportunities,
                f"{field}.opportunity_id: unknown opportunity")
        require(decision.get("decision") in DECISIONS, f"{field}.decision: invalid")
        require(decision.get("scope") in {"investigate", "implement", "none"}, f"{field}.scope: invalid")
        iso_time(decision.get("decided_at"), f"{field}.decided_at")
        text_field(decision.get("decided_by"), f"{field}.decided_by", 100)
        text_field(decision.get("instruction_text"), f"{field}.instruction_text")


def validate_records(sources: dict, discoveries: dict, decisions: dict, state: dict) -> None:
    entries = set(validate_sources(sources))
    observations = discoveries.get("observations")
    opportunities = discoveries.get("opportunities")
    require(isinstance(observations, list) and isinstance(opportunities, list),
            "discoveries: observations/opportunities lists required")
    obs_ids: set[str] = set()
    source_ids = {source["source_id"] for source in sources["sources"]}
    sources_by_id = {source["source_id"]: source for source in sources["sources"]}
    for index, item in enumerate(observations):
        field = f"observations[{index}]"
        require(isinstance(item, dict), f"{field}: object required")
        source_id = item.get("source_id")
        require(source_id in source_ids, f"{field}.source_id: unknown source")
        url = publisher_url(item.get("canonical_url"), sources_by_id[source_id], f"{field}.canonical_url")
        key = text_field(item.get("release_item_key"), f"{field}.release_item_key", 200)
        expected = digest_id("OBS-", source_id, url, key)
        require(item.get("observation_id") == expected and expected not in obs_ids,
                f"{field}.observation_id: invalid or duplicate")
        obs_ids.add(expected)
        require(item.get("publisher") == sources_by_id[source_id]["publisher"],
                f"{field}.publisher: source mismatch")
        text_field(item.get("title"), f"{field}.title", 300)
        text_field(item.get("summary"), f"{field}.summary")
        published_date(item.get("published_date"), f"{field}.published_date")
        require(item.get("availability") in AVAILABILITY, f"{field}.availability: invalid")
        require(item.get("evidence_type") in EVIDENCE_TYPES, f"{field}.evidence_type: invalid")
        require(item.get("kind") in KINDS, f"{field}.kind: invalid")
        require(isinstance(item.get("constraints"), list) and
                all(isinstance(value, str) for value in item["constraints"]),
                f"{field}.constraints: text list required")
        require(item.get("method_details") is None or isinstance(item["method_details"], dict),
                f"{field}.method_details: object or null required")
        iso_time(item.get("first_seen_at"), f"{field}.first_seen_at")
        iso_time(item.get("last_checked_at"), f"{field}.last_checked_at")
        require(isinstance(item.get("revisions"), list), f"{field}.revisions: list required")
        require(item.get("content_fingerprint") == fingerprint(item), f"{field}.content_fingerprint: mismatch")
    opportunity_ids: set[str] = set()
    for index, item in enumerate(opportunities):
        field = f"opportunities[{index}]"
        key = text_field(item.get("capability_key"), f"{field}.capability_key", 200)
        expected = digest_id("RFS-KB-", key)
        require(item.get("opportunity_id") == expected and expected not in opportunity_ids,
                f"{field}.opportunity_id: invalid or duplicate")
        opportunity_ids.add(expected)
        links = item.get("observation_ids")
        require(isinstance(links, list) and bool(links) and set(links) <= obs_ids,
                f"{field}.observation_ids: unknown or missing evidence")
        score = item.get("score_breakdown")
        require(isinstance(score, dict) and set(score) == set(SCORE_LIMITS),
                f"{field}.score_breakdown: required dimensions missing")
        for dimension, maximum in SCORE_LIMITS.items():
            require(type(score[dimension]) is int and 0 <= score[dimension] <= maximum,
                    f"{field}.score_breakdown.{dimension}: out of range")
        require(item.get("relevance_score") == sum(score.values()),
                f"{field}.relevance_score: mismatch")
        for label in ("title", "problem", "rfs_use", "reason"):
            text_field(item.get(label), f"{field}.{label}")
        require(item.get("existing_coverage") in
                {"new_to_rfs", "partially_implemented", "already_implemented", "unknown"},
                f"{field}.existing_coverage: invalid")
        iso_time(item.get("first_seen_at"), f"{field}.first_seen_at")
        iso_time(item.get("last_changed_at"), f"{field}.last_changed_at")
    validate_decisions(decisions, opportunity_ids)
    require(state.get("coverage") in COVERAGE, "scan_state.coverage: invalid")
    state_entries = state.get("entries")
    require(isinstance(state_entries, list), "scan_state.entries: list required")
    require({(entry.get("source_id"), canonical_url(entry.get("entry_url"), "scan_state.entry_url"))
             for entry in state_entries} == entries, "scan_state.entries: must match enabled sources")
    require(state.get("snapshot_id") == discoveries.get("snapshot_id"), "snapshot IDs differ")


def snapshot_id(discoveries: dict, decisions: dict, state: dict) -> str:
    data = {
        "discoveries": {key: value for key, value in discoveries.items() if key != "snapshot_id"},
        "decisions": decisions,
        "state": {key: value for key, value in state.items() if key != "snapshot_id"},
    }
    encoded = json.dumps(data, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def normalize_observation(raw: dict, started_at: str, sources_by_id: dict[str, dict]) -> dict:
    require(isinstance(raw, dict), "observation: object required")
    source_id = text_field(raw.get("source_id"), "observation.source_id", 40)
    require(source_id in sources_by_id, "observation.source_id: unknown source")
    url = publisher_url(raw.get("canonical_url"), sources_by_id[source_id], "observation.canonical_url")
    key = text_field(raw.get("release_item_key"), "observation.release_item_key", 200)
    item = {
        "observation_id": digest_id("OBS-", source_id, url, key),
        "source_id": source_id,
        "publisher": text_field(raw.get("publisher"), "observation.publisher", 100),
        "canonical_url": url,
        "release_item_key": key,
        "title": text_field(raw.get("title"), "observation.title", 300),
        "published_date": raw.get("published_date"),
        "first_seen_at": started_at,
        "last_checked_at": started_at,
        "summary": text_field(raw.get("summary"), "observation.summary"),
        "availability": raw.get("availability"),
        "constraints": raw.get("constraints", []),
        "evidence_type": raw.get("evidence_type"),
        "kind": raw.get("kind"),
        "method_details": raw.get("method_details"),
        "revisions": [],
    }
    require(item["availability"] in AVAILABILITY, "observation.availability: invalid")
    require(item["evidence_type"] in EVIDENCE_TYPES, "observation.evidence_type: invalid")
    require(item["kind"] in KINDS, "observation.kind: invalid")
    require(isinstance(item["constraints"], list) and
            all(isinstance(value, str) for value in item["constraints"]),
            "observation.constraints: text list required")
    published_date(item["published_date"], "observation.published_date")
    require(item["method_details"] is None or isinstance(item["method_details"], dict),
            "observation.method_details: object or null required")
    item["content_fingerprint"] = fingerprint(item)
    return item


def refresh(root: Path, input_path: Path) -> None:
    directory = knowledge(root)
    sources = read_json(directory / "sources.json")
    discoveries = copy.deepcopy(read_json(directory / "discoveries.json"))
    decisions = read_json(directory / "review_decisions.json")
    state = copy.deepcopy(read_json(directory / "scan_state.json"))
    # A PM may have recorded a new decision since the last scan. Validate the
    # records structurally, then refresh the joint snapshot after merging.
    validate_records(sources, discoveries, decisions, state)
    envelope = read_json(input_path)
    run_id = envelope.get("run_id")
    require(isinstance(run_id, str) and RUN_ID.fullmatch(run_id) is not None,
            "run_id: 3-80 safe characters required")
    history_path = directory / "scan_history" / f"{run_id}.json"
    if history_path.exists():
        prior = read_json(history_path)
        prior_input = {key: value for key, value in prior.items() if key != "pipeline"}
        require(prior_input == envelope, "run_id: an existing run cannot be replaced with different input")
        validate_records(sources, discoveries, decisions, state)
        require(prior.get("pipeline", {}).get("snapshot_id") == state.get("snapshot_id"),
                "run_id: existing history does not match current snapshot")
        print(json.dumps(prior["pipeline"], sort_keys=True))
        return
    started_at = iso_time(envelope.get("started_at"), "started_at")
    if envelope.get("scheduled_for") is not None:
        iso_time(envelope["scheduled_for"], "scheduled_for")
    text_field(envelope.get("base_repository_commit"), "base_repository_commit", 100)
    enabled_entries = set(validate_sources(sources))
    sources_by_id = {source["source_id"]: source for source in sources["sources"]}
    results = envelope.get("source_results")
    require(isinstance(results, list), "source_results: list required")
    by_entry: dict[tuple[str, str], dict] = {}
    for result in results:
        require(isinstance(result, dict), "source_result: object required")
        entry = (result.get("source_id"), canonical_url(result.get("entry_url"), "source_result.entry_url"))
        require(entry in enabled_entries and entry not in by_entry,
                "source_result: unknown or duplicate registered entry")
        require(result.get("status") in SOURCE_STATUSES, "source_result.status: invalid")
        iso_time(result.get("attempted_at"), "source_result.attempted_at")
        if result.get("processed_through") is not None:
            iso_time(result["processed_through"], "source_result.processed_through")
        overflow = result.get("overflow", [])
        require(isinstance(overflow, list) and all(isinstance(value, str) for value in overflow),
                "source_result.overflow: text list required")
        for url in overflow:
            http_url(url, "source_result.overflow")
        error = result.get("error")
        require(error is None or (isinstance(error, str) and bool(error.strip()) and len(error) <= 1000),
                "source_result.error: short text or null required")
        require(result["status"] != "success" or
                (error is None and result.get("processed_through") is not None),
                "source_result: success requires processed_through and no error")
        require(result["status"] != "failed" or error is not None,
                "source_result: failure requires an error")
        by_entry[entry] = result
    incoming = envelope.get("observations")
    require(isinstance(incoming, list), "observations: list required")
    observations = {item["observation_id"]: item for item in discoveries["observations"]}
    changed = 0
    for raw in incoming:
        item = normalize_observation(raw, started_at, sources_by_id)
        source = next(source for source in sources["sources"] if source["source_id"] == item["source_id"])
        require(item["publisher"] == source["publisher"], "observation.publisher: source mismatch")
        old = observations.get(item["observation_id"])
        if old:
            item["first_seen_at"] = old["first_seen_at"]
            item["revisions"] = list(old["revisions"])
            if old["content_fingerprint"] != item["content_fingerprint"]:
                item["revisions"].append({"changed_at": started_at, "previous_fingerprint": old["content_fingerprint"],
                                          "previous_summary": old["summary"], "previous_availability": old["availability"]})
                changed += 1
        else:
            changed += 1
        observations[item["observation_id"]] = item
    discoveries["observations"] = sorted(observations.values(), key=lambda item: item["observation_id"])
    proposals = envelope.get("opportunity_proposals")
    require(isinstance(proposals, list), "opportunity_proposals: list required")
    opportunities = {item["opportunity_id"]: item for item in discoveries["opportunities"]}
    for raw in proposals:
        require(isinstance(raw, dict), "opportunity proposal: object required")
        key = text_field(raw.get("capability_key"), "opportunity.capability_key", 200)
        opportunity_id = digest_id("RFS-KB-", key)
        linked = raw.get("observation_ids")
        require(isinstance(linked, list) and bool(linked) and
                set(linked) <= set(observations), "opportunity.observation_ids: unknown evidence")
        score = raw.get("score_breakdown")
        require(isinstance(score, dict) and set(score) == set(SCORE_LIMITS),
                "opportunity.score_breakdown: required dimensions missing")
        item = {
            "opportunity_id": opportunity_id, "capability_key": key,
            "title": raw.get("title"), "observation_ids": sorted(set(linked)),
            "problem": raw.get("problem"), "rfs_use": raw.get("rfs_use"),
            "affected_areas": raw.get("affected_areas", []),
            "existing_coverage": raw.get("existing_coverage", "unknown"),
            "related_documents": raw.get("related_documents", []),
            "tracker_ids": raw.get("tracker_ids", []),
            "dependencies": raw.get("dependencies", []), "risks": raw.get("risks", []),
            "effort": raw.get("effort", "unknown"), "score_breakdown": score,
            "relevance_score": sum(score.values()) if all(type(value) is int for value in score.values()) else None,
            "reason": raw.get("reason"),
            "research_confidence": raw.get("research_confidence", "low"),
            "first_seen_at": opportunities.get(opportunity_id, {}).get("first_seen_at", started_at),
            "last_changed_at": started_at,
        }
        old = opportunities.get(opportunity_id)
        if old:
            # A later scan may find only one new vendor. Keep prior supporting evidence.
            item["observation_ids"] = sorted(set(old["observation_ids"]) | set(item["observation_ids"]))
            old_comparison = {k: v for k, v in old.items() if k not in {"last_changed_at", "first_seen_at"}}
            new_comparison = {k: v for k, v in item.items() if k not in {"last_changed_at", "first_seen_at"}}
            if old_comparison == new_comparison:
                item["last_changed_at"] = old["last_changed_at"]
            else:
                changed += 1
        else:
            changed += 1
        opportunities[opportunity_id] = item
    discoveries["opportunities"] = sorted(opportunities.values(), key=lambda item: item["opportunity_id"])
    discoveries["generated_at"] = started_at
    updated_entries = []
    statuses = []
    for entry in state["entries"]:
        updated = copy.deepcopy(entry)
        result = by_entry.get((entry["source_id"], canonical_url(entry["entry_url"], "scan_state.entry_url")))
        if result:
            updated["last_attempt_at"] = result["attempted_at"]
            updated["overflow"] = result.get("overflow", [])
            updated["result"] = ("partial" if updated["overflow"] and result["status"] == "success"
                                 else result["status"])
            updated["error"] = result.get("error")
            if result["status"] == "success" and not updated["overflow"]:
                updated["last_success_at"] = result["attempted_at"]
                updated["processed_through"] = result.get("processed_through", result["attempted_at"])
            statuses.append(updated["result"])
        else:
            statuses.append("not_attempted")
        updated_entries.append(updated)
    state["entries"] = updated_entries
    state["last_run_id"] = run_id
    state["last_attempt_at"] = started_at
    state["coverage"] = ("complete" if statuses and all(status == "success" for status in statuses)
                         else "failed" if statuses and all(status in {"failed", "not_attempted"} for status in statuses)
                         else "partial")
    if state["coverage"] == "complete":
        state["last_complete_success_at"] = started_at
    state["snapshot_id"] = discoveries["snapshot_id"] = snapshot_id(discoveries, decisions, state)
    validate_records(sources, discoveries, decisions, state)
    review = render_html(sources, discoveries, decisions, state)
    history = copy.deepcopy(envelope)
    history["pipeline"] = {"snapshot_id": state["snapshot_id"], "coverage": state["coverage"],
                           "changed_records": changed}
    # Validation is complete before any canonical output changes. On interruption,
    # snapshot mismatch is detectable by the validate command on the next run.
    write_json(directory / "discoveries.json", discoveries)
    write_json(directory / "scan_state.json", state)
    atomic_write(directory / "html-output" / "index.html", review)
    write_json(history_path, history)
    print(json.dumps(history["pipeline"], sort_keys=True))


def render_html(sources: dict, discoveries: dict, decisions: dict, state: dict) -> str:
    observations = {item["observation_id"]: item for item in discoveries["observations"]}
    decisions_by_opportunity: dict[str, dict] = {}
    for decision in decisions["decisions"]:
        current = decisions_by_opportunity.get(decision["opportunity_id"])
        if current is None or decision["decided_at"] >= current["decided_at"]:
            decisions_by_opportunity[decision["opportunity_id"]] = decision
    esc = lambda value: html.escape(str(value if value is not None else "Unknown"), quote=True)
    cards = []
    ranked = sorted(discoveries["opportunities"],
                    key=lambda item: (-item["relevance_score"], item["title"].lower()))
    for opportunity in ranked:
        linked = [observations[item_id] for item_id in opportunity["observation_ids"]]
        decision = decisions_by_opportunity.get(opportunity["opportunity_id"])
        decision_label = decision["decision"] if decision else "Awaiting PM review"
        evidence = "".join(
            f'<li><a href="{esc(item["canonical_url"])}" target="_blank" rel="noopener noreferrer">{esc(item["publisher"])} — {esc(item["title"])}</a> '
            f'<span>{esc(item["availability"])} · published {esc(item["published_date"])} · checked {esc(item["last_checked_at"])}</span></li>'
            for item in linked
        )
        score = opportunity["relevance_score"]
        level = "High" if score >= 7 else "Moderate" if score >= 4 else "Low"
        cards.append(
            f'<article class="card" data-search="{esc((opportunity["title"] + " " + opportunity["problem"] + " " + opportunity["rfs_use"]).lower())}" '
            f'data-decision="{esc(decision_label)}" data-level="{level}">'
            f'<div class="card-top"><span class="eyebrow">{esc(opportunity["opportunity_id"])}</span><span class="pill">{level} · {score}/10</span></div>'
            f'<h2>{esc(opportunity["title"])}</h2><p><strong>Manager problem:</strong> {esc(opportunity["problem"])}</p>'
            f'<p><strong>Possible RFS use (inference):</strong> {esc(opportunity["rfs_use"])}</p>'
            f'<p><strong>Why it is ranked here:</strong> {esc(opportunity["reason"])}</p>'
            f'<p class="muted">Current coverage: {esc(opportunity["existing_coverage"])} · PM decision: {esc(decision_label)}</p>'
            f'<details><summary>Original evidence</summary><ul>{evidence}</ul></details>'
            f'<button type="button" class="copy" data-id="{esc(opportunity["opportunity_id"])}">Copy review request</button>'
            '</article>'
        )
    coverage_rows = "".join(
        f'<tr data-last-success="{esc(entry["last_success_at"] or "")}"><th scope="row">{esc(entry["source_id"])}</th><td><a href="{esc(entry["entry_url"])}">{esc(entry["entry_url"])}</a></td>'
        f'<td>{esc(entry["result"])}</td><td>{esc(entry["last_success_at"])}</td>'
        f'<td>{esc(entry["processed_through"])}</td><td>{esc(entry["error"])}</td>'
        f'<td>{len(entry["overflow"])} unprocessed'
        + (f'<details><summary>Show URLs</summary><ul>{"".join(f"<li>{esc(url)}</li>" for url in entry["overflow"])}</ul></details>'
           if entry["overflow"] else '') + '</td><td class="source-freshness">Checking on open</td></tr>'
        for entry in state["entries"]
    )
    notice = ("No research opportunities have been published yet. The source registry is installed, but a successful evidence scan is still required."
              if not cards else "Research suggestions require an explicit Product Manager instruction before implementation.")
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RFS Feature Discovery</title><style>
:root{{font:16px/1.5 system-ui,sans-serif;color:#172033;background:#f6f7f9}}*{{box-sizing:border-box}}
body{{margin:0}}header{{background:#fff;border-bottom:1px solid #d9dee8}}.wrap{{max-width:1120px;margin:auto;padding:1.25rem}}
h1{{font-size:clamp(1.6rem,4vw,2.3rem);margin:.25rem 0}}h2{{font-size:1.2rem;margin:.4rem 0}}
p{{margin:.55rem 0}}.muted,small{{color:#58667d}}.eyebrow{{color:#b4162b;font-weight:750;font-size:.8rem}}
.summary{{display:flex;gap:1rem;flex-wrap:wrap;margin:1rem 0}}.stat{{background:#fff;border:1px solid #d9dee8;border-radius:12px;padding:.7rem 1rem}}
.controls{{display:flex;gap:.7rem;flex-wrap:wrap;margin:1.25rem 0}}input,select,button{{font:inherit;padding:.6rem;border:1px solid #aab4c4;border-radius:8px;background:#fff}}
input{{flex:1;min-width:220px}}button{{cursor:pointer}}button.copy{{background:#b4162b;color:#fff;border-color:#b4162b;margin-top:.8rem}}
button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{{outline:3px solid #295cb7;outline-offset:2px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:1rem}}.card{{background:#fff;border:1px solid #d9dee8;border-radius:14px;padding:1rem;box-shadow:0 6px 20px #14213d0a}}
.card-top{{display:flex;justify-content:space-between;gap:.5rem;align-items:center}}.pill{{border-radius:999px;background:#fce8eb;color:#8d0e20;padding:.2rem .6rem;font-size:.8rem;font-weight:700}}
details{{margin-top:.75rem}}a{{color:#164b9b;overflow-wrap:anywhere}}table{{border-collapse:collapse;width:100%;background:#fff}}th,td{{text-align:left;padding:.55rem;border-bottom:1px solid #e3e8f0;vertical-align:top}}.scroll{{overflow-x:auto}}
.fallback{{width:100%;margin-top:.75rem}}footer{{margin-top:2rem;border-top:1px solid #d9dee8}}
@media(max-width:600px){{.wrap{{padding:1rem}}.summary{{display:grid;grid-template-columns:1fr 1fr}}}}
</style></head><body>
<header><div class="wrap"><span class="eyebrow">RFS RESEARCH WORKSPACE</span><h1>Feature Discovery</h1>
<p>Public AI and hospitality research for Product Manager review. No suggestion is an approved app change.</p></div></header>
<main class="wrap"><div class="summary" aria-label="Research status">
<div class="stat"><strong>{len(cards)}</strong><br><small>Opportunities</small></div>
<div class="stat"><strong>{esc(state["coverage"])}</strong><br><small>Source coverage</small></div>
<div class="stat"><strong>{esc(state["last_attempt_at"])}</strong><br><small>Last attempted scan</small></div>
<div class="stat"><strong>{esc(state["last_complete_success_at"])}</strong><br><small>Last complete scan</small></div></div>
<p id="freshness" data-last-complete="{esc(state['last_complete_success_at'] or '')}">Checking research freshness against this device's date…</p>
<p role="status" id="notice">{esc(notice)}</p>
<div class="controls"><label for="search">Search opportunities</label><input id="search" type="search" placeholder="Search title, problem or use">
<label for="level">Relevance</label><select id="level"><option value="">All</option><option>High</option><option>Moderate</option><option>Low</option></select>
<label for="decision">PM decision</label><select id="decision"><option value="">All</option><option>Awaiting PM review</option><option>approved</option><option>rejected</option><option>deferred</option><option>needs_information</option></select></div>
<section class="grid" aria-label="Opportunities">{''.join(cards)}</section>
<section aria-labelledby="coverage-heading"><h2 id="coverage-heading">Source coverage</h2><div class="scroll"><table><thead><tr><th>Source</th><th>Entry page</th><th>Result</th><th>Last success</th><th>Processed through</th><th>Error</th><th>Overflow</th><th>Freshness</th></tr></thead><tbody>{coverage_rows}</tbody></table></div></section>
<div id="copy-fallback" hidden><label for="fallback">Copy request fallback</label><textarea id="fallback" class="fallback" rows="4" readonly></textarea></div>
</main><footer><div class="wrap"><p>Snapshot: <code id="snapshot">{esc(state["snapshot_id"])}</code>. Research may be stale or partial; inspect each source result above.</p>
<p>Send a copied request to the project agent. Copying does not record approval or start implementation. Canonical records live in <code>docs/knowledge/</code>.</p></div></footer>
<script>
const search=document.getElementById('search'),level=document.getElementById('level'),decision=document.getElementById('decision');
function filter(){{const cards=document.querySelectorAll('.card');if(!cards.length)return;let shown=0;cards.forEach(card=>{{const visible=card.dataset.search.includes(search.value.toLowerCase())&&(!level.value||card.dataset.level===level.value)&&(!decision.value||card.dataset.decision===decision.value);card.hidden=!visible;if(visible)shown++}});document.getElementById('notice').textContent=shown?'Showing '+shown+' of '+cards.length+' research opportunities. Inspect original evidence before deciding.':'No opportunities match these filters.'}}
for(const field of [search,level,decision])field.addEventListener('input',filter);
const staleCutoff=8*24*60*60*1000,freshness=document.getElementById('freshness'),complete=Date.parse(freshness.dataset.lastComplete);
freshness.textContent=Number.isNaN(complete)?'No complete research scan yet.':'Research '+(Date.now()-complete>staleCutoff?'is stale: the last complete scan was more than eight days ago.':'has a complete scan within the last eight days.')+' Dates use this device clock.';
document.querySelectorAll('tr[data-last-success]').forEach(row=>{{const checked=Date.parse(row.dataset.lastSuccess);row.querySelector('.source-freshness').textContent=Number.isNaN(checked)?'Never completed':Date.now()-checked>staleCutoff?'Last success >8 days ago':'Last success within 8 days'}});
document.querySelectorAll('button.copy').forEach(button=>button.addEventListener('click',async()=>{{const request='Investigate opportunity '+button.dataset.id+' in the RFS project. Check its linked original evidence and current requirements. Report feasibility before implementation.';const fallback=document.getElementById('fallback');fallback.value=request;document.getElementById('copy-fallback').hidden=false;try{{await navigator.clipboard.writeText(request);document.getElementById('notice').textContent='Request copied. Send it to the project agent to record your decision.'}}catch{{fallback.focus();fallback.select();document.getElementById('notice').textContent='Clipboard unavailable. Select and copy the request below.'}}}}));
</script></body></html>'''


def validate(root: Path) -> None:
    directory = knowledge(root)
    sources = read_json(directory / "sources.json")
    discoveries = read_json(directory / "discoveries.json")
    decisions = read_json(directory / "review_decisions.json")
    state = read_json(directory / "scan_state.json")
    validate_records(sources, discoveries, decisions, state)
    if state["snapshot_id"] is not None:
        require(state["snapshot_id"] == snapshot_id(discoveries, decisions, state),
                "snapshot_id: canonical content mismatch")
    review = directory / "html-output" / "index.html"
    require(review.is_file() and review.read_text(encoding="utf-8") ==
            render_html(sources, discoveries, decisions, state),
            "HTML review: missing or not the exact validated snapshot")
    print("Knowledge records validated.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("init", "refresh", "render", "validate", "extract-issue"):
        command = sub.add_parser(name)
        command.add_argument("--root", type=Path, default=Path.cwd())
        if name == "refresh":
            command.add_argument("--input", type=Path, required=True)
        if name == "render":
            command.add_argument("--output", type=Path, default=Path("docs/knowledge/html-output/index.html"))
        if name == "extract-issue":
            command.add_argument("--event", type=Path, required=True)
            command.add_argument("--actor", required=True)
            command.add_argument("--user-id", required=True)
            command.add_argument("--repository", required=True)
            command.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "init":
            init(args.root)
        elif args.command == "refresh":
            refresh(args.root, args.input)
        elif args.command == "render":
            directory = knowledge(args.root)
            content = render_html(read_json(directory / "sources.json"),
                                  read_json(directory / "discoveries.json"),
                                  read_json(directory / "review_decisions.json"),
                                  read_json(directory / "scan_state.json"))
            output = (args.root / args.output).resolve()
            require(output.is_relative_to(directory), "render output must stay in docs/knowledge")
            atomic_write(output, content)
            print(f"Rendered {output}")
        elif args.command == "extract-issue":
            extract_issue(args.event, args.output, args.actor, args.user_id, args.repository)
            print(f"Extracted bounded research input to {args.output}")
        else:
            validate(args.root)
    except ValidationError as exc:
        print(f"Validation failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
