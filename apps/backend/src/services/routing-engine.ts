/**
 * Multimodal trip-planning engine.
 *
 * Builds a graph where nodes are (stop, current-route) states and edges are:
 *   - ride segments along each route (bidirectional),
 *   - walking transfers between nearby stops,
 *   - walking from the origin / to the destination.
 *
 * A mode-aware Dijkstra search then optimizes a lexicographic cost tuple:
 *   FASTEST          → (time, transfers, fare, walking)
 *   CHEAPEST         → (fare, time, transfers, walking)
 *   FEWEST_TRANSFERS → (boardings, time, fare, walking)
 *   LEAST_WALKING    → (walking, time, fare, transfers)
 *
 * Alternatives are produced by re-running the search with the dominant route
 * of the previous solution banned from boarding.
 */
import {
  haversineMeters,
  MODE_SPEED_KMH,
  WALKING_SPEED_KMH,
  type ConfidenceLevel,
  type FareType,
  type GeoPoint,
  type RideLeg,
  type RouteDto,
  type SearchMode,
  type StopDto,
  type Trip,
  type TripLeg,
  type WalkLeg,
} from '@mowaslaty/shared';

// ============= Tunables =============
export const ENGINE_CONFIG = {
  /** Max walking distance from the origin to the first stop (m). */
  firstWalkM: 1500,
  /** Max walking distance from the last stop to the destination (m). */
  lastWalkM: 1500,
  /** Stops closer than this can be transferred between on foot (m). */
  walkTransferRadiusM: 700,
  /** If origin→destination is within this distance, offer walking as a trip. */
  directWalkMaxM: 1200,
  /** Hard cap on total walking per trip (prevents walk-only chains). */
  maxTotalWalkM: 1600,
  /** Average wait when boarding a vehicle (min). */
  waitMin: 5,
  /** Extra penalty when switching between two vehicles (min). */
  transferPenaltyMin: 2,
  /** Dwell time added per segment (min). */
  dwellMin: 0.8,
  /** Fallback fare when a route has none recorded (EGP). */
  defaultFare: 5,
  /** Per-km rate for distance-based fares (EGP/km). */
  distanceFarePerKm: 0.5,
  /** Safety cap on Dijkstra expansions. */
  maxExpansions: 50_000,
  /** How many alternative trips to return at most. */
  maxAlternatives: 3,
};

export interface EngineStop {
  id: string;
  name: string;
  nameAr: string;
  lat: number;
  lng: number;
}

export interface EngineRoute {
  id: string;
  name: string;
  nameAr: string;
  modeName: string;
  modeNameAr: string;
  modeIcon: string;
  modeColor: string;
  fare: number | null;
  fareType: FareType;
  confidence: ConfidenceLevel;
  speedKmh: number;
  stopIds: string[];
}

export interface EngineGraph {
  stops: Map<string, EngineStop>;
  routes: EngineRoute[];
  /** stopId → list of { route, index of the stop in that route } */
  routeIndex: Map<string, Array<{ route: EngineRoute; index: number }>>;
  /** stopId → walking-reachable neighbour stops */
  walkNeighbors: Map<string, Array<{ stopId: string; distanceM: number }>>;
}

const MODE_KEY_BY_NAME: Record<string, string> = {
  bus: 'BUS',
  minibus: 'MINIBUS',
  metro: 'METRO',
  train: 'TRAIN',
  tram: 'TRAM',
  brt: 'BRT',
  shared: 'SHARED',
  taxi: 'TAXI',
  walking: 'WALKING',
};

