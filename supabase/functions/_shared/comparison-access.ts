export type ComparisonAccess = {
  targetExists: boolean;
  targetHasProfile: boolean;
  targetEligible: boolean;
  targetIsPersona: boolean;
  blocked: boolean;
  isFriend: boolean;
  targetIsPrivate: boolean;
  targetIsDiscoverable: boolean;
  hasDiscoveryRelationship: boolean;
};

export function canAccessDnaComparison(access: ComparisonAccess) {
  if (!access.targetExists || !access.targetHasProfile || !access.targetEligible || access.targetIsPersona || access.blocked) {
    return false;
  }
  if (access.isFriend) return true;
  return !access.targetIsPrivate
    && access.targetIsDiscoverable
    && access.hasDiscoveryRelationship;
}