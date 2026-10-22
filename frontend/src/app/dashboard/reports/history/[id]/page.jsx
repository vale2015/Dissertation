"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import ReportSummary from "@/components/reports/report-summary";
import ReportFinancials from "@/components/reports/report-financials";
import ReportBookingMix from "@/components/reports/report-booking-mix";
import ReportDailyTable from "@/components/reports/report-daily-table";
import ReportInsights from "@/components/reports/report-insights";
import ReportWarnings from "@/components/reports/report-warnings";
import {API_BASE} from "@/lib/api";
import {downloadSavedReport} from "@/lib/report-download";
import {formatDate} from "@/lib/report-formatters";

export default function SavedReportPage(){
  const {id}=useParams();const [report,setReport]=useState(null);const [error,setError]=useState("");const [loading,setLoading]=useState(true);const [busy,setBusy]=useState("");
  useEffect(()=>{const controller=new AbortController();fetch(`${API_BASE}/reports/history/${id}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body?.error?.message||"Unable to open this report.");return body}).then(setReport).catch(caught=>{if(caught.name!=="AbortError")setError(caught.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[id]);
  async function download(format){setBusy(format);setError("");try{await downloadSavedReport(id,format)}catch(caught){setError(caught.message)}finally{setBusy("")}}
  return <div className="dashboard-app"><Topbar/><div className="dashboard-shell"><Sidebar/><div className="dashboard-main-area"><main className="dashboard-page"><div className="dashboard-container">
    <section className="dashboard-hero"><h1 className="dashboard-title">Saved report</h1><p className="dashboard-text">This is the report as it was saved, not a newly calculated forecast.</p></section>
    <p><Link href="/dashboard/reports/history">← Past reports</Link></p>
    {loading&&<p className="report-state" role="status">Loading saved report…</p>}
    {error&&<p className="report-state report-error" role="alert">{error}</p>}
    {report&&<div className="management-report"><div className="report-toolbar"><p><strong>Selected date:</strong> {formatDate(report.metadata.selected_date)} · <strong>Forecast period:</strong> {formatDate(report.metadata.start_date)} to {formatDate(report.metadata.end_date)}</p><div className="report-toolbar-actions">{["pdf","csv"].map(format=><button type="button" key={format} disabled={Boolean(busy)} onClick={()=>download(format)}>{busy===format?"Downloading…":`Download ${format.toUpperCase()}`}</button>)}</div></div><ReportSummary report={report}/><ReportFinancials report={report}/><ReportBookingMix reference={report.booking_mix_reference}/><ReportDailyTable report={report}/><ReportInsights items={report.operational_insights}/><ReportWarnings warnings={report.warnings}/></div>}
  </div></main></div></div></div>;
}
