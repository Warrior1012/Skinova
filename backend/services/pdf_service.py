import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)


BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

REPORT_DIR = os.path.join(
    BASE_DIR,
    "reports"
)

os.makedirs(
    REPORT_DIR,
    exist_ok=True
)


def generate_pdf_report(
    assessment_id: str,
    ml_result: dict,
    answers: dict,
    final_result: dict,
    sources: list | None = None,
):

    filename = f"skinova_report_{assessment_id}.pdf"

    filepath = os.path.join(
        REPORT_DIR,
        filename
    )

    document = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "TitleStyle",
        parent=styles["Title"],
        alignment=TA_CENTER,
        fontSize=22,
        leading=26,
        spaceAfter=8,
    )

    subtitle_style = ParagraphStyle(
        "SubtitleStyle",
        parent=styles["Normal"],
        alignment=TA_CENTER,
        fontSize=9,
        leading=12,
        textColor=colors.grey,
        spaceAfter=18,
    )

    heading_style = ParagraphStyle(
        "HeadingStyle",
        parent=styles["Heading2"],
        fontSize=14,
        leading=18,
        spaceBefore=12,
        spaceAfter=8,
    )

    body_style = ParagraphStyle(
        "BodyStyle",
        parent=styles["BodyText"],
        fontSize=9.5,
        leading=14,
        spaceAfter=6,
    )

    small_style = ParagraphStyle(
        "SmallStyle",
        parent=styles["BodyText"],
        fontSize=8,
        leading=11,
        textColor=colors.grey,
    )

    warning_style = ParagraphStyle(
        "WarningStyle",
        parent=body_style,
        fontSize=9,
        leading=13,
    )

    story = []

    # ========================================================
    # HEADER
    # ========================================================

    story.append(
        Paragraph(
            "SKINOVA",
            title_style
        )
    )

    story.append(
        Paragraph(
            "AI-Assisted Skin Health Screening Report",
            subtitle_style
        )
    )

    story.append(
        Paragraph(
            f"<b>Assessment ID:</b> {assessment_id}",
            body_style
        )
    )

    story.append(
        Paragraph(
            f"<b>Generated:</b> "
            f"{datetime.now().strftime('%d %B %Y, %I:%M %p')}",
            body_style
        )
    )

    story.append(Spacer(1, 8))

    # ========================================================
    # IMPORTANT DISCLAIMER
    # ========================================================

    story.append(
        Paragraph(
            "IMPORTANT: This report is an AI-assisted screening "
            "summary and is NOT a medical diagnosis. The ML model "
            "prediction and AI assessment cannot replace evaluation "
            "by a qualified healthcare professional.",
            warning_style
        )
    )

    story.append(Spacer(1, 10))

    # ========================================================
    # ML RESULT
    # ========================================================

    story.append(
        Paragraph(
            "1. Image Screening Result",
            heading_style
        )
    )

    ml_class = ml_result.get(
        "class",
        "Unknown"
    )

    disease = ml_result.get(
        "disease",
        "Unknown"
    )

    confidence = ml_result.get(
        "confidence",
        "Unknown"
    )

    ml_data = [
        ["Model prediction", str(disease)],
        ["Classification code", str(ml_class)],
        ["Model confidence", f"{confidence}%"],
    ]

    ml_table = Table(
        ml_data,
        colWidths=[55 * mm, 110 * mm]
    )

    ml_table.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ])
    )

    story.append(ml_table)

    distribution = ml_result.get("distribution", [])
    if distribution:
        story.append(Paragraph("7-Class Model Output Distribution", heading_style))
        dist_data = [["Class", "Model output"]]
        for item in distribution:
            dist_data.append([
                f'{item.get("code", "")} · {item.get("name", "")}',
                f'{item.get("score", 0):.2f}%'
            ])
        dist_table = Table(dist_data, colWidths=[115 * mm, 50 * mm])
        dist_table.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.4, colors.lightgrey),
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(dist_table)
        story.append(Paragraph(
            "These are model output scores and are not medically calibrated disease probabilities.",
            small_style
        ))

    story.append(Spacer(1, 6))

    story.append(
        Paragraph(
            "The classification confidence represents the model's "
            "confidence in its predicted class. It should NOT be "
            "interpreted as the probability that the user has the "
            "corresponding disease.",
            small_style
        )
    )

    # ========================================================
    # CONTEXTUAL SCREENING ASSESSMENT
    # ========================================================

    story.append(
        Paragraph(
            "2. Contextual Screening Assessment",
            heading_style
        )
    )

    priority = final_result.get("screening_priority", "Uncertain")
    urgency = final_result.get("urgency", "")
    story.append(Paragraph(
        f"<b>Screening priority:</b> {priority}",
        body_style
    ))
    if urgency:
        story.append(Paragraph(
            f"<b>Suggested next-step urgency:</b> {urgency}",
            body_style
        ))

    if final_result.get("summary"):
        story.append(Paragraph(
            f"<b>Summary:</b> {final_result['summary']}",
            body_style
        ))

    # ========================================================
    # USER ANSWERS
    # ========================================================

    story.append(
        Paragraph(
            "3. User-Provided Information",
            heading_style
        )
    )

    if answers:

        answer_data = [
            ["Question", "Answer"]
        ]

        if isinstance(answers, dict):
            answer_items = [
                {
                    "question_id": question_id,
                    "question": question_id,
                    "answer": answer
                }
                for question_id, answer in answers.items()
            ]
        else:
            answer_items = answers

        for item in answer_items:
            answer_data.append([
                str(item.get("question", item.get("question_id", ""))),
                str(item.get("answer", ""))
            ])

        answer_table = Table(
            answer_data,
            colWidths=[55 * mm, 110 * mm],
            repeatRows=1
        )

        answer_table.setStyle(
            TableStyle([
                ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ])
        )

        story.append(answer_table)

    else:

        story.append(
            Paragraph(
                "No user answers were provided.",
                body_style
            )
        )

    # ========================================================
    # FINAL AI ASSESSMENT
    # ========================================================

    story.append(
        Paragraph(
            "4. AI Screening Assessment",
            heading_style
        )
    )

    screening_priority = final_result.get(
        "screening_priority",
        "Uncertain"
    )

    urgency = final_result.get(
        "urgency",
        "Not specified"
    )

    summary = final_result.get(
        "summary",
        ""
    )

    explanation = final_result.get(
        "explanation",
        ""
    )

    recommendation = final_result.get(
        "recommendation",
        ""
    )

    disclaimer = final_result.get(
        "disclaimer",
        ""
    )

    assessment_data = [
        ["Screening concern", str(screening_priority)],
        ["Recommended urgency", str(urgency)],
    ]

    assessment_table = Table(
        assessment_data,
        colWidths=[55 * mm, 110 * mm]
    )

    assessment_table.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ])
    )

    story.append(
        assessment_table
    )

    story.append(
        Paragraph(
            "<b>Summary</b>",
            body_style
        )
    )

    story.append(
        Paragraph(
            str(summary),
            body_style
        )
    )

    story.append(
        Paragraph(
            "<b>Explanation</b>",
            body_style
        )
    )

    story.append(
        Paragraph(
            str(explanation),
            body_style
        )
    )

    # ========================================================
    # PRECAUTIONS
    # ========================================================

    story.append(
        Paragraph(
            "5. General Precautions",
            heading_style
        )
    )

    precautions = final_result.get(
        "precautions",
        []
    )

    if precautions:

        for precaution in precautions:

            story.append(
                Paragraph(
                    f"• {precaution}",
                    body_style
                )
            )

    else:

        story.append(
            Paragraph(
                "No specific precautions were generated.",
                body_style
            )
        )

    # ========================================================
    # RECOMMENDATION
    # ========================================================

    story.append(
        Paragraph(
            "6. Recommended Next Step",
            heading_style
        )
    )

    story.append(
        Paragraph(
            str(recommendation),
            body_style
        )
    )

    # ========================================================
    # SOURCES
    # ========================================================

    if sources:

        story.append(
            Paragraph(
                "7. Medical Knowledge Sources",
                heading_style
            )
        )

        for source in sources:

            source_id = source.get(
                "id",
                "Unknown source"
            )

            source_title = source.get("title") or source_id
            source_url = source.get("url")

            if source_url:
                story.append(
                    Paragraph(
                        f"• {source_title}<br/><font size='7'>{source_url}</font>",
                        body_style
                    )
                )
            else:
                story.append(
                    Paragraph(
                        f"• {source_title}",
                        body_style
                    )
                )

    # ========================================================
    # FINAL DISCLAIMER
    # ========================================================

    story.append(
        Spacer(1, 12)
    )

    story.append(
        Paragraph(
            "<b>Medical Disclaimer</b>",
            heading_style
        )
    )

    story.append(
        Paragraph(
            str(disclaimer),
            warning_style
        )
    )

    story.append(
        Paragraph(
            "Skinova is an AI-assisted screening tool. It does not "
            "provide a definitive diagnosis and should not be used "
            "as a substitute for professional medical care.",
            warning_style
        )
    )

    # ========================================================
    # BUILD PDF
    # ========================================================

    document.build(story)

    return filepath