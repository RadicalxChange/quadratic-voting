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

function unique_members(g1, g2) {

  // This helper function takes in two arrays, g1 and g2,
  // and returns the elements that are just in g1 but not g2.

  let unique = []
  for (let i = 0; i < g1.length; i++) {
    if (!g2.includes(g1[i])) {
      unique.push(g1[i])
    }
  }
  return unique
}


function count_memberships(groups, num_agents) {
  /*
  this function takes in a list of groups of the format described above and
  a total number of agents, and returns a list called memberships where
  memberships[i] is the number of groups that agent i is in.
  */
  let memberships = []
  for (let i = 0; i < num_agents; i++) {
    let num_memberships = 0
    for (let g = 0; g < groups.length; g++) {
      if (groups[g].indexOf(i) >= 0) {
        num_memberships++
      }
    }
    memberships.push(num_memberships)
  }
  return memberships
}

function same_nonzero_sign(num1, num2) {
  return ((num1 > 0) && (num2 > 0)) || ((num1 < 0) && (num2 < 0))
}

function find_friends(groups, contributions) {
  /*
  this function takes in a list of groups and the total number of agents,
  and returns a matrix / 2D array called friends where friends[i][j] = 1 if i
  and j are in any group together AND have the same contribution polarity, and
  0 otherwise.
  */
  let friends = []

  for (let i = 0; i < contributions.length; i++) {
    let new_row = new Array(contributions.length).fill(0)
    friends.push(new_row)
  }
  /*
  for every group, take each pair of people in that group, and make sure the
  friends array is set to 1 at the index corresponding to that pair of people.
  */
  for (let g = 0; g < groups.length; g++) {
    for (let i = 0; i < groups[g].length - 1; i++) {
      for (let j = i + 1; j < groups[g].length; j++) {
        if (same_nonzero_sign(contributions[groups[g][i]], contributions[groups[g][j]])) {
          friends[groups[g][i]][groups[g][j]] = 1
          friends[groups[g][j]][groups[g][i]] = 1
        }
      }
    }
  }
  //console.log(friends)
  return friends
}

// console.log(find_friends(groups, len(contributions)))



function root(x) {
  /*
  this function takes in a number x and returns sqrt(x) if x is positive, or
  -sqrt(|x|) if x is negative.
  */
  return Math.sign(x) * Math.sqrt(Math.abs(x))
}


function cluster_match(groups, contributions) {
  /*
  first off, call helper functions to get a list showing the number of groups
  each agent is in and a 2d array of which agents are in at least one group
  together.
  */

  var memberships = count_memberships(groups, contributions.length)

  var friends = find_friends(groups, contributions)

  //console.log(memberships)

  let funding_amount = 0

  // first just sum up all the individual contributions
  contributions.forEach(x => {
    funding_amount += x
  })

  //console.log("sum of individual contributions: " + funding_amount)

  // now add in all the interaction terms
  for (let g = 0; g < groups.length - 1; g++) {
    for (let h = g + 1; h < groups.length; h++) {

      //console.log("finding interaction term for groups " + g + " and " + h)

      /*
      we need to figure out which members of g and h are friends with each
      other. this for loop does that. it fills up a list called common_friends
      with all the agents who are friends with at least one person from the
      other group. (it actually might add agents to this list more than once,
      which is fine for our purposes)
      */
      let common_friends = []
      for (let i = 0; i < groups[g].length; i++) {
        for (let j = 0; j < groups[h].length; j++) {
          if (friends[groups[g][i]][groups[h][j]] == 1) {
            common_friends.push(groups[g][i])
            common_friends.push(groups[h][j])
          }
        }
      }

      // g_term and h_term are g and h's sides of the interaction term, respectively.
      // they'll get multiplied together to form the full interaction term.
      let g_term = 0;

      for (let i = 0; i < groups[g].length; i++) {
        if (common_friends.includes(groups[g][i])) {
          g_term += root(contributions[groups[g][i]]) / memberships[groups[g][i]]

        } else {
          g_term += contributions[groups[g][i]] / memberships[groups[g][i]]
        }
      }

      let h_term = 0;

      for (let j = 0; j < groups[h].length; j++) {
        if (common_friends.includes(groups[h][j])) {
          h_term += root(contributions[groups[h][j]]) / memberships[groups[h][j]]
          //console.log(contributions[groups[h][j]], '/', memberships[groups[h][j]])
        } else {
          h_term += contributions[groups[h][j]] / memberships[groups[h][j]]
        }
      }

      /*
      now, add the interaction term to the total funding amount.
      if the two terms are signed differently, then one group likes the
      proposal/project and the other doesn't. In this case, it's not
      immediately clear how to change the funding amount, so we just won't.
      */
      if (Math.sign(g_term) == Math.sign(h_term)) {
        funding_amount += 2 * root(g_term) * root(h_term) * Math.sign(g_term)

        // if both g_term and h_term were positive, then we could just write:
        // funding_amount += 2 * root(g_term) * root(h_term)
        // but if they're both negative, we don't want those two negative
        // numbers to cancel out and make a positive number. So we multiply again by Math.sign(g_term).
      }
    }
  }
  return funding_amount
}

function calculatePluralVotes(groups, contributions) {
  console.log("groups")
  console.log(groups)
  console.log("contributions")
  console.log(contributions)
  var pos_contributions = []
  var neg_contributions = []
  for (let i = 0; i < contributions.length; i++) {
    if (contributions[i] >= 0) {
      pos_contributions.push(contributions[i])
      neg_contributions.push(0)
    } else {
      pos_contributions.push(0)
      neg_contributions.push(contributions[i])
    }
  }
  // console.log(pos_contributions)
  // console.log(neg_contributions)
  // console.log(groups)
  // console.log(cluster_match(groups, pos_contributions))
  // console.log(cluster_match(groups, neg_contributions))
  let pos_amount = cluster_match(groups, pos_contributions)
  let neg_amount = cluster_match(groups, neg_contributions)
  return root(pos_amount) + root(neg_amount)
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
  console.log(groups);
  console.log(contributions);

  for (let i = 0; i < contributions.length; i++) {
    finalVotes[i] = calculatePluralVotes(groups.map((group) => group.members), contributions[i]);
  }
  console.log(finalVotes);

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
