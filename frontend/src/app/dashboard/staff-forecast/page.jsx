"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import DataChart from "@/components/charts/DataChart";
import SummaryCard from "@/components/dashboard/summaryCard";
import { API_BASE } from "@/lib/api";
import { formatDateDDMMYYYY } from "@/utils/DateFormat";
import useSession from "@/hooks/useSession";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

const DEPARTMENTS = [
  { key: "floor", label: "Front of house", short: "FOH" },
  { key: "kitchen", label: "Kitchen", short: "Kitchen" },
  { key: "bar", label: "Bar", short: "Bar" },
  { key: "management", label: "Management", short: "Management" },
];
const currency = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

function validISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function nonNegativeNumber(value) {
  if (value === null || value === undefined || value === "") throw new Error("Incomplete staffing forecast data");
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error("Incomplete staffing forecast data");
  return number;
}

function normalizeForecast(json, days) {
  if (!Array.isArray(json?.daily_totals) || json.daily_totals.length !== days || !validISODate(json?.selected_date)) {
    throw new Error("Incomplete staffing forecast data");
  }
  const rolesByDate = new Map();
  if (Array.isArray(json.results)) {
    for (const role of json.results) {
      if (!validISODate(role.forecast_date)) throw new Error("Incomplete staffing forecast data");
      const dateRoles = rolesByDate.get(role.forecast_date) || [];
      dateRoles.push(role);
      rolesByDate.set(role.forecast_date, dateRoles);
    }
  }

  const rows = json.daily_totals.map((day) => {
    if (!validISODate(day.forecast_date)) throw new Error("Incomplete staffing forecast data");
    const closed = day.closed === true;
    const covers = nonNegativeNumber(day.predicted_covers);
    const cost = nonNegativeNumber(day.total_estimated_cost);
    const rawRoles = rolesByDate.get(day.forecast_date) || day.operational_roles || [];
    if (!Array.isArray(rawRoles)) throw new Error("Incomplete staffing forecast data");
    const roles = rawRoles.map((role) => ({
      department: String(role.department || ""),
      name: String(role.role_name || ""),
      staff: nonNegativeNumber(role.required_staff),
      rate: nonNegativeNumber(role.hourly_rate),
      hours: nonNegativeNumber(role.shift_hours),
      cost: nonNegativeNumber(role.estimated_cost),
    }));
    if (roles.some((role) => !role.department || !role.name || !Number.isInteger(role.staff))) {
      throw new Error("Incomplete staffing forecast data");
    }
    const departments = Object.fromEntries(DEPARTMENTS.map(({ key }) => [key, 0]));
    for (const role of roles) {
      const key = role.department.toLowerCase();
      if (!(key in departments)) throw new Error("Unknown staffing department");
      departments[key] += role.staff;
    }
    const staff = roles.reduce((sum, role) => sum + role.staff, 0);
    const roleCost = roles.reduce((sum, role) => sum + role.cost, 0);
    if ((closed && (covers !== 0 || cost !== 0 || staff !== 0)) || Math.abs(cost - roleCost) > 0.05) {
      throw new Error("Inconsistent staffing forecast data");
    }
    return {
      date: day.forecast_date,
      label: new Date(`${day.forecast_date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long" }),
      closed,
      closureReason: day.closure_reason || "Restaurant closed",
      covers, cost, staff, departments, roles, rule: day.rule_applied,
    };
  });
  if (new Set(rows.map((row) => row.date)).size !== days) throw new Error("Duplicate staffing forecast dates");
  return { rows, runId: json.run_id ?? null, modelVersion: json.model_version || "" };
}

function StaffingBars({ rows }) {
  const maximum = Math.max(1, ...rows.map((row) => row.staff));
  return <>
    <div className="rfs-staff-legend" aria-hidden="true">
      {DEPARTMENTS.map((department) => <span key={department.key} className={`rfs-staff-legend-${department.key}`}>{department.label}</span>)}
    </div>
    <div className="rfs-staff-chart-scroll"><div className="rfs-staff-bars" aria-hidden="true">
      {rows.map((row) => <div className="rfs-staff-bar-row" key={row.date}>
        <span>{row.label.slice(0, 3)} {formatDateDDMMYYYY(row.date).slice(0, 5)}</span>
        <div className="rfs-staff-bar-track">{DEPARTMENTS.map((department) => row.departments[department.key] > 0 && <span
          key={department.key} className={`rfs-staff-bar-${department.key}`}
          style={{ width: `${row.departments[department.key] / maximum * 100}%` }} />)}</div>
        <strong>{row.closed ? "Closed" : row.staff}</strong>
      </div>)}
    </div></div>
    <p className="rfs-staff-chart-footnote">Recommended staff, not a scheduled rota. Exact daily values are in the table below.</p>
  </>;
}

function StaffForecastContent() {
  const { user } = useSession();
  const canManageRules = hasPermission(user, PERMISSIONS.MANAGE_STAFFING_RULES);
  const searchParams = useSearchParams();
  const requestedDate = searchParams.get("date") || "";
  const invalidDate = Boolean(requestedDate) && !validISODate(requestedDate);
  const [days, setDays] = useState(7);
  const [view, setView] = useState("staffing");
  const [retryKey, setRetryKey] = useState(0);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState("");

  useEffect(() => {
    if (invalidDate) {
      setResult(null);
      setError("Choose a valid historical date in the dashboard calendar.");
      setStatus("error");
      return;
    }
    const controller = new AbortController();
    async function generateForecast() {
      setStatus("loading");
      setError("");
      setResult(null);
      try {
        const params = new URLSearchParams({ days_ahead: String(days) });
        if (requestedDate) params.set("selected_date", requestedDate);
        const response = await fetch(`${API_BASE}/staff-cost/forecast?${params}`, {
          method: "POST", cache: "no-store", signal: controller.signal,
        });
        const json = await response.json();
        if (response.status === 422 && /complete 7- or 10-day forecast/i.test(json?.error || "")) {
          if (controller.signal.aborted) return;
          setError("There isn’t enough eligible demand history for this date. Choose another historical day.");
          setStatus("empty");
          return;
        }
        if (!response.ok) throw new Error(json?.error || "Staffing forecast unavailable");
        const forecast = normalizeForecast(json, days);
        if (controller.signal.aborted) return;
        setResult(forecast);
        setSelectedDay(forecast.rows.find((row) => !row.closed)?.date || forecast.rows[0].date);
        setStatus("ready");
      } catch (requestError) {
        if (controller.signal.aborted) return;
        const detail = requestError?.message || "";
        setError(/^(Incomplete|Inconsistent|Unknown staffing|Duplicate staffing)/.test(detail)
          ? "The staffing data was incomplete. Please try again."
          : detail || "We couldn’t generate a staffing forecast. Please try again.");
        setStatus("error");
      }
    }
    generateForecast();
    return () => controller.abort();
  }, [days, requestedDate, invalidDate, retryKey]);

  const rows = useMemo(() => result?.rows || [], [result]);
  const openDays = useMemo(() => rows.filter((row) => !row.closed), [rows]);
  const selected = rows.find((row) => row.date === selectedDay) || openDays[0] || rows[0];
  const totalCovers = openDays.reduce((sum, row) => sum + row.covers, 0);
  const totalCost = openDays.reduce((sum, row) => sum + row.cost, 0);
  const averageStaff = openDays.length ? (openDays.reduce((sum, row) => sum + row.staff, 0) / openDays.length).toFixed(1) : "—";
  const peakStaffDay = openDays.reduce((peak, row) => !peak || row.staff > peak.staff ? row : peak, null);
  const costChartData = rows.map((row) => ({ date: row.date, label: row.label, value: row.cost }));

  return <div className="rfs-forecast-page rfs-staff-page">
    <header className="rfs-forecast-header"><div>
      <p className="rfs-forecast-kicker">Planning / Team outlook</p>
      <h1>Staffing forecast</h1>
      <p>Rule-based staffing recommendations and estimated labour cost—not a scheduled rota.</p>
    </div>{result?.runId && <span className="rfs-staff-run">Saved run #{result.runId}</span>}</header>

    <div className="rfs-forecast-controls rfs-staff-controls">
      <div><span className="rfs-forecast-control-label">Forecast horizon</span><div className="rfs-forecast-horizon" role="group" aria-label="Forecast horizon">
        {[7, 10].map((horizon) => <button key={horizon} type="button" aria-pressed={days === horizon} onClick={() => setDays(horizon)}>{horizon} days</button>)}
      </div></div>
      <div><span className="rfs-forecast-control-label">Show</span><div className="rfs-forecast-horizon" role="group" aria-label="Forecast view">
        <button type="button" aria-pressed={view === "staffing"} onClick={() => setView("staffing")}>Staffing</button>
        <button type="button" aria-pressed={view === "cost"} onClick={() => setView("cost")}>Labour cost</button>
      </div></div>
    </div>

    {status === "loading" && <section className="dashboard-panel rfs-forecast-state" role="status">Generating and saving staffing forecast…</section>}
    {status === "error" && <section className="dashboard-panel rfs-forecast-state" role="alert"><h2>Staffing forecast unavailable</h2><p>{error}</p>{!invalidDate && <button type="button" onClick={() => setRetryKey((key) => key + 1)}>Try again</button>}</section>}
    {status === "empty" && <section className="dashboard-panel rfs-forecast-state"><h2>No staffing forecast available</h2><p>{error}</p></section>}

    {status === "ready" && <>
      <section className="dashboard-summary-grid rfs-forecast-stats rfs-staff-stats" aria-label="Staffing forecast summary">
        <SummaryCard title="Average recommended staff" value={averageStaff} description="Per open forecast day; not scheduled staff." />
        <SummaryCard title="Peak staffing day" value={peakStaffDay?.label || "—"} description={peakStaffDay ? `${formatDateDDMMYYYY(peakStaffDay.date)} · ${peakStaffDay.staff} recommended` : "No open days in this forecast."} />
        <SummaryCard title="Predicted covers" value={totalCovers} description={`Total across ${openDays.length} open forecast days.`} />
        <SummaryCard title="Estimated labour cost" value={currency.format(totalCost)} description="Rule-based estimate across open forecast days." />
      </section>

      <div className="rfs-staff-main">
        <section className="dashboard-panel rfs-staff-chart-panel" aria-label={view === "staffing" ? "Recommended staff by day" : "Estimated labour cost by day"}>
          {view === "staffing" ? <><div className="rfs-forecast-details-heading"><div><h2>Recommended staff by day</h2><p>Department mix follows the active staffing rules.</p></div><span>{rows.length} days</span></div><StaffingBars rows={rows} /></> :
            <DataChart data={costChartData} title="Estimated labour cost by day" description="Projected cost from recommended roles, rates and standard shift lengths; closed days are zero." variant="columns" unit="GBP" seriesLabel="Estimated labour cost" />}
        </section>
        <section className="dashboard-panel rfs-staff-day-panel" aria-labelledby="rfs-staff-day-title">
          <div className="rfs-forecast-details-heading"><div><h2 id="rfs-staff-day-title">Selected day</h2><p>{selected.label}, {formatDateDDMMYYYY(selected.date)}</p></div><span className={`rfs-forecast-status ${selected.closed ? "is-closed" : "is-open"}`}>{selected.closed ? "Closed" : "Open"}</span></div>
          <p className="sr-only" role="status">Selected {selected.label}, {formatDateDDMMYYYY(selected.date)}. {selected.closed ? "Restaurant closed." : `${selected.staff} staff recommended.`}</p>
          {selected.closed ? <p className="rfs-staff-day-empty">{selected.closureReason}. No staff or labour cost is forecast.</p> : <>
            <dl className="rfs-staff-day-facts"><div><dt>Predicted covers</dt><dd>{selected.covers}</dd></div><div><dt>Recommended staff</dt><dd>{selected.staff}</dd></div><div><dt>Estimated labour</dt><dd>{currency.format(selected.cost)}</dd></div></dl>
            {selected.rule && <p className="rfs-staff-rule">Staffing rule: {selected.rule.min_covers}–{selected.rule.max_covers} predicted covers{canManageRules && <> · <Link href="/dashboard/settings#rules">Review staffing rules in Settings</Link></>}</p>}
            <h3>By department</h3><dl className="rfs-staff-departments">{DEPARTMENTS.map((department) => <div key={department.key}><dt>{department.label}</dt><dd>{selected.departments[department.key]}</dd></div>)}</dl>
          </>}
        </section>
      </div>

      <section className="dashboard-panel rfs-forecast-details rfs-staff-details" aria-labelledby="rfs-staff-details-title">
        <div className="rfs-forecast-details-heading"><div><h2 id="rfs-staff-details-title">Day-by-day plan</h2><p>Select a date to inspect its department and role recommendations.</p></div><span>{formatDateDDMMYYYY(rows[0].date)} – {formatDateDDMMYYYY(rows.at(-1).date)}</span></div>
        <div className="booking-table-wrapper"><table className="booking-table rfs-forecast-table rfs-staff-table"><caption className="sr-only">Recommended staffing and estimated cost for {rows.length} forecast days</caption><thead><tr><th scope="col">Date</th><th scope="col">Service</th><th scope="col">Predicted covers</th><th scope="col">Recommended staff</th><th scope="col">Department mix</th><th scope="col">Estimated labour</th></tr></thead><tbody>
          {rows.map((row) => <tr key={row.date} className={selected.date === row.date ? "is-selected" : ""}><th scope="row"><button type="button" className="rfs-staff-date-button" aria-pressed={selected.date === row.date} onClick={() => setSelectedDay(row.date)}>{formatDateDDMMYYYY(row.date)} <span>{row.label}</span></button></th><td><span className={`rfs-forecast-status ${row.closed ? "is-closed" : "is-open"}`}>{row.closed ? "Closed" : "Open"}</span></td><td>{row.closed ? "—" : row.covers}</td><td className="rfs-forecast-covers">{row.closed ? "—" : row.staff}</td><td>{row.closed ? row.closureReason : DEPARTMENTS.filter((department) => row.departments[department.key] > 0).map((department) => `${row.departments[department.key]} ${department.short}`).join(" · ") || "No roles recommended"}</td><td>{row.closed ? "—" : currency.format(row.cost)}</td></tr>)}
        </tbody></table></div>
      </section>

      <section className="dashboard-panel rfs-forecast-details rfs-staff-roles" aria-labelledby="rfs-staff-roles-title">
        <div className="rfs-forecast-details-heading"><div><h2 id="rfs-staff-roles-title">Role and cost breakdown</h2><p>{selected.label}, {formatDateDDMMYYYY(selected.date)} · recommended quantities, not assigned people.</p></div></div>
        {selected.closed ? <p className="rfs-staff-day-empty">No roles are needed on this closed day.</p> : selected.roles.length ? <div className="booking-table-wrapper"><table className="booking-table rfs-forecast-table rfs-staff-table"><caption className="sr-only">Role-level staffing costs for {selected.date}</caption><thead><tr><th scope="col">Department</th><th scope="col">Role</th><th scope="col">Staff</th><th scope="col">Hourly rate</th><th scope="col">Shift</th><th scope="col">Estimated cost</th></tr></thead><tbody>
          {selected.roles.map((role, index) => <tr key={`${role.department}-${role.name}-${index}`}><th scope="row">{role.department}</th><td>{role.name}</td><td>{role.staff}</td><td>{currency.format(role.rate)}</td><td>{role.hours} hours</td><td>{currency.format(role.cost)}</td></tr>)}
        </tbody></table></div> : <p className="rfs-staff-day-empty">No staff roles are recommended for this open day under the active rule.</p>}
      </section>
      <p className="rfs-forecast-basis">Saved run {result.runId ? `#${result.runId}` : "unavailable"} · Model version <span title={result.modelVersion}>{result.modelVersion ? result.modelVersion.slice(0, 12) : "unavailable"}</span>. These are recommendations and cost estimates, not an actual rota or payroll.</p>
    </>}
  </div>;
}

export default function StaffForecastPage() {
  return <Suspense fallback={<p className="dashboard-text" role="status">Loading staffing forecast…</p>}><StaffForecastContent /></Suspense>;
}
