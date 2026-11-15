// Local query boundary for this fixture only. The sandbox uses React 19 while
// the application's TanStack installation resolves React 18 from the root.
import { useEffect, useRef, useState, type ReactNode } from "react";

const cache = new Map<string, unknown>();
const listeners = new Set<() => void>();
const client = {
  invalidateQueries: async () => {
    cache.clear();
    listeners.forEach(listener => listener());
  },
};

export class QueryClient {
  constructor(_options?: unknown) {}
}

export function QueryClientProvider({ children }: { children: ReactNode; client: QueryClient }) {
  return <>{children}</>;
}

export function useQueryClient() {
  return client;
}

export function useQuery({ queryKey, queryFn, enabled = true }: {
  queryKey: unknown[];
  queryFn: () => Promise<any>;
  enabled?: boolean;
}) {
  const key = JSON.stringify(queryKey);
  const fn = useRef(queryFn);
  fn.current = queryFn;
  const [data, setData] = useState<any>(() => cache.get(key));
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    listeners.add(refresh);
    return () => { listeners.delete(refresh); };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fn.current().then(value => {
      if (!active) return;
      cache.set(key, value);
      setData(value);
    });
    return () => { active = false; };
  }, [key, enabled, revision]);
  return { data };
}

export function useMutation({ mutationFn, onSuccess, onError }: {
  mutationFn: (value: any) => Promise<any>;
  onSuccess?: (result: any) => void;
  onError?: (error: unknown) => void;
}) {
  const [isPending, setPending] = useState(false);
  const mutate = async (value: any) => {
    setPending(true);
    try {
      const result = await mutationFn(value);
      onSuccess?.(result);
    } catch (error) {
      onError?.(error);
    } finally {
      setPending(false);
    }
  };
  return { mutate, isPending };
}
