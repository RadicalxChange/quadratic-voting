import axios from "axios";
import moment from "moment";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import Loader from "../components/loader";
import Layout from "../components/layout";
import Navigation from "../components/navigation";
import RemainingCredits from "../components/credits";
import ProposalBlocks from "../components/proposalBlocks";

import { UserCreateRequest } from "./api/users/create";
import { EventFindResponseData } from "./api/events/find";
import { EventVoteRequest } from "./api/events/vote";

function linkify(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  text.replace(urlRegex, (url: string, _, offset: number) => {
    if (lastIndex < offset) {
      parts.push(text.slice(lastIndex, offset));
    }

    parts.push(
      <a key={offset} href={url} target="_blank" rel="noopener noreferrer">
        {url}
      </a>,
    );

    lastIndex = offset + url.length;

    return "";
  });

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export type VoteProps = {
  query: {
    user_id?: number;
    event_id: number;
  };
};

function Vote({ query }: VoteProps) {
  const router = useRouter();
  const [data, setData] = useState<EventFindResponseData>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [descriptionsVisible, setDescriptionsVisible] = useState([] as number[]);

  const pointsSquared = useMemo(
    () => data.items.map(({ points }) => Math.pow(points, 2)).reduce((sum, x) => sum + x, 0),
    [data],
  );

  const pointsRemaining = useMemo(() => {
    return data.credits_per_voter - pointsSquared;
  }, [data, pointsSquared]);

  const submitNewUser = async () => {
    setSubmitLoading(true);

    const newUser = await axios.post<{}, { id: number }, UserCreateRequest["body"]>("/api/users/create", {
      name: newName,
      event_id: query.event_id,
    });

    setLoading(false);

    window.document.location = `/vote?user_id=${newUser.id}&event_id=${query.event_id}`;

    // router
    //   .push(`/vote?user=${newUser.data.id}`)
    //   .then(() => window.scrollTo(0, 0));
  };

  /**
   * Update votes array with QV weighted vote increment/decrement
   * @param {number} id of item to update
   * @param {boolean} increment true === increment, else decrement
   */
  const makeVote = (id: number, increment: boolean) => {
    setData({
      ...data,
      items: data.items.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          points: item.points + (increment ? 1 : -1),
        };
      }),
    });
  };

  /**
   * componentDidMount
   */
  useEffect(() => {
    // console.log("query.user", query.user);
    if (!query.user_id) {
      if (!query.event_id) router.push("/place?error=true");
      setLoading(false);
    } else
      axios
        .get<EventFindResponseData>(`/api/events/find?user_id=${query.user_id}&event_id=${query.event_id}`)
        .then(({ data }) => {
          if (!data.id) return;
          setData(data);
          setLoading(false);
        })
        .catch(() => {
          // router.push("/place?error=true");
        });
  }, []);

  /**
   * Calculate render state of -/+ buttons based on possible actions
   * @param {number} current number of option votes
   * @param {number} delta -/+ button toggle
   */
  const isIncrementVisible = (current: number, delta: number) => {
    const newSquared = Math.pow(current + delta, 2);
    const canOccur = Math.abs(Math.pow(current, 2) - newSquared) <= pointsRemaining;

    if (current === 0 && pointsRemaining === 0) {
      return false;
    }

    if (delta > 0) {
      return current <= 0 || canOccur;
    } else {
      if (data.event_title === "Wish List Poll") {
        return (current >= 0 || canOccur) && current !== 0;
      } else {
        return current >= 0 || canOccur;
      }
    }
  };

  /**
   * Vote submission POST
   */
  const submitVotes = async () => {
    setSubmitLoading(true);

    const { user_id } = query;
    const { status } = await axios.post<EventVoteRequest["body"]>("/api/events/vote", {
      id: user_id,
      votes: data.items.reduce(
        (pointsMap, item) => ({
          ...pointsMap,
          [item.id]: item.points,
        }),
        {} as Record<string, number>,
      ),
    });

    const queryString = `event=${data.id}&user=${user_id}`;
    if (status === 200) {
      router.push(`success?${queryString}`);
    } else {
      router.push(`failure?${queryString}`);
    }

    setSubmitLoading(false);
  };

  /**
   * Toggle show/hide description
   * @param {number} eventId identifying the option the user clicked on
   */
  const toggleDescription = (eventId: number) => {
    if (descriptionsVisible.includes(eventId)) {
      setDescriptionsVisible(descriptionsVisible.filter((id) => id !== eventId));
    } else {
      setDescriptionsVisible([...descriptionsVisible, eventId]);
    }
  };

  return (
    <Layout>
      <Navigation
        history={{
          title: "Home",
          link: "/",
        }}
        title="Place Votes"
      />

      <div className="vote">
        {!loading && !!data?.voter.voter_name ? (
          <>
            <aside id="table-of-contents_container">
              <div className="toc-header">
                <h3>Jump to an Option</h3>
              </div>
              <div id="table-of-contents">
                {(data?.items || []).map((option, i) => {
                  return (
                    <div key={i} className="toc-item">
                      <a href={"#" + i}>{option.name}</a>
                    </div>
                  );
                })}
              </div>
            </aside>
            <aside id="budget-container">
              <RemainingCredits creditBalance={data.credits_per_voter} creditsRemaining={pointsRemaining} />
              {data ? (
                <>
                  {moment() > moment(data.end_event_date) ? (
                    <></>
                  ) : (
                    <>
                      {submitLoading ? (
                        <button className="submit__button" disabled>
                          <Loader />
                        </button>
                      ) : (
                        <button name="input-element" onClick={submitVotes} className="submit__button">
                          Submit Votes
                        </button>
                      )}
                    </>
                  )}
                </>
              ) : null}
            </aside>
            <div className="ballot_container">
              <div className="vote__info">
                {/* General voting header */}
                <div className="vote__info_heading">
                  <h1>Place your votes</h1>
                  <p>
                    You can use up to <strong>{data.credits_per_voter} credits</strong> to vote during this event.
                  </p>
                </div>

                {/* Project name and description */}
                <div className="event__details">
                  <div className="vote__loading event__summary">
                    <h2>{data.event_title}</h2>
                    <p>{data.event_description}</p>
                    {data ? (
                      <>
                        {moment() > moment(data.end_event_date) ? (
                          <>
                            <h3>This event has concluded. Click below to to see the results!</h3>
                            {/* Redirect to event dashboard */}
                            <Link href={`/event?id=${data.id}`}>See event dashboard</Link>
                          </>
                        ) : (
                          <>
                            {moment() < moment(data.start_event_date) ? (
                              <h3>
                                This event begins {moment(data.start_event_date).format("MMMM Do YYYY, h:mm:ss a")}
                              </h3>
                            ) : (
                              <h3>This event closes {moment(data.end_event_date).format("MMMM Do YYYY, h:mm:ss a")}</h3>
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
                    {moment() < moment(data.start_event_date) ? (
                      <></>
                    ) : (
                      <>
                        {/* Voteable options */}
                        <div className="event__options">
                          <h2>Voteable Options</h2>
                          <div className="divider" />
                          <div className="event__options_list">
                            {data.items.map((item, i) => {
                              const showDescription = descriptionsVisible.includes(item.id);
                              return (
                                <div key={i} id={`${i}`} className="event__option_item">
                                  <div>
                                    <button className="title-container" onClick={() => toggleDescription(i)}>
                                      <label>Title</label>
                                      <h3>{item.name}</h3>
                                      {showDescription ? (
                                        <img id={`toggle-button-${i}`} src="/vectors/down_arrow.svg" alt="down arrow" />
                                      ) : (
                                        <img id={`toggle-button-${i}`} src="/vectors/up_arrow.svg" alt="up arrow" />
                                      )}
                                    </button>
                                    {item.description !== "" && showDescription ? (
                                      <div id={`description-container-${i}`}>
                                        <label>Description</label>
                                        <p className="event__option_item_desc">{linkify(item.description)}</p>
                                      </div>
                                    ) : null}
                                    {item.url !== "" && showDescription ? (
                                      <div id={`link-container-${i}`}>
                                        <label>Link</label>
                                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                                          {item.url}
                                        </a>
                                      </div>
                                    ) : null}
                                  </div>
                                  {item.points !== 0 ? <ProposalBlocks cost={Math.pow(item.points, 2)} /> : null}
                                  <div className="event__option_item_vote">
                                    <label>Votes</label>
                                    <input type="number" value={item.points} disabled />
                                    <div className="item__vote_buttons">
                                      {data ? (
                                        <>
                                          {moment() > moment(data.end_event_date) ? (
                                            <></>
                                          ) : (
                                            <>
                                              {/* Toggleable button states based on remaining credits */}
                                              {isIncrementVisible(item.points, -1) ? (
                                                <button name="input-element" onClick={() => makeVote(i, false)}>
                                                  -
                                                </button>
                                              ) : (
                                                <button className="button__disabled" disabled>
                                                  -
                                                </button>
                                              )}
                                              {isIncrementVisible(item.points, 1) ? (
                                                <button name="input-element" onClick={() => makeVote(i, true)}>
                                                  +
                                                </button>
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
                                    {/*data.voter_name !== "" && data.voter_name !== null ? (
                                <div className="existing__votes">
                                  <span>
                                    You last allocated{" "}
                                    <strong>{data.vote_data[i].votes} votes </strong>
                                    to this option.
                                  </span>
                                </div>
                              ) : null*/}
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
        ) : (
          <div className="ballot_container">
            <div className="vote__create_user_section">
              <div className="vote__create_user">
                <label htmlFor="user_name">User Name</label>
                <br />
                <input
                  type="text"
                  id="user_name"
                  placeholder="Enter a username or email"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <br />
                <br />
                {newName.length >= 3 ? (
                  <button className="vote__create_user_button submit__button" onClick={submitNewUser}>
                    {submitLoading ? <Loader /> : "Begin Voting"}
                  </button>
                ) : (
                  <button className="vote__create_user_disabled button__disabled" disabled>
                    Begin Voting
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        button {
          touch-action: manipulation;
        }
        .vote {
          text-align: center;
        }

        .vote__create_user_section {
          background-color: #fff;
          background-color: #fff;
          border-radius: 8px;
          border: 1px solid #f1f2e5;
          box-shadow: 0 0 35px rgba(127, 150, 174, 0.125);
          padding: 15px;
          width: calc(70%);
          min-width: 320px;
          margin: 25px auto;
        }
        .vote__create_user_section label {
          display: block;
          color: #000;
          font-weight: bold;
          font-size: 18px;
          text-transform: uppercase;
        }
        .vote__create_user_section input {
          width: calc(100% - 10px);
          font-size: 26px !important;
          border-radius: 5px;
          border: 1px solid #f1f2e5;
          margin-top: 15px;
          padding: 5px 0px 5px 5px;
          text-align: center;
        }

        .vote__create_user_section button {
          margin-top: 12px;
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
      `}</style>
    </Layout>
  );
}

Vote.getInitialProps = ({ query }) => {
  return { query };
};

export default Vote;
