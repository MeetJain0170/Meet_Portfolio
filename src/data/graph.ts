import { GraphNodeDef, buildNodeMap, buildParentMap } from "@/lib/graph";
import { profile } from "./profile";
import { projects } from "./projects";
import { skills } from "./skills";
import { experience } from "./experience";
import { socials, contact } from "./socials";

export const graphRoot: GraphNodeDef = {
  id: "meet",
  label: profile.name,
  kind: "core",
  meta: profile.roles,
  children: [
    {
      id: "about",
      label: "ABOUT",
      kind: "root",
      meta: ["AI / ML ENGINEER"],
      description:
        "I build intelligent systems at the intersection of machine learning, software engineering, and applied research.",
      children: [
        {
          id: "about-ai",
          label: "AI / ML",
          kind: "child",
          meta: ["LLMs · COMPUTER VISION · AGENTS"],
        },
        {
          id: "about-builder",
          label: "BUILDER",
          kind: "child",
          meta: ["SYSTEMS · PRODUCTS · OPEN SOURCE"],
        },
        {
          id: "about-research",
          label: "RESEARCH",
          kind: "child",
          meta: ["APPLIED AI · EXPERIMENTATION"],
        },
        {
          id: "about-focus",
          label: "CURRENT FOCUS",
          kind: "child",
          meta: ["AI SYSTEMS · LLMs · AGENTS"],
        },
      ],
    },
    { id: "projects", label: "PROJECTS", kind: "root", children: projects },
    { id: "skills", label: "SKILLS", kind: "root", children: skills },
    { id: "experience", label: "EXPERIENCE", kind: "root", children: experience },
    { id: "contact", label: "CONTACT", kind: "root", children: contact },
    { id: "socials", label: "SOCIALS", kind: "root", children: socials },
  ],
};

export const nodeMap = buildNodeMap(graphRoot);
export const parentMap = buildParentMap(graphRoot);