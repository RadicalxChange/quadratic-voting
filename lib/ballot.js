// Helpers for reading/writing the Events.event_data column.
//
// Historically event_data is a JSON-stringified ARRAY of subjects:
//   [{title, description, url}, ...]
// To carry event-level translations without a schema migration, it may now
// also be an OBJECT:
//   { meta: {event_title_es, event_description_es}, subjects: [...] }
// Subjects themselves may carry optional title_es / description_es fields;
// all existing consumers index subjects positionally and ignore extra
// fields, so both additions are backward compatible.
//
// Every reader of event_data must go through parseEventData so both shapes
// (and the legacy double-encoded string vs. object ambiguity) are handled
// in one place.

function parseEventData(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return { subjects: [], meta: {} };
  }
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return { subjects: [], meta: {} };
    }
  }
  if (Array.isArray(parsed)) {
    return { subjects: parsed, meta: {} };
  }
  if (parsed && typeof parsed === "object") {
    return {
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      meta:
        parsed.meta && typeof parsed.meta === "object" ? parsed.meta : {},
    };
  }
  return { subjects: [], meta: {} };
}

// Serializes back to the stored string form. Events with no meta keep the
// legacy plain-array shape so their stored bytes stay familiar to any
// external consumer.
function serializeEventData(subjects, meta) {
  const list = Array.isArray(subjects) ? subjects : [];
  const hasMeta =
    meta &&
    typeof meta === "object" &&
    Object.keys(meta).some(
      (k) => meta[k] !== undefined && meta[k] !== null && meta[k] !== ""
    );
  return JSON.stringify(hasMeta ? { meta, subjects: list } : list);
}

module.exports = {
  parseEventData,
  serializeEventData,
};
