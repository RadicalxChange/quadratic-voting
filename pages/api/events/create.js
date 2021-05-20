// FIXME: Fix end date parsing
import prisma from "db"; // Import prisma
import moment from "moment"; // Time formatting

// --> /api/events/create
export default async (req, res) => {
  // Collect event details from request body
  const event = req.body;
  const vote_data = [];

  // Loop through all subjects
  for (const subject of event.subjects) {
    // Assign 0 votes to each subject
    vote_data.push({
      ...subject,
      votes: 0,
    });
  }

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
      // Create voters from filled array
      Voters: [],
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
