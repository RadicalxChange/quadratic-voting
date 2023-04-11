import prisma from "db"; // Import the prisma client for interacting with the database
import moment from "moment"; // Import the moment library for formatting and manipulating dates

// This function handles the /api/events/vote route, which is used to submit votes for a specific event.
export default async (req, res) => {
  // Collect vote data from the POST request body
  const vote = req.body;

  // Try to find the voter with the ID specified in the request body
  const voter = await prisma.voters.findUnique({
    where: { id: vote.id },
  });

  // If the voter was found in the database
  if (voter) {
    // Get the event data for the event that the voter is participating in
    const eventData = await prisma.events.findUnique({
      where: { id: voter.event_uuid },
      select: {
        start_event_date: true,
        end_event_date: true,
      },
    });

    // Check if the current time is within the start and end dates of the event
    if (moment().isBetween(eventData.start_event_date, eventData.end_event_date)) {
      // Loop through the vote data for the voter and update the votes with the new values from the request body
      voter.vote_data.forEach((voteData, i) => {
        voteData.votes = vote.votes[i];
      });

      // Update the voter in the database with the updated vote data and (optionally) the updated voter name
      await prisma.voters.update({
        where: { id: vote.id },
        data: {
          voter_name: vote.name !== "" ? vote.name : voter.voter_name,
          vote_data: voter.vote_data,
        },
      });

      // Send a success response to the client
      res.status(200).send("Successful update");
    } else {
      // If the voting period has ended, send a response indicating that voting is closed
      res.status(400).send("Voting is closed for this event");
    }
  } else {
    // If the voter was not found in the database, send a response indicating an invalid voter link
    res.status(400).send("Invalid voter link");
  }
};
