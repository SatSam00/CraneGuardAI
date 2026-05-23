"""
Module 3F: AI-Generated Shift Safety Report
=============================================
Queries Supabase for all incidents from the current shift, sends the structured
data to Claude claude-sonnet-4-20250514 (Anthropic) to produce a professional OSHA-formatted
natural-language report, then:
  1. Converts the report to a PDF (ReportLab).
  2. Uploads the PDF to Supabase Storage.
  3. Sends a Telegram message with the PDF link to the supervisor.

All steps are async-safe and wrapped in try/except.
"""

import os
import io
import time
import json
import asyncio
import httpx
from datetime import datetime, timezone
from collections import Counter

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib import colors
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    print("[ReportEngine] reportlab not installed. PDF export disabled.")

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    print("[ReportEngine] anthropic not installed. AI report disabled.")


ANTHROPIC_API_KEY    = os.getenv("ANTHROPIC_API_KEY", "")
TELEGRAM_BOT_TOKEN   = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID     = os.getenv("TELEGRAM_CHAT_ID", "")
SUPABASE_URL         = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY         = os.getenv("SUPABASE_KEY", "")


def _build_analysis_payload(incidents: list, shift_start: str, shift_end: str) -> dict:
    """Summarise raw Supabase incidents into a compact analysis dict for Claude."""
    total = len(incidents)
    zone_counts   = Counter(i.get("zone_name", "Unknown") for i in incidents)
    type_counts   = Counter(i.get("type", "UNKNOWN") for i in incidents)
    severity_counts = Counter(i.get("severity", "UNKNOWN") for i in incidents)
    critical_count = severity_counts.get("CRITICAL", 0)
    pre_col_count  = type_counts.get("PRE_COLLISION_WARNING", 0)

    top_zones = zone_counts.most_common(5)
    return {
        "shift_start": shift_start,
        "shift_end": shift_end,
        "total_incidents": total,
        "critical_incidents": critical_count,
        "pre_collision_warnings": pre_col_count,
        "top_risk_zones": [{"zone": z, "count": c} for z, c in top_zones],
        "incident_type_breakdown": dict(type_counts),
        "incidents_sample": incidents[:20]  # First 20 for Claude context
    }


async def _call_claude(payload: dict) -> str:
    """Call Claude claude-sonnet-4-20250514 to generate the report text."""
    if not ANTHROPIC_AVAILABLE or not ANTHROPIC_API_KEY:
        return _fallback_report(payload)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    prompt = f"""You are an expert industrial safety analyst. Generate a formal OSHA-formatted
shift safety report from the following site monitoring data.

DATA:
{json.dumps(payload, indent=2, default=str)}

Write a structured report with these sections:
1. EXECUTIVE SUMMARY — brief paragraph, overall safety grade (A–F)
2. INCIDENT BREAKDOWN — bullet points by type and severity
3. HIGHEST RISK ZONES — table of zones with incident counts and risk level
4. WORKER SAFETY COMPLIANCE — assessment based on pre-collision and proximity data
5. OSHA 1926 RECOMMENDATIONS — at least 3 specific, actionable recommendations referencing OSHA standard subparts
6. NEXT SHIFT PRIORITIES — 3 bullet points for the safety supervisor

Use plain text formatting with clear section headers. Be concise but professional."""

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
    )
    return response.content[0].text


def _fallback_report(payload: dict) -> str:
    """Simple text report when Anthropic API is unavailable."""
    lines = [
        "CRANEGUARD AI — SHIFT SAFETY REPORT (Auto-Generated)",
        "=" * 55,
        f"Shift:  {payload['shift_start']} → {payload['shift_end']}",
        f"Total Incidents:  {payload['total_incidents']}",
        f"Critical:         {payload['critical_incidents']}",
        f"Pre-Collision:    {payload['pre_collision_warnings']}",
        "",
        "TOP RISK ZONES:",
    ]
    for item in payload["top_risk_zones"]:
        lines.append(f"  • {item['zone']:30s} {item['count']} incidents")
    lines += [
        "",
        "RECOMMENDATION: Review flagged zones before next shift.",
        "Ensure all workers complete safety briefing.",
    ]
    return "\n".join(lines)


