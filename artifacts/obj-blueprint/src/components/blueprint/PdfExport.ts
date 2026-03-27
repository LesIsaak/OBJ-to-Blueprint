import jsPDF from 'jspdf';
import * as THREE from 'three';
import { exportCameraRef } from './exportCamera';
import type { Dimension, Unit } from '@/store/use-blueprint-store';

/**
 * Project a 3D world point to PDF page coordinates.
 * The canvas image is placed at (imgX, imgY, imgW, imgH) in mm.
 */
function project3dToPdf(
  pt: [number, number, number],
  camera: THREE.Camera,
  canvasW: number,
  canvasH: number,
  imgX: number,
  imgY: number,
  imgW: number,
  imgH: number,
): { x: number; y: number } {
  const v = new THREE.Vector3(...pt).project(camera);
  // NDC → canvas pixels
  const px = ((v.x + 1) / 2) * canvasW;
  const py = ((-v.y + 1) / 2) * canvasH;
  // Canvas pixels → PDF mm
  return {
    x: imgX + (px / canvasW) * imgW,
    y: imgY + (py / canvasH) * imgH,
  };
}

export const exportToPdf = (
  canvas: HTMLCanvasElement | null,
  projectName: string,
  dimensions: Dimension[],
  scale: number,
  unit: Unit,
) => {
  if (!canvas) return false;

  try {
    const imgData = canvas.toDataURL('image/png', 1.0);

    // A4 Landscape
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // ── Blueprint dark background ──────────────────────────────────────────────
    pdf.setFillColor(13, 17, 23);
    pdf.rect(0, 0, 297, 210, 'F');

    // ── Canvas image — centered, aspect-ratio preserved ───────────────────────
    const marginX = 10;
    const marginY = 10;
    const titleH  = 28;

    // Maximum available area for the image
    const areaW = 297 - marginX * 2;
    const areaH = 210 - marginY - titleH - 5;

    // Preserve canvas aspect ratio
    const canvasAspect = canvas.width / canvas.height;
    const areaAspect   = areaW / areaH;

    let imgW: number, imgH: number;
    if (canvasAspect > areaAspect) {
      // Canvas is wider — fit to width
      imgW = areaW;
      imgH = areaW / canvasAspect;
    } else {
      // Canvas is taller — fit to height
      imgH = areaH;
      imgW = areaH * canvasAspect;
    }

    // Center within the available area
    const imgX = marginX + (areaW - imgW) / 2;
    const imgY = marginY + (areaH - imgH) / 2;

    // Fill the area background before placing the image
    pdf.setFillColor(13, 17, 23);
    pdf.rect(marginX, marginY, areaW, areaH, 'F');

    pdf.addImage(imgData, 'PNG', imgX, imgY, imgW, imgH);

    // ── Outer border around the full image area ───────────────────────────────
    pdf.setDrawColor(88, 166, 255);
    pdf.setLineWidth(0.4);
    pdf.rect(marginX, marginY, areaW, areaH);

    // ── Dimension labels projected onto the PDF ───────────────────────────────
    const cam   = exportCameraRef.current;
    const cw    = exportCameraRef.size.w || canvas.width;
    const ch    = exportCameraRef.size.h || canvas.height;

    if (cam && dimensions.length > 0) {
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');

      for (const dim of dimensions) {
        const { p1, p2, customText, axis, chainIndex = 0, view } = dim;

        // Compute the label world position (mirrors DimensionLine.tsx logic)
        let labelPos: [number, number, number] | null = null;

        // We mirror the label position logic from DimensionLine/buildDimGeometry
        // This keeps label placement consistent between viewport and PDF
        const midX = (p1[0] + p2[0]) / 2;
        const midY = (p1[1] + p2[1]) / 2;
        const midZ = (p1[2] + p2[2]) / 2;

        if (axis === 'horizontal') {
          // Label is below the dimension line — approximate offset
          const approxOffset = 2 + chainIndex * 3;
          if (view === 'left' || view === 'right') {
            labelPos = [0, midY - approxOffset, midZ];
          } else {
            labelPos = [midX, midY - approxOffset, 0];
          }
        } else if (axis === 'vertical') {
          const approxOffset = 2 + chainIndex * 3;
          if (view === 'left') {
            labelPos = [0, midY, midZ + approxOffset];
          } else if (view === 'right') {
            labelPos = [0, midY, midZ - approxOffset];
          } else if (view === 'back') {
            labelPos = [midX + approxOffset, midY, 0];
          } else {
            labelPos = [midX - approxOffset, midY, 0];
          }
        } else {
          labelPos = [midX, midY, midZ];
        }

        if (!labelPos) continue;

        const { x, y } = project3dToPdf(labelPos, cam, cw, ch, imgX, imgY, imgW, imgH);

        // Skip labels that project outside the image area
        if (x < imgX || x > imgX + imgW || y < imgY || y > imgY + imgH) continue;

        const measuredDist = Math.sqrt(
          (p2[0] - p1[0]) ** 2 +
          (p2[1] - p1[1]) ** 2 +
          (p2[2] - p1[2]) ** 2,
        );
        const labelText = customText || `${(measuredDist * scale).toFixed(2)} ${unit}`;

        // White background pill for readability
        const tw = pdf.getTextWidth(labelText);
        pdf.setFillColor(13, 17, 23);
        pdf.roundedRect(x - tw / 2 - 1.5, y - 3, tw + 3, 4.5, 0.5, 0.5, 'F');

        // Label text in purple to match viewport
        pdf.setTextColor(210, 168, 255);
        pdf.text(labelText, x, y, { align: 'center', baseline: 'middle' });
      }
    }

    // ── Title block ───────────────────────────────────────────────────────────
    const tbX = marginX;
    const tbY = 210 - marginY - titleH + 2;
    const tbW = imgW;
    const tbH = titleH;

    pdf.setFillColor(22, 27, 34);
    pdf.setDrawColor(88, 166, 255);
    pdf.setLineWidth(0.4);
    pdf.roundedRect(tbX, tbY, tbW, tbH, 1, 1, 'FD');

    // Vertical dividers
    const col1 = tbX + tbW * 0.45;
    const col2 = tbX + tbW * 0.70;
    pdf.setLineWidth(0.2);
    pdf.line(col1, tbY, col1, tbY + tbH);
    pdf.line(col2, tbY, col2, tbY + tbH);

    // Left column — project name
    pdf.setTextColor(88, 166, 255);
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.text('PROJECT', tbX + 4, tbY + 5);
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text(projectName || 'Untitled Blueprint', tbX + 4, tbY + 13);
    pdf.setTextColor(150, 170, 200);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.text('OBJ BLUEPRINT MAKER', tbX + 4, tbY + 20);

    // Middle column — dimensions summary
    pdf.setTextColor(88, 166, 255);
    pdf.setFontSize(6);
    pdf.text('MEASUREMENTS', col1 + 4, tbY + 5);
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${dimensions.length} dimension${dimensions.length !== 1 ? 's' : ''}`, col1 + 4, tbY + 12);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(150, 170, 200);
    pdf.text(`Unit: ${unit}  ·  Scale: ${scale}`, col1 + 4, tbY + 19);

    // Right column — date & app
    pdf.setTextColor(88, 166, 255);
    pdf.setFontSize(6);
    pdf.text('DATE', col2 + 4, tbY + 5);
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(new Date().toLocaleDateString(), col2 + 4, tbY + 12);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6);
    pdf.setTextColor(88, 166, 255);
    pdf.text('OBJ.PRINT', col2 + 4, tbY + 20);

    pdf.save(`${(projectName || 'Blueprint').replace(/\s+/g, '_')}_Blueprint.pdf`);
    return true;
  } catch (err) {
    console.error('Failed to export PDF', err);
    return false;
  }
};
