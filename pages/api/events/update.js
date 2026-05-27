import prisma from "db"; // Import prisma
import moment from "moment"; // Time formatting
import {
  isValidPrivacyMode,
  hasAnyVoteBeenCast,
} from "lib/privacy";

// --> /api/events/update
export default async (req, res) => {
  const new_data = req.body;

  const updateData = {
    start_event_date: formatAsPGTimestamp(new_data.start_event_date),
    end_event_date: formatAsPGTimestamp(new_data.end_event_date),
  };

  // privacy_mode is optional on update. When present, it must be a known
  // value AND no voter may have already cast a vote — the privacy contract
  // can't change underneath voters who've already submitted under one mode.
  if (new_data.privacy_mode !== undefined) {
    if (!isValidPrivacyMode(new_data.privacy_mode)) {
      return res.status(400).send(`Invalid privacy_mode: ${new_data.privacy_mode}`);
    }
    const voters = await prisma.voters.findMany({
      where: { event_uuid: new_data.id },
      select: { vote_data: true },
    });
    if (hasAnyVoteBeenCast(voters)) {
      return res
        .status(409)
        .send("Privacy mode is locked: at least one voter has already submitted a vote.");
    }
    updateData.privacy_mode = new_data.privacy_mode;
  }

  await prisma.events.update({
    where: { id: new_data.id },
    data: updateData,
  });
  res.status(200).send("Successful update");
};

/**
 * Converts moment date to Postgres-compatible DATETIME
 * @param {object} date Moment object
 * @returns {string} containing DATETIME
 */
function formatAsPGTimestamp(date) {
  return moment(date).toDate();
}
