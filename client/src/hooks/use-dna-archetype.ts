import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export function useDnaArchetype() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['dna-archetype', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dna_profiles')
        .select('core_archetype, label')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) return null;
      return data;
    },
  });

  return {
    archetypeKey: data?.core_archetype ?? null,
    archetypeLabel: data?.label ?? null,
    isLoading,
  };
}
