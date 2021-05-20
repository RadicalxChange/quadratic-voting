import prisma from "db"; // Import prisma
import moment from "moment"; // Time formatting

// --> /api/events/vote
export default async (req, res) => {
  const new_data = req.body; // Collect vote data from POST

  const event = await prisma.events.findUnique({
    where: { id: new_data.id },
    select: {
      start_event_date: true,
      end_event_date: true,
      secret_key: true,
    },
  });

  // Check for administrator access based on passed secret_key
  const isAdmin =
    event.secret_key && event.secret_key === new_data.secret ? true : false;

  if (isAdmin) {
    // Update event object
    await prisma.events.update({
      where: { id: new_data.id },
      data: {
        start_event_date: formatAsPGTimestamp(new_data.start_event_date),
        end_event_date: formatAsPGTimestamp(new_data.end_event_date),
      },
    });
    // Upon success, respond with 200
    res.status(200).send("Successful update");
  } else {
    // If user is not an admin, respond with 400
    res.status(400).send("You do not have permission to perform this action");
  }

};

/**
 * Converts moment date to Postgres-compatible DATETIME
 * @param {object} date Moment object
 * @returns {string} containing DATETIME
 */
function formatAsPGTimestamp(date) {
  return moment(date).toDate();
}
