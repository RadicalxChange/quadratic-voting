// Pure, side-effect-free helpers for the event privacy_mode setting.
// Importable from API handlers and from scripts/test-privacy.js.

const PRIVACY_MODES = Object.freeze({
  ANONYMOUS: "anonymous",
  IDENTIFIED: "identified",
});

const DEFAULT_PRIVACY_MODE = PRIVACY_MODES.ANONYMOUS;

function isValidPrivacyMode(value) {
  return value === PRIVACY_MODES.ANONYMOUS || value === PRIVACY_MODES.IDENTIFIED;
}

// Normalizes an incoming privacy_mode value from a request body. Falls back
// to the default when missing/empty; throws on anything else so the API
// can reject the request rather than silently coerce.
function normalizePrivacyMode(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_PRIVACY_MODE;
  }
  if (!isValidPrivacyMode(value)) {
    throw new Error(`Invalid privacy_mode: ${value}`);
  }
  return value;
}

// In-place scrub of voter identity from an admin-bound payload.
//
// Mode-conditional as of PR 2:
//   - 'identified' is the ONLY mode that exposes voter_name + vote_data.
//   - 'anonymous' scrubs (byte-identical to PR 1's unconditional behavior).
//   - Any unrecognized mode value also scrubs. Fail-closed: a future mode
//     value (e.g. 'pseudonymous' from a later PR) MUST opt in to exposure
//     explicitly here, never inherit it by being unrecognized.
function scrubVotersForAdmin(voters, privacyMode) {
  if (!Array.isArray(voters)) return voters;
  if (privacyMode === PRIVACY_MODES.IDENTIFIED) return voters;
  for (const voter of voters) {
    delete voter.voter_name;
    delete voter.vote_data;
  }
  return voters;
}

// Mirrors the "voter has actually voted" check used in details.js's
// generateStatistics: a voter has voted iff any subject's votes are nonzero.
// Squared because that's the credits-spent metric the rest of the code uses;
// the math reduces to the same predicate either way.
function hasVoterVoted(voter) {
  const data = voter && voter.vote_data;
  if (!Array.isArray(data)) return false;
  for (const subject of data) {
    if (subject && subject.votes && subject.votes !== 0) return true;
  }
  return false;
}

function hasAnyVoteBeenCast(voters) {
  if (!Array.isArray(voters)) return false;
  return voters.some(hasVoterVoted);
}

// Normalizes a submitted voter name for persistence.
//
//   - Trim leading + trailing whitespace.
//   - Collapse internal runs of whitespace to a single space.
//   - NOT case-collapsed. "Alice" and "alice" persist as distinct rows
//     because voters chose how to type their own name, and the platform
//     is not an identity service. We don't have any signal to decide
//     whether "Alice" and "alice" are the same person, so we don't
//     pretend to.
//
// Returns "" for non-string input so the caller can treat that the same
// as an empty submission.
function normalizeVoterName(name) {
  if (typeof name !== "string") return "";
  return name.trim().replace(/\s+/g, " ");
}

// Validates a vote submission against the event's privacy_mode. Returns
// { error: string | null, name: string } — the normalized name on success,
// the raw input echoed back on failure (callers shouldn't persist it).
// Anonymous mode preserves today's behavior (empty name accepted, also
// normalized so an all-whitespace input doesn't persist as " "); identified
// mode requires the normalized form to be non-empty.
function validateVoteSubmission({ privacyMode, name }) {
  const mode = normalizePrivacyMode(privacyMode);
  const normalized = normalizeVoterName(name);
  if (mode === PRIVACY_MODES.IDENTIFIED && normalized === "") {
    return { error: "Voter name is required for identified events", name: normalized };
  }
  return { error: null, name: normalized };
}

module.exports = {
  PRIVACY_MODES,
  DEFAULT_PRIVACY_MODE,
  isValidPrivacyMode,
  normalizePrivacyMode,
  scrubVotersForAdmin,
  hasVoterVoted,
  hasAnyVoteBeenCast,
  normalizeVoterName,
  validateVoteSubmission,
};
