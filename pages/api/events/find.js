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
      voter_name: "",
      vote_data: "",
      event_data: {},
      signature_exists: false,
      mudamos_url: "",
    }; // Setup response object

    // Collect voter information
    const user = await prisma.voters.findUnique({
      // With ID from request body
      where: {
        id: id,
      },
    });

    // If voter exists in database
    if (user) {
      // Toggle response object exist field
      response.exists = true;
      // Set response event_id field to value retrived from DB
      response.event_id = user.event_uuid;
      // Set respons object voter_name field to value retrieved from DB
      response.voter_name = user.voter_name;
      // Set response object vote_data field to value retrieved from DB
      response.vote_data = user.vote_data;
      // determine whether the user has signed using Mudamos
      response.signature_exists = user.signature !== '' && user.public_key != '';

      // recreate mudamos url if necessary
      if (!response.signature_exists) {
        const crypto = require('crypto');

        // pack user, vote data, and timestamp into message
        const encodedMessage = Buffer.from(user.hash, "utf8").toString("hex");

        // hash message
        const signature = crypto
          .createHmac("sha256", process.env.APP_SECRET)
          .update(user.hash)
          .digest("hex");

        const deeplink = `https://sign.mudamos.org/signlink?message=${encodedMessage}&appid=${process.env.APP_ID}&signature=${signature}`;
        const encodedDeepLink = encodeURIComponent(deeplink);
        response.mudamos_url = `https://${process.env.FB_SUBDOMAIN}.app.goo.gl/?link=${encodedDeepLink}&apn=${process.env.ANDROID_PKG_NAME}&ibi=${process.env.IOS_BUNDLE_ID}&isi=${process.env.APP_STORE_ID}&efr=1`;
      }

      // Collect misc event data
      const event_data = await prisma.events.findUnique({
        // By searching for the Event ID from table of Events
        where: {
          id: user.event_uuid,
        },
        // And selecting the appropriate fields
        select: {
          event_title: true,
          event_description: true,
          start_event_date: true,
          end_event_date: true,
          credits_per_voter: true,
        },
      });

      // Set response object field to values retrieved from DB
      response.event_data = event_data;
    }

    // Send edited/unedited response object
    res.send(response);
  } else {
    // Else, without ID param, return 500
    res.status(500).send("No ID Provided");
  }
};