export function buildGraph(stops: StopDto[], routes: RouteDto[]): EngineGraph {
  const stopMap = new Map<string, EngineStop>();
  for (const s of stops) {
    stopMap.set(s.id, { id: s.id, name: s.name, nameAr: s.nameAr, lat: s.latitude, lng: s.longitude });
  }

  const engineRoutes: EngineRoute[] = [];
  const routeIndex = new Map<string, Array<{ route: EngineRoute; index: number }>>();

  for (const r of routes) {
    const stopIds = (r.stops ?? []).map((rs) => rs.stopId).filter((id) => stopMap.has(id));
    if (stopIds.length < 2 || !r.transportMode) continue;
    const modeKey = MODE_KEY_BY_NAME[r.transportMode.name.toLowerCase()] ?? 'BUS';
    const engineRoute: EngineRoute = {
      id: r.id,
      name: r.name,
      nameAr: r.nameAr,
      modeName: r.transportMode.name,
      modeNameAr: r.transportMode.nameAr,
      modeIcon: r.transportMode.icon,
      modeColor: r.transportMode.color,
      fare: r.fare,
      fareType: r.fareType,
      confidence: r.confidenceLevel,
      speedKmh: MODE_SPEED_KMH[modeKey] ?? 18,
      stopIds,
    };
    engineRoutes.push(engineRoute);
    stopIds.forEach((stopId, index) => {
      const list = routeIndex.get(stopId) ?? [];
      list.push({ route: engineRoute, index });
      routeIndex.set(stopId, list);
    });
  }

  const walkNeighbors = new Map<string, Array<{ stopId: string; distanceM: number }>>();
  const all = [...stopMap.values()];
  for (const a of all) {
    const neighbors: Array<{ stopId: string; distanceM: number }> = [];
    for (const b of all) {
      if (a.id === b.id) continue;
      const d = haversineMeters({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
      if (d <= ENGINE_CONFIG.walkTransferRadiusM) neighbors.push({ stopId: b.id, distanceM: d });
    }
    neighbors.sort((x, y) => x.distanceM - y.distanceM);
    walkNeighbors.set(a.id, neighbors.slice(0, 12));
  }

  return { stops: stopMap, routes: engineRoutes, routeIndex, walkNeighbors };
}

// ============= Cost algebra =============

interface Cost {
  time: number; // minutes
  fare: number; // EGP
  boardings: number;
  walkM: number;
}

const addCost = (a: Cost, b: Cost): Cost => ({
  time: a.time + b.time,
  fare: a.fare + b.fare,
  boardings: a.boardings + b.boardings,
  walkM: a.walkM + b.walkM,
});

function tuple(c: Cost, mode: SearchMode): number[] {
  const transfers = Math.max(0, c.boardings - 1);
  switch (mode) {
    case 'FASTEST':
      return [c.time, transfers, c.fare, c.walkM];
    case 'CHEAPEST':
      return [c.fare, c.time, transfers, c.walkM];
    case 'FEWEST_TRANSFERS':
      return [c.boardings, c.time, c.fare, c.walkM];
    case 'LEAST_WALKING':
      return [c.walkM, c.time, c.fare, c.boardings];
  }
}

const compareByMode = (mode: SearchMode) => (a: Cost, b: Cost): number => {
  const ta = tuple(a, mode);
  const tb = tuple(b, mode);
  for (let i = 0; i < ta.length; i++) {
    if (ta[i] !== tb[i]) return ta[i] - tb[i];
  }
  return 0;
};

// ============= Priority queue =============

class MinHeap<T> {
  private items: Array<{ key: number; value: T }> = [];

  get size() {
    return this.items.length;
  }

  push(key: number, value: T) {
    this.items.push({ key, value });
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.items[p].key <= this.items[i].key) break;
      [this.items[p], this.items[i]] = [this.items[i], this.items[p]];
      i = p;
    }
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.items[l].key < this.items[m].key) m = l;
        if (r < this.items.length && this.items[r].key < this.items[m].key) m = r;
        if (m === i) break;
        [this.items[m], this.items[i]] = [this.items[i], this.items[m]];
        i = m;
      }
    }
    return top.value;
  }
}

// ============= Edge model =============

