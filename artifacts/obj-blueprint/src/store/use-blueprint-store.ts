import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type ViewMode = '3d' | 'front' | 'back' | 'left' | 'right';
export type Unit = 'mm' | 'cm' | 'm' | 'in' | 'ft';
export type DimAxis = 'horizontal' | 'vertical' | 'diagonal';

export interface ModelBounds {
  min: [number, number, number];
  max: [number, number, number];
}

export interface Dimension {
  id: string;
  view: ViewMode;
  p1: [number, number, number];
  p2: [number, number, number];
  customText?: string;
  axis?: DimAxis;
  chainIndex?: number;
  /** Manual additional rows away from model (positive = further, negative = closer) */
  chainOffset?: number;
}

interface BlueprintState {
  projectId: number | null;
  projectName: string;
  objData: string | null;
  modelBounds: ModelBounds | null;
  dimensions: Dimension[];
  unit: Unit;
  scale: number;

  theme: 'dark' | 'light';

  viewMode: ViewMode;
  isDrawing: boolean;
  draftPoint: [number, number, number] | null;
  selectedDimensionId: string | null;

  setProject: (data: { id: number; name: string; objData: string | null; dimensions: Dimension[]; unit: Unit; scale: number }) => void;
  resetProject: () => void;
  setObjData: (data: string) => void;
  setModelBounds: (bounds: ModelBounds | null) => void;
  setProjectName: (name: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setUnit: (unit: Unit) => void;
  setScale: (scale: number) => void;
  toggleTheme: () => void;

  toggleDrawing: () => void;
  setDraftPoint: (point: [number, number, number] | null) => void;
  addDimension: (p1: [number, number, number], p2: [number, number, number]) => void;
  updateDimension: (id: string, updates: Partial<Dimension>) => void;
  deleteDimension: (id: string) => void;
  setSelectedDimension: (id: string | null) => void;
}

// Restore theme on init (before first render)
const savedTheme = (localStorage.getItem('blueprint-theme') ?? 'dark') as 'dark' | 'light';
if (savedTheme === 'light') document.documentElement.classList.add('light');

export const useBlueprintStore = create<BlueprintState>((set) => ({
  projectId: null,
  projectName: 'Untitled Blueprint',
  objData: null,
  modelBounds: null,
  dimensions: [],
  unit: 'mm',
  scale: 1,

  theme: savedTheme,

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
    modelBounds: null,
    viewMode: '3d',
    isDrawing: false,
    draftPoint: null,
    selectedDimensionId: null,
  }),

  resetProject: () => set({
    projectId: null,
    projectName: 'Untitled Blueprint',
    objData: null,
    modelBounds: null,
    dimensions: [],
    unit: 'mm',
    scale: 1,
    viewMode: '3d',
    isDrawing: false,
    draftPoint: null,
    selectedDimensionId: null,
  }),

  setObjData: (data) => set({ objData: data }),
  setModelBounds: (bounds) => set({ modelBounds: bounds }),
  setProjectName: (name) => set({ projectName: name }),
  setViewMode: (mode) => set({ viewMode: mode, isDrawing: false, draftPoint: null }),
  setUnit: (unit) => set({ unit }),
  setScale: (scale) => set({ scale }),
  toggleTheme: () => set((state) => {
    const next = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('light', next === 'light');
    localStorage.setItem('blueprint-theme', next);
    return { theme: next };
  }),

  toggleDrawing: () => set((state) => ({
    isDrawing: !state.isDrawing,
    draftPoint: null,
    selectedDimensionId: null,
  })),

  setDraftPoint: (point) => set({ draftPoint: point }),

  addDimension: (p1, p2) => set((state) => {
    const vm = state.viewMode;

    // Determine dominant axis in view-plane coordinates
    const hDelta = (vm === 'left' || vm === 'right')
      ? Math.abs(p2[2] - p1[2])   // Z is horizontal in left/right views
      : Math.abs(p2[0] - p1[0]);  // X is horizontal in front/back views
    const vDelta = Math.abs(p2[1] - p1[1]);

    const axis: DimAxis =
      hDelta >= vDelta * 1.5 ? 'horizontal'
      : vDelta >= hDelta * 1.5 ? 'vertical'
      : 'diagonal';

    // Chain index = number of existing dims in this view with the same axis
    const chainIndex = state.dimensions.filter(
      d => d.view === vm && d.axis === axis,
    ).length;

    return {
      dimensions: [
        ...state.dimensions,
        { id: uuidv4(), view: vm, p1, p2, axis, chainIndex },
      ],
      draftPoint: null,
      // Stay in drawing mode so user can chain multiple measurements
      isDrawing: true,
    };
  }),

  updateDimension: (id, updates) => set((state) => ({
    dimensions: state.dimensions.map(d => d.id === id ? { ...d, ...updates } : d),
  })),

  deleteDimension: (id) => set((state) => ({
    dimensions: state.dimensions.filter(d => d.id !== id),
    selectedDimensionId: state.selectedDimensionId === id ? null : state.selectedDimensionId,
  })),

  setSelectedDimension: (id) => set({ selectedDimensionId: id, isDrawing: false, draftPoint: null }),
}));
