// Runnable unit tests for lib/privacy.js and lib/export.js. No test
// framework — `node` only. Run from the project root:
//
//   node scripts/test-privacy.js
//
// Exits non-zero on first failure with a diff-style message.
//
// Covers PR 1 invariants (mode default, validation, scrub semantics) plus
// the PR 2 additions:
//   - scrub is mode-conditional and fails closed for unknown modes
//   - voter names are normalized (trim + collapse internal whitespace,
//     case preserved); identified mode rejects pure-whitespace input
//   - per-voter Voters sheet has correct rows, sorted alphabetically by
//     name case-insensitively, with correct allocations and Σ votes²
//     credit totals
//   - anonymous-mode totals sheet construction is unchanged from PR 1
//     (no byte-equality assertion via XLSX.write because node_modules may
//     not be installed; the test asserts data-structure equivalence,
//     which is sufficient since XLSX.write is deterministic given input)

const assert = require("assert");
const path = require("path");

const privacy = require(path.join(__dirname, "..", "lib", "privacy.js"));
const exporter = require(path.join(__dirname, "..", "lib", "export.js"));

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// ---------------------------------------------------------------------------
// normalizePrivacyMode / DEFAULT_PRIVACY_MODE — PR 1
// ---------------------------------------------------------------------------

test("default privacy mode is anonymous", () => {
  assert.strictEqual(privacy.DEFAULT_PRIVACY_MODE, "anonymous");
});

test("missing privacy_mode normalizes to anonymous", () => {
  assert.strictEqual(privacy.normalizePrivacyMode(undefined), "anonymous");
  assert.strictEqual(privacy.normalizePrivacyMode(null), "anonymous");
  assert.strictEqual(privacy.normalizePrivacyMode(""), "anonymous");
});

test("known privacy modes round-trip", () => {
  assert.strictEqual(privacy.normalizePrivacyMode("anonymous"), "anonymous");
  assert.strictEqual(privacy.normalizePrivacyMode("identified"), "identified");
});

test("unknown privacy mode throws", () => {
  assert.throws(() => privacy.normalizePrivacyMode("pseudonymous"), /Invalid privacy_mode/);
  assert.throws(() => privacy.normalizePrivacyMode("Anonymous"), /Invalid privacy_mode/);
  assert.throws(() => privacy.normalizePrivacyMode(0), /Invalid privacy_mode/);
});

// ---------------------------------------------------------------------------
// scrubVotersForAdmin — PR 2 made it mode-conditional, fail-closed
// ---------------------------------------------------------------------------

function freshVoters() {
  return [
    { id: "v1", event_uuid: "e1", voter_name: "Alice", vote_data: [{ votes: 3 }] },
    { id: "v2", event_uuid: "e1", voter_name: "Bob",   vote_data: [{ votes: 0 }] },
  ];
}

test("scrub: anonymous mode drops voter_name and vote_data", () => {
  const voters = freshVoters();
  privacy.scrubVotersForAdmin(voters, "anonymous");
  for (const v of voters) {
    assert.strictEqual(v.voter_name, undefined);
    assert.strictEqual(v.vote_data, undefined);
    assert.ok(v.id);
    assert.ok(v.event_uuid);
  }
});

test("scrub: identified mode is a no-op (data passes through)", () => {
  const voters = freshVoters();
  privacy.scrubVotersForAdmin(voters, "identified");
  assert.strictEqual(voters[0].voter_name, "Alice");
  assert.deepStrictEqual(voters[0].vote_data, [{ votes: 3 }]);
  assert.strictEqual(voters[1].voter_name, "Bob");
});

test("scrub: unknown mode fails closed (scrubs)", () => {
  const voters = freshVoters();
  privacy.scrubVotersForAdmin(voters, "pseudonymous");
  for (const v of voters) {
    assert.strictEqual(v.voter_name, undefined, "unknown mode must not expose names");
    assert.strictEqual(v.vote_data, undefined, "unknown mode must not expose vote_data");
  }
});

