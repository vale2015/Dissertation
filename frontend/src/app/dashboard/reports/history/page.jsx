"use client";

import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import {API_BASE} from "@/lib/api";
import {downloadSavedReport} from "@/lib/report-download";
import {formatDate} from "@/lib/report-formatters";

function formattedTime(value){return new Date(value).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"})}

export default function ReportHistoryPage(){
  const [reports,setReports]=useState([]);
  const [nextCursor,setNextCursor]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState("");

  const loadPage=useCallback(async(cursor,signal)=>{
    setLoading(true);setError("");
    try{
      const query=cursor?`?${new URLSearchParams({cursor})}`:"";
      const response=await fetch(`${API_BASE}/reports/history${query}`,{cache:"no-store",signal});
      const body=await response.json();
      if(!response.ok)throw new Error(body?.error?.message||"Unable to load past reports.");
      setReports(current=>cursor?[...current,...body.reports]:body.reports);
      setNextCursor(body.next_cursor);
    }catch(caught){if(caught.name!=="AbortError")setError(caught.message)}
    finally{if(!signal?.aborted)setLoading(false)}
  },[]);

  useEffect(()=>{const controller=new AbortController();loadPage(null,controller.signal);return()=>controller.abort()},[loadPage]);

  async function download(id,format){
    const key=`${id}-${format}`;setBusy(key);setError("");
    try{await downloadSavedReport(id,format)}catch(caught){setError(caught.message)}finally{setBusy("")}
  }

  return <div className="dashboard-app"><Topbar/><div className="dashboard-shell"><Sidebar/><div className="dashboard-main-area"><main className="dashboard-page"><div className="dashboard-container">
    <section className="dashboard-hero"><h1 className="dashboard-title">Past reports</h1><p className="dashboard-text">Saved snapshots remain available for 90 days. Downloads require a fresh, short-lived link.</p></section>
    <p><Link href="/dashboard/reports">← Generate a report</Link></p>
    {error&&<p className="report-state report-error" role="alert">{error}</p>}
    {!loading&&reports.length===0&&!error&&<p className="report-state">No saved reports yet. Generate a report and choose Save report.</p>}
    {reports.length>0&&<div className="report-table-scroll report-section"><table className="report-table report-history-table"><caption>Saved management reports</caption><thead><tr><th scope="col">Selected date</th><th scope="col">Period</th><th scope="col">Saved</th><th scope="col">Saved by</th><th scope="col">Expires</th><th scope="col">Actions</th></tr></thead><tbody>{reports.map(item=><tr key={item.id}><td>{formatDate(item.selected_date)}</td><td>{item.days_ahead} days</td><td>{formattedTime(item.created_at)}</td><td>{item.creator_name}</td><td>{formattedTime(item.expires_at)}</td><td className="report-history-actions"><Link href={`/dashboard/reports/history/${item.id}`}>View</Link>{["pdf","csv"].map(format=><button type="button" key={format} onClick={()=>download(item.id,format)} disabled={Boolean(busy)}>{busy===`${item.id}-${format}`?"Downloading…":format.toUpperCase()}</button>)}</td></tr>)}</tbody></table></div>}
    {loading&&<p className="report-state" role="status">Loading past reports…</p>}
    {nextCursor&&!loading&&<button className="report-history-more" type="button" onClick={()=>loadPage(nextCursor)}>Load more</button>}
  </div></main></div></div></div>;
}
