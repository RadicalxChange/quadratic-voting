import prisma from "db"; // Import prisma
import moment from "moment"; // Time formatting

// --> /api/events/vote
export default async (req, res) => {
  const vote = req.body; // Collect vote data from POST

  // Look for current JSON data
  const { vote_data } = await prisma.voters.findUnique({
    // Using individual, secret vote ID passed from request body
    where: { id: vote.id },
    // And select only existing JSON data
    select: { vote_data: true },
  });

  // Collect voter information
  const user = await prisma.voters.findUnique({
    // With ID from request body
    where: {
      id: vote.id,
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
        event_data: true,
      },
    });

    const options = JSON.parse(event_data.event_data).map((option) => option.title)

    if ((moment() > moment(event_data.start_event_date)) &&
      (moment() < moment(event_data.end_event_date))) {
      // Loop through vote_data in DB
      for (let i = 0; i < vote_data.length; i++) {
        // Update with new votes from request body
        vote_data[i].votes = vote.votes[i];
      }

      const crypto = require('crypto');

      // pack vote data into a string
      var vote_data_str = "";
      for (let i = 0; i < vote_data.length; i++) {
        vote_data_str += options[i]
        vote_data_str += vote_data[i]
      }

      // pack user, vote data, and timestamp into message
      const message = vote.id + ';' + vote_data_str + ';' + formatAsPGTimestamp(moment());
      var encodedMessage = crypto
        .createHash("sha256")
        .update(message)
        .digest("hex");

      // hash message
      const signature = crypto
        .createHmac("sha256", process.env.APP_SECRET)
        .update(message)
        .digest("hex");

      // Update voter object
      await prisma.voters.update({
        // Using individual, secret vote ID passed from request body
        where: { id: vote.id },
        // With updated votes from request body + preexisting vote_data from DB
        data: {
          voter_name: vote.name !== "" ? vote.name : "",
          vote_data: vote_data,
          hash: encodedMessage,
        },
      });

      const deeplink = `https://sign.mudamos.org/signlink?message=${encodedMessage}&appid=${process.env.APP_ID}&signature=${signature}`;
      const encodedDeepLink = encodeURIComponent(deeplink);
      const url = `https://${process.env.FB_SUBDOMAIN}.app.goo.gl/?link=${encodedDeepLink}&apn=${process.env.ANDROID_PKG_NAME}&ibi=${process.env.IOS_BUNDLE_ID}&isi=${process.env.APP_STORE_ID}&efr=1`;

      // Upon success, respond with 200
      res.status(200).json({
        msg: "Successful update",
        url: url,
      });
    } else {
      // If voting is closed, respond with 400
      res.status(400).json({ msg: "Voting is closed for this event" });
    }
  } else {
    // If user does not exist, respond with 400
    res.status(400).json({ msg: "Invalid voter link" });
  }
};

/**
 * Converts moment date to Postgres-compatible DATETIME
 * @param {object} date Moment object
 * @returns {string} containing DATETIME
 */
function formatAsPGTimestamp(date) {
  return moment(date).toDate();
}
