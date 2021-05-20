import prisma from "db"; // Import prisma

// --> /api/events/exists
export default async (req, res) => {
  // Collect event ID from request object
  const {
    query: { id },
  } = req;

  // Search events table
  await prisma.events
    .findMany({
      where: {
        // For entry with matching ID
        id: id,
      },
    })
    // If result is found
    .then((array) => {
      // Check to see that resulting array length > 0
      if (array.length > 0) {
        // If event is present, return 200 status
        res.status(200).send("Found event");
      } else {
        // Else, return 502
        res.status(502).send("Unable to find event");
      }
    })
    // Else return 502
    .catch(() => res.status(500).send("Unable to find event"));
};
