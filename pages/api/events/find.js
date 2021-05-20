import prisma from "db"; // Import prisma

// --> /api/events/find
export default async (req, res) => {
  const {
    query: { id },
  } = req; // Collect voter ID from request body

  // If GET request passes ID param
  if (id) {
    const response = {
      exists: false,
      event_id: "",
      event_title: "",
      event_description: "",
      start_event_date: "",
      end_event_date: "",
      credits_per_voter: "",
      event_data: {},
    }; // Setup response object

    // Collect event information
    const event = await prisma.events.findUnique({
      // With ID from request body
      where: {
        id: id,
      },
      // And selecting the appropriate fields
      select: {
        event_title: true,
        event_description: true,
        start_event_date: true,
        end_event_date: true,
        credits_per_voter: true,
        event_data: true,
      },
    });

    // If event exists in database
    if (event) {
      // Toggle response object exist field
      response.exists = true;
      // Set response event_id field to value from query
      response.event_id = id;
      response.event_title = event.event_title;
      response.event_description = event.event_description;
      response.start_event_date = event.start_event_date;
      response.end_event_date = event.end_event_date;
      response.credits_per_voter = event.credits_per_voter;
      response.event_data = JSON.parse(event.event_data);
    }

    // Send edited/unedited response object
    res.send(response);
  } else {
    // Else, without ID param, return 500
    res.status(500).send("No ID Provided");
  }
};
