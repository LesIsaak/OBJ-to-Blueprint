import React, { useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { useBlueprintStore } from '@/store/use-blueprint-store';
import { useProjectsManager } from '@/hooks/use-projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Upload, FileText, Plus, Save, Trash2, FolderOpen, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const ACCEPTED = '.obj,.gltf,.glb,.stl';

function objGroupToString(group: THREE.Object3D): string {
  const exporter = new OBJExporter();
  return exporter.parse(group);
}

export const Sidebar = () => {
  const { 
    projectName, setProjectName, 
    unit, setUnit, 
    scale, setScale,
    setObjData,
    projectId,
    resetProject
  } = useBlueprintStore();

  const { toast } = useToast();
  const { projects, handleLoad, handleSaveCurrent, deleteProject, isSaving } = useProjectsManager();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
    e.target.value = '';

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    // ── OBJ — plain text ──────────────────────────────────────────────────────
    if (ext === 'obj') {
      const reader = new FileReader();
      reader.onload = (ev) => setObjData(ev.target?.result as string);
      reader.readAsText(file);
      return;
    }

    // ── GLTF / GLB ────────────────────────────────────────────────────────────
    if (ext === 'gltf' || ext === 'glb') {
      toast({ title: 'Loading…', description: `Parsing ${file.name}` });
      const url = URL.createObjectURL(file);
      try {
        const loader = new GLTFLoader();
        const gltf = await new Promise<{ scene: THREE.Group }>((res, rej) => {
          loader.load(url, res, undefined, rej);
        });
        URL.revokeObjectURL(url);
        setObjData(objGroupToString(gltf.scene));
        toast({ title: 'Imported', description: `Loaded ${file.name} as geometry` });
      } catch (err) {
        URL.revokeObjectURL(url);
        toast({ variant: 'destructive', title: 'Import failed', description: String(err) });
      }
      return;
    }

    // ── STL ───────────────────────────────────────────────────────────────────
    if (ext === 'stl') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const loader = new STLLoader();
          const geometry = loader.parse(ev.target?.result as ArrayBuffer);
          const mesh = new THREE.Mesh(geometry);
          const group = new THREE.Group();
          group.add(mesh);
          setObjData(objGroupToString(group));
          toast({ title: 'Imported', description: `Loaded ${file.name}` });
        } catch (err) {
          toast({ variant: 'destructive', title: 'Import failed', description: String(err) });
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    toast({
      variant: 'destructive',
      title: 'Unsupported format',
      description: `"${ext}" files are not supported. Use OBJ, GLTF/GLB, or STL.`,
    });
  };

  return (
    <div className="w-72 h-full border-r border-border bg-card flex flex-col z-10 shadow-xl shadow-black/20">
      <div className="p-6 border-b border-border bg-background/50">
        <div className="flex items-center gap-3 text-primary mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <BoxIcon className="w-5 h-5" />
          </div>
          <h1 className="font-mono font-bold text-lg tracking-tight text-foreground">OBJ.PRINT</h1>
        </div>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Project Name</Label>
            <Input 
              value={projectName} 
              onChange={e => setProjectName(e.target.value)} 
              className="bg-background border-border/50 focus-visible:ring-primary/50"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveCurrent} disabled={isSaving} className="flex-1 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/20">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline" onClick={resetProject} title="New Project">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-8">
          
          {/* File Import */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Model Import</Label>
            <input 
              type="file" 
              accept={ACCEPTED}
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            <Button 
              variant="secondary" 
              className="w-full justify-start border-dashed border-2 border-border bg-transparent hover:bg-muted/50 h-12"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2 text-muted-foreground" />
              <span className="text-muted-foreground font-medium">Upload 3D file</span>
            </Button>
            <p className="text-xs text-muted-foreground flex gap-1 items-start">
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
              Supported: OBJ, GLTF, GLB, STL.
              For Cinema 4D, export to one of these formats first.
            </p>
          </div>

          <Separator className="bg-border/50" />

          {/* Settings */}
          <div className="space-y-4">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Document Settings</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Unit</Label>
                <Select value={unit} onValueChange={(v: any) => setUnit(v)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mm">mm</SelectItem>
                    <SelectItem value="cm">cm</SelectItem>
                    <SelectItem value="m">m</SelectItem>
                    <SelectItem value="in">in</SelectItem>
                    <SelectItem value="ft">ft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Scale Factor</Label>
                <Input 
                  type="number" 
                  value={scale} 
                  onChange={e => setScale(parseFloat(e.target.value) || 1)} 
                  className="bg-background font-mono"
                />
              </div>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Saved Projects */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Saved Projects</Label>
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            
            <div className="space-y-2">
              {projects?.map(p => (
                <div key={p.id} className="group flex items-center justify-between p-2 rounded-md hover:bg-muted/50 border border-transparent hover:border-border/50 transition-all cursor-pointer">
                  <div className="flex items-center gap-2 overflow-hidden flex-1" onClick={() => handleLoad(p.id)}>
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm truncate">{p.name}</span>
                  </div>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/20">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Project</DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-muted-foreground">Are you sure you want to delete "{p.name}"? This action cannot be undone.</p>
                      <DialogFooter>
                        <Button variant="destructive" onClick={() => deleteProject({ id: p.id })}>Delete</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
              {projects?.length === 0 && (
                <div className="text-xs text-muted-foreground italic text-center py-4">No saved projects</div>
              )}
            </div>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
};

function BoxIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  )
}
