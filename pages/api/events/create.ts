// FIXME: Fix end date parsing
import prisma from "../../../db/index";
import moment from "moment";

import { EventItemCreateInput } from "../../../prisma/.prisma/client/models";

export type EventCreateRequest = {
  query: { [key: string]: string | undefined };
  body?: Parameters<typeof prisma.event.create>[0]["data"] & {
    items: EventItemCreateInput[];
  };
};

export type EventCreateResponseData = Pick<Awaited<ReturnType<typeof prisma.event.create>>, "id" | "secret_key">;

export type EventCreateResponse = {
  send: (body: EventCreateResponseData) => EventCreateResponse;
};

// --> /api/events/create
export default async (req: EventCreateRequest, res: EventCreateResponse) => {
  // Collect event details from request body
  const event = req.body;

  // Create new event
  const createdEvent = await prisma.event.create({
    data: {
      event_title: event.event_title,
      event_description: event.event_description,
      credits_per_voter: event.credits_per_voter,
      start_event_date: formatAsPGTimestamp(event.start_event_date),
      end_event_date: formatAsPGTimestamp(event.end_event_date),
      event_data: "{}", // TODO: remove?
      items: {
        create: event.items,
      },
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
function formatAsPGTimestamp(date: string | Date) {
  return moment(date).toDate();
}
