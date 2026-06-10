import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { logAuditEvent } from "@/services/auditLogger";
import { getActiveOrganizationId, setActiveOrganizationId } from "@/hooks/useOrganizations";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const prevUserRef = useRef<string | null>(null);

  const ensureActiveOrg = async (userId: string) => {
    try {
      if (getActiveOrganizationId()) return;

      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", userId)
        .not("organization_id", "is", null)
        .limit(1);

      const fromRoles = (roleRows ?? []).find((r: any) => r.organization_id)?.organization_id;
      if (fromRoles) {
        setActiveOrganizationId(fromRoles);
        return;
      }

      const { data: memberRows } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .limit(1);
      const fromMembers = (memberRows ?? [])[0]?.organization_id;
      if (fromMembers) {
        setActiveOrganizationId(fromMembers);
        return;
      }

      const { data: ownedRows } = await supabase
        .from("organizations")
        .select("id")
        .eq("owner_id", userId)
        .limit(1);
      const owned = (ownedRows ?? [])[0]?.id;
      if (owned) setActiveOrganizationId(owned);
    } catch (e) {
      console.error("Failed to resolve active organization", e);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        prevUserRef.current = session.user.id;
        ensureActiveOrg(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      setLoading(false);

      // Log auth events
      if (event === "SIGNED_IN" && newUser && prevUserRef.current !== newUser.id) {
        ensureActiveOrg(newUser.id);
        logAuditEvent({
          userId: newUser.id,
          action: "login",
          category: "auth",
          description: "signed in",
          metadata: { email: newUser.email },
        });
      } else if (event === "SIGNED_OUT" && prevUserRef.current) {
        logAuditEvent({
          userId: prevUserRef.current,
          action: "logout",
          category: "auth",
          description: "signed out",
        });
      }
      prevUserRef.current = newUser?.id ?? null;
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