interface EdgeInfo {
  kind: 'walk' | 'ride';
  routeId?: string;
  boarding: boolean; // true when this edge boards (or switches to) the route
  fromStopId: string;
  toStopId: string; // DEST sentinel for final walk
  distanceM: number;
  durationMin: number;
  fare: number;
}

interface SearchState {
  stopId: string; // DEST sentinel = '__dest__'
  routeId: string | null; // null = on foot
}

const DEST = '__dest__';
const stateKey = (s: SearchState) => `${s.stopId}|${s.routeId ?? '·'}`;

function segTimeMin(route: EngineRoute, distanceM: number): number {
  return (distanceM / 1000 / route.speedKmh) * 60 + ENGINE_CONFIG.dwellMin;
}

function boardingFare(route: EngineRoute, segDistanceM: number): number {
  switch (route.fareType) {
    case 'DISTANCE_BASED': {
      const base = route.fare ?? 8;
      return Math.max(base, Math.round((segDistanceM / 1000) * ENGINE_CONFIG.distanceFarePerKm));
    }
    case 'FIXED':
    case 'STAGE_BASED':
    case 'ZONE_BASED':
    default:
      return route.fare ?? ENGINE_CONFIG.defaultFare;
  }
}

export interface PlanInput {
  from: GeoPoint;
  to: GeoPoint;
  fromName: string;
  toName: string;
  mode: SearchMode;
  bannedRoutes?: Set<string>;
}

interface DijkstraOutcome {
  cost: Cost;
  edges: EdgeInfo[];
}

