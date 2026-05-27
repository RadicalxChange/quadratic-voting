// Pure helpers for the per-voter XLSX export added in PR 2.
//
// Only the identified-mode path is here. The anonymous-mode workbook is
// constructed inline in pages/event.js using PR 1's exact code — keeping
// that block verbatim is the byte-identical guarantee for anonymous events,
// and refactoring it out would make that guarantee harder to verify.

// Builds the Voters sheet for an identified event.
//
// Subject columns are emitted in canonical creation order (the order in
// event_data), not the chart's sort-by-effective-votes order. Stability
// across re-downloads matters more than matching the totals-sheet column
// order, and creation order is what voters saw on the ballot.
//
// Voter rows are sorted alphabetically by name, case-insensitive for sort
// purposes, with the display case preserved exactly as the voter typed it.
// Voters without a name are filtered out — in identified mode the API
// rejects empty names, so a nameless row is a pre-allocated slot that
// hasn't been used.
//
// Each row: { "Voter name": string, "<subject title>": number, ...,
// "Credits used": number }. Credits used is Σ votes² (QV credit cost).
function buildVotersSheet(data) {
  const subjects = (data && data.event && data.event.event_data) || [];
  const voters = (data && data.event && data.event.voters) || [];

  const named = voters.filter(
    (v) => typeof v.voter_name === "string" && v.voter_name !== ""
  );

  named.sort((a, b) => {
    const al = a.voter_name.toLowerCase();
    const bl = b.voter_name.toLowerCase();
    if (al < bl) return -1;
    if (al > bl) return 1;
    return 0;
  });

  const rows = named.map((voter) => {
    const row = { "Voter name": voter.voter_name };
    const voterData = Array.isArray(voter.vote_data) ? voter.vote_data : [];
    let creditsUsed = 0;
    for (let i = 0; i < subjects.length; i++) {
      const cell =
        voterData[i] && typeof voterData[i].votes === "number"
          ? voterData[i].votes
          : 0;
      row[subjects[i].title] = cell;
      creditsUsed += cell * cell;
    }
    row["Credits used"] = creditsUsed;
    return row;
  });

  return { name: "Voters", rows };
}

// True when the identified-mode export should attach a Voters sheet. A
// non-admin viewer's response has no event.voters at all, in which case
// the export degrades cleanly to totals-only.
function shouldIncludeVotersSheet(data) {
  if (!data || !data.event) return false;
  if (data.event.privacy_mode !== "identified") return false;
  const voters = data.event.voters;
  if (!Array.isArray(voters) || voters.length === 0) return false;
  return voters.some(
    (v) => typeof v.voter_name === "string" && v.voter_name !== ""
  );
}

module.exports = {
  buildVotersSheet,
  shouldIncludeVotersSheet,
};
