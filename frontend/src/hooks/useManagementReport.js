"use client";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

export default function useManagementReport(selectedDate, daysAhead) {
  const [report,setReport]=useState(null); const [isLoading,setLoading]=useState(false); const [error,setError]=useState(""); const [nonce,setNonce]=useState(0);
  const refetch=useCallback(()=>setNonce(value=>value+1),[]);
  useEffect(()=>{
    if(!selectedDate)return;
    const controller=new AbortController();
    const query=new URLSearchParams({selected_date:selectedDate,days_ahead:String(daysAhead)});
    Promise.resolve().then(()=>{if(!controller.signal.aborted){setLoading(true);setError("");}});
    fetch(`${API_BASE}/reports/management?${query}`,{signal:controller.signal,cache:"no-store"}).then(async response=>{
      const body=await response.json(); if(!response.ok) throw new Error(body?.error?.message||"Unable to generate the report."); return body;
    }).then(setReport).catch(err=>{if(err.name!=="AbortError"){setReport(null);setError(err.message);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[selectedDate,daysAhead,nonce]); return {report,isLoading,error:selectedDate?error:"Select a dashboard date to generate a report.",refetch};
}
