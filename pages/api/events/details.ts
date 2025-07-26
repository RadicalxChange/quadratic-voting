import prisma from "../../../db/index";
import moment from "moment";

import { EventModel, EventItemModel, VoteModel, VoterModel } from "../../../prisma/.prisma/client/models";

export type EventDetailsRequest = {
  query: {
    id: number;
    secret_key: string;
  };
  body?: Parameters<typeof prisma.event.create>[0]["data"];
};

export type EventDetailsResponseData = {
  event: Partial<EventModel> & {
    items: Array<EventItemModel>;
    voters?: Array<
      Omit<VoterModel, "voter_name"> & {
        votes: Array<VoteModel>;
      }
    >;
  };
  statistics: ReturnType<typeof generateStatistics>;
  chart: ReturnType<typeof generateChart>;
};

export type EventDetailsResponse = {
  send: (body: EventDetailsResponseData) => EventDetailsResponse;
};

// --> /api/events/details
export default async (req: EventDetailsRequest, res: EventDetailsResponse) => {
  // Collect event ID and secret key (if it exists) from request
  const {
    query: { id, secret_key },
  } = req;

  // Collect event information from event ID
  const eventDataWithSecretKey = await prisma.event.findUnique({
    where: { id },
    include: {
      items: true,
      voters: {
        include: {
          votes: true,
        },
      },
    },
  });

  const isAdmin = secret_key && eventDataWithSecretKey.secret_key === secret_key;

  const { secret_key: discardSecretKey, voters, ...event } = eventDataWithSecretKey;

  var statistics = null;
  var chart = null;

  // If event is concluded or private_key enables administrator access
  if (isAdmin || moment() > moment(event.end_event_date)) {
    // Pass voting statistics to endpoint
    statistics = generateStatistics(event.items, event.credits_per_voter, voters);

    // Generate chart data for chartJS
    chart = generateChart(event.items, statistics.linear, statistics.qv);
  }

  // If private_key enables administrator access
  let anonymizedVoters = [] as EventDetailsResponseData["event"]["voters"];
  if (isAdmin && voters) {
    // remove voter name and vote data to keep anonymous from election admins
    // TODO: revisit (strip ID also?)
    anonymizedVoters = voters.map((voter) => {
      const { voter_name, ...anonymizedVoter } = voter;
      return anonymizedVoter;
    });
  }

  // Return event data, computed statistics, and chart
  res.send({
    event: !isAdmin
      ? event
      : {
          ...event,
          secret_key,
          voters: anonymizedVoters,
        },
    statistics,
    chart,
  });
};

/**
 * Generate QV Statistics and weights
 * @param {EventItemModel[]} eventItems number of subjects
 * @param {number} creditsPerVoter number of credits per voter
 * @param {EventDetailsResponseData['event']['voters']} voters array of voter preferences
 * @return {object} containing QV statistics and calculated weights
 */
function generateStatistics(
  eventItems: EventItemModel[],
  creditsPerVoter: number,
  voters: EventDetailsResponseData["event"]["voters"],
) {
  const qvRaw = {} as Record<number, Array<number>>;

  const squaredPointsByVoter = voters.reduce(
    (map, voter) => ({
      ...map,
      [voter.id]: voter.votes.reduce((sum, { points }) => sum + Math.pow(points, 2), 0),
    }),
    {} as Record<number, number>,
  );
  // const numberVoters = voters.reduce((ct, voter) => ct + (voter.votes.some(({ points }) => points > 0) ? 1 : 0), 0);
  const numberVotes = Object.values(squaredPointsByVoter).reduce((sum, points) => sum + points, 0);
  const numberVoters = Object.values(squaredPointsByVoter).reduce((sum, points) => sum + (points ? 1 : 0), 0);

  for (const eventItem of eventItems) {
    // Collect voter preferences
    const eventPoints = voters.map((voter) => voter.votes.find((v) => v.event_item_id === eventItem.id)?.points ?? 0);

    qvRaw[eventItem.id] = eventPoints.filter((points) => points > 0);
  }

  // Calculate linear weights from raw votes
  const linear = calculateLinear(qvRaw);

  // Calculate QV weights from raw votes
  const qv = calculateQV(qvRaw);

  // Return computed statistics
  return {
    numberVotersTotal: voters.length,
    numberVoters,
    numberVotesTotal: creditsPerVoter * voters.length,
    numberVotes,
    voterParticiptation: (voters.length / numberVoters) * 100,
    qvRaw,
    linear,
    qv,
  };
}

