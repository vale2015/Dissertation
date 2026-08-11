"""In-memory A4 landscape management-report PDF."""

import io
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak


def _money(value, currency): return "Unavailable" if value is None else f"{currency} {value:,.2f}"


def generate_report_pdf(report):
    buffer=io.BytesIO(); meta=report["metadata"]; styles=getSampleStyleSheet()
    small=ParagraphStyle("Small",parent=styles["BodyText"],fontSize=7,leading=9)
    doc=SimpleDocTemplate(buffer,pagesize=landscape(A4),leftMargin=12*mm,rightMargin=12*mm,topMargin=14*mm,bottomMargin=14*mm,
        title="Management Forecast Report",author=meta["restaurant_name"] or "Restaurant Forecasting System")
    story=[Paragraph("Management Forecast Report",styles["Title"]),Paragraph(
        f"{meta['restaurant_name']} - {meta['restaurant_city']} | Selected date: {meta['selected_date']} | Forecast: {meta['start_date']} to {meta['end_date']}",
        ParagraphStyle("Centre",parent=styles["BodyText"],alignment=TA_CENTER)),Spacer(1,6*mm)]
    summary=report["summary"]; fin=report["financials"]
    cards=[["Forecast covers","Open days","Peak day","Staff assignments","Labour cost"],
           [summary["forecasted_covers"],summary["open_days"],summary["peak_date"] or "-",summary["total_staff_assignments"],_money(fin["estimated_labour_cost"],meta["currency"])]]
    table=Table(cards,colWidths=[52*mm]*5); table.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#dc2038")),("TEXTCOLOR",(0,0),(-1,0),colors.white),("GRID",(0,0),(-1,-1),.5,colors.grey),("ALIGN",(0,0),(-1,-1),"CENTER"),("PADDING",(0,0),(-1,-1),6)])); story += [table,Spacer(1,5*mm)]
    story += [Paragraph("Financial projections",styles["Heading2"]),Paragraph(
        f"Revenue: {_money(fin['estimated_revenue'],meta['currency'])} | Food cost: {_money(fin['estimated_food_cost'],meta['currency'])} | Gross profit before labour: {_money(fin['estimated_gross_profit_before_labour'],meta['currency'])} | Contribution after food and labour: {_money(fin['estimated_contribution_after_food_and_labour'],meta['currency'])}",styles["BodyText"])]
    mix=report["booking_mix_reference"]; story += [Paragraph("Historical booking mix reference",styles["Heading2"]),Paragraph(
        f"Same-day avg: {mix['same_day_average'] if mix['same_day_average'] is not None else 'Unavailable'} | Walk-in avg: {mix['walk_in_average'] if mix['walk_in_average'] is not None else 'Unavailable'} | Advance avg: {mix['advance_booking_average'] if mix['advance_booking_average'] is not None else 'Unavailable'} | Avg duration: {mix['average_booking_duration'] if mix['average_booking_duration'] is not None else 'Unavailable'}",styles["BodyText"]),Spacer(1,4*mm)]
    data=[[Paragraph(x,small) for x in ["Date","Day","Status","Covers","Staff","Labour","Revenue","Weather","Events","Warnings"]]]
    for row in report["daily_breakdown"]:
        weather=row["weather"].get("condition") if row["weather"].get("available") else "Unavailable"
        events=str(row["events"].get("event_count")) if row["events"].get("available") else "Unavailable"
        data.append([Paragraph(str(x),small) for x in [row["date"],row["day_of_week"],row["status"],row["predicted_covers"],row["staffing"]["total_staff_assignments"],_money(row["estimated_labour_cost"],meta["currency"]),_money(row["estimated_revenue"],meta["currency"]),weather,events,"; ".join(w["message"] for w in row["warnings"]) or "-"]])
    daily=Table(data,repeatRows=1,colWidths=[24*mm,20*mm,17*mm,15*mm,14*mm,25*mm,25*mm,28*mm,15*mm,69*mm]); daily.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#172033")),("TEXTCOLOR",(0,0),(-1,0),colors.white),("GRID",(0,0),(-1,-1),.35,colors.grey),("VALIGN",(0,0),(-1,-1),"TOP"),("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,colors.HexColor("#f4f4f4")])]))
    story += [Paragraph("Daily operational breakdown",styles["Heading2"]),daily,PageBreak(),Paragraph("Operational insights",styles["Heading2"])]
    story += [Paragraph(f"- {item}",styles["BodyText"]) for item in report["operational_insights"]] or [Paragraph("No additional insights.",styles["BodyText"])]
    story += [Paragraph("Warnings",styles["Heading2"])] + ([Paragraph(f"- {w['message']}",styles["BodyText"]) for w in report["warnings"]] or [Paragraph("No report warnings.",styles["BodyText"])])
    sources=", ".join(f"{k}: {'available' if v['available'] else 'unavailable'}" for k,v in report["data_sources"].items())
    story += [Paragraph("Data sources",styles["Heading2"]),Paragraph(sources,styles["BodyText"]),Spacer(1,5*mm),Paragraph(
        f"Generated {meta['generated_at']}. Figures are forecasts and estimates for management planning; they are not accounting statements.",small)]
    def page_number(canvas, document): canvas.saveState(); canvas.setFont("Helvetica",8); canvas.drawRightString(landscape(A4)[0]-12*mm,7*mm,f"Page {document.page}"); canvas.restoreState()
    doc.build(story,onFirstPage=page_number,onLaterPages=page_number); return buffer.getvalue()
