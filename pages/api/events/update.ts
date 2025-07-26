import prisma from "../../../db/index";
import moment from "moment";

export type EventUpdateRequest = {
  query: { id: number };
  body?: Pick<
    Parameters<typeof prisma.event.update>[0]["data"],
    "id" | "start_event_date" | "end_event_date"
  >;
};

export type EventUpdateResponse = {
  send: (body: string) => EventUpdateResponse;
  status: (code: number) => EventUpdateResponse;
};

// --> /api/events/vote
export default async (req: EventUpdateRequest, res: EventUpdateResponse) => {
  const newData = req.body; // Collect vote data from POST

  await prisma.event.update({
    where: { id: newData.id as number },
    data: {
      start_event_date: formatAsPGTimestamp(
        newData.start_event_date as string | Date,
      ),
      end_event_date: formatAsPGTimestamp(
        newData.end_event_date as string | Date,
      ),
    },
  });
  // Upon success, respond with 200
  res.status(200).send("Successful update");
};

/**
 * Converts moment date to Postgres-compatible DATETIME
 * @param {object} date Moment object
 * @returns {string} containing DATETIME
 */
function formatAsPGTimestamp(date: string | Date) {
  return moment(date).toDate();
}
