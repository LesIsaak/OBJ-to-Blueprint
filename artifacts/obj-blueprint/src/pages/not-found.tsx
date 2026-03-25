import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-8 text-center shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
        </div>
        
        <h1 className="text-4xl font-mono font-bold text-foreground mb-4 tracking-tighter">404</h1>
        <h2 className="text-xl font-medium text-foreground mb-4">Path Not Found</h2>
        
        <p className="text-muted-foreground mb-8">
          The structural coordinates you requested do not exist in this blueprint.
        </p>

        <Link href="/" className="inline-block">
          <Button size="lg" className="w-full font-mono uppercase tracking-wider">
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
