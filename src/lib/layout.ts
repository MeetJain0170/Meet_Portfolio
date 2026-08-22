import { GraphNodeDef } from "@/lib/graph";

export interface NodePosition {
  id: string;
  x: number;
  y: number;
  angleDeg: number;
  depth: number;
  parentId: string | null;
  isFocus: boolean;
  isOrbit: boolean;
  hubId?: string;
  clusterId?: string;
  constellationDepth?: number;
}

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/* -------------------------------------------------------------------------- */
/* Stable deterministic randomness                                            */
/* -------------------------------------------------------------------------- */

function stableHash(id: string) {
  let hash = 2166136261;

  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

/* -------------------------------------------------------------------------- */
/* Find node                                                                  */
/* -------------------------------------------------------------------------- */

function findNode(
  node: GraphNodeDef,
  id: string
): GraphNodeDef | null {
  if (node.id === id) return node;

  for (const child of node.children ?? []) {
    const found = findNode(child, id);

    if (found) return found;
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* NORMAL ORBIT                                                               */
/* -------------------------------------------------------------------------- */

function layoutNormalFocus(
  out: Map<string, NodePosition>,
  focus: GraphNodeDef,
  parentId: string | null,
  cx: number,
  cy: number,
  baseRadius: number,
  depth: number,
  width: number,
  height: number
) {
  out.set(focus.id, {
    id: focus.id,
    x: cx,
    y: cy,
    angleDeg: -90,
    depth,
    parentId,
    isFocus: true,
    isOrbit: false,
    constellationDepth: 0,
  });

  const children = focus.children ?? [];

  if (!children.length) return;

  const viewport = Math.min(width, height);

  const radius = clamp(
    Math.max(baseRadius * 1.45, viewport * 0.22),
    baseRadius * 1.3,
    viewport * 0.34
  );

  const spacing = TAU / children.length;

  children.forEach((child, i) => {
    const angle =
      -Math.PI / 2 +
      i * spacing +
      (stableHash(child.id) - 0.5) * 0.04;

    const distance =
      radius * (0.97 + stableHash(child.id + ":r") * 0.06);

    out.set(child.id, {
      id: child.id,
      x: cx + Math.cos(angle) * distance,
      y: cy + Math.sin(angle) * distance,
      angleDeg: angle / DEG,
      depth: depth + 1,
      parentId: focus.id,
      isFocus: false,
      isOrbit: true,
      constellationDepth: 1,
    });
  });
}

/* -------------------------------------------------------------------------- */
/* PROJECT / DETAIL CONSTELLATION                                             */
/* -------------------------------------------------------------------------- */

function layoutDetailConstellation(
  out: Map<string, NodePosition>,
  focus: GraphNodeDef,
  parentId: string | null,
  cx: number,
  cy: number,
  baseRadius: number,
  depth: number,
  width: number,
  height: number
) {
  out.set(focus.id, {
    id: focus.id,
    x: cx,
    y: cy,
    angleDeg: -90,
    depth,
    parentId,
    isFocus: true,
    isOrbit: false,
    constellationDepth: 0,
  });

  const hubs = focus.children ?? [];

  if (!hubs.length) return;

  const viewport = Math.min(width, height);

  const hubRadius = clamp(
    Math.max(baseRadius * 1.45, viewport * 0.16),
    viewport * 0.13,
    viewport * 0.22
  );

  const sectors =
    hubs.length === 3
      ? [-Math.PI / 2, Math.PI * 0.82, Math.PI * 0.18]
      : hubs.length === 4
        ? [-Math.PI / 2, 0, Math.PI / 2, Math.PI]
        : hubs.map(
          (_, i) => -Math.PI / 2 + (TAU * i) / hubs.length
        );

  hubs.forEach((hub, hubIndex) => {
    const hubAngle =
      sectors[hubIndex] +
      (stableHash(hub.id) - 0.5) * 0.025;

    const hubX =
      cx + Math.cos(hubAngle) * hubRadius;

    const hubY =
      cy + Math.sin(hubAngle) * hubRadius;

    out.set(hub.id, {
      id: hub.id,
      x: hubX,
      y: hubY,
      angleDeg: hubAngle / DEG,
      depth: depth + 1,
      parentId: focus.id,
      isFocus: false,
      isOrbit: true,
      hubId: hub.id,
      clusterId: hub.id,
      constellationDepth: 1,
    });

    const leaves = hub.children ?? [];

    if (!leaves.length) return;

    const outwardX = Math.cos(hubAngle);
    const outwardY = Math.sin(hubAngle);

    const tangentX = -outwardY;
    const tangentY = outwardX;

    /*
     * More technologies = more space.
     */
    const countBoost =
      Math.max(0, leaves.length - 3) * 0.012;

    const leafRadius = clamp(
      Math.max(
        baseRadius * 1.15,
        viewport * (0.12 + countBoost)
      ),
      viewport * 0.10,
      viewport * 0.20
    );

    /*
     * Wider fan for larger technology groups.
     */
    const fan =
      leaves.length === 1
        ? 0
        : leaves.length === 2
          ? 0.38
          : leaves.length === 3
            ? 0.72
            : leaves.length === 4
              ? 1.02
              : leaves.length === 5
                ? 1.22
                : leaves.length === 6
                  ? 1.38
                  : 1.48;

    leaves.forEach((leaf, leafIndex) => {
      let tangentAmount = 0;

      if (leaves.length > 1) {
        const normalized =
          leafIndex / (leaves.length - 1);

        tangentAmount =
          (normalized - 0.5) * 2 * fan;
      }

      const jitter =
        (stableHash(leaf.id) - 0.5) * 0.045;

      const localAngle =
        tangentAmount + jitter;

      const edgeFactor =
        leaves.length > 2
          ? Math.abs(
            leafIndex / (leaves.length - 1) - 0.5
          ) * 2
          : 0;

      const radialDistance =
        leafRadius * (1 + edgeFactor * 0.10);

      const radial =
        Math.cos(localAngle) * radialDistance;

      const tangent =
        Math.sin(localAngle) * radialDistance;

      const x =
        hubX +
        outwardX * radial +
        tangentX * tangent;

      const y =
        hubY +
        outwardY * radial +
        tangentY * tangent;

      out.set(leaf.id, {
        id: leaf.id,
        x,
        y,
        angleDeg:
          Math.atan2(y - hubY, x - hubX) / DEG,
        depth: depth + 2,
        parentId: hub.id,
        isFocus: false,
        isOrbit: true,
        hubId: hub.id,
        clusterId: hub.id,
        constellationDepth: 2,
      });
    });
  });
}

/* -------------------------------------------------------------------------- */
/* SKILLS CONSTELLATION                                                       */
/*                                                                            */
/*                       TECH     TECH                                        */
/*                         \       /                                          */
/*                    AI / LLM HUB                                            */
/*                    /    |     \                                            */
/*                 TECH   TECH   TECH                                         */
/*                                                                            */
/*                              ME                                            */
/*                                                                            */
/*             ML HUB                    DATA HUB                             */
/*              / | \                     / | \                              */
/*            TECH TECH TECH             TECH TECH                            */
/*                                                                            */
/* -------------------------------------------------------------------------- */

function layoutSkillsConstellation(
  out: Map<string, NodePosition>,
  focus: GraphNodeDef,
  parentId: string | null,
  cx: number,
  cy: number,
  _baseRadius: number,
  depth: number,
  width: number,
  height: number
) {
  const categories = focus.children ?? [];

  if (!categories.length) {
    out.set(focus.id, {
      id: focus.id,
      x: cx,
      y: cy,
      depth,
      angleDeg: -90,
      parentId,
      isFocus: true,
      isOrbit: false,
    });

    return;
  }

  const vw = Math.max(width, 900);
  const vh = Math.max(height, 600);

  const TAU = Math.PI * 2;
  const DEG = 180 / Math.PI;

  const clamp = (
    value: number,
    min: number,
    max: number
  ) => Math.max(min, Math.min(max, value));

  /*
   * Stable pseudo-random value.
   * Gives every node tiny deterministic variation without
   * causing the layout to jump between renders.
   */
  const hash = (value: string) => {
    let h = 2166136261;

    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }

    return (h >>> 0) / 4294967295;
  };

  /* ---------------------------------------------------------------------- */
  /* ROOT                                                                    */
  /* ---------------------------------------------------------------------- */

  out.set(focus.id, {
    id: focus.id,
    x: cx,
    y: cy,
    depth,
    angleDeg: -90,
    parentId,
    isFocus: true,
    isOrbit: false,
  });

  /* ---------------------------------------------------------------------- */
  /* CATEGORY RING                                                           */
  /* ---------------------------------------------------------------------- */

  const categoryCount = categories.length;

  /*
   * Slightly wider than before.
   *
   * This gives the individual clusters enough breathing room.
   */
  const radiusX = clamp(
    vw * 0.22,
    260,
    470
  );

  const radiusY = clamp(
    vh * 0.18,
    190,
    330
  );

  const marginX = 135;
  const marginY = 105;

  categories.forEach((category, categoryIndex) => {
    /*
     * Categories are distributed around the central node.
     *
     * Start at the top and go clockwise.
     */
    const angle =
      -Math.PI / 2 +
      (categoryIndex / categoryCount) * TAU;

    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    let categoryX =
      cx + dirX * radiusX;

    let categoryY =
      cy + dirY * radiusY;

    /*
     * Keep category hubs safely inside the screen.
     */
    categoryX = clamp(
      categoryX,
      marginX,
      vw - marginX
    );

    categoryY = clamp(
      categoryY,
      marginY,
      vh - marginY
    );

    out.set(category.id, {
      id: category.id,
      x: categoryX,
      y: categoryY,
      depth: depth + 1,
      angleDeg: angle * DEG,
      parentId: focus.id,
      isFocus: false,
      isOrbit: true,
    });

    const children = category.children ?? [];

    if (!children.length) return;

    /* -------------------------------------------------------------------- */
    /* BRANCH BASIS                                                           */
    /* -------------------------------------------------------------------- */

    /*
     * OUTWARD direction:
     *
     *       SKILLS
     *          |
     *          ↓
     *        DATA
     *          ↓
     *       children
     */
    const radialX = dirX;
    const radialY = dirY;

    /*
     * Tangent direction gives us the horizontal spread of the branch.
     *
     * For a top category this is basically LEFT ↔ RIGHT.
     * For a left category it becomes UP ↕ DOWN.
     */
    const tangentX = -radialY;
    const tangentY = radialX;

    const count = children.length;

    /* -------------------------------------------------------------------- */
    /* RESPONSIVE BRANCH CONFIGURATION                                      */
    /* -------------------------------------------------------------------- */

    /*
     * Keep most clusters on ONE curved row.
     *
     * This is important.
     *
     * Your previous layout started creating little grids, which is what
     * produced the ugly stacks at DATA and AI / LLM.
     */
    let columns: number;

    if (count <= 6) {
      columns = count;
    } else if (count <= 8) {
      columns = 4;
    } else {
      columns = 5;
    }

    const rows = Math.ceil(count / columns);

    /*
     * Wide horizontal separation.
     */
    const siblingSpacing = clamp(
      vw * 0.075,
      78,
      115
    );

    /*
     * Distance from category → first child.
     */
    const branchDistance = clamp(
      Math.min(vw * 0.085, vh * 0.115),
      82,
      125
    );

    /*
     * If a category eventually gets >6 children,
     * additional rows are pushed outward.
     */
    const rowSpacing = clamp(
      vh * 0.055,
      42,
      58
    );

    /*
     * CURVATURE.
     *
     * This is deliberately strong enough to actually see.
     *
     * Middle nodes are pushed OUTWARD.
     * Outer nodes are pulled slightly TOWARD THE CENTER.
     *
     * Example:
     *
     *       ●       ●
     *    ●             ●
     *          HUB
     */
    const curvature = clamp(
      Math.min(
        vw * 0.055,
        vh * 0.075
      ),
      45,
      85
    );

    /* -------------------------------------------------------------------- */
    /* CHILDREN                                                               */
    /* -------------------------------------------------------------------- */

    children.forEach((child, childIndex) => {
      const row =
        Math.floor(childIndex / columns);

      const indexInRow =
        childIndex % columns;

      const itemsInRow =
        Math.min(
          columns,
          count - row * columns
        );

      /*
       * Normalized horizontal position.
       *
       * -1 = far left
        0 = center
       * +1 = far right
       */
      const t =
        itemsInRow === 1
          ? 0
          : (indexInRow /
              (itemsInRow - 1)) *
              2 -
            1;

      /* ------------------------------------------------------------------ */
      /* HORIZONTAL SPREAD                                                    */
      /* ------------------------------------------------------------------ */

      const tangentDistance =
        t *
        siblingSpacing *
        ((itemsInRow - 1) / 2);

      /*
       * Tiny deterministic variation.
       * VERY small so it doesn't destroy the geometry.
       */
      const micro =
        (hash(child.id) - 0.5) * 4;

      /* ------------------------------------------------------------------ */
      /* CURVED RADIAL DISTANCE                                               */
      /* ------------------------------------------------------------------ */

      /*
       * Parabolic curve:
       *
       * t = -1       -> closer to center
       * t =  0       -> farthest outward
       * t = +1       -> closer to center
       *
       * This gives the branch its inward-facing curvature.
       */
      const curveFactor =
        1 - t * t;

      const radialDistance =
        branchDistance +
        curveFactor * curvature +
        row * rowSpacing;

      /* ------------------------------------------------------------------ */
      /* POSITION                                                             */
      /* ------------------------------------------------------------------ */

      let x =
        categoryX +
        radialX * radialDistance +
        tangentX *
          tangentDistance;

      let y =
        categoryY +
        radialY * radialDistance +
        tangentY *
          tangentDistance;

      /*
       * Small deterministic offset along the tangent.
       */
      x += tangentX * micro;
      y += tangentY * micro;

      /* ------------------------------------------------------------------ */
      /* SCREEN BOUNDARY                                                      */
      /* ------------------------------------------------------------------ */

      /*
       * Do NOT hard-clamp immediately.
       *
       * First compress the branch toward its category.
       * This preserves the curve.
       */
      const safeLeft = 90;
      const safeRight = vw - 90;
      const safeTop = 75;
      const safeBottom = vh - 75;

      const overflowLeft =
        Math.max(
          0,
          safeLeft - x
        );

      const overflowRight =
        Math.max(
          0,
          x - safeRight
        );

      const overflowTop =
        Math.max(
          0,
          safeTop - y
        );

      const overflowBottom =
        Math.max(
          0,
          y - safeBottom
        );

      if (overflowLeft > 0) {
        x += overflowLeft * 0.9;
      }

      if (overflowRight > 0) {
        x -= overflowRight * 0.9;
      }

      if (overflowTop > 0) {
        y += overflowTop * 0.9;
      }

      if (overflowBottom > 0) {
        y -= overflowBottom * 0.9;
      }

      /*
       * Final safety clamp.
       */
      x = clamp(
        x,
        safeLeft,
        safeRight
      );

      y = clamp(
        y,
        safeTop,
        safeBottom
      );

      /* ------------------------------------------------------------------ */
      /* STORE NODE                                                           */
      /* ------------------------------------------------------------------ */

      out.set(child.id, {
        id: child.id,
        x,
        y,
        depth: depth + 2,

        angleDeg:
          Math.atan2(
            y - categoryY,
            x - categoryX
          ) * DEG,

        parentId: category.id,

        isFocus: false,
        isOrbit: true,
      });
    });
  });
}

/* -------------------------------------------------------------------------- */
/* ABOUT                                                                      */
/* -------------------------------------------------------------------------- */

function layoutAbout(
  out: Map<string, NodePosition>,
  root: GraphNodeDef,
  about: GraphNodeDef,
  cx: number,
  cy: number,
  baseRadius: number,
  width: number,
  height: number
) {
  out.set(about.id, {
    id: about.id,
    x: cx,
    y: cy,
    angleDeg: -90,
    depth: 1,
    parentId: root.id,
    isFocus: true,
    isOrbit: false,
    constellationDepth: 0,
  });

  const branches = (root.children ?? []).filter(
    (child) => child.id !== "about"
  );

  if (!branches.length) return;

  const vw = Math.max(width, 320);
  const vh = Math.max(height, 420);

  const sideX = Math.min(vw * 0.38, 520);
  const topY = Math.min(vh * 0.40, 300);
  const bottomY = Math.min(vh * 0.40, 300);

  const positions: Record<
    string,
    { x: number; y: number; angle: number }
  > = {
    projects: {
      x: cx,
      y: cy - topY,
      angle: -90,
    },

    socials: {
      x: cx - sideX,
      y: cy - vh * 0.04,
      angle: 180,
    },

    skills: {
      x: cx + sideX,
      y: cy - vh * 0.04,
      angle: 0,
    },

    contact: {
      x: cx - sideX * 0.92,
      y: cy + bottomY,
      angle: 145,
    },

    experience: {
      x: cx + sideX * 0.92,
      y: cy + bottomY,
      angle: 35,
    },
  };

  const fallbackAngles = [
    -90,
    -25,
    25,
    155,
    205,
    0,
  ];

  let fallbackIndex = 0;

  branches.forEach((branch) => {
    const preset = positions[branch.id];

    let x: number;
    let y: number;
    let angle: number;

    if (preset) {
      x = preset.x;
      y = preset.y;
      angle = preset.angle;
    } else {
      const a =
        fallbackAngles[
        fallbackIndex++ %
        fallbackAngles.length
        ] * DEG;

      const radius = Math.min(
        vw * 0.40,
        vh * 0.43
      );

      x = cx + Math.cos(a) * radius;
      y = cy + Math.sin(a) * radius;
      angle = a / DEG;
    }

    out.set(branch.id, {
      id: branch.id,
      x,
      y,
      angleDeg: angle,
      depth: 2,
      parentId: about.id,
      isFocus: false,
      isOrbit: true,
      constellationDepth: 1,
    });
  });
}

/* -------------------------------------------------------------------------- */
/* MAIN LAYOUT                                                                */
/* -------------------------------------------------------------------------- */

export function layoutGraph(
  root: GraphNodeDef,
  cx: number,
  cy: number,
  baseRadius: number,
  activePath: string[],
  width?: number,
  height?: number
): Map<string, NodePosition> {
  const out = new Map<string, NodePosition>();

  const viewportWidth =
    width ?? baseRadius * 7;

  const viewportHeight =
    height ?? baseRadius * 7;

  const focusId =
    activePath[activePath.length - 1] ??
    root.id;

  const focus =
    findNode(root, focusId) ?? root;

  const parentId =
    activePath.length > 1
      ? activePath[activePath.length - 2]
      : null;

  /* ---------------------------------------------------------------------- */
  /* MEET                                                                    */
  /* ---------------------------------------------------------------------- */

  if (focus.id === root.id) {
    layoutNormalFocus(
      out,
      root,
      null,
      cx,
      cy,
      baseRadius,
      0,
      viewportWidth,
      viewportHeight
    );

    return out;
  }

  /* ---------------------------------------------------------------------- */
  /* ABOUT                                                                   */
  /* ---------------------------------------------------------------------- */

  if (focus.id === "about") {
    layoutAbout(
      out,
      root,
      focus,
      cx,
      cy,
      baseRadius,
      viewportWidth,
      viewportHeight
    );

    return out;
  }

  /* ---------------------------------------------------------------------- */
  /* SKILLS                                                                  */
  /*                                                                      */
  /* THIS IS THE IMPORTANT FIX.                                             */
  /*                                                                      */
  /* Previously:                                                             */
  /*                                                                        */
  /* SKILLS → categories                                                     */
  /*                                                                        */
  /* Now:                                                                    */
  /*                                                                        */
  /*                 TECH   TECH                                            */
  /*                   \   /                                                 */
  /*               AI / LLM                                                  */
  /*                   |                                                      */
  /*             TECH  SKILLS  TECH                                          */
  /*                   |                                                      */
  /*               DATA HUB                                                   */
  /*                 / | \                                                    */
  /*              TECH TECH TECH                                              */
  /*                                                                        */
  /* All descendants are positioned immediately.                            */
  /* ---------------------------------------------------------------------- */

  if (focus.id === "skills") {
    layoutSkillsConstellation(
      out,
      focus,
      parentId,
      cx,
      cy,
      baseRadius,
      activePath.length - 1,
      viewportWidth,
      viewportHeight
    );

    return out;
  }

  /* ---------------------------------------------------------------------- */
  /* ROOT CATEGORIES                                                         */
  /* ---------------------------------------------------------------------- */

  const isRoot = focus.kind === "root";

  /*
   * A focused non-root node with children that themselves have children
   * gets the project-style constellation.
   */
  const hasNestedChildren =
    !isRoot &&
    (focus.children ?? []).some(
      (child) =>
        (child.children?.length ?? 0) > 0
    );

  const depth =
    activePath.length - 1;

  if (hasNestedChildren) {
    layoutDetailConstellation(
      out,
      focus,
      parentId,
      cx,
      cy,
      baseRadius,
      depth,
      viewportWidth,
      viewportHeight
    );

    return out;
  }

  /* ---------------------------------------------------------------------- */
  /* SIMPLE NODES                                                            */
  /* ---------------------------------------------------------------------- */

  layoutNormalFocus(
    out,
    focus,
    parentId,
    cx,
    cy,
    baseRadius,
    depth,
    viewportWidth,
    viewportHeight
  );

  return out;
}