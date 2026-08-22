/**
 * The entire site is one recursive graph. Every piece of content — about,
 * projects, skills, experience, research, contact, socials — is a node in
 * this graph. There are no "pages" and no "sections": a renderer walks this
 * tree and decides what to draw based on which branch is hovered/locked.
 */

export type NodeKind =
  | "core" // the single MEET node
  | "root" // ABOUT / PROJECTS / SKILLS / EXPERIENCE / RESEARCH / CONTACT / SOCIALS
  | "child" // e.g. a project, a skill cluster, an experience entry
  | "grand" // e.g. an architecture stage inside a project
  | "tech" // a leaf technology node
  | "action" // a node whose click performs an action (open link / mailto)
  | "token"; // a word-node used by the About reconstruction engine

export interface NodeAction {
  kind: "external" | "email";
  href: string;
}

export interface GraphNodeDef {
  id: string;
  label: string;
  kind: NodeKind;
  meta?: string[];
  description?: string;
  github?: string;
  action?: NodeAction;
  children?: GraphNodeDef[];
}

/** Flatten the tree into a parent-lookup map, built once at module load. */
export function buildParentMap(root: GraphNodeDef): Map<string, string | null> {
  const map = new Map<string, string | null>();
  function walk(node: GraphNodeDef, parentId: string | null) {
    map.set(node.id, parentId);
    node.children?.forEach((c) => walk(c, node.id));
  }
  walk(root, null);
  return map;
}

export function buildNodeMap(root: GraphNodeDef): Map<string, GraphNodeDef> {
  const map = new Map<string, GraphNodeDef>();
  function walk(node: GraphNodeDef) {
    map.set(node.id, node);
    node.children?.forEach(walk);
  }
  walk(root);
  return map;
}

/** Path of ids from the root to `id`, inclusive of both ends. */
export function pathTo(
  id: string,
  parentMap: Map<string, string | null>
): string[] {
  const path: string[] = [];
  let cur: string | null | undefined = id;
  while (cur) {
    path.unshift(cur);
    cur = parentMap.get(cur) ?? null;
  }
  return path;
}
