import prisma from "db"; // Import prisma
import moment from "moment"; // Time formatting
import {
  isValidPrivacyMode,
  hasAnyVoteBeenCast,
} from "lib/privacy";
import { isValidLinkMode } from "lib/access";

// --> /api/events/update
export default async (req, res) => {
  const new_data = req.body;

  const updateData = {
    start_event_date: formatAsPGTimestamp(new_data.start_event_date),
    end_event_date: formatAsPGTimestamp(new_data.end_event_date),
  };

  // Both privacy_mode and link_mode are optional and independently
  // locked after the first vote — voters can't have either contract
  // changed underneath them mid-event. We query voters at most once.
  const wantsPrivacyChange = new_data.privacy_mode !== undefined;
  const wantsLinkChange = new_data.link_mode !== undefined;

  if (wantsPrivacyChange && !isValidPrivacyMode(new_data.privacy_mode)) {
    return res.status(400).send(`Invalid privacy_mode: ${new_data.privacy_mode}`);
  }
  if (wantsLinkChange && !isValidLinkMode(new_data.link_mode)) {
    return res.status(400).send(`Invalid link_mode: ${new_data.link_mode}`);
  }

  if (wantsPrivacyChange || wantsLinkChange) {
    const voters = await prisma.voters.findMany({
      where: { event_uuid: new_data.id },
      select: { vote_data: true },
    });
    if (hasAnyVoteBeenCast(voters)) {
      if (wantsPrivacyChange) {
        return res
          .status(409)
          .send("Privacy mode is locked: at least one voter has already submitted a vote.");
      }
      return res
        .status(409)
        .send("Link mode is locked: at least one voter has already submitted a vote.");
    }
    if (wantsPrivacyChange) updateData.privacy_mode = new_data.privacy_mode;
    if (wantsLinkChange) updateData.link_mode = new_data.link_mode;
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
