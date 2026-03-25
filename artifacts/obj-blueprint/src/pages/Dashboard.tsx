import React, { useRef } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { RightPanel } from '@/components/layout/RightPanel';
import { BlueprintCanvas } from '@/components/blueprint/BlueprintCanvas';

export default function Dashboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Decorative blueprint background underlying everything */}
        <div className="absolute inset-0 blueprint-grid opacity-20 pointer-events-none" />
        
        <Topbar canvasRef={canvasRef} />
        
        <main className="flex-1 relative">
          <BlueprintCanvas ref={canvasRef} />
        </main>
      </div>

      {/* Right Properties Panel */}
      <RightPanel />
    </div>
  );
}
