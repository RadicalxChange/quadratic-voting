import useSWR from "swr"; // State-while-revalidate
import fetch from "unfetch"; // Fetch for requests
import moment from "moment"; // Moment date parsing
import Head from "next/head"; // Custom meta images
import Layout from "components/layout"; // Layout wrapper
import Navigation from "components/navigation"; // Navigation
import { HorizontalBar } from "react-chartjs-2"; // Horizontal bar graph
import HashLoader from "react-spinners/HashLoader"; // Loader
import * as FileSaver from 'file-saver';
import * as XLSX from 'xlsx';
import Datetime from "react-datetime"; // Datetime component
import { useState, useEffect } from "react"; // State handling
import axios from "axios"; // Axios for requests
import { buildVotersSheet, shouldIncludeVotersSheet } from "lib/export";
import { LINK_MODES } from "lib/access"; // Link-mode constants

// Setup fetcher for SWR
const fetcher = (url) => fetch(url).then((r) => r.json());

// Displays the public voting URL for an event in public link mode, with a
// copy-to-clipboard button. URL is built client-side from
// window.location.origin so we don't hard-code the deployment domain.
function PublicVotingUrl({ eventId }) {
  const [url, setUrl] = useState("");
  const [urlEs, setUrlEs] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    // window is only defined client-side; safe inside useEffect.
    setUrl(`${window.location.origin}/vote?event=${eventId}`);
    setUrlEs(`${window.location.origin}/vote?event=${eventId}&lang=es`);
  }, [eventId]);

  const copy = async (value, key, inputId) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch (_) {
      // Clipboard may be unavailable (e.g. insecure context). Fall back
      // by selecting the input so the user can copy manually.
      const el = document.getElementById(inputId);
      if (el) {
        el.focus();
        el.select();
      }
    }
  };

  return (
    <div>
      <div className="public__url">
        <span className="public__url_lang">EN</span>
        <input id="public_voting_url" value={url} readOnly />
        <button
          type="button"
          onClick={() => copy(url, "en", "public_voting_url")}
        >
          {copied === "en" ? "Copied!" : "Copy"}
        </button>
      </div>
      {/* Same event, same ballot, same tally — only the interface language
          differs. Share this one with Spanish-speaking voters. */}
      <div className="public__url">
        <span className="public__url_lang">ES</span>
        <input id="public_voting_url_es" value={urlEs} readOnly />
        <button
          type="button"
          onClick={() => copy(urlEs, "es", "public_voting_url_es")}
        >
          {copied === "es" ? "Copied!" : "Copy"}
        </button>
      </div>
      <style jsx>{`
        .public__url {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 8px;
          margin-top: 12px;
          align-items: center;
        }
        .public__url_lang {
          font-weight: bold;
          font-size: 14px;
        }
        .public__url > input {
          font-size: 16px;
          border-radius: 5px;
          border: 1px solid #f1f2e5;
          padding: 8px 10px;
          background-color: #fff;
        }
        .public__url > button {
          padding: 8px 14px;
          border-radius: 5px;
          background-color: #000;
          color: #edff38;
          border: none;
          cursor: pointer;
          font-size: 14px;
        }
        .public__url > button:hover {
          opacity: 0.85;
        }
      `}</style>
    </div>
  );
}

