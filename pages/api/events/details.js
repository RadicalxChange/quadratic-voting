import prisma from "db"; // Import prisma
import moment from "moment"; // Time formatting

// --> /api/events/details
export default async (req, res) => {
  // Collect event ID and secret key (if it exists) from request
  const {
    query: { id, secret_key },
  } = req;

  // Collect event information from event ID
  const event = await prisma.events.findUnique({
    where: { id: id },
  });

  // Collect voter information using event ID
  const voters = await prisma.voters.findMany({
    where: { event_uuid: id },
  });

  // Check for administrator access based on passed secret_key
  const isAdmin =
    event.secret_key && event.secret_key === secret_key ? true : false;
  // After checking for administrator access, delete secret_key from event object
  delete event.secret_key;

  // If private_key enables administrator access
  if (isAdmin) {
    // Pass individual voter row details to endpoint
    event.voters = voters;
  }

  // Pass voting statistics to endpoint
  const statistics = generateStatistics(
    // Number of voteable subjects
    JSON.parse(event.event_data).length,
    // Number of max voters
    event.num_voters,
    // Number of credits per voter
    event.credits_per_voter,
    // Array of voter preferences
    voters
  );

  // Parse event_data
  event.event_data = JSON.parse(event.event_data);

  // Generate chart data for chartJS
  const chart = generateChart(
    event.event_data,
    statistics.linear,
    statistics.qv
  );

  // Generate 1p1v chart data for chartJS
  const chart2 = generateChart2(
    event.event_data,
    statistics.traditional,
    statistics.qv
  );

  // Return event data, computed statistics, and chart
  res.send({
    event,
    statistics,
    chart,
    chart2
  });
};

/**
 * Generate QV Statistics and weights
 * @param {number} subjects number of subjects
 * @param {number} num_voters number of max voters
 * @param {number} credits_per_voter number of credits per voter
 * @param {voter[]} voters array of voter preferences
 * @return {object} containing QV statistics and calculated weights
 */
function generateStatistics(subjects, num_voters, credits_per_voter, voters) {
  let numberVoters = 0, // Placeholder for number of participating voters
    numberVotes = 0, // Placeholder for number of placed votes
    qvRaw = new Array(subjects).fill([]), // Empty raw array to hold individual votes
    traditional = new Array(subjects).fill(0); // Empty raw array to hold estimated 1p1v results

  // For each voter
  for (const voter of voters) {
    // Collect voter preferences
    const voter_data = voter.vote_data;

    // Sum voter preferences to check if user has placed at least 1 vote
    const sumVotes = voter_data
      .map((subject) => Math.pow(subject.votes, 2))
      .reduce((prev, curr) => prev + curr, 0);

    // If user has placed a vote:
    if (sumVotes > 0) {
      numberVoters++; // Increment number of participating voters
      numberVotes += sumVotes; // Increment number of placed votes

      // For each of a users votes:
      for (let i = 0; i < voter_data.length; i++) {
        // Increment raw voting array for each subject
        qvRaw[i] = [...qvRaw[i], voter_data[i].votes];
      }
      // Estimate what this voter would have chosen in one person one vote
      const max_index = voter_data.reduce((curr_max, x, i, arr) => {
        if (x.votes > arr[curr_max].votes) {
          return i;
        } else {
          return curr_max;
        }
      }, 0)
      traditional[max_index] += 1;
    }
  }

  // Calculate linear weights from raw votes
  const linear = calculateLinear(qvRaw);

  // Calculate QV weights from raw votes
  const qv = calculateQV(qvRaw);

  // Return computed statistics
  return {
    totalVoters: voters.length,
    numberVotersTotal: num_voters,
    numberVoters,
    numberVotesTotal: credits_per_voter * num_voters,
    numberVotes,
    voterParticiptation: (voters.length / numberVoters) * 100,
    qvRaw,
    linear,
    qv,
    traditional,
  };
}

/**
 * Calculates and returnes subject weights based on linear addition
 * @param {integer[][]} qvRaw
 * @returns {integer[]} containing linear weights
 */
function calculateLinear(qvRaw) {
  let mapped = [],
    sumWeights = 0;

  // For individual subjects in qvRaw
  for (const subjectVotes of qvRaw) {
    // Calculate sum of votes
    const numCredits = subjectVotes.map((item, _) => Math.pow(item, 2));
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
 * @param {integer[][]} qvRaw
 * @returns {integer[]} containing QV votes
 */
function calculateQV(qvRaw) {
  let votes = [];

  // For individual subjects in qvRaw
  for (const subjectVotes of qvRaw) {
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
function generateChart(subjects, linearWeights, weights) {
  let labels = [], // Placeholder labels
    linearData = [], // Placeholder series linear weight array
    data = [], // Placeholder series weight array
    sorted_data = []; // Subject array for sorting by votes received

  // For each subject
  for (let i = 0; i < subjects.length; i++) {
    var subject = {
      label: subjects[i].title,
      linearData: (linearWeights[i] * 100).toFixed(2),
      data: weights[i],
    }
    sorted_data.push(subject)
  }

  // Sort by votes received
  sorted_data = sorted_data.sort((a, b) => {
    if (b.data - a.data !== 0) {
      return b.data - a.data;
    } else {
      return b.linearData - a.linearData;
    }
  });
  labels = sorted_data.map((subject) => subject.label);
  data = sorted_data.map((subject) => subject.data);
  linearData = sorted_data.map((subject) => subject.linearData);

  // Return data in chartJS format
  return {
    labels,
    datasets: [
      {
        backgroundColor: "#000",
        label: "Votes",
        data,
      },
      {
        backgroundColor: "#edff38",
        label: "% Credits",
        data: linearData,
      },
    ],
  };
}

/**
 * Returns chartJS chart data
 * @param {subjects[]} subjects voteable subjects
 * @param {integer[]} traditional estimated 1p1v results
 */
function generateChart2(subjects, traditional, weights) {
  let labels = [], // Placeholder labels
    qvData = [], // Placeholder series weight array
    data = [], // Placeholder series 1p1v array
    sorted_data = []; // Subject array for sorting by votes received

  // For each subject
  for (let i = 0; i < subjects.length; i++) {
    var subject = {
      label: subjects[i].title,
      data: traditional[i],
      qvData: weights[i],
    }
    sorted_data.push(subject)
  }

  // Sort by votes received
  sorted_data = sorted_data.sort((a, b) => {
    return b.data - a.data;
  });
  labels = sorted_data.map((subject) => subject.label);
  data = sorted_data.map((subject) => subject.data);
  qvData = sorted_data.map((subject) => subject.qvData);

  // Return data in chartJS format
  return {
    labels,
    datasets: [
      {
        backgroundColor: "#000",
        label: "Votos tradicionais",
        data,
      },
      {
        backgroundColor: "#edff38",
        label: "Votos quadráticos",
        data: qvData,
      },
    ],
  };
}
