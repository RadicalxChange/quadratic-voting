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

  var statistics = null;
  var chart = null;

  // If event is concluded or private_key enables administrator access
  if (isAdmin || (moment() > moment(event.end_event_date))) {
    // Pass voting statistics to endpoint
    if (event.social_graph) {
      statistics = generateStatisticsPlural(
        // Number of voteable subjects
        JSON.parse(event.event_data).length,
        // Number of max voters
        event.num_voters,
        // Number of credits per voter
        event.credits_per_voter,
        // Array of voter preferences
        voters,
        JSON.parse(event.social_graph)
      );
    } else {
      statistics = generateStatistics(
        // Number of voteable subjects
        JSON.parse(event.event_data).length,
        // Number of max voters
        event.num_voters,
        // Number of credits per voter
        event.credits_per_voter,
        // Array of voter preferences
        voters
      );
    }
  }

  // Parse event_data
  event.event_data = JSON.parse(event.event_data);

  // If event is concluded or private_key enables administrator access
  if (isAdmin || (moment() > moment(event.end_event_date))) {
    // Generate chart data for chartJS
    chart = generateChart(
      event.event_data,
      statistics.finalVotes
    );
  }

  // If private_key enables administrator access
  if (isAdmin && event.voters) {
    // remove voter name and vote data to keep anonymous from election admins
    const voterIds = event.voters;
    voterIds.forEach((voter, _) => {
      delete voter.voter_name;
      delete voter.vote_data;
    });
    event.voters = voterIds;
  }

  // Return event data, computed statistics, and chart
  res.send({
    event,
    statistics,
    chart,
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
    qvRaw = new Array(subjects).fill([]); // Empty raw array to hold individual votes

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
    }
  }

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
    finalVotes: qv,
  };
}

function clusterMatch(groups, contributions) {
  // groups: bag of groups (array of arrays of integers)
  // contributions: array of contributions (floats)
  // groupMemberships: array of sets (arrays of arrays) where
  //                   groupMemberships[i] is the groups agent i belongs to
  let groupMemberships = new Array(contributions.length).fill([]);

  for (let i = 0; i < groups.length; i++) {
    for (let j of groups[i]) {
      groupMemberships[j] = [...groupMemberships[j], i];
    }
  }

  function commonGroup(i, j) {
   // If voter i and voter j share any common group, return true. Else return false.
   return groupMemberships[i].some(group => groupMemberships[j].includes(group))
  }

  function K(i, group) {
    // If group includes voter i, or any member of group shares a different group with voter i
    if (group.includes(i) || group.some(j => commonGroup(i, j))) {
      return Math.sqrt(contributions[i]);
    }
    return contributions[i];
  }

  let result = 0;

  // Add the contribution of each agent in each group to the result
  for (let g of groups) {
    for (let i of g) {
      result += contributions[i] / groupMemberships[i].length;
    }
  }

  // Iterate over each pair of groups and add their contribution to the result
  for (let g of groups) {
    for (let h of groups) {
      if (g === h) continue; // Skip if the groups are the same

      let term1 = 0;
      // Calculate term1 for the current pair of groups
      for (let i of g) {
        term1 += K(i, h) / groupMemberships[i].length;
      }
      term1 = Math.sqrt(term1);

      let term2 = 0;
      // Calculate term2 for the current pair of groups
      for (let j of h) {
        term2 += K(j, g) / groupMemberships[j].length;
      }
      term2 = Math.sqrt(term2);

      result += term1 * term2;
    }
  }

  return Math.sqrt(result);
}

function calculatePluralVotes(groups, contributions) {
  var positiveContributions = [];
  var negativeContributions = [];
  for (let i = 0; i < contributions.length; i++) {
    if (contributions[i] >= 0) {
      positiveContributions.push(contributions[i]);
      negativeContributions.push(0);
    } else {
      positiveContributions.push(0);
      negativeContributions.push(Math.abs(contributions[i]));
    }
  }
  let positiveAmount = clusterMatch(groups, positiveContributions);
  let negativeAmount = clusterMatch(groups, negativeContributions);
  return positiveAmount - negativeAmount;
}

/**
 * Generate QV Statistics and weights
 * @param {number} subjects number of subjects
 * @param {number} num_voters number of max voters
 * @param {number} credits_per_voter number of credits per voter
 * @param {voter[]} voters array of voter preferences
 * @param {social_graph[]} social_graph array of survey questions
 * @return {object} containing QV statistics and calculated weights
 */
function generateStatisticsPlural(subjects, num_voters, credits_per_voter, voters, social_graph) {
  let numberVoters = 0, // Placeholder for number of participating voters
    numberVotes = 0, // Placeholder for number of placed votes
    contributions = new Array(subjects).fill([]), // Empty raw array to hold individual contributions
    // (Array of arrays, each subject holds an array of individual votes for that subject)
    groups = [],
    finalVotes = new Array(subjects).fill(0);

  // pull all groups into one groups array
  for (let i = 0; i < social_graph.length; i++) {
    groups = groups.concat(social_graph[i]["options"].map((option) => {
    	return {
      	"key": i + " " + option,
        "group": option,
        "members": [],
      }
    }));
  }

  // For each voter
  for (let i = 0; i < voters.length; i++) {
    // Collect voter preferences
    const voter_data = voters[i].vote_data;
    const social_data = voters[i].social_data;

    // Sum voter preferences to check if user has placed at least 1 vote
    const sumVotes = voter_data
      .map((subject) => Math.pow(subject.votes, 2))
      .reduce((prev, curr) => prev + curr, 0);

    // If user has placed a vote:
    if (sumVotes > 0) {
      numberVoters++; // Increment number of participating voters
      numberVotes += sumVotes; // Increment number of placed votes
      for (let j = 0; j < social_data.length; j++) {
        const groupIndex = groups.findIndex(group => group.key === j + " " + social_data[j]["response"]);
        groups[groupIndex].members.push(i);
      }
    }

    // For each of a users votes:
    for (let j = 0; j < voter_data.length; j++) {
      // Increment raw voting array for each subject
      contributions[j] = [...contributions[j], Math.pow(voter_data[j].votes, 2)];
    }
  }

  for (let i = 0; i < contributions.length; i++) {
    finalVotes[i] = calculatePluralVotes(groups.map((group) => group.members), contributions[i]);
  }

  // Return computed statistics
  return {
    totalVoters: voters.length,
    numberVotersTotal: num_voters,
    numberVoters,
    numberVotesTotal: credits_per_voter * num_voters,
    numberVotes,
    voterParticiptation: (voters.length / numberVoters) * 100,
    finalVotes: finalVotes,
  };
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
 * @param {integer[]} weights qv subject weights
 */
function generateChart(subjects, weights) {
  let labels = [], // Placeholder labels
    descriptions = [],
    data = [], // Placeholder series weight array
    sorted_data = []; // Subject array for sorting by votes received

  // For each subject
  for (let i = 0; i < subjects.length; i++) {
    // Package subject data for sorting;
    var subject = {
      label: subjects[i].title,
      description: subjects[i].description,
      data: weights[i],
    }
    sorted_data.push(subject)
  }

  // Sort by votes received
  sorted_data = sorted_data.sort((a, b) => {
    return b.data - a.data;
  });
  labels = sorted_data.map((subject) => subject.label);
  descriptions = sorted_data.map((subject) => subject.description);
  data = sorted_data.map((subject) => subject.data);

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