function dijkstra(graph: EngineGraph, input: PlanInput): DijkstraOutcome | null {
  const cmp = compareByMode(input.mode);
  const banned = input.bannedRoutes ?? new Set<string>();

  const startStates: Array<{ state: SearchState; cost: Cost; edge: EdgeInfo | null }> = [];
  for (const stop of graph.stops.values()) {
    const d = haversineMeters(input.from, { lat: stop.lat, lng: stop.lng });
    if (d <= ENGINE_CONFIG.firstWalkM) {
      startStates.push({
        state: { stopId: stop.id, routeId: null },
        cost: { time: (d / 1000 / WALKING_SPEED_KMH) * 60, fare: 0, boardings: 0, walkM: d },
        edge: {
          kind: 'walk',
          fromStopId: 'ORIGIN',
          toStopId: stop.id,
          distanceM: d,
          durationMin: (d / 1000 / WALKING_SPEED_KMH) * 60,
          fare: 0,
          boarding: false,
        },
      });
    }
  }
  if (startStates.length === 0) return null;

  const best = new Map<string, Cost>();
  const parent = new Map<string, { prevKey: string; edge: EdgeInfo }>();
  const heap = new MinHeap<{ state: SearchState; cost: Cost }>();

  const keyFor = (state: SearchState) => stateKey(state);
  const scalar = (c: Cost) => tuple(c, input.mode)[0] * 1000 + c.time; // heap ordering by primary, then time

  for (const start of startStates) {
    const k = keyFor(start.state);
    if (!best.has(k) || cmp(start.cost, best.get(k)!) < 0) {
      best.set(k, start.cost);
      if (start.edge) parent.set(k, { prevKey: 'ORIGIN', edge: start.edge });
      heap.push(scalar(start.cost), { state: start.state, cost: start.cost });
    }
  }

  let expansions = 0;
  let destResult: DijkstraOutcome | null = null;

  while (heap.size > 0 && expansions < ENGINE_CONFIG.maxExpansions) {
    const current = heap.pop()!;
    expansions++;
    const curKey = keyFor(current.state);
    const curBest = best.get(curKey);
    if (!curBest || cmp(current.cost, curBest) > 0) continue; // stale entry

    // ---- Reached destination? ----
    if (current.state.stopId === DEST) {
      const edges: EdgeInfo[] = [];
      let k = curKey;
      while (parent.has(k)) {
        const p = parent.get(k)!;
        edges.unshift(p.edge);
        k = p.prevKey;
      }
      destResult = { cost: current.cost, edges };
      break; // Dijkstra: first pop of DEST is optimal for this mode
    }

    const stop = graph.stops.get(current.state.stopId);
    if (!stop) continue;
    const here = graph.stops.get(current.state.stopId)!;

    const relax = (state: SearchState, cost: Cost, edge: EdgeInfo) => {
      const k = keyFor(state);
      const prev = best.get(k);
      if (prev && cmp(prev, cost) <= 0) return;
      best.set(k, cost);
      parent.set(k, { prevKey: curKey, edge });
      heap.push(scalar(cost), { state, cost });
    };

    // ---- Walk to destination ----
    const dDest = haversineMeters({ lat: here.lat, lng: here.lng }, input.to);
    if (
      dDest <= ENGINE_CONFIG.lastWalkM &&
      current.cost.walkM + dDest <= ENGINE_CONFIG.maxTotalWalkM
    ) {
      const walkTime = (dDest / 1000 / WALKING_SPEED_KMH) * 60;
      relax(
        { stopId: DEST, routeId: null },
        addCost(current.cost, { time: walkTime, fare: 0, boardings: 0, walkM: dDest }),
        {
          kind: 'walk',
          fromStopId: here.id,
          toStopId: DEST,
          distanceM: dDest,
          durationMin: walkTime,
          fare: 0,
          boarding: false,
        },
      );
    }

    // ---- Ride along routes serving this stop ----
    for (const { route, index } of graph.routeIndex.get(here.id) ?? []) {
      if (banned.has(route.id)) continue;
      for (const nextIndex of [index + 1, index - 1]) {
        const nextStopId = route.stopIds[nextIndex];
        if (!nextStopId) continue;
        const next = graph.stops.get(nextStopId);
        if (!next) continue;
        const segDist = haversineMeters({ lat: here.lat, lng: here.lng }, { lat: next.lat, lng: next.lng });
        const riding = current.state.routeId === route.id;
        const travel = segTimeMin(route, segDist);
        if (riding) {
          relax(
            { stopId: nextStopId, routeId: route.id },
            addCost(current.cost, { time: travel, fare: 0, boardings: 0, walkM: 0 }),
            {
              kind: 'ride',
              routeId: route.id,
              boarding: false,
              fromStopId: here.id,
              toStopId: nextStopId,
              distanceM: segDist,
              durationMin: travel,
              fare: 0,
            },
          );
        } else {
          const wait =
            ENGINE_CONFIG.waitMin + (current.state.routeId ? ENGINE_CONFIG.transferPenaltyMin : 0);
          const fare = boardingFare(route, segDist);
          relax(
            { stopId: nextStopId, routeId: route.id },
            addCost(current.cost, { time: wait + travel, fare, boardings: 1, walkM: 0 }),
            {
              kind: 'ride',
              routeId: route.id,
              boarding: true,
              fromStopId: here.id,
              toStopId: nextStopId,
              distanceM: segDist,
              durationMin: wait + travel,
              fare,
            },
          );
        }
      }
    }

    // ---- Walking transfers ----
    for (const { stopId, distanceM } of graph.walkNeighbors.get(here.id) ?? []) {
      if (current.cost.walkM + distanceM > ENGINE_CONFIG.maxTotalWalkM) continue;
      const walkTime = (distanceM / 1000 / WALKING_SPEED_KMH) * 60;
      relax(
        { stopId, routeId: null },
        addCost(current.cost, { time: walkTime, fare: 0, boardings: 0, walkM: distanceM }),
        {
          kind: 'walk',
          fromStopId: here.id,
          toStopId: stopId,
          distanceM,
          durationMin: walkTime,
          fare: 0,
          boarding: false,
        },
      );
    }
  }

  return destResult;
}

// ============= Path → Trip conversion =============

