import {
  getIdentityProvider,
  getProfileIdentityDefaults,
  hasCompleteProfileIdentity,
  hasConfirmedProfileIdentity,
  isCorrectableProfileCompletionStatus,
  USERNAME_PATTERN,
  type IdentityUserLike,
  type ProfileIdentity,
} from "./profile-identity";

export interface ResolvedProfileIdentityCore {
  complete: boolean;
  profile: ProfileIdentity | null;
  provider: ReturnType<typeof getIdentityProvider>;
  defaults: ReturnType<typeof getProfileIdentityDefaults>;
}

export class ProfileCompletionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProfileCompletionError";
  }
}

export async function resolveKnownProfileIdentity(
  user: IdentityUserLike,
  initialProfile: ProfileIdentity | null,
  completeProfile: (body: Record<string, unknown>) => Promise<ProfileIdentity>,
): Promise<ResolvedProfileIdentityCore> {
  let profile = initialProfile;
  const provider = getIdentityProvider(user);
  let defaults = getProfileIdentityDefaults(user, profile);

  if (hasConfirmedProfileIdentity(profile)) {
    return { complete: true, profile, provider, defaults };
  }

  if (
    provider === "email"
    && defaults.firstName
    && defaults.lastName
    && defaults.hasCanonicalUsername
    && hasCompleteProfileIdentity(profile)
  ) {
    try {
      profile = await completeProfile({ action: "confirm-existing" });
      defaults = getProfileIdentityDefaults(user, profile);
      return { complete: true, profile, provider, defaults };
    } catch (error) {
      if (
        !(error instanceof ProfileCompletionError)
        || !isCorrectableProfileCompletionStatus(error.status)
      ) throw error;
    }
  }

  if (
    provider === "email"
    && defaults.firstName
    && defaults.lastName
    && (defaults.hasCanonicalUsername || defaults.hasMetadataUsername)
    && USERNAME_PATTERN.test(defaults.username)
  ) {
    try {
      profile = await completeProfile({
        first_name: defaults.firstName,
        last_name: defaults.lastName,
        username: defaults.username,
      });
      defaults = getProfileIdentityDefaults(user, profile);
      return { complete: true, profile, provider, defaults };
    } catch (error) {
      if (
        !(error instanceof ProfileCompletionError)
        || !isCorrectableProfileCompletionStatus(error.status)
      ) throw error;

      if (error.status === 409 || error.status === 400) {
        defaults = {
          ...defaults,
          missingUsername: true,
        };
      }
    }
  }

  return { complete: false, profile, provider, defaults };
}