import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

interface FeatureFlags {
  roomsEnabled: boolean;
  loading: boolean;
}

const FeatureFlagsContext = createContext<FeatureFlags>({
  roomsEnabled: false,
  loading: true,
});

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [roomsEnabled, setRoomsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["rooms_enabled"])
      .then(({ data }) => {
        if (data) {
          const flags = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
          setRoomsEnabled(flags["rooms_enabled"] === "true");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <FeatureFlagsContext.Provider value={{ roomsEnabled, loading }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
