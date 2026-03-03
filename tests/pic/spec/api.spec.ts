import { Manager } from "../setup/manager";
import { createIdentity } from "@dfinity/pic";
import { MiningData } from "../../../src/declarations/utxogrid_api.did.js";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Build a full MiningData object from a few distinguishing values. */
function makeMiningData(opts: {
  totalHashrate: bigint;
  totalMiners: bigint;
  difficulty: bigint;
  uptime?: string;
}): MiningData {
  return {
    miner: {
      userAgents: [
        {
          userAgent: "test-agent",
          count: 1n,
          bestDifficulty: opts.difficulty,
          totalHashrate: opts.totalHashrate,
        },
      ],
      highScores: [
        {
          updatedAt: "2025-01-01",
          bestDifficulty: opts.difficulty,
          bestDifficultyUserAgent: "test-agent",
        },
      ],
      uptime: opts.uptime ?? "1h",
    },
    pool: {
      totalHashrate: opts.totalHashrate,
      blockHeight: 800_000n,
      totalMiners: opts.totalMiners,
      blocksFound: [],
    },
    network: {
      bits: "0x17034219",
      currentTx: 100n,
      chain: "main",
      difficulty: opts.difficulty,
      next: {
        height: 800_001n,
        bits: "0x17034219",
        difficulty: opts.difficulty,
        target: "0x00000000000000000003421900000000000000000000000000000000000000",
      },
      target: "0x00000000000000000003421900000000000000000000000000000000000000",
      networkHashrate: 500_000_000n,
      pooledTx: 50n,
      currentWeight: 4_000_000n,
    },
  };
}

describe("API", () => {
  let manager: Manager;

  beforeAll(async () => {
    manager = await Manager.beforeAll();
  });

  afterAll(async () => {
    await manager.afterAll();
  });

  // ── Admin guard ──────────────────────────────────────────────────────

  it("should reject add_data from non-admin", async () => {
    const nobody = createIdentity("nobodyPassword");
    manager.setActorIdentity(nobody);

    const res = await manager.getActor().add_data({
      data: makeMiningData({ totalHashrate: 10n, totalMiners: 1n, difficulty: 1n }),
    });

    expect("err" in res).toBe(true);
    manager.resetIdentity();
  });

  it("should allow owner to add_admin, then new admin can add data", async () => {
    const nobody = createIdentity("nobodyPassword");

    // Owner adds nobody as admin
    const addRes = await manager.getActor().add_admin({ principal: nobody.getPrincipal() });
    expect("ok" in addRes).toBe(true);

    // Switch to nobody – should now succeed
    manager.setActorIdentity(nobody);
    const res = await manager.getActor().add_data({
      data: makeMiningData({ totalHashrate: 50n, totalMiners: 3n, difficulty: 2n }),
    });
    expect("ok" in res).toBe(true);

    manager.resetIdentity();
  });

  // ── Data & queries ───────────────────────────────────────────────────

  const mockData: MiningData[] = [
    makeMiningData({ totalHashrate: 100n, totalMiners: 5n, difficulty: 100n }),
    makeMiningData({ totalHashrate: 200n, totalMiners: 10n, difficulty: 200n }),
    makeMiningData({ totalHashrate: 300n, totalMiners: 15n, difficulty: 300n }),
  ];

  let timestamps: bigint[] = [];

  it("should add multiple data points", async () => {
    for (const data of mockData) {
      // advance time so each entry gets a unique timestamp
      await manager.advanceTime(1);
      await manager.advanceBlocks(1);

      const res = await manager.getActor().add_data({ data });
      expect("ok" in res).toBe(true);
      if ("ok" in res) timestamps.push(res.ok);
    }
    expect(timestamps.length).toBe(3);
  });

  it("get_data_count returns correct count", async () => {
    const res = await manager.getActor().get_data_count();
    // 3 from mockData + 1 from the admin test earlier
    expect("ok" in res).toBe(true);
    if ("ok" in res) expect(res.ok).toBe(4n);
  });

  it("get_last_data returns the most recent entry", async () => {
    const res = await manager.getActor().get_last_data();
    expect("ok" in res).toBe(true);
    if ("ok" in res) {
      expect(res.ok.data.pool.totalHashrate).toBe(300n);
      expect(res.ok.data.pool.totalMiners).toBe(15n);
    }
  });

  it("get_history_count returns N most recent in chronological order", async () => {
    const res = await manager.getActor().get_history_count({ count: 2n });
    expect("ok" in res).toBe(true);
    if ("ok" in res) {
      const points = res.ok;
      expect(points.length).toBe(2);
      // Should be ordered oldest → newest
      expect(points[0].data.pool.totalHashrate).toBe(200n);
      expect(points[1].data.pool.totalHashrate).toBe(300n);
      expect(points[0].timestamp < points[1].timestamp).toBe(true);
    }
  });

  it("get_history_range filters by time range", async () => {
    // Query only the range covering the last two mock entries
    const res = await manager.getActor().get_history_range({
      startTime: timestamps[1],
      endTime: timestamps[2],
    });
    expect("ok" in res).toBe(true);
    if ("ok" in res) {
      const points = res.ok;
      expect(points.length).toBe(2);
      expect(points[0].data.pool.totalHashrate).toBe(200n);
      expect(points[1].data.pool.totalHashrate).toBe(300n);
    }
  });

  it("get_history_range with 0 to max returns all entries", async () => {
    const res = await manager.getActor().get_history_range({
      startTime: 0n,
      endTime: BigInt("18446744073709551615"), // u64 max
    });
    expect("ok" in res).toBe(true);
    if ("ok" in res) expect(res.ok.length).toBe(4);
  });

  // ── Timestamp advancement ────────────────────────────────────────────

  it("timestamps increase after advancing time and adding more data", async () => {
    const prevLastTs = timestamps[timestamps.length - 1];

    // Advance 30 minutes and add a new point
    await manager.advanceTime(30);
    await manager.advanceBlocks(2);

    const res = await manager.getActor().add_data({
      data: makeMiningData({ totalHashrate: 400n, totalMiners: 20n, difficulty: 400n }),
    });
    expect("ok" in res).toBe(true);
    if ("ok" in res) {
      const newTs = res.ok;
      expect(newTs > prevLastTs).toBe(true);
      timestamps.push(newTs);
    }

    // Verify get_last_data reflects the new entry
    const last = await manager.getActor().get_last_data();
    expect("ok" in last).toBe(true);
    if ("ok" in last) {
      expect(last.ok.data.pool.totalHashrate).toBe(400n);
      expect(last.ok.timestamp > prevLastTs).toBe(true);
    }
  });

  it("all stored timestamps are unique and strictly ascending", async () => {
    // Advance another hour, add one more entry
    await manager.advanceTime(60);
    await manager.advanceBlocks(2);

    const res = await manager.getActor().add_data({
      data: makeMiningData({ totalHashrate: 500n, totalMiners: 25n, difficulty: 500n }),
    });
    expect("ok" in res).toBe(true);
    if ("ok" in res) timestamps.push(res.ok);

    // Fetch all entries and verify every timestamp is strictly increasing
    const all = await manager.getActor().get_history_range({
      startTime: 0n,
      endTime: BigInt("18446744073709551615"),
    });
    expect("ok" in all).toBe(true);
    if ("ok" in all) {
      const points = all.ok;
      expect(points.length).toBe(6); // 1 admin + 3 mock + 2 new
      for (let i = 1; i < points.length; i++) {
        expect(points[i].timestamp > points[i - 1].timestamp).toBe(true);
      }
    }
  });
});
