import prisma from "db"; // Import prisma
import moment from "moment"; // Time formatting
import {
  isValidPrivacyMode,
  hasAnyVoteBeenCast,
} from "lib/privacy";
import { isValidLinkMode } from "lib/access";
import { parseEventData, serializeEventData } from "lib/ballot";

// --> /api/events/update
//
// Admin-only: every change (dates, modes, Spanish meta) requires the
// event's secret_key — the same credential as the admin dashboard URL.
// Historically this endpoint accepted unauthenticated updates; that let
// anyone with a public event id move its dates.
export default async (req, res) => {
  const new_data = req.body;

  if (!new_data || !new_data.id || !new_data.secret_key) {
    return res.status(400).send("Missing id or secret_key");
  }

  const event = await prisma.events.findUnique({
    where: { id: new_data.id },
    select: { secret_key: true, event_data: true },
  });
  if (!event) {
    return res.status(404).send("Event not found");
  }
  if (event.secret_key !== new_data.secret_key) {
    return res.status(403).send("Invalid secret key");
  }

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

  // Optional Spanish event-level text. Stored inside event_data's ballot
  // meta (no schema change), so an existing event can be made bilingual
  // after creation. Translations are presentation-only — safe to change at
  // any time, including mid-event.
  const wantsMetaChange =
    new_data.event_title_es !== undefined ||
    new_data.event_description_es !== undefined;
  if (wantsMetaChange) {
    // event_data was already fetched by the auth lookup above.
    const { subjects, meta } = parseEventData(event.event_data);
    if (new_data.event_title_es !== undefined) {
      meta.event_title_es = new_data.event_title_es;
    }
    if (new_data.event_description_es !== undefined) {
      meta.event_description_es = new_data.event_description_es;
    }
    updateData.event_data = serializeEventData(subjects, meta);
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