/**
 * Calculates and returnes subject weights based on linear addition
 * @param {object} qvRaw
 * @returns {integer[]} containing linear weights
 */
function calculateLinear(qvRaw: Record<number, number[]>): number[] {
  let mapped = [],
    sumWeights = 0;

  for (const [eventItemId, subjectVotes] of Object.entries(qvRaw)) {
    // Calculate sum of votes
    const numCredits = subjectVotes.map((item) => Math.pow(item, 2));
    const subjectSum = numCredits.reduce((a, b) => a + b, 0);

    // Add sum of votes to sumWeights
    sumWeights += subjectSum;

    // Push linear sum to mapped
    mapped.push(subjectSum);
  }

  let weights = []; // Final weights array

  // For each sum vote in mapped
  for (const sumVotes of mapped) {
    // Divide by total summed # of votes to calculate weight
    weights.push(sumVotes / sumWeights);
  }

  // Return linear weights
  return weights;
}

/**
 * Calculates and returns QV summed votes
 * @param {object} qvRaw
 * @returns {integer[]} containing QV votes
 */
function calculateQV(qvRaw: Record<number, number[]>): number[] {
  let votes = [];

  // For individual subjects in qvRaw
  for (const [eventItemId, subjectVotes] of Object.entries(qvRaw)) {
    // Push subject weights to mapped array which contains summed votes
    votes.push(subjectVotes.reduce((a, b) => a + b, 0));
  }

  // Return votes array
  return votes;
}

/**
 * Returns chartJS chart data
 * @param {subjects[]} subjects voteable subjects
 * @param {integer[]} linearWeights linear subject weights
 * @param {integer[]} weights qv subject weights
 */
function generateChart(subjects: EventItemModel[], linearWeights: number[], weights: number[]) {
  type SubjectData = {
    label: string;
    description: string;
    linearData: string;
    data: number;
  };

  let labels = []; // Placeholder labels
  let descriptions = [] as string[];
  // let linearData = [] as string[]; // Placeholder series linear weight array
  let data = [] as number[]; // Placeholder series weight array
  let sortedData = [] as Array<SubjectData>; // Subject array for sorting by votes received

  // For each subject
  for (let i = 0; i < subjects.length; i++) {
    // Collect title for xaxis
    // labels.push(subjects[i].title);
    // Collect linear weight for series
    // linearData.push((linearWeights[i] * 100).toFixed(2));
    // Collect weight for series
    // data.push(weights[i]);
    // Package subject data for sorting;
    var subject = {
      label: subjects[i].name,
      description: subjects[i].description,
      linearData: (linearWeights[i] * 100).toFixed(2),
      data: weights[i],
    };
    sortedData.push(subject);
  }

  // Sort by votes received
  sortedData = sortedData.sort((a, b) => {
    if (b.data - a.data !== 0) {
      return b.data - a.data;
    } else {
      return parseFloat(b.linearData) - parseFloat(a.linearData);
    }
  });
  labels = sortedData.map((subject) => subject.label);
  descriptions = sortedData.map((subject) => subject.description);
  data = sortedData.map((subject) => subject.data);
  // linearData = sortedData.map((subject) => subject.linearData);

  // Return data in chartJS format
  return {
    labels,
    descriptions,
    datasets: [
      {
        backgroundColor: "#000",
        label: "Votes",
        data,
      },
    ],
  };
}
