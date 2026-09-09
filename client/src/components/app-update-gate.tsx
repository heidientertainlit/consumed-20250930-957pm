import { useCallback, useEffect, useState } from "react";
import { App as CapApp, type PluginListenerHandle } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { ArrowUpCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getUpdateRequirement,
  type AppVersionConfig,
  type UpdateRequirement,
} from "@/lib/app-version";

type UpdateState = {
  requirement: Exclude<UpdateRequirement, "none">;
  latestVersion: string;
  appStoreUrl: string;
};

const DISMISSED_VERSION_KEY = "consumed-dismissed-update-version";

export function AppUpdateGate() {
  const [update, setUpdate] = useState<UpdateState | null>(null);

  const checkForUpdate = useCallback(async () => {
    if (Capacitor.getPlatform() !== "ios") return;

    try {
      const [{ version }, { data, error }] = await Promise.all([
        CapApp.getInfo(),
        supabase
          .from("app_version_config")
          .select("latest_version, minimum_supported_version, app_store_url")
          .eq("platform", "ios")
          .maybeSingle(),
      ]);

      if (error || !data) {
        console.warn("[app-update] Version configuration unavailable; continuing normally.");
        setUpdate(null);
        return;
      }

      const config = data as AppVersionConfig;
      const requirement = getUpdateRequirement(version, config);
      if (requirement === "none") {
        setUpdate(null);
        return;
      }

      if (
        requirement === "soft" &&
        localStorage.getItem(DISMISSED_VERSION_KEY) === config.latest_version
      ) {
        setUpdate(null);
        return;
      }

      setUpdate({
        requirement,
        latestVersion: config.latest_version,
        appStoreUrl: config.app_store_url,
      });
    } catch (error) {
      console.warn("[app-update] Version check failed; continuing normally.", error);
      setUpdate(null);
    }
  }, []);

  useEffect(() => {
    if (Capacitor.getPlatform() !== "ios") return;

    void checkForUpdate();
    let listener: PluginListenerHandle | undefined;
    void CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void checkForUpdate();
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      void listener?.remove();
    };
  }, [checkForUpdate]);

  if (!update) return null;

  const openAppStore = () => {
    window.location.assign(update.appStoreUrl);
  };

  if (update.requirement === "required") {
    return (
      <div className="fixed inset-0 z-[2147483647] flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-[#090812] via-[#171129] to-[#34205b] px-6 text-center">
        <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 text-purple-700">
            <ArrowUpCircle size={30} />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-gray-950">Update required</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            Please update Consumed to continue. This version is no longer supported.
          </p>
          <button
            type="button"
            onClick={openAppStore}
            className="mt-6 w-full rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg"
          >
            Update Consumed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2147483647] flex items-end justify-center bg-black/50 px-3 pb-[max(16px,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-700">
          <ArrowUpCircle size={26} />
        </div>
        <h2 className="mt-4 text-xl font-bold text-gray-950">A new version of Consumed is available.</h2>
        <p className="mt-2 text-sm text-gray-600">
          Update to version {update.latestVersion} for the latest improvements.
        </p>
        <button
          type="button"
          onClick={openAppStore}
          className="mt-5 w-full rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-3 text-sm font-bold text-white"
        >
          Update
        </button>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DISMISSED_VERSION_KEY, update.latestVersion);
            setUpdate(null);
          }}
          className="mt-2 w-full rounded-full px-5 py-3 text-sm font-semibold text-gray-500"
        >
          Not now
        </button>
      </div>
    </div>
  );
}