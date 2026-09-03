/**
 * THE anonymity boundary for the whole product. K-Meets' entire premise is
 * that a match's identity stays hidden until both parties physically check
 * in — see build plan §08. This file is the single place that decides what
 * shape of a user's data is safe to send to their matched counterpart, so
 * every caller goes through one of these two functions instead of each
 * hand-rolling its own field list (and risking a leak).
 *
 * IMPORTANT: this must always be applied when building an API response for
 * the OTHER party in a match — never for the user's own profile (they can
 * always see all of their own fields via UsersService.getProfile).
 */

export interface UserRow {
  id: string;
  name: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  relationshipStatus: string | null;
}

export interface PreRevealProfile {
  ageRange: string | null;
  gender: string | null;
  relationshipStatus: string | null;
}

export interface RevealedProfile extends PreRevealProfile {
  id: string;
  name: string | null;
}

/** What a matched counterpart sees BEFORE both parties have checked in. No id, no name. */
export function toPreRevealProfile(user: UserRow): PreRevealProfile {
  return {
    ageRange: user.dateOfBirth ? ageRangeFor(user.dateOfBirth) : null,
    gender: user.gender,
    relationshipStatus: user.relationshipStatus,
  };
}

/** What a matched counterpart sees AFTER both check-ins are recorded. */
export function toRevealedProfile(user: UserRow): RevealedProfile {
  return {
    id: user.id,
    name: user.name,
    ...toPreRevealProfile(user),
  };
}

function ageRangeFor(dob: Date): string {
  const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  const bucketStart = Math.floor(age / 5) * 5;
  return `${bucketStart}-${bucketStart + 4}`;
}
