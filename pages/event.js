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

// Setup fetcher for SWR
const fetcher = (url) => fetch(url).then((r) => r.json());

function Event({ query }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editMode, setEditMode] = useState(false);

  // Collect data from endpoint
  const { data, loading } = useSWR(
    // Use query ID in URL
    `/api/events/details?id=${query.id}${
      // If secret is present, use administrator view
      query.secret !== "" ? `&secret_key=${query.secret}` : ""
    }`,
    {
      fetcher,
      // Force refresh SWR every 500ms
      refreshInterval: 500,
    }
  );

  /**
   * Admin view: download voter URLs as text file
   */
  const downloadTXT = () => {
    // Collect voter URLs in single text string
    const text = data.event.voters
      .map((voter, _) => `https://demo.qv.radicalxchange.org/vote?user=${voter.id}`)
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
    const fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
    const fileExtension = '.xlsx';
    const options = data.chart.labels
    const effectiveVotes = data.chart.datasets[0].data
    const percentCredits = data.chart.datasets[1].data
    var rows = [];
    var i;
    for (i = 0; i < options.length; i++) {
      var option = {
        title: options[i],
        effective_votes: effectiveVotes[i],
        percent_credits: percentCredits[i],
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
        secret: query.secret,
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
            query.secret && query.secret !== "" ? "criar evento" : "Início",
          // If secret is present, return to create page
          link: query.secret && query.secret !== "" ? `/create` : "/",
        }}
        title="Detalhes do evento"
      />

      {/* Event page summary */}
      <div className="event">
        <h1>Detalhes do evento </h1>
        <div className="event__information">
          <h2>{!loading && data ? data.event.event_title : "Carregando..."}</h2>
          <p>
            {!loading && data ? data.event.event_description : "Carregando..."}
          </p>
          {data ? (
            <>
            {(moment() > moment(data.event.end_event_date)) ? (
              <h3> Este evento foi encerrado. Veja os resultados abaixo! </h3>
            ) : (
              <>
              {(moment() < moment(data.event.start_event_date)) ? (
                <h3>Esse evento começa {moment(data.event.start_event_date).format('MMMM Do YYYY, h:mm a')}</h3>
              ) : (
                <h3>Esse evento encerra {moment(data.event.end_event_date).format('MMMM Do YYYY, h:mm a')}</h3>
              )}
              </>
            )}
            </>
          ) : null}
        </div>

        {/* Event start date selection */}
        {query.id !== "" &&
        query.secret !== "" &&
        query.secret !== undefined &&
        !loading &&
        data ? (
          editMode ? (
            <div className="event__section">
              <label>Data de início do evento</label>
              <div className="event__dates">
                <Datetime
                  className="create__settings_datetime"
                  value={startDate}
                  dateFormat="DD/MM/YYYY"
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
              <label>Data de início do evento</label>
              <div className="event__dates">
                <p>
                  {moment(data.event.start_event_date).format('MMMM Do YYYY, h:mm a')}
                </p>
                {query.secret !== "" &&
                query.secret !== undefined ? (
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
        {query.id !== "" &&
        query.secret !== "" &&
        query.secret !== undefined &&
        !loading &&
        data ? (
          editMode ? (
            <div className="event__section">
              <label>Data de término do evento</label>
              <div className="event__dates">
                <Datetime
                  className="create__settings_datetime"
                  value={endDate}
                  dateFormat="DD/MM/YYYY"
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
              <label>Data de término do evento</label>
              <div className="event__dates">
                <p>
                  {moment(data.event.end_event_date).format('MMMM Do YYYY, h:mm a')}
                </p>
                {query.secret !== "" &&
                query.secret !== undefined ? (
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
          <p>URL do painel de estatísticas</p>
          <input
            value={`https://demo.qv.radicalxchange.org/event?id=${query.id}`}
            readOnly
          />
        </div>

        {/* Event private URL */}
        {query.id !== "" &&
        query.secret !== "" &&
        query.secret !== undefined &&
        !loading &&
        data ? (
          <div className="event__section">
            <label className="private__label">URL de administrador privado</label>
            <p>Salve este URL para gerenciar o evento e fazer alterações</p>
            <input
              value={`https://demo.qv.radicalxchange.org/event?id=${query.id}&secret=${query.secret}`}
              readOnly
            />
          </div>
        ) : null}

        {/* Event copyable links */}
        {query.id !== "" &&
        !loading &&
        data ? (
          <div className="event__section">
            <label className="private__label">Links de votação</label>
            <p>Para compartilhar com os eleitores</p>
            <input
              value={`https://demo.qv.radicalxchange.org/vote?id=${query.id}`}
              readOnly
            />
          </div>
        ) : null}

        {/* Event public chart */}
        {query.id !== "" &&
        !loading &&
        data ? (
          <div className="event__section">
            <label> Votos de evento </label>
            {data.chart ? (
            <>
              <p> Resultados da votação ponderada por votação quadrática </p>
              {!loading && data ? (
                <>
                <div className="chart">
                  <HorizontalBar data={data.chart} width={90} height={60} />
                </div>
                <button onClick={downloadXLSX} className="download__button">
                  Baixar planilha
                </button>
                </>
              ) : (
                <div className="loading__chart">
                  <HashLoader
                    size={50}
                    color="#000"
                    css={{ display: "inline-block" }}
                  />
                  <h3> Carregando gráfico ... </h3>
                  <span> Dê-nos um momento </span>
                </div>
              )}
            </>
            ) : (
              <p> Os resultados da votação aparecerão aqui quando o evento for concluído </p>
            )}
          </div>
        ) : null}


        {/* Event public statistics */}
        {query.id !== "" &&
        !loading &&
        data ? (
          <div className="event__section">
              <label> Estatísticas do evento </label>
              {data.statistics ? (
              <>
                <div className="event__sub_section">
                  <label>Participantes votantes</label>
                  <h3>
                    {!loading && data
                      ? `${data.statistics.numberVoters.toLocaleString()}`
                      : "Loading..."}
                  </h3>
                </div>
                <div className="event__sub_section">
                  <label>Créditos usados</label>
                  <h3>
                    {!loading && data
                      ? `${data.statistics.numberVotes.toLocaleString()}`
                      : "Loading..."}
                  </h3>
                </div>
              </>
              ) : (
                <p>As estatísticas do evento aparecerão aqui quando o evento for concluído</p>
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
