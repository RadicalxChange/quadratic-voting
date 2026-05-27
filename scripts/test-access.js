// Runnable unit tests for lib/access.js. No test framework — `node` only.
// Run from the project root:
//
//   node scripts/test-access.js
//
// Exits non-zero on first failure with a diff-style message.
//
// Covers the link_mode axis introduced in this PR:
//   - validator + normalizer mirror the privacy_mode shape
//   - default is 'unique' so existing events behave identically post-migration
//   - buildNewPublicVoterRow constructs an independent row per call (so
//     repeat submissions from the same client each get their own row,
//     each with the event's credit allocation implicit in the empty
//     starting state)
//   - hasAnyVoteBeenCast (reused from lib/privacy.js) covers the lock
//     in both directions — same predicate, same answer
//   - all four (privacy_mode × link_mode) combinations validate cleanly
//     and produce sensible row data

const assert = require("assert");
const path = require("path");

const access = require(path.join(__dirname, "..", "lib", "access.js"));
const privacy = require(path.join(__dirname, "..", "lib", "privacy.js"));

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// ---------------------------------------------------------------------------
// normalizeLinkMode / DEFAULT_LINK_MODE
// ---------------------------------------------------------------------------

test("default link mode is unique", () => {
  assert.strictEqual(access.DEFAULT_LINK_MODE, "unique");
});

test("missing link_mode normalizes to unique", () => {
  assert.strictEqual(access.normalizeLinkMode(undefined), "unique");
  assert.strictEqual(access.normalizeLinkMode(null), "unique");
  assert.strictEqual(access.normalizeLinkMode(""), "unique");
});

test("known link modes round-trip", () => {
  assert.strictEqual(access.normalizeLinkMode("unique"), "unique");
  assert.strictEqual(access.normalizeLinkMode("public"), "public");
});

test("unknown link mode throws (parallels privacy_mode)", () => {
  assert.throws(() => access.normalizeLinkMode("invitelink"), /Invalid link_mode/);
  assert.throws(() => access.normalizeLinkMode("Unique"), /Invalid link_mode/);
  assert.throws(() => access.normalizeLinkMode(0), /Invalid link_mode/);
});

test("isValidLinkMode rejects unknown values", () => {
  assert.strictEqual(access.isValidLinkMode("unique"), true);
  assert.strictEqual(access.isValidLinkMode("public"), true);
  assert.strictEqual(access.isValidLinkMode("invitelink"), false);
  assert.strictEqual(access.isValidLinkMode(undefined), false);
});

// ---------------------------------------------------------------------------
// Migration semantics — explicit-UPDATE pattern
// ---------------------------------------------------------------------------
//
// We can't apply the SQL here, but the migration file's intent is checkable:
// it must explicitly set existing rows to 'unique' rather than relying on
// the column default. Locating the UPDATE string in the migration file is
// a low-cost proxy that catches accidental deletion of the explicit UPDATE.

test("migration explicitly UPDATEs existing rows to 'unique'", () => {
  const fs = require("fs");
  const file = fs.readFileSync(
    path.join(__dirname, "..", "prisma", "migrations", "2026_05_27_add_link_mode.sql"),
    "utf8"
  );
  assert.ok(file.includes("ADD COLUMN link_mode"), "migration must add the column");
  assert.ok(/UPDATE\s+"public"\."Events"\s+SET\s+link_mode\s*=\s*'unique'/i.test(file),
    "migration must explicitly UPDATE existing rows to 'unique'");
});

// ---------------------------------------------------------------------------
// buildNewPublicVoterRow — fresh row per call, correct shape
// ---------------------------------------------------------------------------

function publicEventFixture() {
  return {
    eventUuid: "evt-1",
    eventSubjects: [
      { title: "Option A", description: "first", url: "" },
      { title: "Option B", description: "second", url: "" },
      { title: "Option C", description: "third", url: "" },
    ],
  };
}

test("buildNewPublicVoterRow produces a row with event_uuid + voter_name + vote_data", () => {
  const fx = publicEventFixture();
  const row = access.buildNewPublicVoterRow({
    eventUuid: fx.eventUuid,
    eventSubjects: fx.eventSubjects,
    voterName: "Alice",
    submittedVotes: [2, 0, -1],
  });
  assert.strictEqual(row.event_uuid, "evt-1");
  assert.strictEqual(row.voter_name, "Alice");
  assert.strictEqual(row.vote_data.length, 3);
});

test("buildNewPublicVoterRow preserves subject metadata + adds vote values", () => {
  const fx = publicEventFixture();
  const row = access.buildNewPublicVoterRow({
    eventUuid: fx.eventUuid,
    eventSubjects: fx.eventSubjects,
    voterName: "Alice",
    submittedVotes: [2, 0, -1],
  });
  assert.deepStrictEqual(row.vote_data, [
    { title: "Option A", description: "first", url: "", votes: 2 },
    { title: "Option B", description: "second", url: "", votes: 0 },
    { title: "Option C", description: "third", url: "", votes: -1 },
  ]);
});

