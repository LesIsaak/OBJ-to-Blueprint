import jsPDF from 'jspdf';
import * as THREE from 'three';
import { exportCameraRef } from './exportCamera';
import type { Dimension, ModelBounds, Unit } from '@/store/use-blueprint-store';

/**
 * Project a 3D world point to PDF page coordinates.
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
  const px = ((v.x + 1) / 2) * canvasW;
  const py = ((-v.y + 1) / 2) * canvasH;
  return {
    x: imgX + (px / canvasW) * imgW,
    y: imgY + (py / canvasH) * imgH,
  };
}

/**
 * Compute the 3D world-space label position for a dimension,
 * mirroring the exact logic in DimensionLine / buildDimGeometry.
 * The label always sits OUTSIDE the model boundary AND outside the dim line.
 */
function computeLabelWorldPos(
  dim: Dimension,
  bounds: ModelBounds,
): [number, number, number] | null {
  const { p1, p2, axis, chainIndex = 0, chainOffset = 0, view } = dim;
  const { min, max } = bounds;

  const bSize = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const maxSize = Math.max(...bSize, 0.001);

  const GAP      = maxSize * 0.08;
  const SPACING  = maxSize * 0.10;
  const TICK     = maxSize * 0.025;
  const effectiveIndex = Math.max(0, chainIndex + chainOffset);
  const offset   = GAP + effectiveIndex * SPACING;

  const isLeftRight = view === 'left' || view === 'right';

  // ── Horizontal: label below the dim line ───────────────────────────────────
  if (axis === 'horizontal') {
    const dimY = min[1] - offset;
    const labelY = dimY - TICK * 2.5;  // below the dim line

    const h1 = isLeftRight ? p1[2] : p1[0];
    const h2 = isLeftRight ? p2[2] : p2[0];
    const midH = (h1 + h2) / 2;

    if (isLeftRight) return [0, labelY, midH];
    return [midH, labelY, 0];
  }

  // ── Vertical: label beyond the dim line (away from model) ─────────────────
  if (axis === 'vertical') {
    const vMin = Math.min(p1[1], p2[1]);
    const vMax = Math.max(p1[1], p2[1]);
    const midV = (vMin + vMax) / 2;

    if (view === 'left') {
      const dimZ = max[2] + offset;
      return [0, midV, dimZ + TICK * 3];           // beyond the dim line (+Z)
    }
    if (view === 'right') {
      const dimZ = min[2] - offset;
      return [0, midV, dimZ - TICK * 3];           // beyond the dim line (−Z)
    }
    if (view === 'back') {
      const dimX = max[0] + offset;
      return [dimX + TICK * 3, midV, 0];           // beyond the dim line (+X)
    }
    // front
    const dimX = min[0] - offset;
    return [dimX - TICK * 3, midV, 0];             // beyond the dim line (−X)
  }

  // ── Diagonal fallback: midpoint ────────────────────────────────────────────
  return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2];
}

export const exportToPdf = (
  canvas: HTMLCanvasElement | null,
  projectName: string,
  dimensions: Dimension[],
  scale: number,
  unit: Unit,
  modelBounds: ModelBounds | null,
) => {
  if (!canvas) return false;

  try {
    const imgData = canvas.toDataURL('image/png', 1.0);

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // ── Dark background ───────────────────────────────────────────────────────
    pdf.setFillColor(13, 17, 23);
    pdf.rect(0, 0, 297, 210, 'F');

    // ── Canvas image — centered, aspect-ratio preserved ───────────────────────
    const marginX = 10;
    const marginY = 10;
    const titleH  = 28;
    const areaW   = 297 - marginX * 2;
    const areaH   = 210 - marginY - titleH - 5;

    const canvasAspect = canvas.width / canvas.height;
    const areaAspect   = areaW / areaH;

    let imgW: number, imgH: number;
    if (canvasAspect > areaAspect) {
      imgW = areaW;
      imgH = areaW / canvasAspect;
    } else {
      imgH = areaH;
      imgW = areaH * canvasAspect;
    }

    const imgX = marginX + (areaW - imgW) / 2;
    const imgY = marginY + (areaH - imgH) / 2;

    pdf.setFillColor(13, 17, 23);
    pdf.rect(marginX, marginY, areaW, areaH, 'F');
    pdf.addImage(imgData, 'PNG', imgX, imgY, imgW, imgH);

    // ── Border ────────────────────────────────────────────────────────────────
    pdf.setDrawColor(88, 166, 255);
    pdf.setLineWidth(0.4);
    pdf.rect(marginX, marginY, areaW, areaH);

    // ── Dimension labels — projected from exact 3D label positions ────────────
    const cam = exportCameraRef.current;
    const cw  = exportCameraRef.size.w || canvas.width;
    const ch  = exportCameraRef.size.h || canvas.height;

    if (cam && modelBounds && dimensions.length > 0) {
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');

      for (const dim of dimensions) {
        const labelWorld = computeLabelWorldPos(dim, modelBounds);
        if (!labelWorld) continue;

        const { x, y } = project3dToPdf(labelWorld, cam, cw, ch, imgX, imgY, imgW, imgH);

        // Skip labels that fall outside the image area
        if (x < imgX + 1 || x > imgX + imgW - 1 || y < imgY + 1 || y > imgY + imgH - 1) continue;

        const measuredDist = Math.sqrt(
          (dim.p2[0] - dim.p1[0]) ** 2 +
          (dim.p2[1] - dim.p1[1]) ** 2 +
          (dim.p2[2] - dim.p1[2]) ** 2,
        );
        const labelText = dim.customText || `${(measuredDist * scale).toFixed(2)} ${unit}`;

        // Dark pill background, then coloured text
        const tw = pdf.getTextWidth(labelText);
        pdf.setFillColor(13, 17, 23);
        pdf.roundedRect(x - tw / 2 - 1.5, y - 2.8, tw + 3, 4.5, 0.5, 0.5, 'F');
        pdf.setTextColor(210, 168, 255);
        pdf.text(labelText, x, y, { align: 'center', baseline: 'middle' });
      }
    }

    // ── Title block ───────────────────────────────────────────────────────────
    const tbX = marginX;
    const tbY = 210 - marginY - titleH + 2;
    const tbW = areaW;
    const tbH = titleH;

    pdf.setFillColor(22, 27, 34);
    pdf.setDrawColor(88, 166, 255);
    pdf.setLineWidth(0.4);
    pdf.roundedRect(tbX, tbY, tbW, tbH, 1, 1, 'FD');

    const col1 = tbX + tbW * 0.45;
    const col2 = tbX + tbW * 0.70;
    pdf.setLineWidth(0.2);
    pdf.line(col1, tbY, col1, tbY + tbH);
    pdf.line(col2, tbY, col2, tbY + tbH);

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
