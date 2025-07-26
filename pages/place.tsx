import axios from "axios";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Countdown from "react-countdown";

import Layout from "../components/layout";
import Loader from "../components/loader";
import Navigation from "../components/navigation";

export type PlaceProps = {
  query: {
    error?: string;
  };
};

function Place({ query }: PlaceProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.error) {
      throwError();
    }
  }, []);

  /**
   * Gets /api/events/exists to check if voter exists
   */
  const checkVoterExists = () => {
    setLoading(true);

    axios
      .get(`/api/events/exists?id=${code}`)
      .then(() => {
        router.push(`/vote?user=${code}`);
        setLoading(false);
      })
      .catch(() => {
        throwError();
        setLoading(false);
      });
  };

  /**
   * Manages error state if enterred voting code does not exist
   */
  const throwError = () => {
    setError(true);

    setTimeout(() => {
      tryAgain();
    }, 5000);
  };

  /**
   * Restores from error state
   */
  const tryAgain = () => {
    setCode("");
    setError(false);
  };

  /**
   * Renderer for react-countdown
   * @param {integer} seconds remaining in countdown
   */
  const renderer = ({ seconds }: { seconds: number }) => {
    return <span>{seconds}</span>;
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

      <div className="place">
        {!error ? (
          <div className="place__votes">
            <h2>Enter your voting code</h2>
            <p>This should be a long code with multiple characters and dashes.</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="0918cd22-a487-4cd0-8e29-8144b9580b80"
            />
            {!loading ? (
              <button onClick={checkVoterExists}>Submit</button>
            ) : (
              <button disabled>
                <Loader />
              </button>
            )}
          </div>
        ) : (
          // If there is an error, show invalid voting code block
          <div className="place__votes">
            <h2>Invalid voting code</h2>
            <p>Oops! It doesn't look like that voting code exists.</p>
            <button className="retry__button" onClick={tryAgain}>
              Try Again
            </button>
            <span>
              Automatic redirect in <Countdown date={Date.now() + 5000} renderer={renderer} /> seconds
            </span>
          </div>
        )}
      </div>

      <style jsx>{`
        .place__votes {
          display: inline-block;
          max-width: 270px;
          width: 100%;
          background-color: #fff;
          margin: 20px;
          border-radius: 8px;
          border: 1px solid #f1f2e5;
          box-shadow: 0 0 35px rgba(127, 150, 174, 0.125);
          padding: 15px;
          vertical-align: top;
          height: 255px;
          margin-top: calc((100vh - 390px) / 2);
        }

        .place__votes > h2 {
          color: #000;
          margin-block-end: 0px;
        }

        .place__votes > p {
          color: #80806b;
          margin-block-start: 5px;
          margin-block-end: 40px;
          line-height: 150%;
        }

        .place__votes > input {
          width: calc(100% - 10px);
          font-size: 18px;
          border-radius: 5px;
          border: 1px solid #f1f2e5;
          margin-top: 15px;
          padding: 10px 5px;
        }

        .place__votes > button {
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
          margin-top: 10px;
        }

        .place__votes > button:hover {
          opacity: 0.8;
        }

        .place__votes > span {
          color: #80806b;
          font-size: 13px;
          margin-top: 45px;
          display: block;
        }

        .retry__button {
          transform: translateY(37px);
        }
      `}</style>
    </Layout>
  );
}

Place.getInitialProps = ({ query }: PlaceProps) => {
  return { query };
};

export default Place;