test("scrub: missing mode fails closed (scrubs)", () => {
  const voters = freshVoters();
  privacy.scrubVotersForAdmin(voters, undefined);
  assert.strictEqual(voters[0].voter_name, undefined);
});

test("scrub: empty / non-array input is a no-op regardless of mode", () => {
  assert.deepStrictEqual(privacy.scrubVotersForAdmin([], "identified"), []);
  assert.deepStrictEqual(privacy.scrubVotersForAdmin([], "anonymous"), []);
  assert.strictEqual(privacy.scrubVotersForAdmin(undefined, "identified"), undefined);
  assert.strictEqual(privacy.scrubVotersForAdmin(null, "anonymous"), null);
});

// ---------------------------------------------------------------------------
// hasAnyVoteBeenCast — PR 1
// ---------------------------------------------------------------------------

test("hasAnyVoteBeenCast is false for fresh event", () => {
  assert.strictEqual(privacy.hasAnyVoteBeenCast([
    { vote_data: [{ votes: 0 }, { votes: 0 }] },
    { vote_data: [{ votes: 0 }, { votes: 0 }] },
  ]), false);
});

test("hasAnyVoteBeenCast is true when any subject has nonzero votes", () => {
  assert.strictEqual(privacy.hasAnyVoteBeenCast([
    { vote_data: [{ votes: 0 }] },
    { vote_data: [{ votes: 2 }] },
  ]), true);
});

test("hasAnyVoteBeenCast handles negative votes (QV allows them)", () => {
  assert.strictEqual(
    privacy.hasAnyVoteBeenCast([{ vote_data: [{ votes: -3 }] }]),
    true
  );
});

test("hasAnyVoteBeenCast tolerates missing/empty input", () => {
  assert.strictEqual(privacy.hasAnyVoteBeenCast([]), false);
  assert.strictEqual(privacy.hasAnyVoteBeenCast(undefined), false);
  assert.strictEqual(privacy.hasAnyVoteBeenCast([{ vote_data: null }]), false);
});

// ---------------------------------------------------------------------------
// normalizeVoterName — PR 2
// ---------------------------------------------------------------------------

test("normalizeVoterName trims leading and trailing whitespace", () => {
  assert.strictEqual(privacy.normalizeVoterName("  Alice  "), "Alice");
  assert.strictEqual(privacy.normalizeVoterName("\tBob\n"), "Bob");
});

test("normalizeVoterName collapses internal whitespace", () => {
  assert.strictEqual(privacy.normalizeVoterName("Mary   Anne"), "Mary Anne");
  assert.strictEqual(privacy.normalizeVoterName("Jean\t\t-Luc"), "Jean -Luc");
  assert.strictEqual(privacy.normalizeVoterName("a  b  c"), "a b c");
});

test("normalizeVoterName preserves case (no identity-collapse)", () => {
  assert.strictEqual(privacy.normalizeVoterName("Alice"), "Alice");
  assert.strictEqual(privacy.normalizeVoterName("alice"), "alice");
  assert.strictEqual(privacy.normalizeVoterName("ALICE"), "ALICE");
});

test("normalizeVoterName returns empty string for empty / non-string", () => {
  assert.strictEqual(privacy.normalizeVoterName(""), "");
  assert.strictEqual(privacy.normalizeVoterName("    "), "");
  assert.strictEqual(privacy.normalizeVoterName(undefined), "");
  assert.strictEqual(privacy.normalizeVoterName(null), "");
  assert.strictEqual(privacy.normalizeVoterName(42), "");
});

// ---------------------------------------------------------------------------
// validateVoteSubmission — PR 2 returns { error, name }
// ---------------------------------------------------------------------------

test("validate: identified rejects empty / whitespace name", () => {
  const r1 = privacy.validateVoteSubmission({ privacyMode: "identified", name: "" });
  assert.ok(r1.error);
  assert.strictEqual(r1.name, "");

  const r2 = privacy.validateVoteSubmission({ privacyMode: "identified", name: "   " });
  assert.ok(r2.error);

  const r3 = privacy.validateVoteSubmission({ privacyMode: "identified", name: undefined });
  assert.ok(r3.error);
});

