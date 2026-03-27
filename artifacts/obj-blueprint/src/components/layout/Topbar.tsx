import React from 'react';
import { useBlueprintStore } from '@/store/use-blueprint-store';
import { Button } from '@/components/ui/button';
import {
  Box, ArrowUpSquare, ArrowDownSquare, ArrowLeftSquare, ArrowRightSquare,
  Download, FileImage, Ruler, Sun, Moon, PanelLeft, PanelRight,
} from 'lucide-react';
import { exportToPdf } from '../blueprint/PdfExport';
import { exportToSvg } from '../blueprint/SvgExport';
import { useToast } from '@/hooks/use-toast';

interface TopbarProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const Topbar: React.FC<TopbarProps> = ({ canvasRef }) => {
  const {
    viewMode, setViewMode,
    isDrawing, toggleDrawing,
    projectName, dimensions, scale, unit, modelBounds,
    theme, toggleTheme,
    leftPanelOpen, rightPanelOpen,
    toggleLeftPanel, toggleRightPanel,
  } = useBlueprintStore();
  const { toast } = useToast();

  const handleExportPdf = () => {
    if (canvasRef.current) {
      const ok = exportToPdf(canvasRef.current, projectName, dimensions, scale, unit, modelBounds);
      toast(ok
        ? { title: 'PDF exported', description: 'Blueprint PDF downloaded.' }
        : { variant: 'destructive', title: 'Export failed', description: 'Could not generate PDF.' });
    }
  };

  const handleExportSvg = () => {
    if (canvasRef.current) {
      const ok = exportToSvg(canvasRef.current, projectName, dimensions, scale, unit, modelBounds);
      toast(ok
        ? { title: 'SVG exported', description: 'Blueprint SVG downloaded.' }
        : { variant: 'destructive', title: 'Export failed', description: 'Could not generate SVG.' });
    }
  };

  const views = [
    { id: '3d',    icon: Box,             label: '3D View' },
    { id: 'front', icon: ArrowDownSquare, label: 'Front' },
    { id: 'back',  icon: ArrowUpSquare,   label: 'Back' },
    { id: 'left',  icon: ArrowLeftSquare, label: 'Left' },
    { id: 'right', icon: ArrowRightSquare,label: 'Right' },
  ] as const;

  return (
    <div className="h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center gap-2 px-3 z-10">

      {/* ── Left panel toggle ─────────────────────────────────────────────── */}
      <Button
        variant="ghost"
        size="icon"
        className={`h-9 w-9 flex-shrink-0 ${leftPanelOpen ? 'text-foreground' : 'text-muted-foreground'}`}
        onClick={toggleLeftPanel}
        title={leftPanelOpen ? 'Hide left panel' : 'Show left panel'}
      >
        <PanelLeft className="w-4 h-4" />
      </Button>

      {/* ── View Switcher ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-background/50 p-1 rounded-lg border border-border/50 flex-1 min-w-0 overflow-x-auto">
        {views.map((v) => {
          const Icon = v.icon;
          const isActive = viewMode === v.id;
          return (
            <Button
              key={v.id}
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              className={`h-8 px-3 flex-shrink-0 ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setViewMode(v.id as any)}
              title={v.label}
            >
              <Icon className="w-4 h-4 mr-2" />
              <span className="hidden md:inline font-medium">{v.label}</span>
            </Button>
          );
        })}
      </div>

      {/* ── Action tools ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Theme toggle */}
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* Draw Dimension (ortho views only) */}
        {viewMode !== '3d' && (
          <Button
            variant={isDrawing ? 'secondary' : 'outline'}
            className={`border-dashed ${isDrawing ? 'bg-accent text-accent-foreground border-accent' : 'border-border'}`}
            onClick={toggleDrawing}
          >
            <Ruler className="w-4 h-4 mr-2" />
            {isDrawing ? 'Click to draw' : 'Draw Dimension'}
          </Button>
        )}

        {/* SVG export */}
        <Button variant="outline" onClick={handleExportSvg} title="Export SVG">
          <FileImage className="w-4 h-4 mr-2" />
          SVG
        </Button>

        {/* PDF export */}
        <Button onClick={handleExportPdf} className="bg-foreground text-background hover:bg-foreground/90 font-bold">
          <Download className="w-4 h-4 mr-2" />
          PDF
        </Button>
      </div>

      {/* ── Right panel toggle ────────────────────────────────────────────── */}
      <Button
        variant="ghost"
        size="icon"
        className={`h-9 w-9 flex-shrink-0 ${rightPanelOpen ? 'text-foreground' : 'text-muted-foreground'}`}
        onClick={toggleRightPanel}
        title={rightPanelOpen ? 'Hide right panel' : 'Show right panel'}
      >
        <PanelRight className="w-4 h-4" />
      </Button>
    </div>
  );
};
