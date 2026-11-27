import { randomInt } from "node:crypto";

import { generateTicketCode } from "@/domain/boarding/ticket-code";

export const cryptoTicketCodeGenerator = {
  generate: () => generateTicketCode((max) => randomInt(max)),
};
