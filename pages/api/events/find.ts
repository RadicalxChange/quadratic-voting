import prisma from "../../../db/index";

import { EventModel, EventItemModel, VoteModel, VoterModel } from "../../../prisma/.prisma/client/models";

export type EventFindRequest = {
  query: {
    event_id: number;
    user_id: number;
    items: Array<Pick<EventItemModel, "id" | "name"> & Pick<VoteModel, "points">>;
  };
  body?: Parameters<typeof prisma.event.create>[0]["data"];
};

export type EventFindResponseData = Partial<
  EventModel & {
    voter: VoterModel;
    items: Array<EventItemModel & { points: number }>;
  }
>;

export type EventFindResponse = {
  send: (body: string | EventFindResponseData) => Response;
  status: (code: number) => EventFindResponse;
};

// --> /api/events/find
export default async (req: EventFindRequest, res: EventFindResponse) => {
  const {
    query: { event_id, user_id },
  } = req;

  if (event_id) {
    const eventItems = await prisma.$queryRaw<EventFindResponseData["items"]>`
      SELECT ei.*, v.points
      FROM event_items ei
      LEFT JOIN votes v
        ON v.event_item_id = ei.id
        AND v.voter_id = ${user_id}
      WHERE ei.event_id = ${event_id}
    `;

    // Collect voter information
    const voterEvent = await prisma.event.findUnique({
      where: { id: event_id },
      include: {
        items: {
          include: {
            votes: {
              where: { voter_id: user_id },
              select: { points: true },
            },
          },
        },
        voters_relations: {
          where: { voter_id: user_id },
          select: {
            voter: true,
          },
        },
      },
    });

    // voterEvent.items?.[0].votes[0].points;

    const voter = voterEvent?.voters_relations?.[0]?.voter;

    // If voter exists in database
    if (voterEvent) {
      res.status(200).send({
        ...voterEvent,
        voter,
        items: eventItems,
      });
    } else {
      res.status(200).send({
        id: 0,
      });
    }
  } else {
    // Else, without ID param, return 500
    res.status(500).send("No ID Provided");
  }
};
