import { jsPDF } from 'jspdf';

/**
 * Generate and download a professional PDF Originality & Plagiarism Certificate
 * @param {Object} report - Analysis result object from analyzePlagiarism
 * @param {string} documentTitle - Optional title or filename
 */
export function exportReportToPdf(report, documentTitle = 'Originality-Scan-Report') {
  if (!report) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 32, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('VERITAS AI - ORIGINALITY & PLAGIARISM REPORT', margin, 14);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Generated on ${new Date().toLocaleString()} | Powered by Veritas NLP Engine`, margin, 22);

  y = 42;

  // Overview Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, y, contentWidth, 38, 3, 3, 'FD');

  // Score Highlight Circle / Text
  const score = report.originalityScore;
  if (score >= 80) {
    doc.setTextColor(16, 185, 129); // emerald
  } else if (score >= 50) {
    doc.setTextColor(245, 158, 11); // amber
  } else {
    doc.setTextColor(239, 68, 68); // rose
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text(`${score}%`, margin + 12, y + 20);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('ORIGINALITY SCORE', margin + 8, y + 28);

  // Metrics Grid in Overview Box
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  const col1X = margin + 58;
  const col2X = margin + 105;

  doc.text(`Overall Verdict:`, col1X, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${report.overallVerdict}`, col1X + 26, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.text(`Plagiarism Risk:`, col1X, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.text(`${report.plagiarismRisk}%`, col1X + 26, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.text(`Paraphrased %:`, col1X, y + 28);
  doc.setFont('helvetica', 'bold');
  doc.text(`${report.paraphrasedPercentage}%`, col1X + 26, y + 28);

  doc.setFont('helvetica', 'normal');
  doc.text(`Word Count:`, col2X, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${report.wordCount} words`, col2X + 24, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.text(`AI Likelihood:`, col2X, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.text(`${report.aiGeneratedLikelihood}%`, col2X + 24, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.text(`Sentences:`, col2X, y + 28);
  doc.setFont('helvetica', 'bold');
  doc.text(`${report.sentenceCount || report.sentenceAnalysis?.length || 0}`, col2X + 24, y + 28);

  y += 46;

  // Recommendations Section
  if (report.recommendations && report.recommendations.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Integrity Insights & Recommendations', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    report.recommendations.forEach((rec) => {
      const splitText = doc.splitTextToSize(`• ${rec}`, contentWidth);
      doc.text(splitText, margin, y);
      y += splitText.length * 4.5;
    });

    y += 4;
  }

  // Matched Sources Table
  if (report.potentialSources && report.potentialSources.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Matched Sources & Citations', margin, y);
    y += 6;

    report.potentialSources.slice(0, 4).forEach((source) => {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 14, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(source.title, margin + 3, y + 5);

      doc.setTextColor(239, 68, 68);
      doc.text(`~${source.similarity}% match`, pageWidth - margin - 22, y + 5);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const splitCit = doc.splitTextToSize(source.citation || source.domain, contentWidth - 6);
      doc.text(splitCit[0] || '', margin + 3, y + 10);

      y += 17;
    });
    y += 4;
  }

  // Sentence-by-Sentence Breakdown (top sentences)
  if (report.sentenceAnalysis && report.sentenceAnalysis.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Sentence-by-Sentence Diagnostics', margin, y);
    y += 6;

    report.sentenceAnalysis.slice(0, 10).forEach((item, index) => {
      if (y > 265) {
        doc.addPage();
        y = 20;
      }

      // Status indicator
      if (item.status === 'Plagiarized') {
        doc.setFillColor(254, 242, 242); // rose-50
        doc.setTextColor(225, 29, 72); // rose-600
      } else if (item.status === 'Paraphrased') {
        doc.setFillColor(254, 243, 199); // amber-50
        doc.setTextColor(217, 119, 6); // amber-600
      } else if (item.status === 'AI-Generated') {
        doc.setFillColor(243, 232, 255); // purple-100
        doc.setTextColor(126, 34, 206); // purple-700
      } else {
        doc.setFillColor(240, 253, 244); // emerald-50
        doc.setTextColor(22, 163, 74); // emerald-600
      }

      doc.rect(margin, y, contentWidth, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(`[${item.status}] - Risk: ${item.riskScore}%`, margin + 3, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      const sentenceExcerpt = item.sentence.length > 95 ? item.sentence.substring(0, 95) + '...' : item.sentence;
      doc.text(`"${sentenceExcerpt}"`, margin + 3, y + 9);

      y += 14;
    });
  }

  // Footer on all pages
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${pageCount} | Veritas AI Originality Inspector &bull; Confidential Academic Report`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  // Save the PDF
  const safeFilename = `${documentTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.pdf`;
  doc.save(safeFilename);
}
