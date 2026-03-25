import React, { useState } from 'react';
import { useBlueprintStore } from '@/store/use-blueprint-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Edit3, X } from 'lucide-react';

export const RightPanel = () => {
  const { 
    dimensions, 
    selectedDimensionId, 
    setSelectedDimension, 
    updateDimension, 
    deleteDimension,
    viewMode
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

  const currentViewDims = dimensions.filter(d => d.view === viewMode || viewMode === '3d');

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
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">View</Label>
              <div className="text-sm font-mono capitalize">{selectedDim.view}</div>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">Value Override</Label>
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
                <div className="flex items-center justify-between group">
                  <div className="font-mono text-sm">{selectedDim.customText || 'Auto-calculated'}</div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEditInit(selectedDim.customText || '')}>
                    <Edit3 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            <Button variant="destructive" size="sm" className="w-full mt-4" onClick={() => deleteDimension(selectedDim.id)}>
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
                No dimensions added yet.<br/>Click 'Draw Dimension' to start.
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {currentViewDims.map(dim => (
                  <button
                    key={dim.id}
                    onClick={() => setSelectedDimension(dim.id)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-sm font-mono flex items-center justify-between group"
                  >
                    <span className="truncate flex-1">{dim.customText || 'Auto value'}</span>
                    <span className="text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded ml-2">{dim.view}</span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
