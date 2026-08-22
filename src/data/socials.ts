import { GraphNodeDef } from "@/lib/graph";

export const socials: GraphNodeDef[] = [
  {
    id: "social-github",
    label: "GITHUB",
    kind: "action",
    meta: ["CODE · BUILD · OPEN SOURCE"],
    action: {
      kind: "external",
      href: "https://github.com/MeetJain0170",
    },
  },
  {
    id: "social-linkedin",
    label: "LINKEDIN",
    kind: "action",
    meta: ["CONNECT · NETWORK · OPPORTUNITIES"],
    action: {
      kind: "external",
      href: "https://www.linkedin.com/in/meet-jain-997503226/",
    },
  },
];

export const contact: GraphNodeDef[] = [
  {
    id: "contact-email",
    label: "EMAIL",
    kind: "action",
    meta: ["COLLABORATION · PROJECTS · OPPORTUNITIES"],
    action: {
      kind: "email",
      href: "mailto:meetjain1333@gmail.com",
    },
  },
];