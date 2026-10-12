import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
};

export type CurrentUser = {
  userId: string;
  profile: Profile | null;
  role: "admin" | "salesperson" | null;
  isAdmin: boolean;
};

export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: ["current-user"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id,email,full_name,is_active").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const role = roles?.some((r) => r.role === "admin")
        ? ("admin" as const)
        : roles && roles.length > 0
          ? ("salesperson" as const)
          : null;
      return {
        userId: user.id,
        profile: (profile as Profile) ?? null,
        role,
        isAdmin: role === "admin",
      };
    },
  });
}
