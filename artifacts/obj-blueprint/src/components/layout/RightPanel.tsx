import React, { useState } from 'react';
import { useBlueprintStore } from '@/store/use-blueprint-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Edit3, X, ChevronUp, ChevronDown } from 'lucide-react';

export const RightPanel = () => {
  const {
    dimensions,
    selectedDimensionId,
    setSelectedDimension,
    updateDimension,
    deleteDimension,
    viewMode,
    scale,
    unit,
  } = useBlueprintStore();

  const selectedDim = dimensions.find(d => d.id === selectedDimensionId);
  const [editText, setEditText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleEditInit = (text: string) => {
    setEditText(text || '');
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (selectedDimensionId) {
      updateDimension(selectedDimensionId, { customText: editText });
    }
    setIsEditing(false);
  };

  const handleChainMove = (delta: number) => {
    if (!selectedDim) return;
    const current = selectedDim.chainOffset ?? 0;
    const next = current + delta;
    // Don't allow going so far negative that effectiveIndex < 0
    const chainIndex = selectedDim.chainIndex ?? 0;
    if (chainIndex + next < 0) return;
    updateDimension(selectedDim.id, { chainOffset: next });
  };

  const currentViewDims = dimensions.filter(d => d.view === viewMode || viewMode === '3d');

  // Compute display value for the selected dimension
  const getDisplayValue = (dim: typeof selectedDim) => {
    if (!dim) return '';
    if (dim.customText) return dim.customText;
    const dist = Math.sqrt(
      (dim.p2[0] - dim.p1[0]) ** 2 +
      (dim.p2[1] - dim.p1[1]) ** 2 +
      (dim.p2[2] - dim.p1[2]) ** 2,
    );
    return `${(dist * scale).toFixed(2)} ${unit}`;
  };

  return (
    <div className="w-80 h-full border-l border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="font-mono text-sm font-bold text-foreground tracking-wider uppercase">Properties</h2>
      </div>

      {selectedDim ? (
        <div className="p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary">Selected Dimension</h3>
            <Button variant="ghost" size="icon" onClick={() => setSelectedDimension(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4 bg-background/50 p-4 rounded-lg border border-border">

            {/* View & type */}
            <div className="flex gap-4">
              <div className="flex-1 grid gap-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">View</Label>
                <div className="text-sm font-mono capitalize text-foreground">{selectedDim.view}</div>
              </div>
              <div className="flex-1 grid gap-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Type</Label>
                <div className="text-sm font-mono capitalize text-foreground">{selectedDim.axis ?? 'auto'}</div>
              </div>
            </div>

            {/* Value override */}
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Measured Value</Label>
              {isEditing ? (
                <div className="flex gap-2">
                  <Input
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    placeholder="e.g. 100 mm"
                    className="font-mono text-sm h-8"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                  />
                  <Button size="sm" onClick={handleSaveEdit} className="h-8">Save</Button>
                </div>
              ) : (
                <div className="flex items-center justify-between group bg-background rounded px-3 py-1.5 border border-border/50">
                  <div className="font-mono text-sm text-foreground">{getDisplayValue(selectedDim)}</div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleEditInit(selectedDim.customText || '')}
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>
                </div>
              )}
              {selectedDim.customText && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground text-left transition-colors"
                  onClick={() => updateDimension(selectedDim.id, { customText: undefined })}
                >
                  ↩ Reset to auto-calculated
                </button>
              )}
            </div>

            {/* Chain position */}
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Chain Distance</Label>
              <p className="text-xs text-muted-foreground leading-snug">
                Move the dimension line closer to or further from the model.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9 gap-1.5 font-mono"
                  onClick={() => handleChainMove(-0.5)}
                  disabled={(selectedDim.chainIndex ?? 0) + (selectedDim.chainOffset ?? 0) <= 0}
                >
                  <ChevronDown className="w-4 h-4" />
                  Closer
                </Button>
                <div className="w-10 text-center text-sm font-mono text-muted-foreground">
                  {((selectedDim.chainIndex ?? 0) + (selectedDim.chainOffset ?? 0)).toFixed(1)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9 gap-1.5 font-mono"
                  onClick={() => handleChainMove(+0.5)}
                >
                  Further
                  <ChevronUp className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => deleteDimension(selectedDim.id)}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete Dimension
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-muted-foreground">Dimensions in current view</h3>
          </div>
          <ScrollArea className="flex-1">
            {currentViewDims.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No dimensions added yet.<br />Click 'Draw Dimension' to start.
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {currentViewDims.map(dim => {
                  const dist = Math.sqrt(
                    (dim.p2[0] - dim.p1[0]) ** 2 +
                    (dim.p2[1] - dim.p1[1]) ** 2 +
                    (dim.p2[2] - dim.p1[2]) ** 2,
                  );
                  const label = dim.customText || `${(dist * scale).toFixed(2)} ${unit}`;
                  return (
                    <button
                      key={dim.id}
                      onClick={() => setSelectedDimension(dim.id)}
                      className={`w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-sm font-mono flex items-center justify-between group border
                        ${selectedDimensionId === dim.id ? 'bg-primary/10 border-primary/30' : 'border-transparent'}`}
                    >
                      <span className="truncate flex-1">{label}</span>
                      <span className="text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded ml-2 capitalize">{dim.view}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
