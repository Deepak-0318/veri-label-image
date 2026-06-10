import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getActiveOrganizationId } from '@/hooks/useOrganizations';


export type AppRole = 'admin' | 'manager' | 'annotator' | 'qc';

export function useUserRole(userId: string | undefined) {
  const activeOrgId = getActiveOrganizationId();
  console.log("Active org ID in useUserRole:", activeOrgId);
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['user-roles', userId, activeOrgId],
    queryFn: async () => {
      if (!userId) return [];

      if (activeOrgId) {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role, organization_id')
          .eq('user_id', userId)    
          .eq('organization_id', activeOrgId) as any;

        if (error) throw error;

        return (data || []).map((r: any) => r.role as AppRole);
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role, organization_id')
        .eq('user_id', userId) as any;

      if (error) throw error;

      const rows = data || [];

      const orgRoles = rows.filter((r: any) => r.organization_id !== null);
      const final = orgRoles.length > 0
        ? orgRoles
        : rows.filter((r: any) => r.organization_id === null);

      return final.map((r: any) => r.role as AppRole);
    },
    enabled: !!userId,
  });

  const isAdmin = roles.includes('admin');
  const isManager = roles.includes('manager') || isAdmin;
  const isAnnotator = roles.includes('annotator') || isAdmin || isManager;
  const isQC = roles.includes('qc') || isAdmin || isManager;

  return { roles, isManager, isAdmin, isAnnotator, isQC, isLoading };
}