import { API_BASE } from "@/lib/api";
export async function downloadManagementReport(format,selectedDate,daysAhead){
  const query=new URLSearchParams({selected_date:selectedDate,days_ahead:String(daysAhead)});
  const response=await fetch(`${API_BASE}/reports/management/${format}?${query}`,{cache:"no-store"});
  if(!response.ok){let message="Unable to download the report.";try{const body=await response.json();message=body?.error?.message||message;}catch{}throw new Error(message);}
  const disposition=response.headers.get("content-disposition")||"";
  const match=disposition.match(/filename\*?=(?:UTF-8''|)["']?([^"';]+)["']?/i);
  const fallback=`management-report-${selectedDate}-${daysAhead}-days.${format}`;
  const filename=(match?decodeURIComponent(match[1]):fallback).replace(/[^a-zA-Z0-9._-]/g,"-");
  const url=URL.createObjectURL(await response.blob()); const link=document.createElement("a"); link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
}
