import Link from "next/link"; // Dynamic links
import Layout from "components/layout"; // Layout wrapper
import Navigation from "components/navigation"; // Navigation component

// The one event whose thank-you page carries the post-vote survey and the
// UN Joint Secretariat copy. Every other event on this instance renders the
// stock success page. Remove (or repoint) after the event's results are
// exported.
const SURVEY_EVENT_ID = "5199ccb6-ebdf-4def-b24c-aefc7f146481";

function Success({ query }) {
  const showSurvey = query.event === SURVEY_EVENT_ID;
  // Public-link submitters have no voter id to round-trip — each visit is
  // independent — so "Change your votes" only makes sense for unique-link
  // voters whose row we can resume.
  const hasVoter = !!query.user;
  const backToVote = hasVoter ? `/vote?user=${query.user}` : "/";
  const backToVoteLabel = hasVoter ? "Voting" : "Home";
  return (
    <Layout>
      {/* Navigation header */}
      <Navigation
        history={{
          title: backToVoteLabel,
          link: backToVote,
        }}
        title="Vote Success"
      />

      {/* Success dialog */}
      <div className="success">
        {showSurvey ? (
          <>
            <h1>Thank you — your vote is in.</h1>
            <p>
              Your priorities will go to the UN Joint Secretariat this
              Wednesday, alongside everyone else's.
            </p>
            <p>
              One last thing: a 2-minute optional survey helps us understand
              the results — for example, whether frequent and rare AI users
              prioritized differently. Every question is optional.
            </p>

            {/* Optional post-vote survey. Wrapped in its own container so the
                nth-of-type styling on the navigation links below is
                unaffected. Opens in a new tab so this page isn't lost
                mid-survey. */}
            <div className="survey">
              <a
                href="https://forms.gle/6QYLmyNsdDmGNCTAA"
                target="_blank"
                rel="noopener noreferrer"
              >
                Take the survey
              </a>
            </div>
          </>
        ) : (
          <>
            <h1>Your vote is in!</h1>
            <p>You have successfully placed your votes.</p>
          </>
        )}

        {/* Go back to voting (only for unique-link voters) */}
        {hasVoter ? (
          <Link href={`/vote?user=${query.user}`}>
            <a>Change your votes</a>
          </Link>
        ) : null}

        {/* Redirect to event dashboard */}
        <Link href={`/event?id=${query.event}`}>
          <a>See event dashboard</a>
        </Link>
      </div>

      {/* Scoped styling */}
      <style jsx>{`
        .success {
          max-width: 700px;
          width: calc(100% - 40px);
          padding: 50px 20px 0px 20px;
          margin: 0px auto;
        }

        .success > h1 {
          font-size: 40px;
          color: #000;
          margin: 0px;
        }

        .success > p {
          font-size: 18px;
          line-height: 150%;
          color: #80806b;
          margin-block-start: 0px;
        }

        .success > a {
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
        }

        .success > a:hover {
          opacity: 0.8;
        }

        .survey > a {
          max-width: 200px;
          width: calc(100% - 40px);
          margin: 10px 20px 30px 20px;
          padding: 12px 0px;
          border-radius: 5px;
          text-decoration: none;
          font-size: 18px;
          display: inline-block;
          text-align: center;
          transition: 100ms ease-in-out;
          background-color: #000;
          color: #edff38;
        }

        .survey > a:hover {
          opacity: 0.8;
        }

        .success > a:nth-of-type(1) {
          background-color: #edff38;
          color: #000;
        }

        .success > a:nth-of-type(2) {
          background-color: #000;
          color: #edff38;
        }
      `}</style>
    </Layout>
  );
}

// On initial page load:
Success.getInitialProps = ({ query }) => {
  // Collect url params
  return { query };
};

export default Success;