test("buildNewPublicVoterRow returns independent objects per call (no shared state)", () => {
  const fx = publicEventFixture();
  const row1 = access.buildNewPublicVoterRow({
    eventUuid: fx.eventUuid,
    eventSubjects: fx.eventSubjects,
    voterName: "Alice",
    submittedVotes: [1, 0, 0],
  });
  const row2 = access.buildNewPublicVoterRow({
    eventUuid: fx.eventUuid,
    eventSubjects: fx.eventSubjects,
    voterName: "Alice",
    submittedVotes: [0, 2, 0],
  });
  // Mutating row1 must NOT affect row2.
  row1.vote_data[0].votes = 99;
  assert.strictEqual(row2.vote_data[0].votes, 0);
  // The two rows are genuinely distinct allocations.
  assert.notDeepStrictEqual(row1.vote_data, row2.vote_data);
});

test("buildNewPublicVoterRow tolerates missing/short submittedVotes (zeros default)", () => {
  const fx = publicEventFixture();
  const row = access.buildNewPublicVoterRow({
    eventUuid: fx.eventUuid,
    eventSubjects: fx.eventSubjects,
    voterName: "Alice",
    submittedVotes: [3], // only one value provided
  });
  assert.strictEqual(row.vote_data[0].votes, 3);
  assert.strictEqual(row.vote_data[1].votes, 0);
  assert.strictEqual(row.vote_data[2].votes, 0);
});

test("buildNewPublicVoterRow coerces non-string voterName to empty string", () => {
  const fx = publicEventFixture();
  const row = access.buildNewPublicVoterRow({
    eventUuid: fx.eventUuid,
    eventSubjects: fx.eventSubjects,
    voterName: undefined,
    submittedVotes: [0, 0, 0],
  });
  assert.strictEqual(row.voter_name, "");
});

// ---------------------------------------------------------------------------
// Lock-after-first-vote (reuses hasAnyVoteBeenCast from lib/privacy.js)
// ---------------------------------------------------------------------------

test("link_mode lock check: no votes → both directions allowed", () => {
  const fresh = [{ vote_data: [{ votes: 0 }, { votes: 0 }] }];
  // hasAnyVoteBeenCast returning false means update.js permits the change.
  assert.strictEqual(privacy.hasAnyVoteBeenCast(fresh), false);
});

test("link_mode lock check: any nonzero vote → locked (covers both directions)", () => {
  const voted = [
    { vote_data: [{ votes: 0 }] },
    { vote_data: [{ votes: 1 }] },
  ];
  // Same predicate gates unique→public and public→unique. The 409 message
  // differs in update.js but the lock condition is identical.
  assert.strictEqual(privacy.hasAnyVoteBeenCast(voted), true);
});

// ---------------------------------------------------------------------------
// Combination matrix: privacy_mode × link_mode at the helper level
// ---------------------------------------------------------------------------
//
// We can't exercise the API stack from a plain-node script, but we can
// validate that the helper layer accepts every (privacy, link) combination
// and produces sensible artifacts. Each combination should:
//   - normalize both fields cleanly (no throws)
//   - validate a vote submission consistent with the privacy mode
//   - build a public-voter row when applicable

const matrix = [
  { privacy: "anonymous", link: "unique" },
  { privacy: "anonymous", link: "public" },
  { privacy: "identified", link: "unique" },
  { privacy: "identified", link: "public" },
];

for (const combo of matrix) {
  test(`combo: ${combo.privacy} + ${combo.link} normalizes cleanly`, () => {
    assert.strictEqual(privacy.normalizePrivacyMode(combo.privacy), combo.privacy);
    assert.strictEqual(access.normalizeLinkMode(combo.link), combo.link);
  });

  test(`combo: ${combo.privacy} + ${combo.link} accepts a valid vote submission`, () => {
    const name = combo.privacy === "identified" ? "Alice" : "";
    const v = privacy.validateVoteSubmission({
      privacyMode: combo.privacy,
      name,
    });
    assert.strictEqual(v.error, null, `combo ${JSON.stringify(combo)} should accept; got: ${v.error}`);
  });

  test(`combo: ${combo.privacy} + ${combo.link} rejects a name-missing vote when identified`, () => {
    const v = privacy.validateVoteSubmission({
      privacyMode: combo.privacy,
      name: "",
    });
    if (combo.privacy === "identified") {
      assert.ok(v.error, "identified must require a name regardless of link mode");
    } else {
      assert.strictEqual(v.error, null);
    }
  });

  if (combo.link === "public") {
    test(`combo: ${combo.privacy} + public builds a row carrying the normalized name`, () => {
      const fx = publicEventFixture();
      const name = combo.privacy === "identified" ? "  Alice   B  " : "";
      const v = privacy.validateVoteSubmission({ privacyMode: combo.privacy, name });
      assert.strictEqual(v.error, null);
      const row = access.buildNewPublicVoterRow({
        eventUuid: fx.eventUuid,
        eventSubjects: fx.eventSubjects,
        voterName: v.name,
        submittedVotes: [1, 1, 0],
      });
      // Identified combo normalizes the name; anonymous combo keeps "".
      if (combo.privacy === "identified") {
        assert.strictEqual(row.voter_name, "Alice B");
      } else {
        assert.strictEqual(row.voter_name, "");
      }
      assert.strictEqual(row.event_uuid, fx.eventUuid);
    });
  }
}

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
