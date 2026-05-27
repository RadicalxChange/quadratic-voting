<h1 align="center" style="border-bottom: none;">Quadratic Voting (<a href="https://quadraticvote.radicalxchange.org/">live</a>)</h1>
<h3 align="center">Open-source QV tool</h3>

## Architecture

This application is built atop

1. Front-end: [NextJS](https://nextjs.org/) (React)
2. Back-end: [NodeJS](https://nodejs.org/en/) + [Express](https://expressjs.com/) serverless functions
3. Database: [PostgreSQL](https://www.postgresql.org/) + the [Prisma](https://www.prisma.io/) DB toolkit

At a fundamental level, the way in which voting links are generated and sessions are handled is kept simple:

1. An `events` table keeps track of open voting events. Each event has a `secret_key (uuid)` to manage the event.
2. A `voters` table keeps track of all voters and their preferences. Each voter has a `id (uuid)` that together with the `event_uuid (uuid)` represents their unique voting URL.

Important files:

1. [prisma/schema.sql](https://github.com/RadicalxChange/quadratic-voting/blob/master/prisma/schema.sql) contains the SQL schema for the application.
2. [pages/api/events/details.js](https://github.com/RadicalxChange/quadratic-voting/blob/master/pages/api/events/details.js) contains the QV calculation logic.

## Voter privacy

Each event has a `privacy_mode` chosen at creation time:

- **Anonymous** (default) — voter names and per-voter vote data are never
  returned to the event organizer. The organizer sees only aggregate
  totals in the downloaded report. This matches the behavior of every
  event created before `privacy_mode` was introduced; existing events
  are migrated to `anonymous` explicitly.
- **Identified** — voters are required to enter a name on the ballot
  page, and the name is stored alongside their allocation. Names are
  trimmed and internal whitespace is collapsed before storage; case is
  preserved exactly as the voter typed it.

The downloaded XLSX report differs by mode:

- **Anonymous** — one sheet (`data`) with one row per option containing
  the aggregate QV-weighted total. Byte-identical to what the report
  contained before `privacy_mode` existed.
- **Identified** — the same `data` sheet, plus a second sheet named
  `Voters` with one row per voter. Columns: voter name, one column per
  option in the order they were created (matching the ballot), and a
  final `Credits used` column with the total credits (Σ votes²) the
  voter spent. Rows are sorted alphabetically by name (case-insensitive
  sort, display case preserved).

Once any voter casts a vote, the event's `privacy_mode` is locked. The
API rejects mode-change requests after the first non-zero allocation is
submitted, so voters can't have the privacy contract changed underneath
them mid-event.

Existing events created before this feature shipped display as
**Anonymous** on their settings page and cannot be switched.

## Voter access

Independently of `privacy_mode`, each event chooses a `link_mode` that
determines how voters reach the ballot:

- **Per-voter link** (`unique`, default) — the organizer pre-allocates
  `num_voters` ballot rows at event creation, each with its own personal
  URL. Each link can submit one ballot. Suitable for known voter rosters
  where one-person-one-vote matters. This matches the behavior of every
  event created before `link_mode` was introduced; existing events are
  migrated to `unique` explicitly.
- **Public link** (`public`) — a single URL anyone can visit at
  `/vote?event=<event_uuid>`. No voter rows are pre-allocated; each
  submission creates its own row at vote time.

> Public mode is intentionally low-trust. The same person can submit
> multiple times by reloading the page or sharing the link further.
> Suitable for demos, workshops, and classroom polls — not for
> consequential votes.

All four (`privacy_mode` × `link_mode`) combinations are supported and
behave independently. The two axes are locked separately once the first
vote is cast — the API returns 409 if either is changed after voting
begins.

## Run locally

1. Setup your PostgreSQL database

```
# Import schema
psql -f prisma/schema.sql
```

2. Setup environment variables. Copy [prisma/.env.sample](https://github.com/RadicalxChange/quadratic-voting/blob/master/prisma/.env.sample) to `prisma/.env` and replace `DATABASE_URL` with your PostgreSQL DB url.

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
