import prisma from "db"; // Import prisma
import moment from "moment"; // Time formatting

// --> /api/events/submitSurvey
export default async (req, res) => {
  const submission = req.body; // Collect survey data from POST

  // Collect voter information
  const user = await prisma.voters.findUnique({
    // With ID from request body
    where: {
      id: submission.id,
    },
  });

  // If voter exists in database
  if (user) {
    // Collect event data
    const event_data = await prisma.events.findUnique({
      // By searching for the Event ID from table of Events
      where: {
        id: user.event_uuid,
      },
      // And selecting the appropriate fields
      select: {
        start_event_date: true,
        end_event_date: true,
      },
    });
    if ((moment() > moment(event_data.start_event_date)) &&
      (moment() < moment(event_data.end_event_date))) {
      // Update voter object
      await prisma.voters.update({
        // Using individual, secret vote ID passed from request body
        where: { id: submission.id },
        // With updated survey data from request body
        data: {
          voter_name: submission.name !== "" ? submission.name : "",
          survey_data: submission.survey_data,
        },
      });
      // Upon success, respond with 200
      res.status(200).send("Successful update");
    } else {
      // If voting is closed, respond with 400
      res.status(400).send("Voting is closed for this event")
    }
  } else {
    // If user does not exist, respond with 400
    res.status(400).send("Invalid voter link")
  }
};