const confidenceRank: Record<ConfidenceLevel, number> = { HIGH: 3, MEDIUM: 2, LOW: 1, UNVERIFIED: 0 };

function edgesToTrip(graph: EngineGraph, input: PlanInput, outcome: DijkstraOutcome, seq: number): Trip {
  const legs: TripLeg[] = [];
  let currentWalk: { edges: EdgeInfo[]; fromLabel: string } | null = null;

  const stopName = (id: string): string => graph.stops.get(id)?.nameAr ?? id;

  const flushWalk = (toLabel: string) => {
    if (!currentWalk || currentWalk.edges.length === 0) {
      currentWalk = null;
      return;
    }
    const distanceM = currentWalk.edges.reduce((s, e) => s + e.distanceM, 0);
    const durationMin = currentWalk.edges.reduce((s, e) => s + e.durationMin, 0);
    const first = currentWalk.edges[0];
    const last = currentWalk.edges[currentWalk.edges.length - 1];
    const walk: WalkLeg = {
      type: 'WALK',
      fromName: currentWalk.fromLabel,
      toName: toLabel,
      from:
        first.fromStopId === 'ORIGIN'
          ? input.from
          : { lat: graph.stops.get(first.fromStopId)!.lat, lng: graph.stops.get(first.fromStopId)!.lng },
      to:
        last.toStopId === DEST
          ? input.to
          : { lat: graph.stops.get(last.toStopId)!.lat, lng: graph.stops.get(last.toStopId)!.lng },
      durationMin,
      distanceKm: distanceM / 1000,
    };
    legs.push(walk);
    currentWalk = null;
  };

  let currentRide: { routeId: string; edges: EdgeInfo[] } | null = null;

  const flushRide = () => {
    if (!currentRide) return;
    const route = graph.routes.find((r) => r.id === currentRide!.routeId)!;
    const distanceM = currentRide.edges.reduce((s, e) => s + e.distanceM, 0);
    const durationMin = currentRide.edges.reduce((s, e) => s + e.durationMin, 0);
    const fare = currentRide.edges.reduce((s, e) => s + e.fare, 0);
    const firstStop = currentRide.edges[0].fromStopId;
    const lastStop = currentRide.edges[currentRide.edges.length - 1].toStopId;
    const ride: RideLeg = {
      type: 'RIDE',
      routeId: route.id,
      routeName: route.name,
      routeNameAr: route.nameAr,
      modeName: route.modeName,
      modeNameAr: route.modeNameAr,
      modeIcon: route.modeIcon,
      modeColor: route.modeColor,
      fromStopId: firstStop,
      fromName: stopName(firstStop),
      toStopId: lastStop,
      toName: stopName(lastStop),
      from: {
        lat: graph.stops.get(firstStop)?.lat ?? 0,
        lng: graph.stops.get(firstStop)?.lng ?? 0,
      },
      to: {
        lat: graph.stops.get(lastStop)?.lat ?? 0,
        lng: graph.stops.get(lastStop)?.lng ?? 0,
      },
      stopsCount: currentRide.edges.length + 1,
      durationMin,
      distanceKm: distanceM / 1000,
      fare,
      confidence: route.confidence,
    };
    legs.push(ride);
    currentRide = null;
  };

  for (const edge of outcome.edges) {
    if (edge.kind === 'walk') {
      if (currentRide) flushRide();
      const fromLabel =
        edge.fromStopId === 'ORIGIN' ? input.fromName : stopName(edge.fromStopId);
      if (!currentWalk) currentWalk = { edges: [], fromLabel };
      currentWalk.edges.push(edge);
      // A walk edge chain ends when it arrives at a stop we board from, or DEST.
      const nextIsRide = false; // decided by next iteration
      if (edge.toStopId === DEST) {
        flushWalk(input.toName);
      } else {
        // keep accumulating; boarding edges will flush with proper label
      }
      void nextIsRide;
    } else {
      // ride edge
      if (currentWalk) flushWalk(stopName(edge.fromStopId));
      if (!currentRide || currentRide.routeId !== edge.routeId || edge.boarding) {
        if (currentRide) flushRide();
        currentRide = { routeId: edge.routeId!, edges: [] };
      }
      currentRide.edges.push(edge);
    }
  }
  if (currentRide) flushRide();
  if (currentWalk) flushWalk(input.toName);

  const rideLegs = legs.filter((l): l is RideLeg => l.type === 'RIDE');
  const minConfidence =
    rideLegs.length === 0
      ? 'HIGH'
      : rideLegs.reduce<ConfidenceLevel>(
          (acc, l) => (confidenceRank[l.confidence] < confidenceRank[acc] ? l.confidence : acc),
          'HIGH',
        );

  return {
    id: `trip-${input.mode.toLowerCase()}-${seq}`,
    mode: input.mode,
    legs,
    totalDurationMin: outcome.cost.time,
    totalFare: outcome.cost.fare,
    transfers: Math.max(0, outcome.cost.boardings - 1),
    walkDistanceKm: outcome.cost.walkM / 1000,
    confidence: minConfidence,
  };
}

