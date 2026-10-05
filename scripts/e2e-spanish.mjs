// End-to-end tests for Spanish-language support and update-endpoint auth.
//
// Run against a local dev server (`next dev -p 2000` with a disposable
// local database — these tests create events and cast votes). The server
// runs on Node 15; run THIS script with any Node >= 18 (it uses global
// fetch):  node scripts/e2e-spanish.mjs
const BASE = process.env.QV_BASE || "http://localhost:2000";
let failures = 0;
const ok = (cond, label, extra) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${!cond && extra !== undefined ? "  -> " + JSON.stringify(extra) : ""}`);
  if (!cond) failures++;
};

const post = async (path, body) => {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, text, json };
};
const get = async (path) => {
  const r = await fetch(BASE + path);
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, text, json };
};

const EN_ITEMS = [
  "Helping key economic sectors in Colorado adapt to a changing climate",
  "Strengthening wildfire mitigation and forest health",
  "Supporting a more resilient power grid",
  "Helping households prepare their homes for heat and fire",
  "Strengthening disaster preparedness, including emergency response and recovery capacity",
  "Protecting health during heat and poor air quality",
  "Prioritizing strategies for more efficient water use across all sectors",
];
const ES_ITEMS = [
  "Ayudar a los sectores económicos clave de Colorado a adaptarse a un clima cambiante",
  "Fortalecer la mitigación de incendios forestales y la salud de los bosques",
  "Apoyar una red eléctrica más resiliente",
  "Ayudar a los hogares a preparar sus viviendas para el calor y los incendios",
  "Fortalecer la preparación ante desastres, incluida la capacidad de respuesta a emergencias y de recuperación",
  "Proteger la salud durante el calor extremo y la mala calidad del aire",
  "Priorizar estrategias para un uso más eficiente del agua en todos los sectores",
];

// ---- 1. Create bilingual public event -------------------------------------
const createBody = {
  event_title: "Colorado Climate Priorities",
  event_title_es: "Prioridades Climáticas de Colorado",
  event_description:
    "Quadratic voting gives you a budget of voice credits to spread across these priorities. Each extra vote for — or against — an item costs more than the last, so you show not just what you support, but how strongly you feel about it.",
  event_description_es:
    "El voto cuadrático le da un presupuesto de créditos de voz para repartir entre estas prioridades. Cada voto adicional a favor —o en contra— de una opción cuesta más que el anterior, así que usted muestra no solo lo que apoya, sino con cuánta fuerza lo siente.",
  num_voters: 10,
  credits_per_voter: 100,
  start_event_date: "2026-10-05T00:00:00-06:00",
  end_event_date: "2026-10-08T23:59:00-06:00",
  privacy_mode: "anonymous",
  link_mode: "public",
  subjects: EN_ITEMS.map((title, i) => ({
    title,
    title_es: ES_ITEMS[i],
    description: "",
    url: "",
  })),
};

const created = await post("/api/events/create", createBody);
ok(created.status === 200 && created.json && created.json.id, "create bilingual public event", created.text);
const eventId = created.json.id;
const secret = created.json.secret_key;
console.log(`     event=${eventId} secret=${secret}`);

// ---- 2. find endpoint returns ES fields -----------------------------------
const found = await get(`/api/events/find?event=${eventId}`);
ok(found.status === 200, "public find returns 200");
ok(found.json.event_data.event_title_es === "Prioridades Climáticas de Colorado", "find carries event_title_es", found.json.event_data);
ok(found.json.event_data.event_description_es && found.json.event_data.event_description_es.startsWith("El voto cuadrático"), "find carries event_description_es");
ok(found.json.vote_data.length === 7, "7 items on ballot");
ok(found.json.vote_data[1].title_es === ES_ITEMS[1], "item carries title_es");
ok(found.json.vote_data.every((v) => v.votes === 0), "fresh ballot zeroed");

// ---- 3. SSR renders English and Spanish static strings --------------------
const htmlEn = (await get(`/vote?event=${eventId}`)).text;
const htmlEs = (await get(`/vote?event=${eventId}&lang=es`)).text;
ok(htmlEn.includes("Please give us a moment to retrieve your voting profile."), "EN page SSR loading copy (ballot renders client-side)");
ok(!htmlEn.includes("Emita sus votos"), "EN page has no Spanish heading");
ok(htmlEs.includes("Espere un momento mientras recuperamos su perfil de votación."), "ES page SSR loading copy in Spanish");
ok(htmlEs.includes("Cargando..."), "ES page loading copy in Spanish");
// language toggle renders post-fetch; verified in browser test
const htmlSuccessEs = (await get(`/success?event=${eventId}&lang=es`)).text;
ok(htmlSuccessEs.includes("¡Su voto ha sido registrado!"), "ES success page translated");
const htmlFailEs = (await get(`/failure?event=${eventId}&lang=es&reason=${encodeURIComponent("Voting is closed for this event")}`)).text;
ok(htmlFailEs.includes("La votación está cerrada para este evento"), "ES failure page translates server reason");
const htmlFailEn = (await get(`/failure?event=${eventId}&reason=${encodeURIComponent("Voting is closed for this event")}`)).text;
ok(htmlFailEn.includes("Voting is closed for this event"), "EN failure page shows raw reason");

// ---- 4. Cast votes: one EN voter, one ES voter, same event -----------------
// EN voter: [3,2,1,0,0,0,0] -> 9+4+1 = 14 credits
const voteEn = await post("/api/events/vote", { event_id: eventId, votes: [3, 2, 1, 0, 0, 0, 0], name: "" });
ok(voteEn.status === 200, "EN voter submits", voteEn.text);
// ES voter: [0,4,0,0,-2,0,1] -> 16+4+1 = 21 credits
const voteEs = await post("/api/events/vote", { event_id: eventId, votes: [0, 4, 0, 0, -2, 0, 1], name: "" });
ok(voteEs.status === 200, "ES voter submits", voteEs.text);

// ---- 5. Combined tally -----------------------------------------------------
let details = (await get(`/api/events/details?id=${eventId}&secret_key=${secret}`)).json;
ok(details.statistics.numberVoters === 2, "ONE election: both voters in same tally", details.statistics);
ok(details.statistics.numberVotes === 35, "credit math: 14 + 21 = 35 credits used", details.statistics.numberVotes);
const qv = details.statistics.qv;
ok(JSON.stringify(qv) === JSON.stringify([3, 6, 1, 0, -2, 0, 1]), "per-item QV sums merge EN+ES votes", qv);
ok(details.event.event_meta && details.event.event_meta.event_title_es === "Prioridades Climáticas de Colorado", "details exposes event_meta");
ok(details.event.event_data.length === 7 && details.event.event_data[0].title === EN_ITEMS[0], "details event_data stays a subjects array (dashboard/export shape unchanged)");

// ---- 6. Live-add a bilingual option (the Wednesday workflow) ---------------
const badAdd = await post("/api/events/addOption", { id: eventId, secret_key: "00000000-0000-0000-0000-000000000000", title: "x" });
ok(badAdd.status === 403, "addOption rejects wrong secret", badAdd.status);
const add = await post("/api/events/addOption", {
  id: eventId,
  secret_key: secret,
  title: "Expanding community solar programs",
  title_es: "Ampliar los programas de energía solar comunitaria",
  description: "Added live during the session.",
  description_es: "Agregada en vivo durante la sesión.",
});
ok(add.status === 200 && add.json.num_options === 8, "live add appends 8th option", add.text);

// Ballot reload shows 8 items in both languages
const found8 = (await get(`/api/events/find?event=${eventId}`)).json;
ok(found8.vote_data.length === 8, "reloaded ballot has 8 items");
ok(found8.vote_data[7].title_es === "Ampliar los programas de energía solar comunitaria", "new item carries Spanish");

// A voter who loaded the ballot BEFORE the add submits 7 votes — must not corrupt
const staleVote = await post("/api/events/vote", { event_id: eventId, votes: [1, 0, 0, 0, 0, 0, 1], name: "" });
ok(staleVote.status === 200, "stale 7-item ballot still submits after live add", staleVote.text);
// New voter votes on the new item
const vote8 = await post("/api/events/vote", { event_id: eventId, votes: [0, 0, 0, 0, 0, 0, 0, 2], name: "" });
ok(vote8.status === 200, "new voter votes on live-added item", vote8.text);

details = (await get(`/api/events/details?id=${eventId}&secret_key=${secret}`)).json;
ok(details.statistics.numberVoters === 4, "4 voters in combined tally after live add", details.statistics.numberVoters);
ok(JSON.stringify(details.statistics.qv) === JSON.stringify([4, 6, 1, 0, -2, 0, 2, 2]), "tally correct across pre/post-add voters", details.statistics.qv);
ok(details.statistics.numberVotes === 35 + 2 + 4, "credit math holds after live add (35+2+4=41)", details.statistics.numberVotes);

// ---- 7. update API requires the admin secret --------------------------------
// No secret at all -> rejected.
const updNoSecret = await post("/api/events/update", {
  id: eventId,
  start_event_date: "2020-01-01T00:00:00-06:00",
  end_event_date: "2020-01-02T00:00:00-06:00",
});
ok(updNoSecret.status === 400, "update without secret is rejected (400)", updNoSecret.status);

// Wrong secret -> rejected.
const updWrongSecret = await post("/api/events/update", {
  id: eventId,
  secret_key: "00000000-0000-0000-0000-000000000000",
  start_event_date: "2020-01-01T00:00:00-06:00",
  end_event_date: "2020-01-02T00:00:00-06:00",
  event_description_es: "texto malicioso",
});
ok(updWrongSecret.status === 403, "update with wrong secret is rejected (403)", updWrongSecret.status);

// Rejected attempts must not have changed anything — the event is still
// open (dates intact) and the Spanish description is untouched.
const foundAfterReject = (await get(`/api/events/find?event=${eventId}`)).json;
ok(
  new Date(foundAfterReject.event_data.end_event_date) > new Date(),
  "rejected update left event dates unchanged (event still open)",
  foundAfterReject.event_data.end_event_date
);
ok(
  foundAfterReject.event_data.event_description_es.startsWith("El voto cuadrático"),
  "rejected update left ES description unchanged"
);

// Correct secret -> accepted, and the ES meta change lands.
const upd = await post("/api/events/update", {
  id: eventId,
  secret_key: secret,
  start_event_date: "2026-10-05T00:00:00-06:00",
  end_event_date: "2026-10-08T23:59:00-06:00",
  event_description_es: "El voto cuadrático le da un presupuesto de créditos de voz. (actualizado)",
});
ok(upd.status === 200, "update with correct secret accepts ES meta", upd.text);
const foundUpd = (await get(`/api/events/find?event=${eventId}`)).json;
ok(foundUpd.event_data.event_description_es.endsWith("(actualizado)"), "updated ES description visible");
ok(foundUpd.vote_data.length === 8, "update preserved all 8 subjects");

// ---- 8. Regression: legacy unique-link event, no Spanish fields ------------
const legacy = await post("/api/events/create", {
  event_title: "Legacy English Event",
  event_description: "No Spanish anywhere.",
  num_voters: 3,
  credits_per_voter: 25,
  start_event_date: "2026-10-05T00:00:00-06:00",
  end_event_date: "2026-10-08T23:59:00-06:00",
  privacy_mode: "anonymous",
  link_mode: "unique",
  subjects: [
    { title: "Option A", description: "", url: "" },
    { title: "Option B", description: "", url: "" },
  ],
});
ok(legacy.status === 200, "legacy unique event creates", legacy.text);
const legacyId = legacy.json.id;
const legacySecret = legacy.json.secret_key;
// stored shape stays a plain array (no meta wrapper)
const legacyDetails = (await get(`/api/events/details?id=${legacyId}&secret_key=${legacySecret}`)).json;
ok(Array.isArray(legacyDetails.event.event_data) && legacyDetails.event.event_data.length === 2, "legacy event_data stays array shape");
const legacyVoterId = legacyDetails.event.voters[0].id;
const legacyFind = (await get(`/api/events/find?id=${legacyVoterId}`)).json;
ok(legacyFind.exists === true && legacyFind.vote_data.length === 2, "unique-link voter find works");
ok(legacyFind.event_data.event_title === "Legacy English Event", "unique-link event_data intact");
const legacyVote = await post("/api/events/vote", { id: legacyVoterId, votes: [2, 1], name: "" });
ok(legacyVote.status === 200, "unique-link vote submits", legacyVote.text);
const legacyDetails2 = (await get(`/api/events/details?id=${legacyId}&secret_key=${legacySecret}`)).json;
ok(JSON.stringify(legacyDetails2.statistics.qv) === JSON.stringify([2, 1]), "unique-link tally correct", legacyDetails2.statistics.qv);
const legacyHtml = (await get(`/vote?user=${legacyVoterId}`)).text;
ok(legacyHtml.includes("Please give us a moment") && !legacyHtml.includes("Espere"), "unique-link EN page unchanged");
// addOption must refuse unique-mode
const addUnique = await post("/api/events/addOption", { id: legacyId, secret_key: legacySecret, title: "Nope" });
ok(addUnique.status === 400, "addOption refuses unique-link events", addUnique.status);
// unique-link voter in Spanish (ES fields absent -> English fallback)
const legacyEsHtml = (await get(`/vote?user=${legacyVoterId}&lang=es`)).text;
ok(legacyEsHtml.includes("Espere un momento"), "unique-link SSR loading copy in Spanish");

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
