import Link from "next/link"; // Dynamic links
import Layout from "components/layout"; // Layout wrapper
import Navigation from "components/navigation"; // Navigation component

function Success({ query }) {
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
        <h1>Your vote is in!</h1>
        <p>You have successfully placed your votes.</p>

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
