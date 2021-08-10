import prisma from "db"; // Import prisma

// --> /api/events/callback
export default async (req, res) => {
  const crypto = require('crypto');
  const data = req.body;
  const auth = req.headers.authorization;

  const toBase64 = value => Buffer.from(value, "utf8").toString("base64");

  const isValidAuth = (value, secret) => {
    const givenSecret = String(value).split(' ')[1];

    if (!givenSecret || givenSecret.length !== secret.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(givenSecret, "base64"),
      Buffer.from(secret, "base64")
    );
  };

  const secret = toBase64(process.env.APP_SECRET);

  if (isValidAuth(auth, secret)) {
    const user_id = data.message.split(';')[0].substring(5);

    // Collect voter information
    const user = await prisma.voters.findUnique({
      // With user id from message
      where: {
        id: user_id,
      },
      // And selecting the hashed message representing the vote data
      select: {
        hash: true,
      },
    });

    if (user) {
      const verify = crypto.createVerify('SHA256');
      verify.write(user.hash);
      verify.end();
      const signature_verified = verify.verify(data.publicKey, data.signature, 'hex');

      const payload_hash = crypto
        .createHmac("sha256", process.env.APP_SECRET)
        .update(data.message)
        .digest("hex");
      const message_verified = user.hash === payload_hash;

      if (signature_verified && message_verified) {
        // Update voter object
        await prisma.voters.update({
          // With user id from message
          where: { id: user_id },
          // With signature and public key from payload
          data: {
            signature: signature.toString(),
            public_key: publicKey.toString(),
          },
        });
        // Upon success, respond with 200
        res.status(200).send("Successful update");
      } else {
        // If user does not exist, respond with 400
        res.status(400).send("Invalid signature")
      }
    } else {
      // If user does not exist, respond with 400
      res.status(400).send("Invalid voter id")
    }
  } else {
    // If bearer token is invalid, respond with 401
    res.status(401).send("Unauthorized")
  }
};
