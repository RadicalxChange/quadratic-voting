// Voter-facing UI strings in English and Spanish. Pure data + lookup
// helpers, importable from pages and from scripts/test-i18n.js.
//
// Scope: the voter flow only (/vote, /success, /failure and the components
// they render). Organizer-facing pages (/create, /event dashboard) stay
// English — translating them is a separate project.
//
// Language is chosen per-request via the ?lang=es URL parameter; anything
// other than "es" (including absence) renders English, so existing links
// keep their exact current behavior.

const LANGS = Object.freeze({ EN: "en", ES: "es" });

const STRINGS = {
  en: {
    // navigation
    nav_return_prefix: "Return to",
    nav_home: "Home",
    nav_voting: "Voting",
    nav_place_votes: "Place Votes",
    nav_vote_success: "Vote Success",
    nav_vote_failure: "Vote Failure",

    // vote page
    jump_to_option: "Jump to an Option",
    place_your_votes: "Place your votes",
    credits_intro_before: "You can use up to ",
    credits_intro_credits: "credits",
    credits_intro_after: " to vote during this event.",
    available_credits: "Available Voice Credits",
    credits_remaining: "voice credits remaining",
    submit_votes: "Submit Votes",
    enter_name_to_submit: "Enter your name to submit",
    event_concluded: "This event has concluded. Click below to see the results!",
    see_dashboard: "See event dashboard",
    event_begins: "This event begins",
    event_closes: "This event closes",
    your_name: "Your name",
    name_privacy_note:
      "Your name is used only to connect your responses and is never included in publicly shared results.",
    name_required_placeholder: "Required",
    voteable_options: "Voteable Options",
    label_title: "Title",
    label_description: "Description",
    label_link: "Link",
    label_votes: "Votes",
    last_allocated_before: "You last allocated",
    last_allocated_votes: "votes",
    last_allocated_after: "to this option.",
    loading: "Loading...",
    loading_profile: "Please give us a moment to retrieve your voting profile.",
    cant_open_ballot: "Can't open this ballot",
    back_to_home: "Back to home",
    access_error_fallback:
      "This event requires a personal voting link. Contact the organizer.",

    // success page
    vote_is_in: "Your vote is in!",
    vote_placed: "You have successfully placed your votes.",
    change_votes: "Change your votes",

    // failure page
    vote_failed: "Oops! Your vote failed.",
    vote_failed_generic: "This shouldn't happen—please try again later!",
    try_again: "Try voting again",
  },
  es: {
    // navigation
    nav_return_prefix: "Volver a",
    nav_home: "Inicio",
    nav_voting: "Votación",
    nav_place_votes: "Emitir votos",
    nav_vote_success: "Voto registrado",
    nav_vote_failure: "Error al votar",

    // vote page
    jump_to_option: "Ir a una opción",
    place_your_votes: "Emita sus votos",
    credits_intro_before: "Puede usar hasta ",
    credits_intro_credits: "créditos",
    credits_intro_after: " para votar durante este evento.",
    available_credits: "Créditos de voz disponibles",
    credits_remaining: "créditos de voz restantes",
    submit_votes: "Enviar votos",
    enter_name_to_submit: "Escriba su nombre para enviar",
    event_concluded:
      "Este evento ha concluido. ¡Haga clic abajo para ver los resultados!",
    see_dashboard: "Ver el panel del evento",
    event_begins: "Este evento comienza el",
    event_closes: "Este evento cierra el",
    your_name: "Su nombre",
    name_privacy_note:
      "Su nombre se usa únicamente para vincular sus respuestas y nunca se incluye en los resultados que se comparten públicamente.",
    name_required_placeholder: "Obligatorio",
    voteable_options: "Opciones para votar",
    label_title: "Título",
    label_description: "Descripción",
    label_link: "Enlace",
    label_votes: "Votos",
    last_allocated_before: "La última vez asignó",
    last_allocated_votes: "votos",
    last_allocated_after: "a esta opción.",
    loading: "Cargando...",
    loading_profile:
      "Espere un momento mientras recuperamos su perfil de votación.",
    cant_open_ballot: "No se puede abrir esta boleta",
    back_to_home: "Volver al inicio",
    access_error_fallback:
      "Este evento requiere un enlace de votación personal. Contacte a la persona organizadora.",

    // success page
    vote_is_in: "¡Su voto ha sido registrado!",
    vote_placed: "Ha emitido sus votos con éxito.",
    change_votes: "Cambiar sus votos",

    // failure page
    vote_failed: "¡Ups! Su voto no se pudo enviar.",
    vote_failed_generic:
      "Esto no debería ocurrir. ¡Inténtelo de nuevo más tarde!",
    try_again: "Intentar votar de nuevo",
  },
};

