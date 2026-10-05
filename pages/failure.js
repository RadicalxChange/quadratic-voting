import Link from "next/link"; // Dynamic links
import { useEffect } from "react"; // Side effects
import Layout from "components/layout"; // Layout wrapper
import Navigation from "components/navigation"; // Navigation component
import { getLang, t, translateServerMessage } from "lib/i18n";

function Failure({ query }) {
  const lang = getLang(query);
  const langParam = lang === "es" ? "&lang=es" : "";

  // Match <html lang> to the page language for screen readers.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <Layout>
      {/* Navigation header */}
      <Navigation
        history={{
          title: t(lang, "nav_voting"),
          link: `/vote?user=${query.user}${langParam}`,
        }}
        returnPrefix={t(lang, "nav_return_prefix")}
        title={t(lang, "nav_vote_failure")}
      />

      {/* Failure dialog */}
      <div className="failure">
        <h1>{t(lang, "vote_failed")}</h1>
        {query.reason ? (
          // ?reason= carries the server's English message; translate the
          // known ones client-side, fall through for anything unknown.
          <p className="failure__reason">
            {translateServerMessage(lang, query.reason)}
          </p>
        ) : (
          <p>{t(lang, "vote_failed_generic")}</p>
        )}

        {/* Return to voting — per-voter links only. Public visits have no
            voter id to round-trip; they go back to the public ballot URL. */}
        {query.user ? (
          <Link href={`/vote?user=${query.user}${langParam}`}>
            <a>{t(lang, "try_again")}</a>
          </Link>
        ) : query.event ? (
          <Link href={`/vote?event=${query.event}${langParam}`}>
            <a>{t(lang, "try_again")}</a>
          </Link>
        ) : null}

        {/* Redirect to event dashboard */}
        <Link href={`/event?id=${query.event}`}>
          <a>{t(lang, "see_dashboard")}</a>
        </Link>
      </div>

      {/* Scoped styling */}
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

        .failure__reason {
          background-color: #fff5d0;
          border: 1px solid #fada5e;
          border-radius: 6px;
          padding: 10px 14px;
          color: #000 !important;
          font-size: 16px !important;
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

// On initial page load:
Failure.getInitialProps = ({ query }) => {
  // Collect URL params
  return { query };
};

export default Failure;
