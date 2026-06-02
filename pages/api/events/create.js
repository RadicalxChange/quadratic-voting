// FIXME: Fix end date parsing
import prisma from "db"; // Import prisma
import moment from "moment"; // Time formatting
import { normalizePrivacyMode } from "lib/privacy";
import { normalizeLinkMode, LINK_MODES } from "lib/access";

// --> /api/events/create
export default async (req, res) => {
  // Collect event details from request body
  const event = req.body;
  const vote_data = [];

  let privacy_mode;
  let link_mode;
  try {
    privacy_mode = normalizePrivacyMode(event.privacy_mode);
    link_mode = normalizeLinkMode(event.link_mode);
  } catch (err) {
    return res.status(400).send(err.message);
  }

  // Loop through all subjects
  for (const subject of event.subjects) {
    // Assign 0 votes to each subject
    vote_data.push({
      ...subject,
      votes: 0,
    });
  }

  // Voter rows are only pre-allocated for unique-link events. Public-link
  // events skip pre-allocation entirely — each ballot submission creates
  // its own row at vote time (pages/api/events/vote.js).
  const shouldPreAllocate = link_mode === LINK_MODES.UNIQUE;
  const voters = shouldPreAllocate
    ? new Array(event.num_voters).fill({
        vote_data: vote_data, // Placeholder zeroed vote_data
      })
    : [];

  // Create new event. Build the data payload conditionally — omitting
  // the `Voters` nested-write entirely for public-link events instead of
  // sending `{ create: [] }`. Older Prisma versions handle empty nested
  // arrays inconsistently and we saw the event row come back with
  // empty/undefined fields when the nested write was an empty array,
  // which would then break the /event redirect (id=undefined).
  const data = {
    event_title: event.event_title,
    event_description: event.event_description,
    num_voters: event.num_voters,
    credits_per_voter: event.credits_per_voter,
    start_event_date: formatAsPGTimestamp(event.start_event_date),
    end_event_date: formatAsPGTimestamp(event.end_event_date),
    // Stringify voteable subject data
    event_data: JSON.stringify(event.subjects),
    privacy_mode: privacy_mode,
    link_mode: link_mode,
  };
  if (voters.length > 0) {
    data.Voters = { create: voters };
  }

  let createdEvent;
  try {
    createdEvent = await prisma.events.create({
      data,
      select: {
        id: true,
        secret_key: true,
      },
    });
  } catch (err) {
    // Surface the prisma/db error to the client instead of letting Next
    // return a generic 500 with no body. Otherwise the client just sees
    // a non-2xx, redirects nowhere, and the user is stuck.
    // eslint-disable-next-line no-console
    console.error("events/create failed:", err);
    return res
      .status(500)
      .send((err && err.message) || "Failed to create event");
  }

  if (!createdEvent || !createdEvent.id) {
    // Defense-in-depth: if prisma somehow returns without an id, fail
    // loudly rather than redirecting the client to /event?id=undefined.
    return res.status(500).send("Event was created but no id was returned");
  }

  // Send back created event
  res.send(createdEvent);
};

/**
 * Converts moment date to Postgres-compatible DATETIME
 * @param {object} date Moment object
 * @returns {string} containing DATETIME
 */
function formatAsPGTimestamp(date) {
  return moment(date).toDate();
}
