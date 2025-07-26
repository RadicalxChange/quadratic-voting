import { PrismaClient } from "../prisma/.prisma/client/client";

let prisma: PrismaClient;

// Setup prisma client
if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  // if running in dev mode, make sure hot reloads don't open a new connection
  if (!global.prisma) {
    console.log("creating new prisma client");
    global.prisma = new PrismaClient();
  }

  prisma = global.prisma;
}

export default prisma;
