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

  // Create new event
  const createdEvent = await prisma.events.create({
    data: {
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
      // Create voters from filled array (empty for public-link events)
      Voters: { create: voters },
    },
    select: {
      id: true,
      secret_key: true,
    },
  });

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
