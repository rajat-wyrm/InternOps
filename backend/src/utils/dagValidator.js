'use strict';

/**
 * dagValidator.js
 * ---------------
 * Pure, database-agnostic DAG (Directed Acyclic Graph) validation utility.
 *
 * Task prerequisites form a directed graph where an edge  task_id → prereq_id
 * means "task_id REQUIRES prereq_id to be completed first."
 *
 * This module exposes two functions:
 *
 *   wouldCreateCycle(edges, taskId, prereqId)
 *     Returns whether adding the edge taskId → prereqId would introduce a
 *     cycle into the existing graph.  The cycle path (array of node IDs) is
 *     also returned for user-facing error messages.
 *
 *   validateFullGraph(edges)
 *     Validates the entire graph at once (useful for a dry-run health-check
 *     endpoint).  Returns the first cycle found, or null if the graph is
 *     already acyclic.
 *
 * Algorithm
 * ---------
 * Iterative DFS with three-color marking (WHITE → GREY → BLACK):
 *
 *   WHITE (0) – node not yet visited
 *   GREY  (1) – node is on the current DFS stack (ancestor path)
 *   BLACK (2) – node fully processed; all descendants explored
 *
 * A back-edge (reaching a GREY node) signals a cycle.  The cycle path is
 * reconstructed by walking the parent-pointer map.
 *
 * Complexity: O(V + E) time, O(V + E) space.
 */

const WHITE = 0;
const GREY = 1;
const BLACK = 2;

/**
 * Build an adjacency list from a flat edge array.
 *
 * @param {Array<{task_id: string, prereq_id: string}>} edges
 * @returns {Map<string, Set<string>>}  node → Set of neighbours (prereqs)
 */
function buildAdjacencyList(edges) {
  const adj = new Map();

  for (const { task_id, prereq_id } of edges) {
    if (!adj.has(task_id)) adj.set(task_id, new Set());
    if (!adj.has(prereq_id)) adj.set(prereq_id, new Set());
    adj.get(task_id).add(prereq_id);
  }

  return adj;
}

/**
 * Reconstruct a cycle path from the parent-pointer map.
 * Walks backwards from `cycleNode` until it loops back to `cycleNode`.
 *
 * @param {Map<string, string|null>} parent  node → its DFS parent
 * @param {string} cycleNode  The GREY node we reached (cycle entry point)
 * @param {string} current    The node whose edge led back to cycleNode
 * @returns {string[]}        Cycle path e.g. ["A","B","C","A"]
 */
function reconstructCycle(parent, cycleNode, current) {
  const path = [cycleNode];
  let node = current;

  while (node !== cycleNode) {
    path.unshift(node);
    node = parent.get(node);
    // Safety valve: stop if we ever hit a node with no parent (shouldn't
    // happen in a well-formed graph, but guards against infinite loops).
    if (node === undefined) break;
  }

  path.unshift(cycleNode); // close the loop
  return path;
}

/**
 * Iterative DFS cycle detection on a given adjacency list.
 * Returns the first cycle found, or null if the graph is acyclic.
 *
 * @param {Map<string, Set<string>>} adj  Adjacency list
 * @returns {{ hasCycle: boolean, cycle: string[] }}
 */
function detectCycle(adj) {
  /** @type {Map<string, 0|1|2>} */
  const color = new Map();
  /** @type {Map<string, string|null>} */
  const parent = new Map();

  // Initialise every known node as WHITE.
  for (const node of adj.keys()) {
    color.set(node, WHITE);
    parent.set(node, null);
  }

  for (const startNode of adj.keys()) {
    if (color.get(startNode) !== WHITE) continue;

    // Explicit DFS stack: each entry is [node, iterator-over-neighbours].
    // Using an iterator lets us resume where we left off after pushing a
    // child, matching the behaviour of recursive DFS without stack overflow
    // risk on deep graphs.
    const stack = [[startNode, adj.get(startNode)[Symbol.iterator]()]];
    color.set(startNode, GREY);

    while (stack.length > 0) {
      const [node, neighbourIter] = stack[stack.length - 1];
      const next = neighbourIter.next();

      if (next.done) {
        // All neighbours fully explored — mark BLACK and pop.
        color.set(node, BLACK);
        stack.pop();
      } else {
        const neighbour = next.value;

        if (!color.has(neighbour)) {
          // Node discovered via an edge but not in the adjacency list keys
          // (it has no outgoing edges). Treat as WHITE.
          color.set(neighbour, WHITE);
          parent.set(neighbour, null);
        }

        if (color.get(neighbour) === GREY) {
          // Back-edge → cycle detected.
          parent.set(neighbour, node);
          const cycle = reconstructCycle(parent, neighbour, node);
          return { hasCycle: true, cycle };
        }

        if (color.get(neighbour) === WHITE) {
          color.set(neighbour, GREY);
          parent.set(neighbour, node);
          stack.push([
            neighbour,
            adj.get(neighbour)?.[Symbol.iterator]() ?? [][Symbol.iterator](),
          ]);
        }
        // BLACK neighbours are already fully explored — skip them.
      }
    }
  }

  return { hasCycle: false, cycle: [] };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether adding the directed edge  taskId → prereqId  would create a
 * cycle in the existing task-prerequisite graph.
 *
 * The function works by tentatively adding the proposed edge to a copy of the
 * graph and then running DFS.  The original `edges` array is never mutated.
 *
 * @param {Array<{task_id: string, prereq_id: string}>} edges
 *   All existing prerequisite edges fetched from the database.
 * @param {string} taskId    The task that REQUIRES prereqId.
 * @param {string} prereqId  The task being added as a prerequisite.
 * @returns {{ hasCycle: boolean, cycle: string[] }}
 *   `hasCycle` is true if the new edge would form a loop.
 *   `cycle` contains the full cycle path (array of task IDs) for display.
 */
function wouldCreateCycle(edges, taskId, prereqId) {
  // Immediate self-loop check (also enforced by the DB CHECK constraint).
  if (taskId === prereqId) {
    return { hasCycle: true, cycle: [taskId, taskId] };
  }

  // Tentatively add the proposed edge to the graph.
  const tentativeEdges = [...edges, { task_id: taskId, prereq_id: prereqId }];
  const adj = buildAdjacencyList(tentativeEdges);
  return detectCycle(adj);
}

/**
 * Validate the entire existing graph without adding any new edges.
 * Useful for a health-check / dry-run endpoint.
 *
 * @param {Array<{task_id: string, prereq_id: string}>} edges
 * @returns {{ hasCycle: boolean, cycle: string[], nodeCount: number, edgeCount: number }}
 */
function validateFullGraph(edges) {
  const adj = buildAdjacencyList(edges);
  const result = detectCycle(adj);
  return {
    ...result,
    nodeCount: adj.size,
    edgeCount: edges.length,
  };
}

module.exports = { wouldCreateCycle, validateFullGraph, buildAdjacencyList };
