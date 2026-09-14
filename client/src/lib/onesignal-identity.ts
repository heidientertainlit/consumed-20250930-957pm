import OneSignal from "onesignal-cordova-plugin";
import { getSupabaseFunctionUrl, supabase } from "./supabase";

/**
 * Identity Verification remains opt-in until the compatible native bridge,
 * server key, and OneSignal-side approval have all been reviewed. An absent
 * value is intentionally false so existing push/login behavior is unchanged.
 */
export const oneSignalIdentityVerificationRequested =
  import.meta.env.VITE_ONESIGNAL_IDENTITY_VERIFICATION === "true";

// The current released iOS headers provide token login and an expiry callback,
// but its SWIFT_NOESCAPE completion cannot safely await the asynchronous
// server fetch performed by Cordova JavaScript. The Cordova wrapper also lacks
// the newer update/invalidation methods. This stays false until a native
// bridge is built and verified against a released SDK contract.
export const oneSignalNativeIdentityBridgeAvailable = false;
export const oneSignalIdentityVerificationEnabled =
  oneSignalIdentityVerificationRequested &&
  oneSignalNativeIdentityBridgeAvailable;

type OneSignalBridge = {
  login: (externalId: string) => Promise<void> | void;
  logout: () => Promise<void> | void;
};

async function getCurrentAccessToken(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error("Authenticated session is required for OneSignal identity");
  }
  return session.access_token;
}

/**
 * Fetch a server-issued token. The endpoint derives the external ID from the
 * bearer token; this function sends no UUID, email, or selector in the body.
 */
export async function requestOneSignalIdentityJwt(): Promise<{
  jwt: string;
  expiresAt: number;
}> {
  const accessToken = await getCurrentAccessToken();
  const response = await fetch(getSupabaseFunctionUrl("onesignal-identity-jwt"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: "",
  });
  let payload: { jwt?: string; expiresAt?: number; error?: string } = {};
  try {
    payload = await response.json();
  } catch {
    throw new Error("OneSignal identity endpoint returned invalid JSON");
  }
  if (
    !response.ok ||
    typeof payload.jwt !== "string" ||
    typeof payload.expiresAt !== "number"
  ) {
    throw new Error(payload.error || "OneSignal identity token was not issued");
  }
  return { jwt: payload.jwt, expiresAt: payload.expiresAt };
}

export type OneSignalIdentityAdapter = {
  enabled: boolean;
  login: (externalId: string, stillCurrent?: () => boolean) => Promise<void>;
  logout: () => Promise<void>;
  installJwtInvalidationHandler: (
    stillCurrent?: (externalId: string) => boolean,
  ) => void;
};

export function createOneSignalIdentityAdapter(): OneSignalIdentityAdapter {
  return {
    enabled: oneSignalIdentityVerificationEnabled,

    async login(externalId, stillCurrent = () => true) {
      if (oneSignalIdentityVerificationRequested) {
        if (!stillCurrent()) return;
        const error = new Error(
          "OneSignal Identity Verification is blocked until a released native bridge is verified",
        );
        console.error(error.message);
        throw error;
      }

      const legacy = OneSignal as unknown as OneSignalBridge;
      await legacy.login(externalId);
    },

    async logout() {
      const legacy = OneSignal as unknown as OneSignalBridge;
      await legacy.logout();
    },

    installJwtInvalidationHandler(stillCurrent = () => true) {
      // The released SDK selected for this app has no invalidation/update
      // bridge. Keep this deliberately inert while Identity Verification is
      // blocked; never register an invented native selector.
      void stillCurrent;
    },
  };
}