function tripSignature(trip: Trip): string {
  return trip.legs
    .map((l) => (l.type === 'RIDE' ? l.routeId : `walk:${l.distanceKm.toFixed(2)}`))
    .join('>');
}

/** Dominant route of a trip = route covering the most legs/distance. */
function dominantRoute(trip: Trip): string | null {
  const rides = trip.legs.filter((l): l is RideLeg => l.type === 'RIDE');
  if (rides.length === 0) return null;
  return [...rides].sort((a, b) => b.distanceKm - a.distanceKm)[0].routeId;
}

// ============= Public API =============

export function planTrips(graph: EngineGraph, input: Omit<PlanInput, 'bannedRoutes'>): Trip[] {
  const directDistance = haversineMeters(input.from, input.to);

  const trips: Trip[] = [];
  const seen = new Set<string>();
  const banned = new Set<string>();

  for (let i = 0; i < ENGINE_CONFIG.maxAlternatives; i++) {
    const outcome = dijkstra(graph, { ...input, bannedRoutes: new Set(banned) });
    if (!outcome) break;
    const trip = edgesToTrip(graph, input, outcome, i + 1);
    const sig = tripSignature(trip);
    if (!seen.has(sig)) {
      seen.add(sig);
      trips.push(trip);
    }
    const dominant = dominantRoute(trip);
    if (!dominant || banned.has(dominant)) break;
    banned.add(dominant);
  }

  // Direct walk fallback for short distances.
  if (directDistance <= ENGINE_CONFIG.directWalkMaxM) {
    const walkTime = (directDistance / 1000 / WALKING_SPEED_KMH) * 60;
    trips.push({
      id: `trip-${input.mode.toLowerCase()}-walk-direct`,
      mode: input.mode,
      legs: [
        {
          type: 'WALK',
          fromName: input.fromName,
          toName: input.toName,
          from: input.from,
          to: input.to,
          durationMin: walkTime,
          distanceKm: directDistance / 1000,
        },
      ],
      totalDurationMin: walkTime,
      totalFare: 0,
      transfers: 0,
      walkDistanceKm: directDistance / 1000,
      confidence: 'HIGH',
    });
  }

  // Rank the final list by the requested mode's cost tuple.
  const cmp = compareByMode(input.mode);
  trips.sort((a, b) =>
    cmp(
      { time: a.totalDurationMin, fare: a.totalFare, boardings: a.transfers + (a.legs.some((l) => l.type === 'RIDE') ? 1 : 0), walkM: a.walkDistanceKm * 1000 },
      { time: b.totalDurationMin, fare: b.totalFare, boardings: b.transfers + (b.legs.some((l) => l.type === 'RIDE') ? 1 : 0), walkM: b.walkDistanceKm * 1000 },
    ),
  );

  return trips;
}
