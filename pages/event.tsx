import useSWR from "swr";
import moment from "moment";
import Head from "next/head";
import { Bar } from "react-chartjs-2";
import HashLoader from "react-spinners/HashLoader";
import FileSaver from "file-saver";
import * as XLSX from "xlsx";
import Datetime from "react-datetime";
import { useState } from "react";
import axios, { AxiosResponse } from "axios";

import Layout from "../components/layout";
import Navigation from "../components/navigation";

import type { EventDetailsResponseData } from "./api/events/details";
import type { EventUpdateRequest } from "./api/events/update";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type EventProps = {
  query: {
    event_id: string;
    secret?: string;
  };
};

function Event({ query }: EventProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editMode, setEditMode] = useState(false);

  const { data, isLoading, mutate } = useSWR<EventDetailsResponseData>(
    `/api/events/details?id=${query.event_id}${query.secret !== "" ? `&secret_key=${query.secret}` : ""}`,
    {
      fetcher,
      refreshInterval: 5000, // TODO: configurable
    },
  );

  /**
   * Admin view: download voter URLs as text file
   */
  const downloadTXT = () => {
    // Collect voter URLs in single text string
    const text = data.event.voters
      .map((voter, _) => `https://quadraticvote.radicalxchange.org/vote?user=${voter.id}`)
      .join("\n");

    const element = document.createElement("a");
    const file = new Blob([text], { type: "text/plain" });

    // Setup link component to be downloadable and hidden
    element.href = URL.createObjectURL(file);
    element.download = "voter_links.txt";
    element.style.display = "none";

    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  };

  const downloadXLSX = () => {
    const fileType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8";
    const fileExtension = ".xlsx";
    const options = data.chart.labels;
    const descriptions = data.chart.descriptions;
    const effectiveVotes = data.chart.datasets[0].data;
    var rows = [];
    var i: number;
    for (i = 0; i < options.length; i++) {
      var option = {
        title: options[i],
        description: descriptions[i],
        votes: effectiveVotes[i],
      };
      rows.push(option);
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = { Sheets: { data: ws }, SheetNames: ["data"] };
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const fileData = new Blob([excelBuffer], { type: fileType });
    FileSaver.saveAs(fileData, "qv-results" + fileExtension);
  };

  const toggleEditMode = async (start: boolean) => {
    if (start) {
      if (data) {
        setStartDate(`${moment(data.event.start_event_date)}`);
        setEndDate(`${moment(data.event.end_event_date)}`);
        setEditMode(true);
      }
    } else {
      const { status } = await axios.post<string, AxiosResponse, EventUpdateRequest["body"]>("/api/events/update", {
        id: data.event.id,
        start_event_date: startDate,
        end_event_date: endDate,
      });
      if (status === 200) {
        setEditMode(false);
      }
    }
  };

  const horizBarOptions = {
    // scales: {
    //   xAxes: [
    //     {
    //       ticks: { beginAtZero: true },
    //     },
    //   ],
    // },
    indexAxis: "y" as const,
    // elements: {
    //   bar: {
    //     borderWidth: 2,
    //   },
    // },
    // responsive: true,
    // plugins: {
    //   legend: {
    //     position: 'right' as const,
    //   },
    //   title: {
    //     display: true,
    //     text: 'Chart.js Horizontal Bar Chart',
    //   },
    // },
  };

  return (
    <Layout>
      {/* <Head>
        <meta
          property="og:image"
          content={`https://qv-image.vercel.app/api/?id=${query.event_id}`}
        />
        <meta
          property="twitter:image"
          content={`https://qv-image.vercel.app/api/?id=${query.event_id}`}
        />
      </Head> */}

      <Navigation
        history={{
          // If secret is not present, return to home
          title: query.secret && query.secret !== "" ? "event creation" : "home",
          // If secret is present, return to create page
          link: query.secret && query.secret !== "" ? `/create` : "/",
        }}
        title="Event Details"
      />

      <div className="event">
        <h1>Event Details</h1>
        <div className="event__information">
          <h2>{!isLoading && data ? data.event.event_title : "Loading..."}</h2>
          <p>{!isLoading && data ? data.event.event_description : "Loading..."}</p>
          {data ? (
            <>
              {moment() > moment(data.event.end_event_date) ? (
                <h3>This event has concluded. See results below!</h3>
              ) : (
                <>
                  {moment() < moment(data.event.start_event_date) ? (
                    <h3>This event begins {moment(data.event.start_event_date).format("MMMM Do YYYY, h:mm:ss a")}</h3>
                  ) : (
                    <h3>This event closes {moment(data.event.end_event_date).format("MMMM Do YYYY, h:mm:ss a")}</h3>
                  )}
                </>
              )}
            </>
          ) : null}
        </div>

        {!isLoading && data ? (
          editMode ? (
            <div className="event__section">
              <label>Event start date</label>
              <div className="event__dates">
                <Datetime
                  className="create__settings_datetime"
                  value={startDate}
                  onChange={(value) => setStartDate(value as string)}
                />
                <button type="button" onClick={() => toggleEditMode(false)}>
                  save
                </button>
              </div>
            </div>
          ) : (
            <div className="event__section">
              <label>Event start date</label>
              <div className="event__dates">
                <p>{moment(data.event.start_event_date).format("MMMM Do YYYY, h:mm a")}</p>
                {query.secret && query.secret !== "" ? (
                  <button type="button" onClick={() => toggleEditMode(true)}>
                    edit
                  </button>
                ) : null}
              </div>
            </div>
          )
        ) : null}

        {!isLoading && data ? (
          editMode ? (
            <div className="event__section">
              <label>Event end date</label>
              <div className="event__dates">
                <Datetime
                  className="create__settings_datetime"
                  value={endDate}
                  onChange={(value) => setEndDate(value as string)}
                />
                <button type="button" onClick={() => toggleEditMode(false)}>
                  save
                </button>
              </div>
            </div>
          ) : (
            <div className="event__section">
              <label>Event end date</label>
              <div className="event__dates">
                <p>{moment(data.event.end_event_date).format("MMMM Do YYYY, h:mm a")}</p>
                {query.secret && query.secret !== "" ? (
                  <button type="button" onClick={() => toggleEditMode(true)}>
                    edit
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
          <input value={`https://quadraticvote.radicalxchange.org/event?id=${query.event_id}`} readOnly />
        </div>

        {/* Event private URL */}
        {query.event_id !== "" && query.secret !== "" && query.secret !== undefined && !isLoading && data ? (
          <div className="event__section">
            <label className="private__label">Private Admin URL</label>
            <p>Save this URL to manage event and make changes</p>
            <input
              value={`https://quadraticvote.radicalxchange.org/event?id=${query.event_id}&secret=${query.secret}`}
              readOnly
            />
          </div>
        ) : null}

        {/* Event copyable links */}
        {query.event_id !== "" && query.secret !== "" && query.secret !== undefined && !isLoading && data ? (
          <div className="event__section">
            <label className="private__label">Individual voting links</label>
            <p>For private sharing with voters</p>
            <textarea
              className="event__section_textarea"
              // Collect voter urls as one text element
              value={data.event.voters
                .map((voter, _) => `https://quadraticvote.radicalxchange.org/vote?user=${voter.id}`)
                .join("\n")}
              readOnly
            />
            <button onClick={downloadTXT} className="download__button">
              Download as TXT
            </button>
          </div>
        ) : null}

        {/* Event public chart */}
        {query.event_id !== "" && !isLoading && data ? (
          <div className="event__section">
            <label>Event Votes</label>
            {data.chart ? (
              <>
                <p>Quadratic Voting-weighted voting results</p>
                {!isLoading && data ? (
                  <>
                    <div className="chart">
                      <Bar data={data.chart} width={90} height={60} options={horizBarOptions} />
                    </div>
                    <button onClick={downloadXLSX} className="download__button">
                      Download spreadsheet
                    </button>
                  </>
                ) : (
                  <div className="loading__chart">
                    <HashLoader size={50} color="#000" cssOverride={{ display: "inline-block" }} />
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
        {query.event_id !== "" && !isLoading && data ? (
          <div className="event__section">
            <label>Event Statistics</label>
            {data.statistics ? (
              <>
                <div className="event__sub_section">
                  <label>Voting Participants</label>
                  <h3>
                    {!isLoading && data
                      ? `${data.statistics.numberVoters.toLocaleString()} / ${data.statistics.numberVotersTotal.toLocaleString()}`
                      : "Loading..."}
                  </h3>
                </div>
                <div className="event__sub_section">
                  <label>Credits Used</label>
                  <h3>
                    {!isLoading && data
                      ? `${data.statistics.numberVotes.toLocaleString()} / ${data.statistics.numberVotesTotal.toLocaleString()}`
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

Event.getInitialProps = ({ query }: EventProps) => {
  return { query };
};

export default Event;
