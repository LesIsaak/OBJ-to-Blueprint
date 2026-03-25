import jsPDF from 'jspdf';

export const exportToPdf = (canvas: HTMLCanvasElement | null, projectName: string) => {
  if (!canvas) return;

  try {
    const imgData = canvas.toDataURL('image/png', 1.0);
    
    // A4 Landscape
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    
    // Fill blueprint background
    pdf.setFillColor(13, 17, 23); // Match #0d1117
    pdf.rect(0, 0, 297, 210, 'F');
    
    // Add canvas image (centered, scaled)
    pdf.addImage(imgData, 'PNG', 10, 10, 277, 190);
    
    // Title Block Area (Architectural Style)
    pdf.setDrawColor(88, 166, 255); // Cyan border
    pdf.setLineWidth(0.5);
    pdf.rect(10, 10, 277, 190); // Outer border
    
    // Info Box
    const boxX = 200;
    const boxY = 175;
    pdf.setFillColor(22, 27, 34); // Match #161b22
    pdf.rect(boxX, boxY, 87, 25, 'FD'); // Fill and Draw
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("PROJECT BLUEPRINT", boxX + 5, boxY + 8);
    
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Name: ${projectName}`, boxX + 5, boxY + 16);
    pdf.text(`Date: ${new Date().toLocaleDateString()}`, boxX + 5, boxY + 22);
    
    pdf.save(`${projectName.replace(/\s+/g, '_')}_Blueprint.pdf`);
    return true;
  } catch (err) {
    console.error("Failed to export PDF", err);
    return false;
  }
};
