import React, { useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { useBlueprintStore } from '@/store/use-blueprint-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ACCEPTED = '.obj,.gltf,.glb,.stl';

function objGroupToString(group: THREE.Object3D): string {
  const exporter = new OBJExporter();
  return exporter.parse(group);
}

export const Sidebar = () => {
  const { projectName, setProjectName, unit, setUnit, scale, setScale, setObjData } = useBlueprintStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (ext === 'obj') {
      const reader = new FileReader();
      reader.onload = (ev) => setObjData(ev.target?.result as string);
      reader.readAsText(file);
      return;
    }

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
        toast({ title: 'Imported', description: `Loaded ${file.name}` });
      } catch (err) {
        URL.revokeObjectURL(url);
        toast({ variant: 'destructive', title: 'Import failed', description: String(err) });
      }
      return;
    }

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

        <div className="grid gap-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Project Name</Label>
          <Input
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            className="bg-background border-border/50 focus-visible:ring-primary/50"
          />
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
            <p className="text-xs text-muted-foreground">
              Supported: OBJ, GLTF, GLB, STL
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
  );
}
