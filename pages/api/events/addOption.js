import prisma from "db"; // Import prisma
import { LINK_MODES } from "lib/access";
import { parseEventData, serializeEventData } from "lib/ballot";

// --> /api/events/addOption
//
// Appends one voteable option to a live event, bilingual text supported.
// Secret-key protected (same credential as the admin dashboard URL).
//
// Mid-event safety rests on two properties, both append-only:
//   1. Tallying is positional, so a NEW option must only ever be appended
//      at the END of the subjects array — existing indices (and therefore
//      every vote already cast) are untouched.
//   2. Voters who loaded the ballot before the append submit a shorter
//      votes array; buildNewPublicVoterRow zero-fills the missing tail, and
//      generateStatistics iterates each row's own length. Early voters
//      simply contribute 0 votes to the new option.
//
// Public-link events only. Unique-link events pre-allocate each voter's
// vote_data at creation time; appending to the event would desync those
// rows, so we refuse rather than corrupt.
export default async (req, res) => {
  const body = req.body || {};
  const { id, secret_key } = body;

  if (!id || !secret_key) {
    return res.status(400).send("Missing id or secret_key");
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title === "") {
    return res.status(400).send("Option title (English) is required");
  }

  const event = await prisma.events.findUnique({ where: { id } });
  if (!event) {
    return res.status(404).send("Event not found");
  }
  if (event.secret_key !== secret_key) {
    return res.status(403).send("Invalid secret key");
  }
  if (event.link_mode !== LINK_MODES.PUBLIC) {
    return res
      .status(400)
      .send(
        "Adding options mid-event is only supported for public-link events. " +
          "Per-voter-link events pre-allocate each ballot at creation time."
      );
  }

  const { subjects, meta } = parseEventData(event.event_data);

  const option = {
    title,
    description:
      typeof body.description === "string" ? body.description.trim() : "",
    url: typeof body.url === "string" ? body.url.trim() : "",
  };
  if (typeof body.title_es === "string" && body.title_es.trim() !== "") {
    option.title_es = body.title_es.trim();
  }
  if (
    typeof body.description_es === "string" &&
    body.description_es.trim() !== ""
  ) {
    option.description_es = body.description_es.trim();
  }

  subjects.push(option);

  await prisma.events.update({
    where: { id },
    data: { event_data: serializeEventData(subjects, meta) },
  });

  res.send({
    message: "Option added",
    num_options: subjects.length,
  });
};
