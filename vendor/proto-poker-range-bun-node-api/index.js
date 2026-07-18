import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

function loadNative() {
  // The local fallback keeps source-tree tests and `cargo build` development ergonomic.
  // The Elysia bundle generator copies the compiled library here as `index.node`.
  const localBinary = fileURLToPath(new URL("./index.node", import.meta.url));
  if (existsSync(localBinary)) return require(localBinary);
  throw new Error(
    `Missing internal Node-API binary: ${localBinary}. Build proto-poker-range-node and prepare the Elysia bundle for this platform.`,
  );
}

const native = loadNative();

function toNativeDimension(request) {
  return {
    strategy: request.strategy,
    playerCount: request.playerCount,
    depthBb: request.depthBb,
  };
}

function fromNativeAction(action) {
  return {
    actionName: action.actionName,
    actionSize: action.actionSize,
    amountBb: action.amountBb,
    frequency: action.frequency,
    handEv: action.handEv,
  };
}

export class RangeStoreError extends Error {
  constructor(code, businessCode, message, options = undefined) {
    super(message, options);
    this.name = "RangeStoreError";
    this.code = code;
    this.businessCode = businessCode;
  }
}

const INVALID_ARGUMENT_CODES = new Set(["INVALID_ARGUMENT", "UNKNOWN_HAND"]);
const NOT_FOUND_CODES = new Set([
  "DIMENSION_NOT_FOUND",
  "DATA_FILE_NOT_FOUND",
  "DRILL_SCENARIO_NOT_FOUND",
  "ABSTRACT_LINE_NOT_FOUND",
  "CONCRETE_LINE_NOT_FOUND",
  "HAND_STRATEGY_NOT_FOUND",
  "ACTION_NOT_FOUND",
  "HANDS_NOT_FOUND",
]);

function businessCodeFor(code) {
  if (INVALID_ARGUMENT_CODES.has(code)) return 1000;
  if (NOT_FOUND_CODES.has(code)) return 404;
  if (code === "SERVICE_UNAVAILABLE") return 503;
  return 500;
}

function toRangeStoreError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const match = /^RANGE_STORE_ERROR:([A-Z_]+):(.*)$/s.exec(message);
  if (match) {
    const code = match[1] === "UNKNOWN_HAND" ? "INVALID_ARGUMENT" : match[1];
    return new RangeStoreError(code, businessCodeFor(code), match[2], { cause: error });
  }
  return new RangeStoreError("INTERNAL", 500, message, { cause: error });
}

function callNative(fn) {
  try {
    return fn();
  } catch (error) {
    throw toRangeStoreError(error);
  }
}

export class PokerHandsRange {
  #native;

  constructor(options) {
    this.#native = callNative(
      () =>
        new native.PokerHandsRange({
          dataDir: options.dataDir,
          maxOpenHandles: options.maxOpenHandles,
          verifyChecksums: options.verifyChecksums,
        }),
    );
  }

  getConcreteLines(request) {
    const result = callNative(() =>
      this.#native.getConcreteLines({
        ...toNativeDimension(request),
        abstractLine: request.abstractLine,
        concreteLine: request.concreteLine,
      }),
    );
    return {
      lines: result.lines.map((line) => ({
        concreteLineId: line.concreteLineId,
        abstractLine: line.abstractLine,
        concreteLine: line.concreteLine,
      })),
    };
  }

  getAbstractLines(request) {
    const result = callNative(() =>
      this.#native.getAbstractLines({
        strategy: request.strategy,
        drillName: request.drillName,
        playerCount: request.playerCount,
        drillDepth: request.drillDepth,
      }),
    );
    return { abstractLines: result.abstractLines };
  }

  handsByActions(request) {
    const result = callNative(() =>
      this.#native.handsByActions({
        ...toNativeDimension(request),
        concreteLineId: request.concreteLineId,
        actions: request.actions,
        frequency: request.frequency,
      }),
    );
    return { holeCards: result.holeCards };
  }

  queryHandStrategy(request) {
    const result = callNative(() =>
      this.#native.queryHandStrategy({
        ...toNativeDimension(request),
        concreteLineId: request.concreteLineId,
        holeCards: request.holeCards,
      }),
    );
    return {
      actions: result.actions.map(fromNativeAction),
    };
  }

  queryBatch(request) {
    const result = callNative(() =>
      this.#native.queryBatch({
        ...toNativeDimension(request),
        items: request.items.map((item) => ({
          concreteLineId: item.concreteLineId,
          holeCards: item.holeCards,
        })),
      }),
    );
    return {
      results: result.results.map((item) => ({
        concreteLineId: item.concreteLineId,
        holeCards: item.holeCards,
        actions: item.actions.map(fromNativeAction),
      })),
    };
  }

  prewarm(request) {
    const result = callNative(() => this.#native.prewarm(toNativeDimension(request)));
    return { openHandleCount: result.openHandleCount };
  }

  stats() {
    const result = this.#native.stats();
    return {
      schemaCount: result.schemaCount,
      openHandleCount: result.openHandleCount,
      knownDimensions: result.knownDimensions,
    };
  }
}
