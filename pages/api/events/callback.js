import prisma from "db"; // Import prisma

// --> /api/events/callback
export default async (req, res) => {
  const data = req.body;
  // TODO: check bearer token
  const headers = req.headers;

  const crypto = require('crypto');

  // TESTING ONLY - MUDAMOS CLIENT BEHAVIOR
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase: 'top secret'
    }
  });

  const sign = crypto.createSign('SHA256');
  sign.write(data.hash);
  sign.end();
  const signature = sign.sign({
    key: privateKey,
    passphrase: 'top secret',
  }, 'hex');
  // END TESTING CODE

  const user_id = data.message.split(';')[0];

  // Collect voter information
  const user = await prisma.voters.findUnique({
    // With user id from message
    where: {
      id: user_id,
    },
    // And selecting the hashed message representing the vote data
    // select: {
    //   hash: true,
    // },
  });
  const hash = data.hash; // TESTING ONLY - delete this and uncomment the above select statement

  if (user) {
    const verify = crypto.createVerify('SHA256');
    verify.write(data.hash);
    verify.end();

    const signature_verified = verify.verify(publicKey, signature, 'hex');

    const appSecret = "85f1f95aa0e94701caf1ebc7bffb96da8977071a7b92fe5410a1eb60886ebbb8";
    const payload_hash = crypto
      .createHmac("sha256", appSecret)
      .update(data.message)
      .digest("hex");
    const message_verified = hash === payload_hash;

    if (signature_verified && message_verified) {
      // Update voter object
      await prisma.voters.update({
        // With user id from message
        where: { id: user_id },
        // With signature and public key from payload
        data: {
          signature: signature.toString(),
          public_key: publicKey.toString(),
          hash: hash, // TESTING ONLY
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
};
