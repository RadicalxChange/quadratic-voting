import Link from "next/link";

import Layout from "../components/layout";
import Navigation from "../components/navigation";

export type SuccessProps = {
  query: {
    user: string;
    event: string;
  };
};

function Success({ query }: SuccessProps) {
  return (
    <Layout>
      <Navigation
        history={{
          title: "Voting",
          link: `/vote?user=${query.user}`,
        }}
        title="Vote Success"
      />

      <div className="success">
        <h1>Your vote is in!</h1>
        <p>You have successfully placed your votes.</p>

        <Link href={`/vote?user=${query.user}`}>Change your votes</Link>

        <Link href={`/event?id=${query.event}`}>See event dashboard</Link>
      </div>

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

Success.getInitialProps = ({ query }) => {
  return { query };
};

export default Success;
