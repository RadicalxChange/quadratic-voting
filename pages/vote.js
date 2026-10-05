import axios from "axios"; // Axios for requests
import moment from "moment"; // Moment date parsing
import "moment/locale/es"; // Spanish date strings (registers the locale)
import Link from "next/link"; // Dynamic links
import Loader from "components/loader"; // Placeholder loader
import Layout from "components/layout"; // Layout wrapper
import { useRouter } from "next/router"; // Router for URL params
import { useState, useEffect } from "react"; // State management
import Navigation from "components/navigation"; // Navigation component
import RemainingCredits from "components/credits";
import ProposalBlocks from "components/proposalBlocks";
import {
  getLang,
  t,
  translateServerMessage,
  localizeSubject,
  localizeEventText,
  langToggleHref,
} from "lib/i18n";

// Importing a moment locale makes it the global default; pin the default
// back to English so every page that doesn't opt into Spanish is untouched.
moment.locale("en");

function Vote({ query }) {
  const router = useRouter(); // Hook into router
  const [data, setData] = useState(null); // Data retrieved from DB
  const [loading, setLoading] = useState(true); // Global loading state
  const [name, setName] = useState(""); // Voter name
  const [votes, setVotes] = useState(null); // Option votes array
  const [credits, setCredits] = useState(0); // Total available credits
  const [submitLoading, setSubmitLoading] = useState(false); // Component (button) submission loading state
  const [accessError, setAccessError] = useState(""); // Inline error for public-visit failures
  const [lang, setLang] = useState(getLang(query)); // Ballot language (?lang=es)

  // Reflect the ballot language on <html lang> so screen readers switch
  // pronunciation. The toggle below keeps this in sync via state.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  /**
   * Switches ballot language in place. Votes in progress are React state,
   * so they survive the switch; shallow routing keeps the URL shareable
   * without re-running data fetching.
   */
  const switchLang = (target) => {
    if (target === lang) return;
    setLang(target);
    const href = langToggleHref("/vote", query, target);
    router.replace(href, href, { shallow: true });
  };

  /**
   * Formats an event date in the ballot language. English output is
   * byte-identical to the previous hardcoded format.
   */
  const fmtDate = (date, withSeconds) => {
    const m = moment(date);
    if (lang === "es") {
      return m.locale("es").format("D [de] MMMM [de] YYYY, h:mm a");
    }
    return m.format(withSeconds ? "MMMM Do YYYY, h:mm:ss a" : "MMMM Do YYYY, h:mm a");
  };

  // Public-mode visits use ?event=<id> with no voter id. Per-voter visits
  // use ?user=<voter_id>. Computed once per render.
  const isPublicVisit = !query.user && !!query.event;

  /**
   * Calculates culmulative number of votes and available credits on load
   * @param {object} rData vote data object
   */
  const calculateVotes = (rData) => {
    // Collect array of all user votes per option
    const votesArr = rData.vote_data.map((item, _) => item.votes);
    // Multiple user votes (Quadratic Voting)
    const votesArrMultiple = votesArr.map((item, _) => item * item);
    // Set votes variable to array
    setVotes(votesArr);
    // Set credits to:
    setCredits(
      // Maximum votes -
      rData.event_data.credits_per_voter -
        // Sum of all QV multiplied votes
        votesArrMultiple.reduce((a, b) => a + b, 0)
    );
  };

  /**
   * Update votes array with QV weighted vote increment/decrement
   * @param {number} index of option to update
   * @param {boolean} increment true === increment, else decrement
   */
  const makeVote = (index, increment) => {
    const tempArr = votes; // Collect all votes
    // Increment or decrement depending on boolean
    increment
      ? (tempArr[index] = tempArr[index] + 1)
      : (tempArr[index] = tempArr[index] - 1);

    setVotes(tempArr); // Set votes array
    // Calculate new sumVotes
    const sumVotes = tempArr
      .map((num, _) => num * num)
      .reduce((a, b) => a + b, 0);
    // Set available credits to maximum credits - sumVotes
    setCredits(data.event_data.credits_per_voter - sumVotes);
  };

  /**
   * componentDidMount — branches on URL pattern.
   *
   *   ?user=<voter_id>   per-voter unique-link flow (existing behavior)
   *   ?event=<event_id>  public-link flow (new). The find endpoint rejects
   *                      this query with 403 if the event is unique-mode,
   *                      which we surface inline rather than redirecting.
   *   neither            redirect to /place (matches existing fallback)
   */
  useEffect(() => {
    if (isPublicVisit) {
      axios
        .get(`/api/events/find?event=${query.event}`)
        .then((response) => {
          setData(response.data);
          setName("");
          calculateVotes(response.data);
          setLoading(false);
        })
        .catch((err) => {
          // 403 → unique-mode mismatch; surface server's message inline.
          // 404 → event not found; same treatment.
          const msg =
            err && err.response && typeof err.response.data === "string"
              ? err.response.data
              : "This event requires a personal voting link. Contact the organizer.";
          setAccessError(msg);
          setLoading(false);
        });
      return;
    }

    if (!query.user) {
      router.push("/place?error=true");
      return;
    }

    // Collect voter information on load
    axios
      .get(`/api/events/find?id=${query.user}`)
      // If voter exists
      .then((response) => {
        // Set response data
        setData(response.data);
        // Set name if exists
        setName(
          response.data.voter_name !== null ? response.data.voter_name : ""
        );
        // Calculate QV votes with data
        calculateVotes(response.data);
        // Toggle global loading state to false
        setLoading(false);
      })
      // If voter does not exist
      .catch(() => {
        // Redirect to /place with error state default
        router.push("/place?error=true");
      });
  }, []);

  /**
   * Calculate render state of -/+ buttons based on possible actions
   * @param {number} current number of option votes
   * @param {boolean} increment -/+ button toggle
   */
  const calculateShow = (current, increment) => {
    const change = increment ? 1 : -1;
    const canOccur =
      Math.abs(Math.pow(current, 2) - Math.pow(current + change, 2)) <= credits;
    // Check for absolute squared value of current - absolute squared valueof current + 1 <= credits

    // If current votes === 0, and available credits === 0
    if (current === 0 && credits === 0) {
      // Immediately return false
      return false;
    }

    // Else, if adding
    if (increment) {
      // Check for state of current
      return current <= 0 ? true : canOccur;
    } else {
      // Or check for inverse state when subtracting
      if (data.event_data.event_title === "Wish List Poll") {
        return (current >= 0 ? true : canOccur) && (current !== 0);
      } else {
        return current >= 0 ? true : canOccur;
      }
    }
  };

  /**
   * True when this event requires the voter to provide a name.
   */
  const isIdentified = () =>
    data &&
    data.event_data &&
    data.event_data.privacy_mode === "identified";

  /**
   * True when the vote can be submitted right now.
   */
  const canSubmit = () => !isIdentified() || name.trim() !== "";

  /**
   * Vote submission POST. Two body shapes depending on the visit type:
   *   per-voter: { id: <voter_id>, votes, name }
   *   public:    { event_id: <event_id>, votes, name }
   * The server distinguishes by presence/absence of `id`.
   */
  const submitVotes = async () => {
    // Identified-mode events require a non-empty name. Mirror the server-side
    // check so the user gets immediate feedback instead of a 400.
    if (isIdentified() && name.trim() === "") {
      return;
    }

    // Toggle button loading state to true
    setSubmitLoading(true);

    const body = isPublicVisit
      ? { event_id: data.event_id, votes: votes, name: name }
      : { id: query.user, votes: votes, name: name };

    // Success/failure URLs vary too — public visits have no voter id to
    // round-trip, so the thank-you page renders without a "Change your
    // votes" link.
    // Carry the ballot language through so the thank-you/failure pages
    // render in the language the voter was using.
    const langParam = lang === "es" ? "&lang=es" : "";
    const successUrl = isPublicVisit
      ? `success?event=${data.event_id}${langParam}`
      : `success?event=${data.event_id}&user=${query.user}${langParam}`;
    const failureUrl = isPublicVisit
      ? `failure?event=${data.event_id}${langParam}`
      : `failure?event=${data.event_id}&user=${query.user}${langParam}`;

    // Build a failure URL that surfaces the server's message when we have
    // one. Falls back to the generic copy on /failure when ?reason= is absent.
    const failureWithReason = (reason) => {
      if (!reason) return failureUrl;
      return `${failureUrl}&reason=${encodeURIComponent(reason)}`;
    };

    try {
      const { status } = await axios.post("/api/events/vote", body);
      if (status === 200) {
        router.push(successUrl);
      } else {
        router.push(failureUrl);
      }
    } catch (err) {
      // axios throws on 4xx/5xx. Capture the server's response body when it
      // looks like a usable message (string, under ~300 chars). Otherwise
      // fall back to the generic failure page.
      const body =
        err && err.response && typeof err.response.data === "string"
          ? err.response.data
          : "";
      const reason = body && body.length > 0 && body.length < 300 ? body : "";
      // Log to the console too, so anyone investigating can see the full
      // error shape (status, body, etc.) without needing logs.
      // eslint-disable-next-line no-console
      console.error("Vote submission failed:", err && err.response, err);
      router.push(failureWithReason(reason));
    }

    // Toggle button loading state to false
    setSubmitLoading(false);
  };

  /**
   * Toggle show/hide description
   * @param {number} key identifying the option the user clicked on
   */
  const toggleDescription = (key) => {
    const description = document.getElementById("description-container-" + key);
    const link = document.getElementById("link-container-" + key);
    const toggleButton = document.getElementById("toggle-button-" + key);
    if (toggleButton.alt === "down arrow") {
      toggleButton.src = "/vectors/up_arrow.svg";
      toggleButton.alt = "up arrow";
    } else {
      toggleButton.src = "/vectors/down_arrow.svg";
      toggleButton.alt = "down arrow";
    }
    if (description) {
      if (description.style.display === "none") {
        description.style.display = "block";
      } else {
        description.style.display = "none";
      }
    }
    if (link) {
      if (link.style.display === "none") {
        link.style.display = "block";
      } else {
        link.style.display = "none";
      }
    }
  };

  return (
    <Layout>
      {/* Navigation header */}
      <Navigation
        history={{
          title: t(lang, "nav_home"),
          link: "/",
        }}
        returnPrefix={t(lang, "nav_return_prefix")}
        title={t(lang, "nav_place_votes")}
      />

      <div className="vote">
        {/* Inline error for public visits where the event isn't public,
            doesn't exist, or otherwise can't be browsed. */}
        {accessError ? (
          <div className="vote__loading">
            <h1>{t(lang, "cant_open_ballot")}</h1>
            <p>{translateServerMessage(lang, accessError)}</p>
            <p>
              <a href="/">{t(lang, "back_to_home")}</a>
            </p>
          </div>
        ) : null}

        {/* Loading state check */}
        {!loading && !accessError ? (
          <>
          <aside id="table-of-contents_container">
            <div className="toc-header">
              <h3>{t(lang, "jump_to_option")}</h3>
            </div>
            <div id="table-of-contents">
              {data.vote_data.map((option, i) => {
                // Loop through each voteable option
                return (
                  <div key={i} className="toc-item">
                    <a href={'#' + i}>{localizeSubject(option, lang).title}</a>
                  </div>
                );
              })}
            </div>
          </aside>
          <aside id="budget-container">
            <RemainingCredits
              creditBalance={data.event_data.credits_per_voter}
              creditsRemaining={credits}
              heading={t(lang, "available_credits")}
              remainingLabel={t(lang, "credits_remaining")}
            />
            {data ? (
              <>
              {(moment() > moment(data.event_data.end_event_date)) ? (
                <></>
              ) : (
                <>
                  {/* Submission button states */}
                  {submitLoading ? (
                      // Check for existing button loading state
                      <button className="submit__button" disabled>
                        <Loader />
                      </button>
                    ) : canSubmit() ? (
                      // Else, enable submission
                      <button name="input-element" onClick={submitVotes} className="submit__button">
                        {t(lang, "submit_votes")}
                      </button>
                    ) : (
                      // Identified event with empty name — block submission
                      <button className="submit__button button__disabled" disabled title={t(lang, "enter_name_to_submit")}>
                        {t(lang, "enter_name_to_submit")}
                      </button>
                    )}
                </>
              )}
              </>
            ) : null}
          </aside>
          <div className="ballot_container">
            <div className="vote__info">
              {/* Language toggle — EN/ES. Rendered above the heading so
                  Spanish speakers spot it before reading English copy. */}
              <div className="lang__toggle" role="group" aria-label="Language / Idioma">
                <button
                  type="button"
                  className={lang === "en" ? "lang__active" : ""}
                  aria-pressed={lang === "en"}
                  onClick={() => switchLang("en")}
                >
                  English
                </button>
                <button
                  type="button"
                  className={lang === "es" ? "lang__active" : ""}
                  aria-pressed={lang === "es"}
                  onClick={() => switchLang("es")}
                >
                  Español
                </button>
              </div>

              {/* General voting header */}
              <div className="vote__info_heading">
                <h1>{t(lang, "place_your_votes")}</h1>
                <p>
                  {t(lang, "credits_intro_before")}
                  <strong>
                    {data.event_data.credits_per_voter}{" "}
                    {t(lang, "credits_intro_credits")}
                  </strong>
                  {t(lang, "credits_intro_after")}
                </p>
              </div>

              {/* Project name and description */}
              <div className="event__details">
                <div className="vote__loading event__summary">
                  <h2>{localizeEventText(data.event_data, lang).title}</h2>
                  <p>{localizeEventText(data.event_data, lang).description}</p>
                  {data ? (
                    <>
                    {(moment() > moment(data.event_data.end_event_date)) ? (
                      <>
                      <h3>{t(lang, "event_concluded")}</h3>
                      {/* Redirect to event dashboard */}
                      <Link href={`/event?id=${data.event_id}`}>
                        <a>{t(lang, "see_dashboard")}</a>
                      </Link>
                      </>
                    ) : (
                      <>
                      {(moment() < moment(data.event_data.start_event_date)) ? (
                        <h3>{t(lang, "event_begins")} {fmtDate(data.event_data.start_event_date, true)}</h3>
                      ) : (
                        <h3>{t(lang, "event_closes")} {fmtDate(data.event_data.end_event_date, true)}</h3>
                      )}
                      </>
                    )}
                    </>
                  ) : null}
                </div>
              </div>

              {/* Voter name input — required for identified events */}
              {data && isIdentified() &&
               moment() >= moment(data.event_data.start_event_date) &&
               moment() <= moment(data.event_data.end_event_date) ? (
                <div className="voter__name_section">
                  <label htmlFor="voter_name">{t(lang, "your_name")}</label>
                  <p>{t(lang, "name_privacy_note")}</p>
                  <input
                    type="text"
                    id="voter_name"
                    placeholder={t(lang, "name_required_placeholder")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              ) : null}

              {/* Ballot */}
              {data ? (
                <>
                {/* Hide ballot if event hasn't started yet */}
                {(moment() < moment(data.event_data.start_event_date)) ? (
                  <></>
                ) : (
                  <>
                  {/* Voteable options */}
                  <div className="event__options">
                    <h2>{t(lang, "voteable_options")}</h2>
                    <div className="divider" />
                    <div className="event__options_list">
                      {data.vote_data.map((option, i) => {
                        // Loop through each voteable option, in the ballot
                        // language (field-by-field English fallback)
                        const localized = localizeSubject(option, lang);
                        return (
                          <div key={i} id={i} className="event__option_item">
                            <div>
                              <button className="title-container" onClick={() => toggleDescription(i)}>
                                <label>{t(lang, "label_title")}</label>
                                <h3>{localized.title}</h3>
                                  <img id={`toggle-button-${i}`} src="/vectors/down_arrow.svg" alt="down arrow" />
                              </button>
                              {localized.description !== "" ? (
                                // If description exists, show description
                                <div id={`description-container-${i}`}>
                                  <label>{t(lang, "label_description")}</label>
                                  <p className="event__option_item_desc">{localized.description}</p>
                                </div>
                              ) : null}
                              {localized.url !== "" ? (
                                // If URL exists, show URL
                                <div id={`link-container-${i}`}>
                                  <label>{t(lang, "label_link")}</label>
                                  <a
                                    href={localized.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {localized.url}
                                  </a>
                                </div>
                              ) : null}
                            </div>
                            {votes[i] !== 0 ? (
                              <ProposalBlocks
                                cost={Math.pow(votes[i], 2)}
                              />
                            ) : null}
                            <div className="event__option_item_vote">
                              <label>{t(lang, "label_votes")}</label>
                              <input type="number" value={votes[i]} disabled />
                              <div className="item__vote_buttons">
                                {data ? (
                                  <>
                                  {(moment() > moment(data.event_data.end_event_date)) ? (
                                    <></>
                                  ) : (
                                    <>
                                      {/* Toggleable button states based on remaining credits */}
                                      {calculateShow(votes[i], false) ? (
                                        <button name="input-element" onClick={() => makeVote(i, false)}>
                                          -
                                        </button>
                                      ) : (
                                        <button className="button__disabled" disabled>
                                          -
                                        </button>
                                      )}
                                      {calculateShow(votes[i], true) ? (
                                        <button name="input-element" onClick={() => makeVote(i, true)}>+</button>
                                      ) : (
                                        <button className="button__disabled" disabled>
                                          +
                                        </button>
                                      )}
                                    </>
                                  )}
                                  </>
                                ) : null}
                              </div>
                              {data.voter_name !== "" && data.voter_name !== null ? (
                                // If user has voted before, show historic votes
                                <div className="existing__votes">
                                  <span>
                                    {t(lang, "last_allocated_before")}{" "}
                                    <strong>
                                      {data.vote_data[i].votes}{" "}
                                      {t(lang, "last_allocated_votes")}{" "}
                                    </strong>
                                    {t(lang, "last_allocated_after")}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  </>
                )}
                </>
              ) : null}
            </div>
          </div>
          </>
        ) : !accessError ? (
          // If loading, show global loading state. Suppressed when an
          // access error is already on screen.
          <div className="vote__loading">
            <h1>{t(lang, "loading")}</h1>
            <p>{t(lang, "loading_profile")}</p>
          </div>
        ) : null}
      </div>

      {/* Component scoped CSS */}
      <style jsx>{`
        button {
          touch-action: manipulation;
        }
        .vote {
          text-align: center;
        }

        .lang__toggle {
          display: inline-flex;
          gap: 0px;
          border: 1px solid #000;
          border-radius: 5px;
          overflow: hidden;
          margin-bottom: 10px;
        }

        .lang__toggle > button {
          border: none;
          background-color: #fff;
          color: #000;
          font-size: 16px;
          font-family: suisse_intlbook;
          padding: 8px 18px;
          cursor: pointer;
          transition: 100ms ease-in-out;
        }

        .lang__toggle > button.lang__active {
          background-color: #000;
          color: #edff38;
          cursor: default;
        }

        .lang__toggle > button:not(.lang__active):hover {
          opacity: 0.8;
        }

        .vote__info {
          max-width: 660px;
          width: calc(100% - 40px);
          margin: 50px 0px;
          padding: 0px 20px;
          display: inline-block;
          position: relative;
        }

        #budget-container {
          padding: 1vw 2vw;
          position: sticky;
          top: 0;
          left: 0;
          z-index: 1;
          background: white;
        }

        #table-of-contents_container {
          display: none;
        }

        @media only screen and (min-width: 768px) {
          .vote {
            display: grid;
            grid-template-columns: 1fr auto;
          }

          .ballot_container {
            grid-row: 1;
          }

          .vote__info {
            grid-column: 1;
            margin: 50px 0 50px auto;
          }

          #budget-container {
            background: none;
            grid-column: 2;
            position: sticky;
            top: 0;
            height: 100vh;
            padding: 50px 2rem;
          }

          .vote__loading {
            margin: 50px auto 0px auto !important;
          }
        }

        @media only screen and (min-width: 1150px) {
          .vote {
            display: grid;
            grid-template-columns: [margin] 2rem [column] 1fr repeat(9, [gutter] 2rem [column] 1fr) [margin] 2rem;
          }

          #budget-container {
            grid-column-start: column 9;
            grid-column-end: gutter 10;
          }

          #table-of-contents_container {
            grid-row: 1;
            grid-column-start: 1;
            grid-column-end: gutter 2;
            display: inline-block;
            position: sticky;
            top: 0;
            height: 100vh;
            padding: 50px 2rem;
            text-align: left;
          }

          #table-of-contents {
            height: calc(100vh - 260px);
            overflow-y: auto;
            position: sticky;
            padding-bottom: 1rem;
            border-bottom: solid 1px black;
            border-top: solid 1px black;
          }

          .toc-header {
            box-sizing: border-box;
            width: 100%;
          }

          .toc-item {
            box-sizing: border-box;
            width: 100%;
            padding: .5rem 1rem;
          }
          .toc-item > a {
            text-decoration: none;
            color: black;
          }
          .toc-item > a:hover {
            opacity: 0.8;
          }

          .ballot_container {
            grid-column-start: column 3;
            grid-column-end: gutter 8;
          }

          .vote__info {
            margin: 50px 0 50px auto;
            width: auto;
          }

          .vote__loading {
            grid-column-start: column 3;
            grid-column-end: gutter 8;
          }
        }

        .event__summary {
          display: inline-block;
          box-shadow: 0 0 35px rgba(127, 150, 174, 0.125);
          background-color: #fff;
          margin: 20px 0px !important;
          padding-left: 20px !important;
          padding-right: 20px !important;
          box-sizing: border-box;
        }

        .event__summary > h2 {
          color: #000;
          margin: 0px;
        }

        .event__summary > a {
          max-width: 200px;
          width: calc(100% - 40px);
          margin: 10px 20px;
          padding: 12px 0px;
          border-radius: 5px;
          text-decoration: none;
          font-size: 18px;
          display: inline-block;
          text-decoration: none;
          transition: 100ms ease-in-out;
          background-color: #000;
          color: #edff38;
        }

        .event__summary > a:hover {
          opacity: 0.8;
        }

        .vote__loading {
          max-width: 660px;
          width: calc(100% - 40px);
          border-radius: 10px;
          display: inline-block;
          margin: 50px 20px 0px 20px;
          border: 1px solid #f1f2e5;
          padding: 30px 0px;
          position: relative;
        }

        .vote__loading > h1,
        .vote__info_heading > h1 {
          color: #000;
          margin: 0px;
        }

        .event__options {
          margin-top: 60px;
          text-align: left;
        }

        .event__options > h2 {
          color: #000;
          margin-block-end: 0px;
        }

        .divider {
          border-top: 1px solid #e7eaf3;
          margin-top: 5px;
        }

        .vote__loading > p,
        .vote__info_heading > p {
          font-size: 18px;
          line-height: 150%;
          color: #80806b;
          margin: 0px;
        }

        .event__option_item {
          background-color: #fff;
          border-radius: 8px;
          border: 1px solid #f1f2e5;
          box-shadow: 0 0 35px rgba(127, 150, 174, 0.125);
          max-width: 700px;
          width: 100%;
          margin: 25px 0px;
          text-align: left;
        }

        .event__option_item > div:nth-child(1) {
          padding: 15px;
        }

        .event__option_item label {
          display: block;
          color: #000;
          font-size: 18px;
          text-transform: uppercase;
        }

        .event__option_item > div > div {
          margin: 25px 0px;
        }

        .title-container {
          display: grid;
          grid-template-columns: 1fr auto;
          font-family: suisse_intlbook;
          padding: 0px;
          outline: none;
          width: 100%;
          border-radius: 5px;
          background-color: #fff;
          transition: 100ms ease-in-out;
          border: none;
          cursor: pointer;
        }

        .title-container > label,
        .title-container > h3 {
          grid-column-start: 1;
          text-align: left;
          display: block;
          color: #000;
          font-size: 18px;
        }

        .title-container > label {
          text-transform: uppercase;
        }

        .event__option_item > div > div:nth-child(1) {
          margin-top: 5px;
        }

        .event__option_item > div > div:nth-last-child(1) {
          margin-bottom: 5px;
        }

        .event__option_item h3 {
          margin: 2px 0px;
        }

        .event__option_item p {
          margin-top 5px;
        }

        .event__option_item a {
          text-decoration: none;
        }

        .event__option_item input {
          width: calc(100% - 10px);
          font-size: 18px;
          border-radius: 5px;
          border: 1px solid #f1f2e5;
          padding: 10px 5px;
          background-color: #fff;
        }

        .event__option_item_desc {
          white-space: pre-wrap;
        }

        .event__option_item_vote {
          border-top: 2px solid #e7eaf3;
          border-bottom-left-radius: 5px;
          border-bottom-right-radius: 5px;
          padding: 15px;
        }

        .event__option_item_vote input {
          text-align: center;
          font-weight: bold;
        }

        .item__vote_buttons {
          margin: 10px 0px 0px 0px !important;
        }

        .item__vote_buttons > button {
          width: 49%;
          font-size: 22px;
          font-weight: bold;
          border-radius: 5px;
          border: none;
          transition: 50ms ease-in-out;
          padding: 5px 0px;
          cursor: pointer;
          color: #fff;
        }

        .item__vote_buttons > button:nth-child(1) {
          margin-right: 1%;
          background-color: #edff38;
          color: #000;
        }

        .item__vote_buttons > button:nth-child(2) {
          margin-left: 1%;
          background-color: #000;
          color: #edff38;
        }

        .item__vote_buttons > button:hover {
          opacity: 0.8;
        }

        .button__disabled {
          background-color: #f1f2e5 !important;
          color: #000 !important;
          cursor: not-allowed !important;
        }

        .item__vote_credits {
          color: #80806b;
          font-size: 14px;
          text-align: right;
          display: block;
          transform: translateY(-7.5px);
        }

        .submit__button {
          padding: 12px 0px;
          width: 100%;
          display: inline-block;
          border-radius: 5px;
          background-color: #000;
          color: #edff38;
          font-size: 16px;
          transition: 100ms ease-in-out;
          border: none;
          cursor: pointer;
          margin-top: 20px;
        }

        .submit__button:hover {
          opacity: 0.8;
        }

        .existing__votes {
          background-color: #ffffe0;
          padding: 7.5px 10px;
          width: calc(100% - 22px);
          border-radius: 5px;
          text-align: center;
          border: 1px solid #fada5e;
        }
        .voter__name_section {
          background-color: #fff;
          border-radius: 8px;
          border: 1px solid #f1f2e5;
          box-shadow: 0 0 35px rgba(127, 150, 174, 0.125);
          padding: 15px;
          margin: 25px 0px;
          text-align: left;
        }
        .voter__name_section > label {
          display: block;
          color: #000;
          font-weight: bold;
          font-size: 18px;
          text-transform: uppercase;
        }
        .voter__name_section > p {
          font-size: 16px;
          line-height: 150%;
          color: #80806b;
          margin: 5px 0px 10px 0px;
        }
        .voter__name_section > input {
          width: calc(100% - 22px);
          font-size: 18px;
          border-radius: 5px;
          border: 1px solid #f1f2e5;
          padding: 10px;
          background-color: #fff;
        }
      `}</style>
    </Layout>
  );
}

// Collect params from URL
Vote.getInitialProps = ({ query }) => {
  return { query };
};

export default Vote;
