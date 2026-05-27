import prisma from "db"; // Import prisma
import { LINK_MODES } from "lib/access";

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

    const event_data = await prisma.events.findUnique({
      where: { id: user.event_uuid },
      select: {
        event_title: true,
        event_description: true,
        start_event_date: true,
        end_event_date: true,
        credits_per_voter: true,
        privacy_mode: true,
        link_mode: true,
      },
    });

    response.event_data = event_data;
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

  const subjects =
    typeof event.event_data === "string"
      ? JSON.parse(event.event_data)
      : event.event_data;

  // Build a fresh, zeroed vote_data shape — same shape as a pre-allocated
  // voter row would have, so the ballot page renders identically.
  const fresh_vote_data = (Array.isArray(subjects) ? subjects : []).map((s) => ({
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
    },
  });
}
