import prisma from "db"; // Import prisma
import { LINK_MODES } from "lib/access";
import { parseEventData } from "lib/ballot";

// --> /api/events/find
//
// Two query shapes:
//   ?id=<voter_uuid>     unique-link voter resuming/visiting their personal
//                        ballot. Returns the voter's existing vote_data.
//   ?event=<event_uuid>  public-link visitor with no prior row. Returns a
//                        fresh zeroed vote_data built from event subjects.
//                        Rejected for unique-mode events (no anonymous
//                        browse path there).
export default async (req, res) => {
  const { id, event: eventQuery } = req.query;

  if (id) {
    return findByVoterId(id, res);
  }
  if (eventQuery) {
    return findByEventId(eventQuery, res);
  }
  return res.status(400).send("Provide either id (voter) or event (public)");
};

async function findByVoterId(id, res) {
  const response = {
    exists: false,
    event_id: "",
    voter_name: "",
    vote_data: "",
    event_data: {},
  };

  const user = await prisma.voters.findUnique({ where: { id } });

  if (user) {
    response.exists = true;
    response.event_id = user.event_uuid;
    response.voter_name = user.voter_name;
    response.vote_data = user.vote_data;

    const event = await prisma.events.findUnique({
      where: { id: user.event_uuid },
      select: {
        event_title: true,
        event_description: true,
        start_event_date: true,
        end_event_date: true,
        credits_per_voter: true,
        privacy_mode: true,
        link_mode: true,
        event_data: true,
      },
    });

    // Pre-allocated voter rows were zipped from the subjects at creation
    // time, so they predate any Spanish text (and any live-added option
    // text edits). Overlay the event's current *_es fields positionally so
    // the ballot can render translations, and surface the event-level
    // translations from the ballot meta. English fields in vote_data are
    // left untouched.
    const { subjects, meta } = parseEventData(event.event_data);
    if (Array.isArray(response.vote_data)) {
      response.vote_data = response.vote_data.map((entry, i) => {
        const subject = subjects[i];
        if (!subject) return entry;
        const merged = { ...entry };
        if (subject.title_es !== undefined) merged.title_es = subject.title_es;
        if (subject.description_es !== undefined)
          merged.description_es = subject.description_es;
        return merged;
      });
    }

    response.event_data = {
      event_title: event.event_title,
      event_description: event.event_description,
      start_event_date: event.start_event_date,
      end_event_date: event.end_event_date,
      credits_per_voter: event.credits_per_voter,
      privacy_mode: event.privacy_mode,
      link_mode: event.link_mode,
      event_title_es: meta.event_title_es,
      event_description_es: meta.event_description_es,
    };
  }

  res.send(response);
}

async function findByEventId(eventId, res) {
  const event = await prisma.events.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      event_title: true,
      event_description: true,
      start_event_date: true,
      end_event_date: true,
      credits_per_voter: true,
      privacy_mode: true,
      link_mode: true,
      event_data: true,
    },
  });

  if (!event) {
    return res.status(404).send("Event not found");
  }
  if (event.link_mode !== LINK_MODES.PUBLIC) {
    // No anonymous browse for unique-mode events. Voter needs their
    // personal link.
    return res
      .status(403)
      .send("This event requires a personal voting link. Contact the organizer.");
  }

  const { subjects, meta } = parseEventData(event.event_data);

  // Build a fresh, zeroed vote_data shape — same shape as a pre-allocated
  // voter row would have, so the ballot page renders identically. Subjects
  // carry their optional *_es fields straight through.
  const fresh_vote_data = subjects.map((s) => ({
    ...s,
    votes: 0,
  }));

  res.send({
    exists: true,
    event_id: event.id,
    voter_name: "",
    vote_data: fresh_vote_data,
    event_data: {
      event_title: event.event_title,
      event_description: event.event_description,
      start_event_date: event.start_event_date,
      end_event_date: event.end_event_date,
      credits_per_voter: event.credits_per_voter,
      privacy_mode: event.privacy_mode,
      link_mode: event.link_mode,
      event_title_es: meta.event_title_es,
      event_description_es: meta.event_description_es,
    },
  });
}
