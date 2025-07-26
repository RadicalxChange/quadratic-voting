import Link from "next/link";

import Layout from "../components/layout";
import Navigation from "../components/navigation";

export type FailureProps = {
  query: {
    user: string;
    event: string;
  };
};

function Failure({ query }: FailureProps) {
  return (
    <Layout>
      <Navigation
        history={{
          title: "Voting",
          link: `/vote?user=${query.user}`,
        }}
        title="Vote Failure"
      />

      <div className="failure">
        <h1>Oops! Your vote failed.</h1>
        <p>This shouldn't happen—please try again later!</p>

        <Link href={`/vote?user=${query.user}`}>Try voting again</Link>

        <Link href={`/event?id=${query.event}`}>See event dashboard</Link>
      </div>

      <style jsx>{`
        .failure {
          max-width: 700px;
          width: calc(100% - 40px);
          padding: 50px 20px 0px 20px;
          margin: 0px auto;
        }

        .failure > h1 {
          font-size: 40px;
          color: #000;
          margin: 0px;
        }

        .failure > p {
          font-size: 18px;
          line-height: 150%;
          color: #80806b;
          margin-block-start: 0px;
        }

        .failure > a {
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

        .failure > a:hover {
          opacity: 0.8;
        }

        .failure > a:nth-of-type(1) {
          background-color: #edff38;
          color: #000;
        }

        .failure > a:nth-of-type(2) {
          background-color: #000;
          color: #edff38;
        }
      `}</style>
    </Layout>
  );
}

Failure.getInitialProps = ({ query }) => {
  return { query };
};

export default Failure;
