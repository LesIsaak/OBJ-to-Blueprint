import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  useListProjects, 
  useCreateProject, 
  useGetProject, 
  useUpdateProject, 
  useDeleteProject,
  Project,
  CreateProjectRequest,
  UpdateProjectRequest
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useBlueprintStore, Dimension, Unit } from "@/store/use-blueprint-store";

// Helper to safely parse dimensions JSON
const parseDimensions = (dimString: string | null | undefined): Dimension[] => {
  if (!dimString) return [];
  try {
    return JSON.parse(dimString);
  } catch (e) {
    console.error("Failed to parse dimensions", e);
    return [];
  }
};

export function useProjectsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const store = useBlueprintStore();

  const listQuery = useListProjects();

  const loadProject = useGetProject(store.projectId || 0, {
    query: {
      enabled: false, // Only trigger manually
    }
  });

  const createMutation = useCreateProject({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Project Created", description: `Successfully created ${data.name}` });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        
        // Load it into store
        store.setProject({
          id: data.id,
          name: data.name,
          objData: data.objData || null,
          dimensions: parseDimensions(data.dimensions),
          unit: data.unit as Unit,
          scale: data.scale
        });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error", description: err.message || "Failed to create project" });
      }
    }
  });

  const updateMutation = useUpdateProject({
    mutation: {
      onSuccess: () => {
        toast({ title: "Project Saved", description: "Changes have been saved successfully." });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Save Failed", description: err.message || "Failed to save project" });
      }
    }
  });

  const deleteMutation = useDeleteProject({
    mutation: {
      onSuccess: () => {
        toast({ title: "Project Deleted" });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        if (store.projectId) {
          store.resetProject();
        }
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error", description: err.message || "Failed to delete project" });
      }
    }
  });

  const handleSaveCurrent = () => {
    const payload: UpdateProjectRequest | CreateProjectRequest = {
      name: store.projectName,
      objData: store.objData,
      dimensions: JSON.stringify(store.dimensions),
      unit: store.unit as any,
      scale: store.scale
    };

    if (store.projectId) {
      updateMutation.mutate({ id: store.projectId, data: payload as UpdateProjectRequest });
    } else {
      createMutation.mutate({ data: payload as CreateProjectRequest });
    }
  };

  const handleLoad = async (id: number) => {
    try {
      // In a real app we'd trigger the query, but we can also just fetch manually if needed.
      // Since useGetProject is a hook, we can just let it fetch or find it from the list cache.
      const projects = queryClient.getQueryData<Project[]>(["/api/projects"]);
      const project = projects?.find(p => p.id === id);
      
      if (project) {
        store.setProject({
          id: project.id,
          name: project.name,
          objData: project.objData || null,
          dimensions: parseDimensions(project.dimensions),
          unit: project.unit as Unit,
          scale: project.scale
        });
        toast({ title: "Project Loaded", description: `Loaded ${project.name}` });
      } else {
        // Fallback if not in list cache
        const res = await fetch(`/api/projects/${id}`);
        if(res.ok) {
           const p = await res.json() as Project;
           store.setProject({
            id: p.id,
            name: p.name,
            objData: p.objData || null,
            dimensions: parseDimensions(p.dimensions),
            unit: p.unit as Unit,
            scale: p.scale
          });
        }
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not load project" });
    }
  };

  return {
    projects: listQuery.data || [],
    isLoading: listQuery.isLoading,
    createProject: createMutation.mutate,
    updateProject: updateMutation.mutate,
    deleteProject: deleteMutation.mutate,
    isSaving: createMutation.isPending || updateMutation.isPending,
    handleSaveCurrent,
    handleLoad
  };
}
