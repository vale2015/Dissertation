"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import ReportSummary from "@/components/reports/report-summary";
import ReportFinancials from "@/components/reports/report-financials";
import ReportBookingMix from "@/components/reports/report-booking-mix";
import ReportDailyTable from "@/components/reports/report-daily-table";
import ReportInsights from "@/components/reports/report-insights";
import ReportWarnings from "@/components/reports/report-warnings";
import {API_BASE} from "@/lib/api";
import {formatDate} from "@/lib/report-formatters";

export default function SavedReportPage(){
  const {id}=useParams();const [report,setReport]=useState(null);const [error,setError]=useState("");const [loading,setLoading]=useState(true);
  useEffect(()=>{const controller=new AbortController();fetch(`${API_BASE}/reports/history/${id}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body?.error?.message||"Unable to open this report.");return body}).then(setReport).catch(caught=>{if(caught.name!=="AbortError")setError(caught.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[id]);
  return <>
    <section className="dashboard-hero"><h1 className="dashboard-title">Saved report</h1><p className="dashboard-text">This is the report as it was saved, not a newly calculated forecast.</p></section>
    <p><Link href="/dashboard/reports">← Reports</Link></p>
    {loading&&<p className="report-state" role="status">Loading saved report…</p>}
    {error&&<p className="report-state report-error" role="alert">{error}</p>}
    {report&&<div className="management-report"><p className="report-period"><strong>Selected date:</strong> {formatDate(report.metadata.selected_date)} · <strong>Forecast period:</strong> {formatDate(report.metadata.start_date)} to {formatDate(report.metadata.end_date)}</p><ReportSummary report={report}/><ReportFinancials report={report}/><ReportBookingMix reference={report.booking_mix_reference}/><ReportDailyTable report={report}/><ReportInsights items={report.operational_insights}/><ReportWarnings warnings={report.warnings}/></div>}
  </>;
}
