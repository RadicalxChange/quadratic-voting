import axios from "axios"; // Axios for requests
import moment from "moment"; // Moment date parsing
import Link from "next/link"; // Dynamic links
import Loader from "components/loader"; // Placeholder loader
import Layout from "components/layout"; // Layout wrapper
import { useRouter } from "next/router"; // Router for URL params
import { useState, useEffect } from "react"; // State management
import Navigation from "components/navigation"; // Navigation component
import RemainingCredits from "components/credits";
import ProposalBlocks from "components/proposalBlocks";

function Vote({ query }) {
  const router = useRouter(); // Hook into router
  const [data, setData] = useState(null); // Data retrieved from DB
  const [loading, setLoading] = useState(true); // Global loading state
  const [name, setName] = useState(""); // Voter name
  const [votes, setVotes] = useState(null); // Option votes array
  const [credits, setCredits] = useState(0); // Total available credits
  const [submitLoading, setSubmitLoading] = useState(false); // Component (button) submission loading state

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
   * componentDidMount
   */
  useEffect(() => {
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
      return (current >= 0 ? true : canOccur) && (current !== 0);
    }
  };

  /**
   * Vote submission POST
   */
  const submitVotes = async () => {
    // Toggle button loading state to true
    setSubmitLoading(true);

    // POST data and collect status
    const { status } = await axios.post("/api/events/vote", {
      id: query.user, // Voter ID
      votes: votes, // Vote data
      name: name, // Voter name
    });

    // If POST is a success
    if (status === 200) {
      // Redirect to success page
      router.push(`success?event=${data.event_id}&user=${query.user}`);
    } else {
      // Else, redirec to failure page
      router.push(`failure?event=${data.event_id}&user=${query.user}`);
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
      toggleButton.src = "/vectors/side_arrow.svg";
      toggleButton.alt = "side arrow";
    } else {
      toggleButton.src = "/vectors/down_arrow.svg";
      toggleButton.alt = "down arrow";
    }
    if (description) {
      if (description.style.display !== "block") {
        description.style.display = "block";
      } else {
        description.style.display = "none";
      }
    }
    if (link) {
      if (link.style.display !== "block") {
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
          title: "Home",
          link: "/",
        }}
        title="Participate"
      />

      <div className="vote">
        {/* Loading state check */}
        {!loading ? (
          <>
          <div className="vote__info">
            {/* General voting header */}
            <div className="vote__info_heading">
              <h1>Participate</h1>
              <p>
                You can use up to{" "}
                <strong>{data.event_data.credits_per_voter} credits</strong> to
                express your preferences during this event.
              </p>
            </div>

            {/* Project name and description */}
            <div className="event__details">
              <div className="vote__loading event__summary">
                <h2>{data.event_data.event_title}</h2>
                <div id="event__long_description">
                  <p>Welcome to the 2022 Appropriations Prioritization Poll.</p>

                  <p>Each member has 100 credits that they can use to place “support clicks” on bills or Long Bill amendments. “Support clicks” are a way to convey which bills have more impassioned support.</p>

                  <p>Placing one support click on a bill costs one credit. Placing two support clicks costs four credits. Placing three support clicks costs nine credits. This means you may place multiple support clicks on a single bill, but doing so means you quickly deplete your budget of credits to show support for other bills. The outcome of this poll will be used to prioritize bills through the Appropriations committee, spending down the General Fund legislative set aside, as well as utilized by the Long Bill conference committee.</p>

                  <p>Click the dropdown button to the right of each bill title to display the full information. To see the full list, see the [link].</p>
                </div>
                {data ? (
                  <>
                  {(moment() > moment(data.event_data.end_event_date)) ? (
                    <h3>This event has concluded.</h3>
                  ) : (
                    <>
                    {(moment() < moment(data.event_data.start_event_date)) ? (
                      <h3>This event begins {moment(data.event_data.start_event_date).format('MMMM Do YYYY, h:mm:ss a')}</h3>
                    ) : (
                      <h3>This event closes {moment(data.event_data.end_event_date).format('MMMM Do YYYY, h:mm:ss a')}</h3>
                    )}
                    </>
                  )}
                  </>
                ) : null}
              </div>
            </div>

            {/* Ballot */}
            {data ? (
              <>
              {/* Hide ballot if event hasn't started yet */}
              {(moment() < moment(data.event_data.start_event_date)) ? (
                <></>
              ) : (
                <>
                {/*
                <div className="event__options">
                  <h2>General Information</h2>
                  <div className="divider" />
                  <div className="event__option_item">
                    <div>
                      <label>Voter Name</label>
                      {data ? (
                        <>
                        {(moment() > moment(data.event_data.end_event_date)) ? (
                          <input
                            disabled
                            type="text"
                            placeholder="Jane Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                          />
                        ) : (
                          <>
                          <p>Please enter your full name:</p>
                          <input
                            type="text"
                            placeholder="Jane Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                          />
                          </>
                        )}
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
                */}
                <div className="button-container">
                  <RemainingCredits
                    creditBalance={data.event_data.credits_per_voter}
                    creditsRemaining={credits}
                  />
                </div>

                {/* Voteable options */}
                <div className="event__options">
                  <h2>Options</h2>
                  <div className="divider" />
                  <div className="event__options_list">
                    {data.vote_data.map((option, i) => {
                      // Loop through each voteable option
                      return (
                        <div key={i} className="event__option_item">
                          <div>
                            <button className="title-container" onClick={() => toggleDescription(i)}>
                              <label>Title</label>
                              <h3>{option.title}</h3>
                                <img id={`toggle-button-${i}`} className="toggle-button" src="/vectors/side_arrow.svg" alt="side arrow" />
                            </button>
                            {option.description !== "" ? (
                              // If description exists, show description
                              <div id={`description-container-${i}`} className="description-container">
                                <label>Description</label>
                                <p className="event__option_item_desc">{option.description}</p>
                              </div>
                            ) : null}
                            {option.url !== "" ? (
                              // If URL exists, show URL
                              <div id={`link-container-${i}`} className="link-container">
                                <label>Link</label>
                                <a
                                  href={option.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {option.url}
                                </a>
                              </div>
                            ) : null}
                          </div>
                          <ProposalBlocks
                            cost={Math.pow(votes[i], 2)}
                          />
                          <div className="event__option_item_vote">
                            <label>Support Clicks</label>
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
                                  You last allocated{" "}
                                  <strong>{data.vote_data[i].votes} votes </strong>
                                  to this option.
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {data ? (
                  <>
                  {(moment() > moment(data.event_data.end_event_date)) ? (
                    <></>
                  ) : (
                    <>
                      {/*
                      {name !== "" ? (
                        // Check for name being filled
                        */}
                        {submitLoading ? (
                          // Check for existing button loading state
                          <button className="submit__button" disabled>
                            <Loader />
                          </button>
                        ) : (
                          // Else, enable submission
                          <button name="input-element" onClick={submitVotes} className="submit__button">
                            Submit
                          </button>
                        )}
                        {/*
                      ) : (
                        // If name isn't filled, request fulfillment
                        <button className="submit__button button__disabled" disabled>
                          Enter your name to submit
                        </button>
                      )}
                      */}
                    </>
                  )}
                  </>
                ) : null}
                </>
              )}
              </>
            ) : null}
          </div>
          </>
        ) : (
          // If loading, show global loading state
          <div className="vote__loading">
            <h1>Loading...</h1>
            <p>Please give us a moment to retrieve your voting profile.</p>
          </div>
        )}
      </div>

      {/* Component scoped CSS */}
      <style jsx>{`
        .vote {
          text-align: center;
        }

        .vote__info {
          max-width: 660px;
          width: calc(100% - 40px);
          margin: 50px 0px;
          padding: 0px 20px;
          display: inline-block;
          position: relative;
        }

        .button-container {
          padding: 1vw 2vw;
          position: -webkit-sticky;
          position: sticky;
          top: 0;
          left: 0;
          z-index: 1;
          background: white;
        }

        @media only screen and (min-width: 768px) {
          .vote {
            display: grid;
            grid-template-columns: auto 20vw;
          }

          .vote__info {
            grid-column: 1;
            margin: 50px 0 50px auto;
          }

          .button-container {
            grid-column: 2;
            position: fixed;
            background: none;
            padding: auto auto;
            top: auto;
            right: 0;
            bottom: 5vh;
            left: auto;
            z-index: auto;
          }
        }

        @media only screen and (min-width: 1150px) {
          .vote {
            display: block;
          }

          .vote__info {
            margin: 50px auto;
          }
        }

        .event__summary {
          display: inline-block;
          box-shadow: 0 0 35px rgba(127, 150, 174, 0.125);
          background-color: #fff;
          margin: 20px 0px !important;
          padding-left: 20px !important;
          padding-right: 20px !important;
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
          width: 100%;
          border-radius: 10px;
          display: inline-block;
          margin: 50px 20px 0px 20px;
          border: 1px solid #f1f2e5;
          padding: 30px 0px;
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
        .toggle-button {
          height: 14px;
          width: 14px;
        }
        .description-container {
          display: none;
        }
        .link-container {
          display: none;
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
          margin-top: 50px;
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

        #event__long_description {
          text-align: left;
          font-size: 18px;
          line-height: 150%;
          color: #80806b;
        }
        #event__long_description > p {
          margin-bottom: 20px;
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
