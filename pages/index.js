import Link from "next/link"; // Dynamic links
import Layout from "components/layout"; // Layout wrapper

export default function Home() {
  return (
    // Home page
    <Layout>
      <div className="home">
        {/* Home heading */}
        <div className="home__content">
          <h1>RxC QV</h1>
          <h2> Uma ferramenta fácil para hospedar uma votação quadrática. </h2>
          <p>
            A votação quadrática é a maneira matematicamente ideal de votar em uma comunidade democrática. 
            Vote por meio de tomada de decisão coletiva, alocando votos que expressem o <i> grau </i> 
            de suas preferências, não apenas <i> direção </i>
          </p>
          <h2> Organize um evento de votação quadrática abaixo! </h2>
        </div>

        {/* Home buttons */}
        <div className="home__cta">
          <div className="home__cta_button">
            <img src="/vectors/create_event.svg" alt="Create event" />
            <h2> Crie um evento </h2>
             <p> Configure a votação quadrática para o seu evento.</p>
             <Link href = "/create">
               <a> Configurar evento </a>
             </Link>
          </div>
          <div className="home__cta_button">
            <img src="/vectors/place_vote.svg" alt="Place vote" />
            <h2> Dê o seu voto </h2>
             <p> Use seu código secreto para votar em uma votação quadrática.</p>
             <Link href = "/place">
               <a> Colocar votos </a>
            </Link>
          </div>
        </div>

        {/* Scoped styling */}
        <style jsx>{`
          .home__content {
            max-width: 700px;
            padding: 50px 20px 0px 20px;
            margin: 0px auto;
          }
          .home__content > h1 {
            font-size: 40px;
            color: #000;
            margin: 0px;
          }
          .home__content > h2 {
            color: #000;
            margin-block-start: 0px;
          }
          .home__content > h2:nth-of-type(2) {
            color: #000;
            margin-block-end: 0px;
            margin-block-start: 60px;
          }
          .home__content > p {
            font-size: 18px;
            line-height: 150%;
            color: #80806b;
          }
          .home__cta {
            padding-top: 20px;
          }
          .home__cta_button {
            display: inline-block;
            max-width: 270px;
            width: calc(100% - 70px);
            background-color: #fff;
            margin: 20px;
            border-radius: 16px;
            border: 1px solid #f1f2e5;
            box-shadow: 0 4px 4px rgba(0, 0, 0, 0.125);
            padding: 15px;
            vertical-align: top;
          }
          .home__cta_button > img {
            height: 90px;
            margin-top: 15px;
          }
          .home__cta_button > h2 {
            color: #000;
            margin-block-end: 0px;
          }
          .home__cta_button > p {
            color: #80806b;
            font-size: 15px;
            margin-block-start: 5px;
            margin-block-end: 40px;
          }
          .home__cta_button > a {
            text-decoration: none;
            padding: 12px 0px;
            width: 100%;
            display: inline-block;
            border-radius: 16px;
            background-color: #000;
            color: #edff38;
            font-size: 18px;
            transition: 50ms ease-in-out;
          }
          .home__cta_button > a:hover {
            opacity: 0.8;
          }
        `}</style>
      </div>
    </Layout>
  );
}
