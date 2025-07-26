<h1 align="center" style="border-bottom: none;">Quadratic Voting (<a href="https://quadraticvote.radicalxchange.org/">live</a>)</h1>
<h3 align="center">Open-source QV tool</h3>

## Architecture

This application is built atop

1. Front-end: [NextJS](https://nextjs.org/) (React)
2. Back-end: [NodeJS](https://nodejs.org/en/) + [Express](https://expressjs.com/) serverless functions
3. Database: [SQLite](https://www.sqlite.org/) + the [Prisma](https://www.prisma.io/) DB toolkit

At a fundamental level, the way in which voting links are generated and sessions are handled is kept simple:

1. An `events` table keeps track of open voting events. Each event has a `secret_key (uuid)` to manage the event.
2. A `voters` table keeps track of all voters and their preferences. Each voter has a `id (uuid)` that together with the `event_uuid (uuid)` represents their unique voting URL.

Important files:

1. [prisma/schema.sql](https://github.com/RadicalxChange/quadratic-voting/blob/master/prisma/schema.sql) contains the SQL schema for the application.
2. [pages/api/events/details.js](https://github.com/RadicalxChange/quadratic-voting/blob/master/pages/api/events/details.js) contains the QV calculation logic.

## Run locally

1. Copy environment variables

```bash
cp prisma/.env.sample prisma/.env
```

2. (Optional) Update `prisma/.env` if you wish to change the default SQLite file path.

3. Run application

```
# Install dependencies
yarn

# Run application
yarn dev
```

## Run in Docker container

```
# Build container
docker build . -t rxc_qv

# Run
docker run -d --env DATABASE_URL=postgresql://__USER__:__PASSWORD__@__HOST__/__DATABASE__ -p 2000:2000 rxc_qv
```

## License

[CC BY-NC 2.0](https://github.com/RadicalxChange/quadratic-voting/blob/master/LICENSE)
