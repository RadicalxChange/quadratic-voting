import Link from "next/link";

export type NavigationProps = {
  history: {
    link: string;
    title: string;
  };
  title: string;
};

export default function Navigation(props: NavigationProps) {
  return (
    <div className="navigation">
      <Link href={props.history.link}>⟵ Return to {props.history.title}</Link>
      <span>{props.title}</span>

      <style jsx>{`
        .navigation {
          background-color: #edff38;
          font-size: 18px;
          padding: 10px 20px 0px 20px;
          height: 30px;
        }
        .navigation > a {
          float: left;
          text-decoration: none;
          color: #000;
          border-bottom: 1px solid #0f0857;
          transition: 50ms ease-in-out;
        }
        .navigation > a:hover {
          opacity: 0.8;
        }
        .navigation > span {
          float: right;
          font-weight: bold;
          transform: translateY(-2px);
          color: #000;
        }
      `}</style>
    </div>
  );
}
