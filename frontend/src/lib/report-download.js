import { API_BASE } from "@/lib/api";
async function saveDownload(response,fallback){
  if(!response.ok){let message="Unable to download the report.";try{const body=await response.json();message=body?.error?.message||message;}catch{}throw new Error(message);}
  const disposition=response.headers.get("content-disposition")||"";
  const match=disposition.match(/filename\*?=(?:UTF-8''|)["']?([^"';]+)["']?/i);
  const filename=(match?decodeURIComponent(match[1]):fallback).replace(/[^a-zA-Z0-9._-]/g,"-");
  const url=URL.createObjectURL(await response.blob()); const link=document.createElement("a"); link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
}
export async function downloadManagementReport(format,selectedDate,daysAhead){
  const query=new URLSearchParams({selected_date:selectedDate,days_ahead:String(daysAhead)});
  const response=await fetch(`${API_BASE}/reports/management/${format}?${query}`,{cache:"no-store"});
  const fallback=`management-report-${selectedDate}-${daysAhead}-days.${format}`;
  await saveDownload(response,fallback);
}

export async function downloadSavedReport(reportId,format){
  const linkResponse=await fetch(`${API_BASE}/reports/history/${reportId}/download-link`,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({format}),cache:"no-store"
  });
  const body=await linkResponse.json();
  if(!linkResponse.ok)throw new Error(body?.error?.message||"Unable to prepare the download.");
  const response=await fetch(body.url,{cache:"no-store"});
  await saveDownload(response,`management-report-${reportId}.${format}`);
}
