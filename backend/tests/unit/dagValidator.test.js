'use strict';

/**
 * dagValidator.test.js
 * ---------------------
 * Unit tests for the DFS-based DAG cycle detection utility.
 *
 * Each test is self-contained: it provides a set of existing prerequisite edges
 * and a proposed new edge, then asserts whether a cycle would be introduced and,
 * when applicable, what the cycle path looks like.
 *
 * Node names use single uppercase letters (A, B, C …) for readability.
 * In production these would be UUIDs.
 */

const {
  wouldCreateCycle,
  validateFullGraph,
  buildAdjacencyList,
} = require('../../src/utils/dagValidator');

// Helper: build an edge object the same shape the repository returns.
const edge = (task_id, prereq_id) => ({ task_id, prereq_id });

// ---------------------------------------------------------------------------
// wouldCreateCycle
// ---------------------------------------------------------------------------

describe('wouldCreateCycle', () => {
  // ── 1. Empty graph ──────────────────────────────────────────────────────
  describe('empty graph', () => {
    test('adding the first edge never creates a cycle', () => {
      const result = wouldCreateCycle([], 'A', 'B');
      expect(result.hasCycle).toBe(false);
      expect(result.cycle).toHaveLength(0);
    });
  });

  // ── 2. Linear chain ─────────────────────────────────────────────────────
  describe('linear chain A → B → C', () => {
    // A requires B, B requires C
    const edges = [edge('A', 'B'), edge('B', 'C')];

    test('extending the chain C → D does not create a cycle', () => {
      const result = wouldCreateCycle(edges, 'C', 'D');
      expect(result.hasCycle).toBe(false);
    });

    test('adding a parallel edge A → C does not create a cycle', () => {
      const result = wouldCreateCycle(edges, 'A', 'C');
      expect(result.hasCycle).toBe(false);
    });

    test('reversing C → B would create a 2-node cycle', () => {
      const result = wouldCreateCycle(edges, 'C', 'B');
      expect(result.hasCycle).toBe(true);
      expect(result.cycle).toContain('B');
      expect(result.cycle).toContain('C');
    });

    test('closing the chain C → A would create a 3-node cycle', () => {
      const result = wouldCreateCycle(edges, 'C', 'A');
      expect(result.hasCycle).toBe(true);
      // Cycle path must contain all three nodes.
      expect(result.cycle).toContain('A');
      expect(result.cycle).toContain('B');
      expect(result.cycle).toContain('C');
    });
  });

  // ── 3. Diamond DAG (valid, no cycles) ────────────────────────────────────
  describe('diamond DAG  A→B, A→C, B→D, C→D', () => {
    //   A
    //  / \
    // B   C
    //  \ /
    //   D
    const edges = [
      edge('A', 'B'),
      edge('A', 'C'),
      edge('B', 'D'),
      edge('C', 'D'),
    ];

    test('is a valid DAG (no cycles exist)', () => {
      const result = validateFullGraph(edges);
      expect(result.hasCycle).toBe(false);
    });

    test('extending D → E does not create a cycle', () => {
      const result = wouldCreateCycle(edges, 'D', 'E');
      expect(result.hasCycle).toBe(false);
    });

    test('closing D → A would create a cycle', () => {
      const result = wouldCreateCycle(edges, 'D', 'A');
      expect(result.hasCycle).toBe(true);
    });
  });

  // ── 4. Self-loop ─────────────────────────────────────────────────────────
  describe('self-loop', () => {
    test('A → A is immediately detected as a cycle', () => {
      const result = wouldCreateCycle([], 'A', 'A');
      expect(result.hasCycle).toBe(true);
      expect(result.cycle).toEqual(['A', 'A']);
    });
  });

  // ── 5. Two-node cycle ────────────────────────────────────────────────────
  describe('two-node cycle A → B, B → A', () => {
    test('second edge closes a 2-cycle and is rejected', () => {
      const edges = [edge('A', 'B')]; // A requires B
      const result = wouldCreateCycle(edges, 'B', 'A'); // B now requires A → cycle
      expect(result.hasCycle).toBe(true);
      expect(result.cycle).toContain('A');
      expect(result.cycle).toContain('B');
    });
  });

  // ── 6. Three-node cycle ──────────────────────────────────────────────────
  describe('three-node cycle A→B, B→C, C→A', () => {
    test('third edge closes a 3-cycle', () => {
      const edges = [edge('A', 'B'), edge('B', 'C')];
      const result = wouldCreateCycle(edges, 'C', 'A');
      expect(result.hasCycle).toBe(true);
      expect(result.cycle).toContain('A');
      expect(result.cycle).toContain('B');
      expect(result.cycle).toContain('C');
      // The cycle is a closed path — first and last element are the same node.
      expect(result.cycle[0]).toBe(result.cycle[result.cycle.length - 1]);
    });
  });

  // ── 7. Larger fan-out graph with no cycle ────────────────────────────────
  describe('larger acyclic graph', () => {
    //  A → B → D
    //  A → C → D
    //  B → E
    //  C → F
    //  D → G
    const edges = [
      edge('A', 'B'),
      edge('A', 'C'),
      edge('B', 'D'),
      edge('C', 'D'),
      edge('B', 'E'),
      edge('C', 'F'),
      edge('D', 'G'),
    ];

    test('graph is valid (no cycles)', () => {
      const { hasCycle } = validateFullGraph(edges);
      expect(hasCycle).toBe(false);
    });

    test('adding G → A closes a cycle through the whole chain', () => {
      const result = wouldCreateCycle(edges, 'G', 'A');
      expect(result.hasCycle).toBe(true);
    });

    test('adding G → H (new leaf) is safe', () => {
      const result = wouldCreateCycle(edges, 'G', 'H');
      expect(result.hasCycle).toBe(false);
    });
  });

  // ── 8. Disconnected components ───────────────────────────────────────────
  describe('disconnected graph components', () => {
    // Component 1: A → B
    // Component 2: C → D
    const edges = [edge('A', 'B'), edge('C', 'D')];

    test('bridging two components A → C is safe', () => {
      const result = wouldCreateCycle(edges, 'A', 'C');
      expect(result.hasCycle).toBe(false);
    });

    test('bridging D → A and then C → A would indirectly close a cycle', () => {
      // After D → A: A → B, C → D, D → A  (C→D→A is fine, but D→A→B means A is reachable from D)
      // Then adding C → A would mean C→A and C→D→A — still fine.
      // But adding A → C would create: A→C→D→A — a cycle.
      const extEdges = [...edges, edge('D', 'A')];
      const result = wouldCreateCycle(extEdges, 'A', 'C');
      expect(result.hasCycle).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// validateFullGraph
// ---------------------------------------------------------------------------

describe('validateFullGraph', () => {
  test('empty graph is valid', () => {
    const result = validateFullGraph([]);
    expect(result.hasCycle).toBe(false);
    expect(result.nodeCount).toBe(0);
    expect(result.edgeCount).toBe(0);
  });

  test('returns correct nodeCount and edgeCount for a valid graph', () => {
    const edges = [edge('A', 'B'), edge('B', 'C'), edge('A', 'C')];
    const result = validateFullGraph(edges);
    expect(result.hasCycle).toBe(false);
    expect(result.edgeCount).toBe(3);
    // Unique nodes: A, B, C → 3
    expect(result.nodeCount).toBe(3);
  });

  test('detects a pre-existing cycle in the graph', () => {
    // Graph already has a cycle: A→B→C→A
    const edges = [edge('A', 'B'), edge('B', 'C'), edge('C', 'A')];
    const result = validateFullGraph(edges);
    expect(result.hasCycle).toBe(true);
    expect(result.cycle.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// buildAdjacencyList (internal utility, tested for correctness)
// ---------------------------------------------------------------------------

describe('buildAdjacencyList', () => {
  test('builds correct adjacency list from edges', () => {
    const edges = [edge('A', 'B'), edge('A', 'C'), edge('B', 'C')];
    const adj = buildAdjacencyList(edges);

    expect(adj.get('A').has('B')).toBe(true);
    expect(adj.get('A').has('C')).toBe(true);
    expect(adj.get('B').has('C')).toBe(true);
    // C has no outgoing edges but should still be a key.
    expect(adj.has('C')).toBe(true);
    expect(adj.get('C').size).toBe(0);
  });

  test('returns empty map for empty edge list', () => {
    const adj = buildAdjacencyList([]);
    expect(adj.size).toBe(0);
  });

  test('handles duplicate edges gracefully (idempotent)', () => {
    const edges = [edge('A', 'B'), edge('A', 'B')];
    const adj = buildAdjacencyList(edges);
    // Set deduplication: only one B in A's neighbour set.
    expect(adj.get('A').size).toBe(1);
  });
});
