"use client";

import { useEffect, useState } from "react";

export default function ReportAiExplanation({ reportId }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/ai/reports/${reportId}/explanation`, {
      cache: "no-store",
      signal: controller.signal,
    }).then((response) => response.ok ? response.json() : { available: false })
      .then((body) => setAvailable(Boolean(body.available)))
      .catch(() => { if (!controller.signal.aborted) setAvailable(false); });
    return () => controller.abort();
  }, [reportId]);

  async function explain() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/ai/reports/${reportId}/explanation`, {
        method: "POST",
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || "Unable to explain this report.");
      }
      setResult(body);
    } catch (caught) {
      setError(caught.message || "Unable to explain this report.");
    } finally {
      setLoading(false);
    }
  }

  return <section className="report-section report-ai-explanation" aria-labelledby="report-ai-title">
    <div className="report-ai-header">
      <div>
        <h2 id="report-ai-title">AI-assisted manager notes</h2>
        <p className="report-note">Get a draft interpretation of this saved report. No booking or staffing data will be changed.</p>
      </div>
      {available && !result && <button type="button" onClick={explain} disabled={loading}>
        {loading ? "Explaining…" : "Explain this report"}
      </button>}
    </div>
    {available === false && <p className="report-note">AI notes are not enabled for this restaurant yet. The saved report remains available below.</p>}
    {loading && <p role="status">Reviewing the report figures…</p>}
    {error && <p className="report-error" role="alert">{error}</p>}
    {result && <>
      <p className="report-note">AI draft—review before sharing. Exact evidence below comes from saved report #{result.report_id}.</p>
      <ol className="report-ai-list">
        {result.observations.map((item) => <li key={item.fact.id}>
          <p><strong>{item.fact.label}:</strong> {item.fact.value}</p>
          <p>{item.interpretation}</p>
          <p><strong>Manager check:</strong> {item.manager_check}</p>
        </li>)}
      </ol>
    </>}
  </section>;
}
