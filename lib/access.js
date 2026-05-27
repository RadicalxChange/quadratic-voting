// Pure, side-effect-free helpers for the event link_mode setting.
// Mirrors the shape of lib/privacy.js so the two axes stay parallel.

const LINK_MODES = Object.freeze({
  UNIQUE: "unique",
  PUBLIC: "public",
});

const DEFAULT_LINK_MODE = LINK_MODES.UNIQUE;

function isValidLinkMode(value) {
  return value === LINK_MODES.UNIQUE || value === LINK_MODES.PUBLIC;
}

// Normalizes an incoming link_mode value from a request body. Falls back
// to the default when missing/empty; throws on anything else so the API
// can reject the request rather than silently coerce. Same semantics as
// normalizePrivacyMode in lib/privacy.js.
function normalizeLinkMode(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_LINK_MODE;
  }
  if (!isValidLinkMode(value)) {
    throw new Error(`Invalid link_mode: ${value}`);
  }
  return value;
}

// Constructs the data shape suitable for prisma.voters.create({data}) when
// a public-mode submission arrives without a voter id. The new row carries
// the event's subject definitions zipped with the submitted vote values,
// in the same {title, description, url, votes, ...} shape that pre-allocated
// voter rows use (see pages/api/events/create.js for the source shape).
//
// Pure and deterministic; safe to call any number of times. Repeat
// submissions from the same client produce independent rows — the caller
// just calls this again for each submission.
//
// `eventSubjects` is the parsed event.event_data array. `submittedVotes`
// is the array of integer vote counts from the request body, indexed
// positionally against `eventSubjects`. Missing entries default to 0 so
// a short or malformed `submittedVotes` doesn't blow up the new row.
function buildNewPublicVoterRow({ eventUuid, eventSubjects, voterName, submittedVotes }) {
  const subjects = Array.isArray(eventSubjects) ? eventSubjects : [];
  const votes = Array.isArray(submittedVotes) ? submittedVotes : [];
  const vote_data = subjects.map((subject, i) => ({
    ...subject,
    votes: typeof votes[i] === "number" ? votes[i] : 0,
  }));
  return {
    event_uuid: eventUuid,
    voter_name: typeof voterName === "string" ? voterName : "",
    vote_data,
  };
}

module.exports = {
  LINK_MODES,
  DEFAULT_LINK_MODE,
  isValidLinkMode,
  normalizeLinkMode,
  buildNewPublicVoterRow,
};