def _build_pdf(report_text: str, payload: dict) -> bytes:
    """Convert the report text to a PDF and return bytes."""
    if not REPORTLAB_AVAILABLE:
        return report_text.encode("utf-8")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                             leftMargin=20*mm, rightMargin=20*mm,
                             topMargin=20*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()
    story  = []

    # Header
    story.append(Paragraph("<b>CraneGuard AI — Shift Safety Report</b>", styles["Title"]))
    story.append(Spacer(1, 4*mm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.teal))
    story.append(Spacer(1, 4*mm))

    meta = [
        ["Shift Start:", payload["shift_start"]],
        ["Shift End:",   payload["shift_end"]],
        ["Total Incidents:", str(payload["total_incidents"])],
        ["Critical:",    str(payload["critical_incidents"])],
    ]
    t = Table(meta, colWidths=[50*mm, 100*mm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.whitesmoke, colors.white]),
    ]))
    story.append(t)
    story.append(Spacer(1, 6*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))
    story.append(Spacer(1, 4*mm))

    # Report body
    for line in report_text.split("\n"):
        line = line.strip()
        if not line:
            story.append(Spacer(1, 3*mm))
        elif line.startswith(("1.", "2.", "3.", "4.", "5.", "6.")) or line.isupper():
            story.append(Paragraph(f"<b>{line}</b>", styles["Heading2"]))
        elif line.startswith("•") or line.startswith("-"):
            story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;{line}", styles["Normal"]))
        else:
            story.append(Paragraph(line, styles["Normal"]))

    story.append(Spacer(1, 10*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    story.append(Paragraph(f"<i>Generated by CraneGuard AI on {generated_at}</i>", styles["Normal"]))

    doc.build(story)
    return buf.getvalue()


async def _upload_pdf_to_supabase(pdf_bytes: bytes, filename: str):
    """Upload PDF to Supabase Storage bucket 'reports'."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    url = f"{SUPABASE_URL}/storage/v1/object/reports/{filename}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/pdf",
        "x-upsert": "true"
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, content=pdf_bytes, headers=headers)
        if r.status_code in (200, 201):
            public_url = f"{SUPABASE_URL}/storage/v1/object/public/reports/{filename}"
            return public_url
    return None


async def _send_telegram_report(text_summary: str, pdf_url: str | None):
    """Send shift report summary + PDF link to Telegram supervisor chat."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
    msg = f"📊 *CraneGuard AI — Shift Report Ready*\n\n{text_summary[:500]}..."
    if pdf_url:
        msg += f"\n\n📄 [Download Full PDF Report]({pdf_url})"
    api_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    async with httpx.AsyncClient(timeout=15) as client:
        await client.post(api_url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": msg,
            "parse_mode": "Markdown"
        })


async def generate_shift_report(incidents: list, shift_start: str, shift_end: str) -> dict:
    """
    Main entry point. Call via FastAPI endpoint at shift end.

    Returns:
      {
        "status": "ok" | "error",
        "report_text": str,
        "pdf_url": str | None,
        "telegram_sent": bool
      }
    """
    try:
        payload     = _build_analysis_payload(incidents, shift_start, shift_end)
        report_text = await _call_claude(payload)

        # Build PDF
        pdf_bytes = _build_pdf(report_text, payload)

        # Upload to Supabase Storage
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename  = f"shift_report_{timestamp}.pdf"
        pdf_url   = await _upload_pdf_to_supabase(pdf_bytes, filename)

        # Notify supervisor
        await _send_telegram_report(report_text, pdf_url)

        return {
            "status": "ok",
            "report_text": report_text,
            "pdf_url": pdf_url,
            "telegram_sent": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)
        }
    except Exception as e:
        print(f"[ReportEngine] Error: {e}")
        return {"status": "error", "error": str(e), "report_text": "", "pdf_url": None}