// API error messages are produced server-side in English and round-tripped
// to the client (inline access errors, ?reason= on /failure). Map the known
// ones to Spanish client-side; unknown messages fall through untranslated
// rather than being hidden.
const SERVER_MESSAGES_ES = {
  "Voting is closed for this event": "La votación está cerrada para este evento",
  "Voter name is required for identified events":
    "Se requiere el nombre del votante para este evento",
  "Event not found": "Evento no encontrado",
  "This event requires a personal voting link. Contact the organizer.":
    "Este evento requiere un enlace de votación personal. Contacte a la persona organizadora.",
  "This event requires a personal voting link.":
    "Este evento requiere un enlace de votación personal.",
  "This voting link is in an invalid state. Please contact the organizer.":
    "Este enlace de votación está en un estado inválido. Contacte a la persona organizadora.",
  "Invalid voter link": "Enlace de votación inválido",
};

// Normalizes the lang URL param. Anything other than "es" is English, so
// existing links and typo'd params degrade to current behavior.
function getLang(query) {
  return query && query.lang === LANGS.ES ? LANGS.ES : LANGS.EN;
}

function t(lang, key) {
  const table = STRINGS[lang] || STRINGS.en;
  return table[key] !== undefined ? table[key] : STRINGS.en[key];
}

function translateServerMessage(lang, message) {
  if (lang !== LANGS.ES || typeof message !== "string") return message;
  return SERVER_MESSAGES_ES[message] || message;
}

// Picks the display title/description for a ballot option. Spanish falls
// back to English field-by-field so a half-translated option never renders
// blank.
function localizeSubject(subject, lang) {
  if (!subject) return { title: "", description: "", url: "" };
  const es = lang === LANGS.ES;
  return {
    title: (es && subject.title_es) || subject.title || "",
    description: (es && subject.description_es) || subject.description || "",
    url: subject.url || "",
  };
}

// Same fallback rule for the event-level title/description. `eventData` is
// the event_data object the find endpoint returns (title/description plus
// optional *_es fields sourced from the ballot meta).
function localizeEventText(eventData, lang) {
  if (!eventData) return { title: "", description: "" };
  const es = lang === LANGS.ES;
  return {
    title: (es && eventData.event_title_es) || eventData.event_title || "",
    description:
      (es && eventData.event_description_es) ||
      eventData.event_description ||
      "",
  };
}

// Builds the href that switches the current ballot URL to the other
// language, preserving the voter/event identity params.
function langToggleHref(basePath, query, targetLang) {
  const params = [];
  if (query.user) params.push(`user=${encodeURIComponent(query.user)}`);
  if (query.event) params.push(`event=${encodeURIComponent(query.event)}`);
  if (query.id) params.push(`id=${encodeURIComponent(query.id)}`);
  if (targetLang === LANGS.ES) params.push("lang=es");
  return `${basePath}?${params.join("&")}`;
}

module.exports = {
  LANGS,
  STRINGS,
  SERVER_MESSAGES_ES,
  getLang,
  t,
  translateServerMessage,
  localizeSubject,
  localizeEventText,
  langToggleHref,
};
