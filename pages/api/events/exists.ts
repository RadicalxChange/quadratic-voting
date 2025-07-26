import prisma from "../../../db/index";

export type EventExistsRequest = {
  query: { id: number };
  body?: Parameters<typeof prisma.event.create>[0]["data"];
};

export type EventExistsResponse = {
  send: (body: string) => Response;
  status: (code: number) => EventExistsResponse;
};

// --> /api/events/exists
export default async (req: EventExistsRequest, res: EventExistsResponse) => {
  // Collect voter ID from request object
  const {
    query: { id },
  } = req;

  // Search voters table
  await prisma.voter
    .findMany({
      where: { id },
    })
    // If result is found
    .then((array) => {
      // Check to see that resulting array length > 0
      if (array.length > 0) {
        // If voter is present, return 200 status
        res.status(200).send("Found voter");
      } else {
        // Else, return 502
        res.status(502).send("Unable to find voter");
      }
    })
    // Else return 502
    .catch(() => res.status(500).send("Unable to find voter"));
};
