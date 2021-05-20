import prisma from "db"; // Import prisma
import moment from "moment"; // Time formatting

// --> /api/events/vote
export default async (req, res) => {
  const vote = req.body; // Collect vote data from POST

  // Collect event data
  const event_data = await prisma.events.findUnique({
    // By searching for the Event ID from table of Events
    where: {
      id: vote.id,
    },
    // And selecting the appropriate fields
    select: {
      start_event_date: true,
      end_event_date: true,
    },
  });
  if (event_data) {
    if ((moment() > moment(event_data.start_event_date)) &&
      (moment() < moment(event_data.end_event_date))) {
      // Create new voter
      const createdVoter = await prisma.voters.create({
        data: {
          voter_name: vote.name,
          vote_data: vote.votes,
          Events: {
            connect: {
              id: vote.id,
            }
          }
        },
        select: {
          id: true,
        },
      });
      // Upon success, respond with 200
      res.status(200).send("Successful update");
    } else {
      // If voting is closed, respond with 400
      res.status(400).send("Voting is closed for this event");
    }
  } else {
    // If voting is closed, respond with 400
    res.status(400).send("Invalid voting link");
  }
};