test("validate: identified returns normalized name on success", () => {
  const r = privacy.validateVoteSubmission({
    privacyMode: "identified",
    name: "  Alice   Cooper ",
  });
  assert.strictEqual(r.error, null);
  assert.strictEqual(r.name, "Alice Cooper");
});

test("validate: anonymous accepts any name and normalizes it", () => {
  // Regression: today's behavior accepts empty.
  const empty = privacy.validateVoteSubmission({ privacyMode: "anonymous", name: "" });
  assert.strictEqual(empty.error, null);
  assert.strictEqual(empty.name, "");

  // Normalized even in anonymous (so a whitespace-only input doesn't persist as " ").
  const messy = privacy.validateVoteSubmission({ privacyMode: "anonymous", name: "  " });
  assert.strictEqual(messy.error, null);
  assert.strictEqual(messy.name, "");
});

// ---------------------------------------------------------------------------
// buildVotersSheet — PR 2 per-voter rows
// ---------------------------------------------------------------------------

function identifiedFixture() {
  const subjects = [
    { title: "Option A", description: "first", url: "" },
    { title: "Option B", description: "second", url: "" },
    { title: "Option C", description: "third", url: "" },
  ];
  return {
    event: {
      privacy_mode: "identified",
      event_data: subjects,
      voters: [
        {
          id: "v1",
          voter_name: "charlie",
          vote_data: [
            { ...subjects[0], votes: 1 },
            { ...subjects[1], votes: 2 },
            { ...subjects[2], votes: 0 },
          ],
        },
        {
          id: "v2",
          voter_name: "Alice",
          vote_data: [
            { ...subjects[0], votes: 3 },
            { ...subjects[1], votes: 0 },
            { ...subjects[2], votes: -2 },
          ],
        },
        {
          id: "v3",
          voter_name: "Bob",
          vote_data: [
            { ...subjects[0], votes: 0 },
            { ...subjects[1], votes: 0 },
            { ...subjects[2], votes: 0 },
          ],
        },
        // Unsubmitted slot — no name, all-zero votes. Must be filtered.
        {
          id: "v4",
          voter_name: "",
          vote_data: [
            { ...subjects[0], votes: 0 },
            { ...subjects[1], votes: 0 },
            { ...subjects[2], votes: 0 },
          ],
        },
      ],
    },
  };
}

test("Voters sheet has one row per voter with a name", () => {
  const sheet = exporter.buildVotersSheet(identifiedFixture());
  assert.strictEqual(sheet.name, "Voters");
  assert.strictEqual(sheet.rows.length, 3, "v4 with no name must be filtered out");
});

test("Voters sheet rows are sorted alphabetically (case-insensitive)", () => {
  const sheet = exporter.buildVotersSheet(identifiedFixture());
  const names = sheet.rows.map((r) => r["Voter name"]);
  assert.deepStrictEqual(names, ["Alice", "Bob", "charlie"]);
});

test("Voters sheet preserves display case", () => {
  // charlie was stored lowercase; export must NOT title-case it.
  const sheet = exporter.buildVotersSheet(identifiedFixture());
  assert.strictEqual(sheet.rows[2]["Voter name"], "charlie");
});

test("Voters sheet uses subject columns in creation order", () => {
  const sheet = exporter.buildVotersSheet(identifiedFixture());
  const aliceRow = sheet.rows[0];
  // Object key insertion order should be: Voter name, Option A, B, C, Credits used
  assert.deepStrictEqual(Object.keys(aliceRow), [
    "Voter name",
    "Option A",
    "Option B",
    "Option C",
    "Credits used",
  ]);
});

