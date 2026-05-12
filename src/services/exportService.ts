/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Decision } from '../types';

// Extend jsPDF with autotable types
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export async function exportToWord(decision: Decision) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: "Аналізатор рішень: " + decision.query,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: "Дата: " + new Date(decision.timestamp).toLocaleString('uk-UA'),
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          // Pros & Cons
          new Paragraph({ text: "Переваги та Недоліки", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: "Переваги:", heading: HeadingLevel.HEADING_3 }),
          ...decision.analysis.prosCons.pros.map(p => new Paragraph({ text: `• ${p}`, bullet: { level: 0 } })),
          
          new Paragraph({ text: "Недоліки:", heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }),
          ...decision.analysis.prosCons.cons.map(c => new Paragraph({ text: `• ${c}`, bullet: { level: 0 } })),

          // SWOT
          new Paragraph({ text: "SWOT Аналіз", heading: HeadingLevel.HEADING_2, spacing: { before: 400 } }),
          new Paragraph({ children: [new TextRun({ text: "Сильні сторони:", bold: true })] }),
          ...decision.analysis.swot.strengths.map(s => new Paragraph({ text: `• ${s}`, bullet: { level: 0 } })),
          new Paragraph({ children: [new TextRun({ text: "Слабкі сторони:", bold: true })], spacing: { before: 100 } }),
          ...decision.analysis.swot.weaknesses.map(s => new Paragraph({ text: `• ${s}`, bullet: { level: 0 } })),
          new Paragraph({ children: [new TextRun({ text: "Можливості:", bold: true })], spacing: { before: 100 } }),
          ...decision.analysis.swot.opportunities.map(s => new Paragraph({ text: `• ${s}`, bullet: { level: 0 } })),
          new Paragraph({ children: [new TextRun({ text: "Загрози:", bold: true })], spacing: { before: 100 } }),
          ...decision.analysis.swot.threats.map(s => new Paragraph({ text: `• ${s}`, bullet: { level: 0 } })),

          // Comparison Table
          ...(decision.analysis.comparison ? [
            new Paragraph({ text: "Порівняльна таблиця", heading: HeadingLevel.HEADING_2, spacing: { before: 400 } }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: decision.analysis.comparison.headers.map(h => new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
                    shading: { fill: "F3F4F6" }
                  }))
                }),
                ...decision.analysis.comparison.rows.map(row => new TableRow({
                  children: row.map(cell => new TableCell({
                    children: [new Paragraph({ text: cell })]
                  }))
                }))
              ]
            })
          ] : []),

          // Summary
          new Paragraph({ text: "Підсумок", heading: HeadingLevel.HEADING_2, spacing: { before: 400 } }),
          new Paragraph({
            children: [
              new TextRun({ text: decision.analysis.summary, italics: true })
            ],
            spacing: { before: 200 }
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Decision_Analysis_${decision.id.substring(0, 8)}.docx`);
}

export async function exportToPDF(decision: Decision) {
    const doc = new jsPDF();

    // Note: Standard fonts in jsPDF don't support Cyrillic well.
    // In a production app, we would embed a custom font (TTF).
    // For this app, we'll use autoTable which handles some aspects better, 
    // but the core issue of base font remains.
    // We'll proceed with basic text, but warn that it might need a font for perfect rendering.
    
    doc.setFont("helvetica", "bold");
    doc.text("Аналізатор рішень", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(decision.query, 20, 30, { maxWidth: 170 });
    doc.text(`Дата: ${new Date(decision.timestamp).toLocaleString('uk-UA')}`, 20, 40);

    let currentY = 50;

    // Pros & Cons Tables
    doc.autoTable({
        startY: currentY,
        head: [['Переваги', 'Недоліки']],
        body: Array.from({ length: Math.max(decision.analysis.prosCons.pros.length, decision.analysis.prosCons.cons.length) }).map((_, i) => [
            decision.analysis.prosCons.pros[i] || '',
            decision.analysis.prosCons.cons[i] || ''
        ]),
        styles: { font: 'helvetica' },
        theme: 'striped'
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 10;

    // SWOT Table
    doc.autoTable({
        startY: currentY,
        head: [['SWOT Аналіз']],
        body: [
            ['Сильні сторони', decision.analysis.swot.strengths.join(', ')],
            ['Слабкі сторони', decision.analysis.swot.weaknesses.join(', ')],
            ['Можливості', decision.analysis.swot.opportunities.join(', ')],
            ['Загрози', decision.analysis.swot.threats.join(', ')]
        ],
        styles: { font: 'helvetica' },
        columnStyles: { 0: { fontStyle: 'bold', width: 40 } }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Comparison Table
    if (decision.analysis.comparison) {
        doc.autoTable({
            startY: currentY,
            head: [decision.analysis.comparison.headers],
            body: decision.analysis.comparison.rows,
            styles: { font: 'helvetica' }
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Summary
    doc.setFont("helvetica", "bold");
    doc.text("Підсумок:", 20, currentY);
    doc.setFont("helvetica", "italic");
    doc.text(decision.analysis.summary, 20, currentY + 10, { maxWidth: 170 });

    doc.save(`Decision_Analysis_${decision.id.substring(0, 8)}.pdf`);
}