// Admin-only form to append one (optionally bilingual) option to a live
// public-link event. Appending is index-safe: votes already cast keep their
// positions, and voters who loaded the ballot earlier simply contribute 0
// to the new option. The dashboard's SWR poll picks up the new option in
// the chart within a second of a successful add.
function AddOptionForm({ eventId, secret }) {
  const emptyOption = {
    title: "",
    title_es: "",
    description: "",
    description_es: "",
  };
  const [option, setOption] = useState(emptyOption);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // {ok: bool, message: string}

  const setField = (field, value) =>
    setOption((prev) => ({ ...prev, [field]: value }));

  const submit = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const { data } = await axios.post("/api/events/addOption", {
        id: eventId,
        secret_key: secret,
        title: option.title,
        title_es: option.title_es,
        description: option.description,
        description_es: option.description_es,
      });
      setStatus({
        ok: true,
        message: `Option added — the ballot now has ${data.num_options} options. Voters see it on their next page load.`,
      });
      setOption(emptyOption);
    } catch (err) {
      const message =
        err && err.response && typeof err.response.data === "string"
          ? err.response.data
          : "Adding the option failed. Please try again.";
      setStatus({ ok: false, message });
    }
    setBusy(false);
  };

  return (
    <div className="add__option">
      <div className="add__option_grid">
        <div>
          <label htmlFor="add_option_title">Title (English)</label>
          <input
            id="add_option_title"
            type="text"
            value={option.title}
            onChange={(e) => setField("title", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="add_option_title_es">Title (Spanish)</label>
          <input
            id="add_option_title_es"
            type="text"
            value={option.title_es}
            onChange={(e) => setField("title_es", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="add_option_desc">Description (English)</label>
          <textarea
            id="add_option_desc"
            value={option.description}
            onChange={(e) => setField("description", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="add_option_desc_es">Description (Spanish)</label>
          <textarea
            id="add_option_desc_es"
            value={option.description_es}
            onChange={(e) => setField("description_es", e.target.value)}
          />
        </div>
      </div>
      {option.title.trim() !== "" && !busy ? (
        <button type="button" className="add__option_button" onClick={submit}>
          Add option to live ballot
        </button>
      ) : (
        <button type="button" className="add__option_button add__option_disabled" disabled>
          {busy ? "Adding..." : "Enter an English title to add"}
        </button>
      )}
      {status ? (
        <p className={status.ok ? "add__option_ok" : "add__option_error"}>
          {status.message}
        </p>
      ) : null}
      <style jsx>{`
        .add__option {
          margin-top: 12px;
        }
        .add__option_grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .add__option_grid label {
          display: block;
          font-size: 14px;
          font-weight: bold;
          color: #000;
          text-transform: uppercase;
        }
        .add__option_grid input,
        .add__option_grid textarea {
          width: calc(100% - 12px);
          max-width: calc(100% - 12px);
          font-size: 16px;
          border-radius: 5px;
          border: 1px solid #f1f2e5;
          margin-top: 5px;
          padding: 8px 5px;
          font-family: suisse_intlbook;
        }
        .add__option_grid textarea {
          min-height: 70px;
        }
        .add__option_button {
          margin-top: 12px;
          padding: 12px 0px;
          width: 100%;
          border-radius: 5px;
          background-color: #000;
          color: #edff38;
          font-size: 16px;
          border: none;
          cursor: pointer;
          transition: 100ms ease-in-out;
        }
        .add__option_button:hover {
          opacity: 0.8;
        }
        .add__option_disabled {
          background-color: #f1f2e5 !important;
          color: #000 !important;
          cursor: not-allowed !important;
        }
        .add__option_ok {
          background-color: #eaffea;
          border: 1px solid #9fd89f;
          border-radius: 5px;
          padding: 8px 10px;
          font-size: 14px;
        }
        .add__option_error {
          background-color: #fff5d0;
          border: 1px solid #fada5e;
          border-radius: 5px;
          padding: 8px 10px;
          font-size: 14px;
        }
        @media screen and (max-width: 700px) {
          .add__option_grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function Event({ query }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editMode, setEditMode] = useState(false);

  // Collect data from endpoint.
  //
  // NOTE: useSWR returns { data, error, isValidating } — there is no
  // `loading` field. The pre-existing code destructures `loading` here,
  // which is always undefined; we keep that to avoid touching unrelated
  // render paths, but we ALSO grab `error` so we can surface backend
  // failures instead of silently retrying every 500ms behind a
  // "Loading..." string. Before this change any 4xx/5xx from
  // /api/events/details just looked like an infinite load to the user.
  const swr = useSWR(
    // Use query ID in URL
    `/api/events/details?id=${query.id}${
      // If secret is present, use administrator view
      query.secret !== "" ? `&secret_key=${query.secret}` : ""
    }`,
    {
      fetcher: async (url) => {
        const r = await fetch(url);
        if (!r.ok) {
          // Throw with the server's response body so SWR surfaces it as
          // `error` and the page can show it.
          const body = await r.text();
          const err = new Error(body || `HTTP ${r.status}`);
          err.status = r.status;
          throw err;
        }
        return r.json();
      },
      // Force refresh SWR every 500ms
      refreshInterval: 500,
      // Don't retry forever on a 4xx — the response isn't going to change.
      shouldRetryOnError: (err) => !err || !err.status || err.status >= 500,
    }
  );
  const { data, error, loading } = swr;

  /**
   * Admin view: download voter URLs as text file
   */
  const downloadTXT = () => {
    // Collect voter URLs in single text string
    const text = data.event.voters
      .map((voter, _) => `https://quadraticvote.radicalxchange.org/vote?user=${voter.id}`)
      .join("\n");

    // Create link component
    const element = document.createElement("a");
    // Create blob from text
    const file = new Blob([text], { type: "text/plain" });

    // Setup link component to be downloadable and hidden
    element.href = URL.createObjectURL(file);
    element.download = "voter_links.txt";
    element.style.display = "none";

    // Append link component to body
    document.body.appendChild(element);

    // Click link component to download file
    element.click();

    // Remove link component from body
    document.body.removeChild(element);
  };

  const downloadXLSX = () => {
    // Identified events with at least one named voter get a second sheet.
    // For every other case (anonymous, identified-with-no-voters, non-admin
    // view of identified) we fall through to the PR 1 anonymous code path
    // below — keeping that block byte-for-byte identical is the privacy
    // contract for existing anonymous events. Do not "refactor while
    // you're in here."
    if (shouldIncludeVotersSheet(data)) {
      const fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
      const fileExtension = '.xlsx';

      // Sheet 1: totals, same construction as anonymous mode.
      const options = data.chart.labels;
      const descriptions = data.chart.descriptions;
      const effectiveVotes = data.chart.datasets[0].data;
      const totalsRows = [];
      for (let i = 0; i < options.length; i++) {
        totalsRows.push({
          title: options[i],
          description: descriptions[i],
          votes: effectiveVotes[i],
        });
      }
      const totalsSheet = XLSX.utils.json_to_sheet(totalsRows);

      // Sheet 2: per-voter rows.
      const voters = buildVotersSheet(data);
      const votersSheet = XLSX.utils.json_to_sheet(voters.rows);

      const wb = {
        Sheets: { 'data': totalsSheet, 'Voters': votersSheet },
        SheetNames: ['data', 'Voters'],
      };
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const fileData = new Blob([excelBuffer], { type: fileType });
      FileSaver.saveAs(fileData, 'qv-results' + fileExtension);
      return;
    }

    // === ANONYMOUS PATH — PR 1 verbatim. Do not modify. ===
    const fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
    const fileExtension = '.xlsx';
    const options = data.chart.labels
    const descriptions = data.chart.descriptions
    const effectiveVotes = data.chart.datasets[0].data
    var rows = [];
    var i;
    for (i = 0; i < options.length; i++) {
      var option = {
        title: options[i],
        description: descriptions[i],
        votes: effectiveVotes[i],
      }
      rows.push(option);
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = { Sheets: { 'data': ws }, SheetNames: ['data'] };
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const fileData = new Blob([excelBuffer], {type: fileType});
    FileSaver.saveAs(fileData, 'qv-results' + fileExtension);
  };

  const toggleEditMode = async (start) => {
    if (start) {
      if (data) {
        setStartDate(moment(data.event.start_event_date));
        setEndDate(moment(data.event.end_event_date));
        setEditMode(true);
      }
    } else {
      // POST data and collect status
      const { status } = await axios.post("/api/events/update", {
        id: data.event.id,
        start_event_date: startDate,
        end_event_date: endDate,
      });
      // If POST is a success
      if (status === 200) {
        // Close edit mode
        setEditMode(false);
      }
    }
  };

  return (
    <Layout event>
      {/* Custom meta images */}
      <Head>
        <meta
          property="og:image"
          content={`https://qv-image.vercel.app/api/?id=${query.id}`}
        />
        <meta
          property="twitter:image"
          content={`https://qv-image.vercel.app/api/?id=${query.id}`}
        />
      </Head>

      {/* Navigation header */}
      <Navigation
        history={{
          // If secret is not present, return to home
          title:
            query.secret && query.secret !== "" ? "event creation" : "home",
          // If secret is present, return to create page
          link: query.secret && query.secret !== "" ? `/create` : "/",
        }}
        title="Event Details"
      />

      {/* Event page summary */}
      <div className="event">
        <h1>Event Details</h1>

        {/* Backend error surfacing. Previously the page would just hang
            on "Loading..." forever when /api/events/details returned a
            non-2xx; SWR retried every 500ms and the user got no signal. */}
        {error ? (
          <div className="event__error">
            <h2>This event couldn't be loaded.</h2>
            <p>{String(error.message || error)}</p>
            <p className="event__error_hint">
              Server status: {error.status || "(none)"}.
              Open the browser developer tools, Network tab, and inspect the
              call to <code>/api/events/details</code> for more detail.
            </p>
          </div>
        ) : null}

        <div className="event__information">
          <h2>{!loading && data ? data.event.event_title : "Loading..."}</h2>
          <p>
            {!loading && data ? data.event.event_description : "Loading..."}
          </p>
          {data ? (
            <>
            {(moment() > moment(data.event.end_event_date)) ? (
              <h3>This event has concluded. See results below!</h3>
            ) : (
              <>
              {(moment() < moment(data.event.start_event_date)) ? (
                <h3>This event begins {moment(data.event.start_event_date).format('MMMM Do YYYY, h:mm:ss a')}</h3>
              ) : (
                <h3>This event closes {moment(data.event.end_event_date).format('MMMM Do YYYY, h:mm:ss a')}</h3>
              )}
              </>
            )}
            </>
          ) : null}
        </div>

        {/* Event start date selection */}
        {!loading && data ? (
          editMode ? (
            <div className="event__section">
              <label>Event start date</label>
              <div className="event__dates">
                <Datetime
                  className="create__settings_datetime"
                  value={startDate}
                  onChange={(value) => setStartDate(value)}
                />
                <button
                  type="button"
                  onClick={() => toggleEditMode(false)}
                >save
                </button>
              </div>
            </div>
          ) : (
            <div className="event__section">
              <label>Event start date</label>
              <div className="event__dates">
                <p>
                  {moment(data.event.start_event_date).format('MMMM Do YYYY, h:mm a')}
                </p>
                {query.secret && query.secret !== "" ? (
                  <button
                    type="button"
                    onClick={() => toggleEditMode(true)}
                  >edit
                  </button>
                ) : null}
              </div>
            </div>
          )
        ) : null}

        {/* Event end date selection */}
        {!loading && data ? (
          editMode ? (
            <div className="event__section">
              <label>Event end date</label>
              <div className="event__dates">
                <Datetime
                  className="create__settings_datetime"
                  value={endDate}
                  onChange={(value) => setEndDate(value)}
                />
                <button
                  type="button"
                  onClick={() => toggleEditMode(false)}
                >save
                </button>
              </div>
            </div>
          ) : (
            <div className="event__section">
              <label>Event end date</label>
              <div className="event__dates">
                <p>
                  {moment(data.event.end_event_date).format('MMMM Do YYYY, h:mm a')}
                </p>
                {query.secret && query.secret !== "" ? (
                  <button
                    type="button"
                    onClick={() => toggleEditMode(true)}
                  >edit
                  </button>
                ) : null}
              </div>
            </div>
          )
        ) : null}

        {/* Event public URL */}
        <div className="event__section">
          <label>Event URL</label>
          <p>Statistics dashboard URL</p>
          <input
            value={`https://quadraticvote.radicalxchange.org/event?id=${query.id}`}
            readOnly
          />
        </div>

        {/* Privacy mode (read-only) */}
        {!loading && data ? (
          <div className="event__section">
            <label>Voter privacy</label>
            <p>
              {data.event.privacy_mode === "identified"
                ? "Identified — voter names will appear in the downloaded report (per-voter export ships in a follow-up release)."
                : "Anonymous — voter names are not included in the downloaded report."}
            </p>
          </div>
        ) : null}

        {/* Link mode (read-only) + public URL display when applicable */}
        {!loading && data ? (
          <div className="event__section">
            <label>Voter access</label>
            <p>
              {data.event.link_mode === "public"
                ? "Public link — anyone with the URL below can vote. The same person can submit multiple times."
                : "Per-voter link — each voter has a personal link that can submit one ballot."}
            </p>
            {data.event.link_mode === "public" ? (
              <PublicVotingUrl eventId={query.id} />
            ) : null}
          </div>
        ) : null}

        {/* Admin: add an option to a live public-link ballot */}
        {query.id !== "" &&
        query.secret !== "" &&
        query.secret !== undefined &&
        !loading &&
        data &&
        data.event.link_mode === LINK_MODES.PUBLIC ? (
          <div className="event__section">
            <label className="private__label">Add a live option</label>
            <p>
              Appends a new option to the ballot immediately — no redeploy.
              Votes already cast are unaffected; voters see the new option
              when they next load or reload the ballot. Spanish fields are
              optional (English shows as fallback).
            </p>
            <AddOptionForm eventId={query.id} secret={query.secret} />
          </div>
        ) : null}

        {/* Event private URL */}
        {query.id !== "" &&
        query.secret !== "" &&
        query.secret !== undefined &&
        !loading &&
        data ? (
          <div className="event__section">
            <label className="private__label">Private Admin URL</label>
            <p>Save this URL to manage event and make changes</p>
            <input
              value={`https://quadraticvote.radicalxchange.org/event?id=${query.id}&secret=${query.secret}`}
              readOnly
            />
          </div>
        ) : null}

        {/* Event copyable links */}
        {query.id !== "" &&
        query.secret !== "" &&
        query.secret !== undefined &&
        !loading &&
        data ? (
          <div className="event__section">
            <label className="private__label">Individual voting links</label>
            <p>For private sharing with voters</p>
            <textarea
              className="event__section_textarea"
              // Collect voter urls as one text element
              value={data.event.voters
                .map(
                  (voter, _) => `https://quadraticvote.radicalxchange.org/vote?user=${voter.id}`
                )
                .join("\n")}
              readOnly
            />
            <button onClick={downloadTXT} className="download__button">
              Download as TXT
            </button>
          </div>
        ) : null}

        {/* Event public chart */}
        {query.id !== "" &&
        !loading &&
        data ? (
          <div className="event__section">
            <label>Event Votes</label>
            {data.chart ? (
            <>
              <p>Quadratic Voting-weighted voting results</p>
              {!loading && data ? (
                <>
                <div className="chart">
                  <HorizontalBar data={data.chart} width={90} height={60} />
                </div>
                <button onClick={downloadXLSX} className="download__button">
                  Download spreadsheet
                </button>
                </>
              ) : (
                <div className="loading__chart">
                  <HashLoader
                    size={50}
                    color="#000"
                    css={{ display: "inline-block" }}
                  />
                  <h3>Loading Chart...</h3>
                  <span>Please give us a moment</span>
                </div>
              )}
            </>
            ) : (
              <p>Voting results will appear here when the event has concluded</p>
            )}
          </div>
        ) : null}


        {/* Event public statistics */}
        {query.id !== "" &&
        !loading &&
        data ? (
          <div className="event__section">
              <label>Event Statistics</label>
              {data.statistics ? (
              <>
                <div className="event__sub_section">
                  <label>Voting Participants</label>
                  <h3>
                    {/* For public-link events num_voters is not a real
                        roster, so the "/ N" denominator is a meaningless
                        leftover (and reads as nonsense like "23 / 10" once
                        submissions exceed it). Show just the count for
                        public; keep "x / N" for unique-link rosters. */}
                    {!loading && data
                      ? data.event.link_mode === LINK_MODES.PUBLIC
                        ? `${data.statistics.numberVoters.toLocaleString()}`
                        : `${data.statistics.numberVoters.toLocaleString()} / ${data.statistics.numberVotersTotal.toLocaleString()}`
                      : "Loading..."}
                  </h3>
                </div>
                <div className="event__sub_section">
                  <label>Credits Used</label>
                  <h3>
                    {!loading && data
                      ? data.event.link_mode === LINK_MODES.PUBLIC
                        ? `${data.statistics.numberVotes.toLocaleString()}`
                        : `${data.statistics.numberVotes.toLocaleString()} / ${data.statistics.numberVotesTotal.toLocaleString()}`
                      : "Loading..."}
                  </h3>
                </div>
              </>
              ) : (
                <p>Event Statistics will appear here when the event has concluded</p>
              )}
          </div>
        ) : null}
      </div>

      {/* Global styling */}
      <style jsx global>{`
        .create__settings_section > input,
        .create__settings_datetime > input {
          width: calc(100% - 10px);
          font-size: 26px !important;
          border-radius: 5px;
          border: 1px solid #f1f2e5;
          margin-top: 15px;
          padding: 5px 0px 5px 5px;
        }]
      `}</style>

      {/* Scoped styles */}
      <style jsx>{`
        .event {
          max-width: 700px;
          padding: 40px 20px 75px 20px;
          margin: 0px auto;
        }

        .event > h1 {
          font-size: 40px;
          color: #000;
          margin: 0px;
        }

        .event__information {
          border: 1px solid #f1f2e5;
          padding: 10px;
          border-radius: 10px;
          margin: 20px 0px;
        }

        .event__error {
          background-color: #fff5d0;
          border: 1px solid #fada5e;
          border-radius: 10px;
          padding: 16px 20px;
          margin: 20px 0px;
          color: #000;
          text-align: left;
        }
        .event__error > h2 {
          margin-block-start: 0px;
          font-size: 22px;
        }
        .event__error_hint {
          color: #80806b;
          font-size: 14px;
          margin-block-end: 0px;
        }

        .event__information > h2 {
          color: #000;
          font-size: 22px;
          margin-block-end: 0px;
        }

        .event__information > p {
          font-size: 18px;
          line-height: 150%;
          color: #80806b;
          margin-block-start: 0px;
          display: block;
          word-wrap: break-word;
        }

        .event__section {
          background-color: #fff;
          background-color: #fff;
          border-radius: 8px;
          border: 1px solid #f1f2e5;
          box-shadow: 0 0 35px rgba(127, 150, 174, 0.125);
          padding: 15px;
          width: calc(100% - 30px);
          margin: 25px 0px;
          text-align: left;
        }

        .event__section > label,
        .event__sub_section > label {
          display: block;
          color: #000;
          font-weight: bold;
          font-size: 18px;
          text-transform: uppercase;
        }

        .event__section > p {
          margin: 0px;
        }

        .event__section > input {
          width: calc(100% - 10px);
          max-width: calc(100% - 10px);
          font-size: 18px;
          border-radius: 5px;
          border: 1px solid #f1f2e5;
          margin-top: 15px;
          padding: 8px 5px;
        }

        .event__section_textarea {
          width: calc(100% - 22px);
          margin-top: 15px;
          height: 120px;
          padding: 10px;
          border-radius: 5px;
          border: 1px solid #f1f2e5;
          font-family: "Roboto", sans-serif;
          font-size: 14px;
        }

        .event__sub_section {
          width: calc(50% - 52px);
          display: inline-block;
          margin: 10px;
          padding: 15px;
          border: 1px solid #f1f2e5;
          border-radius: 5px;
          vertical-align: top;
        }

        .event__sub_section > h3 {
          margin: 0px;
        }

        .event__dates {
          display: grid;
          grid-template-columns: 1fr auto;
        }

        .event__dates > button {
          border: none;
          background: none;
          text-decoration: underline;
          cursor: pointer;
        }
        .event__dates > button:hover {
          text-decoration: none;
        }

        .chart {
          margin-top: 20px;
          width: calc(100% - 20px);
          padding: 10px;
          border: 1px solid #f1f2e5;
          border-radius: 5px;
        }

        .loading__chart {
          text-align: center;
          padding: 50px 0px 30px 0px;
        }

        .loading__chart > h3 {
          color: #000;
          font-size: 22px;
          margin-block-start: 10px;
          margin-block-end: 0px;
        }

        .private__label {
        }

        .download__button {
          padding: 12px 0px;
          width: 100%;
          display: inline-block;
          border-radius: 5px;
          background-color: #000;
          color: #edff38;
          font-size: 18px;
          transition: 100ms ease-in-out;
          border: none;
          cursor: pointer;
          margin-top: 15px;
        }

        .download__button:hover {
          opacity: 0.8;
        }

        @media screen and (max-width: 700px) {
          .event__sub_section {
            width: calc(100% - 52px);
          }
        }
      `}</style>
    </Layout>
  );
}

// On initial page load:
Event.getInitialProps = ({ query }) => {
  // Return URL params
  return { query };
};

export default Event;
