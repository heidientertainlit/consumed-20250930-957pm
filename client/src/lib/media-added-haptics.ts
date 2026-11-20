import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

interface HapticRuntime {
  isNativePlatform(): boolean;
  isPluginAvailable(name: string): boolean;
  impact(options: { style: ImpactStyle }): Promise<void>;
}

const nativeRuntime: HapticRuntime = {
  isNativePlatform: () => Capacitor.isNativePlatform(),
  isPluginAvailable: (name) => Capacitor.isPluginAvailable(name),
  impact: (options) => Haptics.impact(options),
};

/** Older native builds and browsers keep the visual feedback without vibration. */
export async function playMediaAddedImpact(runtime: HapticRuntime = nativeRuntime) {
  if (!runtime.isNativePlatform() || !runtime.isPluginAvailable("Haptics")) return false;
  try {
    await runtime.impact({ style: ImpactStyle.Light });
    return true;
  } catch (error) {
    // A device feedback failure must never turn a successful save into an error.
    console.warn("[Media added] Native haptic feedback failed", error);
    return false;
  }
}
