import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivityEvent } from "@/services/activityLogger";
import { logAuditEvent } from "@/services/auditLogger";
import { getActiveOrganizationId } from "@/hooks/useOrganizations";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  data_type: string;
  annotation_type: string;
  guidelines: string | null;
  created_at: string;
  updated_at: string;
}

export function useProjects(userId: string | undefined) {
  const queryClient = useQueryClient();
  const activeOrgId = getActiveOrganizationId();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', userId, activeOrgId],
    queryFn: async () => {
      if (!userId) return [];

      const orgId = activeOrgId;
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('organization_project_mapping')
        .select(`
          project_id,
          projects!inner(*)
        `)
        .eq('org_id', orgId);

      if (error) throw error;

      // Extract projects from the joined data
      return (data || []).map(item => item.projects) as Project[];
    },
    enabled: !!userId && !!activeOrgId,
  });

  const createProject = useMutation({
    mutationFn: async ({ name, description, data_type, annotation_type, guidelines }: {
      name: string;
      description?: string;
      data_type?: string;
      annotation_type?: string;
      guidelines?: string;
    }) => {
      if (!userId) throw new Error("User not authenticated");

      const orgId = activeOrgId;
      if (!orgId) throw new Error("No organization selected");

      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          name,
          description: description || null,
          data_type: data_type || 'text',
          annotation_type: annotation_type || 'classification',
          guidelines: guidelines || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Add entry to organization_project_mapping
      const { error: mappingError } = await supabase
        .from('organization_project_mapping')
        .insert({
          org_id: orgId,
          project_id: data.id,
        });

      if (mappingError) {
        // If mapping fails, try to clean up the created project
        await supabase.from('projects').delete().eq('id', data.id);
        throw mappingError;
      }

      return data as Project;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects', userId, activeOrgId] });
      toast.success('Project created');
      if (userId) {
        logActivityEvent({
          userId,
          eventType: "project",
          entityType: "project",
          entityId: data.id,
          description: `Created project "${data.name}"`,
        });
        logAuditEvent({
          userId,
          action: "create_project",
          category: "crud",
          entityType: "project",
          entityId: data.id,
          entityName: data.name,
          description: `created project "${data.name}"`,
          newValues: { name: data.name, data_type: data.data_type, annotation_type: data.annotation_type },
        });
      }
    },
    onError: (error) => {
      toast.error(`Failed to create project: ${error.message}`);
    },
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description?: string }) => {
      const { data, error } = await supabase
        .from('projects')
        .update({
          name,
          description: description || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Project;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects', userId, activeOrgId] });
      toast.success('Project updated');
      if (userId) {
        logAuditEvent({
          userId,
          action: "update_project",
          category: "crud",
          entityType: "project",
          entityId: data.id,
          entityName: data.name,
          description: `updated project "${data.name}"`,
          newValues: { name: data.name, description: data.description },
        });
      }
    },
    onError: (error) => {
      toast.error(`Failed to update project: ${error.message}`);
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      // First remove from organization_project_mapping
      const { error: mappingError } = await supabase
        .from('organization_project_mapping')
        .delete()
        .eq('project_id', id);

      if (mappingError) throw mappingError;

      // Then delete the project
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['projects', userId, activeOrgId] });
      toast.success('Project deleted');
      if (userId) {
        logAuditEvent({
          userId,
          action: "delete_project",
          category: "crud",
          entityType: "project",
          entityId: id,
          description: `deleted a project`,
        });
      }
    },
    onError: (error) => {
      toast.error(`Failed to delete project: ${error.message}`);
    },
  });

  const cloneProject = useMutation({
    mutationFn: async (sourceId: string) => {
      if (!userId) throw new Error("User not authenticated");

      const orgId = activeOrgId;
      if (!orgId) throw new Error("No organization selected");

      // 1. Fetch the source project
      const { data: source, error: srcErr } = await supabase
        .from('projects')
        .select('*')
        .eq('id', sourceId)
        .single();
      if (srcErr || !source) throw srcErr || new Error("Project not found");

      // 2. Create cloned project
      const { data: cloned, error: cloneErr } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          name: `${source.name} (Copy)`,
          description: source.description,
          data_type: source.data_type,
          annotation_type: source.annotation_type,
          guidelines: source.guidelines,
        })
        .select()
        .single();
      if (cloneErr || !cloned) throw cloneErr || new Error("Failed to clone project");

      // 3. Add entry to organization_project_mapping for the cloned project
      const { error: mappingError } = await supabase
        .from('organization_project_mapping')
        .insert({
          org_id: orgId,
          project_id: cloned.id,
        });

      if (mappingError) {
        // If mapping fails, try to clean up the created project
        await supabase.from('projects').delete().eq('id', cloned.id);
        throw mappingError;
      }

      // 4. Clone definitions in parallel
      const newProjectId = cloned.id;

      // Clone label types and their labels
      const { data: labelTypes } = await supabase
        .from('project_label_types')
        .select('*')
        .eq('project_id', sourceId);

      if (labelTypes && labelTypes.length > 0) {
        for (const lt of labelTypes) {
          const { data: newLt } = await supabase
            .from('project_label_types')
            .insert({
              project_id: newProjectId,
              name: lt.name,
              description: lt.description,
              created_by: userId,
            })
            .select()
            .single();

          if (newLt) {
            const { data: labels } = await supabase
              .from('project_labels')
              .select('*')
              .eq('label_type_id', lt.id)
              .eq('project_id', sourceId);

            if (labels && labels.length > 0) {
              await supabase.from('project_labels').insert(
                labels.map((l) => ({
                  project_id: newProjectId,
                  label_type_id: newLt.id,
                  name: l.name,
                  color: l.color,
                  created_by: userId,
                }))
              );
            }
          }
        }
      }

      // Clone group types
      const { data: groupTypes } = await supabase
        .from('project_group_types')
        .select('*')
        .eq('project_id', sourceId);

      if (groupTypes && groupTypes.length > 0) {
        await supabase.from('project_group_types').insert(
          groupTypes.map((gt) => ({
            project_id: newProjectId,
            name: gt.name,
            created_by: userId,
          }))
        );
      }

      // Clone flags
      const { data: flags } = await supabase
        .from('project_flags')
        .select('*')
        .eq('project_id', sourceId);

      if (flags && flags.length > 0) {
        await supabase.from('project_flags').insert(
          flags.map((f) => ({
            project_id: newProjectId,
            name: f.name,
            created_by: userId,
          }))
        );
      }

      return cloned as Project;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects', userId, activeOrgId] });
      toast.success(`Project cloned as "${data.name}"`, { id: "clone-project" });
      if (userId) {
        logAuditEvent({
          userId,
          action: "clone_project",
          category: "crud",
          entityType: "project",
          entityId: data.id,
          entityName: data.name,
          description: `cloned project "${data.name}"`,
        });
      }
    },
    onError: (error) => {
      toast.error(`Failed to clone project: ${error.message}`, { id: "clone-project" });
    },
  });

  return {
    projects,
    isLoading,
    createProject,
    updateProject,
    deleteProject,
    cloneProject,
  };
}
