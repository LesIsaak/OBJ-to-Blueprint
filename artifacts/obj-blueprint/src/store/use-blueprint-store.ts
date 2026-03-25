import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type ViewMode = '3d' | 'front' | 'back' | 'left' | 'right';
export type Unit = 'mm' | 'cm' | 'm' | 'in' | 'ft';

export interface Dimension {
  id: string;
  view: ViewMode;
  p1: [number, number, number];
  p2: [number, number, number];
  customText?: string;
  value?: number;
}

interface BlueprintState {
  // Project Info
  projectId: number | null;
  projectName: string;
  objData: string | null;
  dimensions: Dimension[];
  unit: Unit;
  scale: number;
  
  // UI State
  viewMode: ViewMode;
  isDrawing: boolean;
  draftPoint: [number, number, number] | null;
  selectedDimensionId: string | null;
  
  // Actions
  setProject: (data: { id: number; name: string; objData: string | null; dimensions: Dimension[]; unit: Unit; scale: number }) => void;
  resetProject: () => void;
  setObjData: (data: string) => void;
  setProjectName: (name: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setUnit: (unit: Unit) => void;
  setScale: (scale: number) => void;
  
  // Dimension Actions
  toggleDrawing: () => void;
  setDraftPoint: (point: [number, number, number] | null) => void;
  addDimension: (p1: [number, number, number], p2: [number, number, number]) => void;
  updateDimension: (id: string, updates: Partial<Dimension>) => void;
  deleteDimension: (id: string) => void;
  setSelectedDimension: (id: string | null) => void;
}

export const useBlueprintStore = create<BlueprintState>((set) => ({
  projectId: null,
  projectName: 'Untitled Blueprint',
  objData: null,
  dimensions: [],
  unit: 'mm',
  scale: 1,
  
  viewMode: '3d',
  isDrawing: false,
  draftPoint: null,
  selectedDimensionId: null,
  
  setProject: (data) => set({
    projectId: data.id,
    projectName: data.name,
    objData: data.objData,
    dimensions: data.dimensions,
    unit: data.unit,
    scale: data.scale,
    viewMode: '3d',
    isDrawing: false,
    draftPoint: null,
    selectedDimensionId: null
  }),
  
  resetProject: () => set({
    projectId: null,
    projectName: 'Untitled Blueprint',
    objData: null,
    dimensions: [],
    unit: 'mm',
    scale: 1,
    viewMode: '3d',
    isDrawing: false,
    draftPoint: null,
    selectedDimensionId: null
  }),

  setObjData: (data) => set({ objData: data }),
  setProjectName: (name) => set({ projectName: name }),
  setViewMode: (mode) => set({ viewMode: mode, isDrawing: false, draftPoint: null }),
  setUnit: (unit) => set({ unit }),
  setScale: (scale) => set({ scale }),
  
  toggleDrawing: () => set((state) => ({ 
    isDrawing: !state.isDrawing, 
    draftPoint: null,
    selectedDimensionId: null 
  })),
  
  setDraftPoint: (point) => set({ draftPoint: point }),
  
  addDimension: (p1, p2) => set((state) => ({
    dimensions: [
      ...state.dimensions,
      {
        id: uuidv4(),
        view: state.viewMode,
        p1,
        p2,
      }
    ],
    draftPoint: null,
    isDrawing: false
  })),
  
  updateDimension: (id, updates) => set((state) => ({
    dimensions: state.dimensions.map(d => d.id === id ? { ...d, ...updates } : d)
  })),
  
  deleteDimension: (id) => set((state) => ({
    dimensions: state.dimensions.filter(d => d.id !== id),
    selectedDimensionId: state.selectedDimensionId === id ? null : state.selectedDimensionId
  })),
  
  setSelectedDimension: (id) => set({ selectedDimensionId: id, isDrawing: false, draftPoint: null }),
}));
