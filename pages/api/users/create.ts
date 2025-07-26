import prisma from "../../../db/index";

import { VoterModel } from "../../../prisma/.prisma/client/models";

export type UserCreateRequest = {
  query: { id: number };
  body?: {
    event_id: number;
    name: string;
  };
};

export type UserCreateResponse = {
  send: (body: string | Pick<VoterModel, "id">) => Response;
  status: (code: number) => UserCreateResponse;
};

// --> /api/users/create
export default async (req: UserCreateRequest, res: UserCreateResponse) => {
  const newUser = req.body;

  const event = await prisma.event.findFirst({
    where: {
      id: newUser.event_id,
    },
    select: {
      id: true,
      event_data: true,
    },
  });

  const existingVoter = await prisma.voter.findFirst({
    where: {
      voter_name: newUser.name,
      events_relations: {
        some: { event_id: event.id },
      },
    },
    select: {
      id: true,
    },
  });

  if (existingVoter) {
    // console.log('Existing voter found:', existingVoter);
    res.send(existingVoter);
    return;
  }

  const createdUser = await prisma.voter.create({
    data: {
      voter_name: newUser.name,
      events_relations: {
        create: {
          event: {
            connect: { id: event.id },
          },
        },
      },
    },
    select: {
      id: true,
    },
  });

  res.send(createdUser);
};