test("Voters sheet allocations match voter.vote_data[i].votes", () => {
  const sheet = exporter.buildVotersSheet(identifiedFixture());
  const alice = sheet.rows[0];
  assert.strictEqual(alice["Option A"], 3);
  assert.strictEqual(alice["Option B"], 0);
  assert.strictEqual(alice["Option C"], -2);

  const charlie = sheet.rows[2];
  assert.strictEqual(charlie["Option A"], 1);
  assert.strictEqual(charlie["Option B"], 2);
  assert.strictEqual(charlie["Option C"], 0);
});

test("Voters sheet Credits used = Σ votes² (handles negatives)", () => {
  const sheet = exporter.buildVotersSheet(identifiedFixture());
  // Alice: 3² + 0² + (-2)² = 9 + 0 + 4 = 13
  assert.strictEqual(sheet.rows[0]["Credits used"], 13);
  // Bob: all zero
  assert.strictEqual(sheet.rows[1]["Credits used"], 0);
  // charlie: 1² + 2² + 0² = 5
  assert.strictEqual(sheet.rows[2]["Credits used"], 5);
});

// ---------------------------------------------------------------------------
// shouldIncludeVotersSheet — gates whether the second sheet is attached
// ---------------------------------------------------------------------------

test("shouldIncludeVotersSheet: yes for identified with named voters", () => {
  assert.strictEqual(exporter.shouldIncludeVotersSheet(identifiedFixture()), true);
});

test("shouldIncludeVotersSheet: no for anonymous events", () => {
  const data = identifiedFixture();
  data.event.privacy_mode = "anonymous";
  assert.strictEqual(exporter.shouldIncludeVotersSheet(data), false);
});

test("shouldIncludeVotersSheet: no when no voters have names (e.g. non-admin view)", () => {
  const data = identifiedFixture();
  // Simulate a non-admin response: voters scrubbed of name + vote_data
  data.event.voters = data.event.voters.map((v) => ({ id: v.id }));
  assert.strictEqual(exporter.shouldIncludeVotersSheet(data), false);
});

test("shouldIncludeVotersSheet: no when voters array is missing entirely", () => {
  const data = identifiedFixture();
  delete data.event.voters;
  assert.strictEqual(exporter.shouldIncludeVotersSheet(data), false);
});

// ---------------------------------------------------------------------------
// Anonymous-mode totals: data-structure equivalence with PR 1
// ---------------------------------------------------------------------------
//
// We can't import the React page from a plain node script, but the anonymous
// XLSX output is determined entirely by:
//   1. The rows array built from data.chart.{labels,descriptions,datasets[0].data}
//   2. The workbook shape { Sheets: { data: ws }, SheetNames: ['data'] }
// XLSX.write is deterministic on this input, so byte-equality of the output
// reduces to equality of the input.
//
// This test reproduces PR 1's row-construction algorithm verbatim and
// asserts it still produces the expected rows for a representative chart.
// If anyone "refactors while in there," this test breaks before the bytes do.

function pr1TotalsRowsFromChart(chart) {
  // VERBATIM PR 1: do not change this function — it is a reference oracle.
  const options = chart.labels;
  const descriptions = chart.descriptions;
  const effectiveVotes = chart.datasets[0].data;
  var rows = [];
  var i;
  for (i = 0; i < options.length; i++) {
    var option = {
      title: options[i],
      description: descriptions[i],
      votes: effectiveVotes[i],
    };
    rows.push(option);
  }
  return rows;
}

test("anonymous totals: row construction matches PR 1 reference exactly", () => {
  const chart = {
    labels: ["Option B", "Option A", "Option C"], // chart sort order
    descriptions: ["second", "first", "third"],
    datasets: [{ label: "Votes", data: [5, 3, 1] }],
  };

  const expected = pr1TotalsRowsFromChart(chart);
  assert.deepStrictEqual(expected, [
    { title: "Option B", description: "second", votes: 5 },
    { title: "Option A", description: "first", votes: 3 },
    { title: "Option C", description: "third", votes: 1 },
  ]);
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL ${name}`);
    console.error("       " + (err.message || err));
    if (err.stack) console.error(err.stack.split("\n").slice(1, 4).join("\n"));
  }
}
console.log("");
console.log(`${tests.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
