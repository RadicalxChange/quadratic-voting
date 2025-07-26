import prisma from "../../../db/index";
import moment from "moment";

export type EventVoteRequest = {
  query: { event_id: number };
  body?: {
    voter_id: number; // voter id (TODO: AUTH)
    votes: Record<string, number>;
  };
};

export type EventVoteResponse = {
  send: (body: string) => Response;
  status: (code: number) => EventVoteResponse;
};

// --> /api/events/vote
export default async (req: EventVoteRequest, res: EventVoteResponse) => {
  const { event_id } = req.query;
  const { voter_id, votes } = req.body;

  const voter = await prisma.voter.findUnique({
    // TODO: AUTH
    where: { id: voter_id },
    include: {
      votes: true,
    },
  });

  if (!voter) {
    res.status(400).send("Invalid voter link");
  } else {
    const event = await prisma.event.findUnique({
      where: {
        id: event_id,
      },
      select: {
        id: true,
        credits_per_voter: true,
        start_event_date: true,
        end_event_date: true,
      },
    });

    const now = moment();
    if (now < moment(event.start_event_date) || now > moment(event.end_event_date)) {
      res.status(400).send("Voting is closed for this event");
    } else {
      const totalPoints = Object.values(votes).reduce((sum, points) => {
        return sum + Math.pow(points, 2);
      }, 0);

      if (totalPoints > event.credits_per_voter) {
        return res.status(400).send("Invalid points count");
      }

      for (const [event_item_id, points] of Object.entries(votes)) {
        await prisma.vote.upsert({
          where: {
            event_item_id_voter_id: {
              event_item_id: event.id,
              voter_id: voter.id,
            },
          },
          update: {
            points: votes[event_item_id] ?? 0,
          },
          create: {
            event_item_id: parseInt(event_item_id),
            voter_id,
            points,
          },
        });
      }

      res.status(200).send("Successful update");
    }
  }
};
