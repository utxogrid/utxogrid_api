import { Manager } from "../setup/manager";
import { MiningData } from "../../../src/declarations/utxogrid_api.did.js";

/** Build a full MiningData object from an index for deterministic variation. */
function makeMiningData(i: number): MiningData {
  const hashrate = BigInt(100 + (i % 50));
  const difficulty = BigInt(500 + (i % 200));
  const miners = BigInt(10 + (i % 30));

  return {
    miner: {
      userAgents: [
        {
          userAgent: "test-agent",
          count: 1n,
          bestDifficulty: difficulty,
          totalHashrate: hashrate,
        },
      ],
      highScores: [
        {
          updatedAt: "2025-01-01",
          bestDifficulty: difficulty,
          bestDifficultyUserAgent: "test-agent",
        },
      ],
      uptime: "1h",
    },
    pool: {
      totalHashrate: hashrate,
      blockHeight: 800_000n,
      totalMiners: miners,
      blocksFound: [],
    },
    network: {
      bits: "0x17034219",
      currentTx: 100n,
      chain: "main",
      difficulty: difficulty,
      next: {
        height: 800_001n,
        bits: "0x17034219",
        difficulty: difficulty,
        target: "0x00000000000000000003421900000000000000000000000000000000000000",
      },
      target: "0x00000000000000000003421900000000000000000000000000000000000000",
      networkHashrate: 500_000_000n,
      pooledTx: 50n,
      currentWeight: 4_000_000n,
    },
  };
}

/**
 * Stress-test: simulate ~61 days of 10-minute data (8,800 entries).
 * Mirrors the real push cadence (every 10 min) and verifies the
 * canister handles sustained writes and queries at scale.
 */
describe("Memory – ~61 days of 10-minute data", () => {
  let manager: Manager;

  const TOTAL_ENTRIES = 8_800; // ~61 days at 10-min intervals
  const INTERVAL_MINS = 10; // 1 entry every 10 minutes
  const BATCH_SIZE = 864; // ~6 days per batch (864 entries = 1 day × 6/hr × 24hr × ~6)

  beforeAll(async () => {
    manager = await Manager.beforeAll();
  }, 60_000);

  afterAll(async () => {
    await manager.afterAll();
  });

  // ── Bulk load ────────────────────────────────────────────────────────

  it(
    "should insert ~8,800 data points (~61 days of 10-min data)",
    async () => {
      let inserted = 0;

      while (inserted < TOTAL_ENTRIES) {
        const batchEnd = Math.min(inserted + BATCH_SIZE, TOTAL_ENTRIES);

        for (let i = inserted; i < batchEnd; i++) {
          await manager.advanceTime(INTERVAL_MINS);

          const data = makeMiningData(i);

          const res = await manager.getActor().add_data({ data });
          expect("ok" in res).toBe(true);
        }

        inserted = batchEnd;
        console.log(`  ↳ inserted ${inserted} / ${TOTAL_ENTRIES}`);
      }
    },
    600_000, // 10 min timeout for bulk insert
  );

  // ── Verify count ─────────────────────────────────────────────────────

  it("total count matches inserted entries", async () => {
    const res = await manager.getActor().get_data_count();
    expect("ok" in res).toBe(true);
    if ("ok" in res) expect(res.ok).toBe(BigInt(TOTAL_ENTRIES));
  });

  // ── Last entry ───────────────────────────────────────────────────────

  it("get_last_data returns the final entry", async () => {
    const res = await manager.getActor().get_last_data();
    expect("ok" in res).toBe(true);
    if ("ok" in res) {
      // Last entry index = TOTAL_ENTRIES - 1
      const i = TOTAL_ENTRIES - 1;
      expect(res.ok.data.pool.totalHashrate).toBe(BigInt(100 + (i % 50)));
      expect(res.ok.data.pool.totalMiners).toBe(BigInt(10 + (i % 30)));
    }
  });

  // ── History count query ──────────────────────────────────────────────

  it("get_history_count returns correct N entries in order", async () => {
    const N = 100n;
    const res = await manager.getActor().get_history_count({ count: N });
    expect("ok" in res).toBe(true);
    if ("ok" in res) {
      const points = res.ok;
      expect(points.length).toBe(Number(N));

      // Verify chronological (ascending) order
      for (let i = 1; i < points.length; i++) {
        expect(points[i].timestamp > points[i - 1].timestamp).toBe(true);
      }
    }
  });

  // ── Full range query ─────────────────────────────────────────────────

  it("get_history_range with full range returns all entries", async () => {
    const res = await manager.getActor().get_history_range({
      startTime: 0n,
      endTime: BigInt("18446744073709551615"),
    });
    expect("ok" in res).toBe(true);
    if ("ok" in res) {
      expect(res.ok.length).toBe(TOTAL_ENTRIES);

      // Spot-check: timestamps are strictly ascending throughout
      const points = res.ok;
      for (let i = 1; i < points.length; i++) {
        expect(points[i].timestamp > points[i - 1].timestamp).toBe(true);
      }
    }
  });

  // ── Narrow range query ───────────────────────────────────────────────

  it("get_history_range with narrow window returns subset", async () => {
    // Grab all entries to pick timestamps from the middle
    const all = await manager.getActor().get_history_range({
      startTime: 0n,
      endTime: BigInt("18446744073709551615"),
    });
    expect("ok" in all).toBe(true);
    if ("ok" in all) {
      const points = all.ok;
      // Pick a 24-hour window from the middle of the dataset
      const midIdx = Math.floor(points.length / 2);
      const startTs = points[midIdx].timestamp;
      const endTs = points[Math.min(midIdx + 23, points.length - 1)].timestamp;

      const rangeRes = await manager.getActor().get_history_range({
        startTime: startTs,
        endTime: endTs,
      });
      expect("ok" in rangeRes).toBe(true);
      if ("ok" in rangeRes) {
        expect(rangeRes.ok.length).toBe(24);
        expect(rangeRes.ok[0].timestamp).toBe(startTs);
        expect(rangeRes.ok[rangeRes.ok.length - 1].timestamp).toBe(endTs);
      }
    }
  });

  // ── Canister still responsive ────────────────────────────────────────

  it("canister is still responsive after heavy load", async () => {
    // Add one more entry after the bulk load
    await manager.advanceTime(INTERVAL_MINS);
    await manager.advanceBlocks(1);

    const finalData: MiningData = {
      miner: {
        userAgents: [
          { userAgent: "test-agent", count: 1n, bestDifficulty: 999n, totalHashrate: 999n },
        ],
        highScores: [
          { updatedAt: "2025-12-31", bestDifficulty: 999n, bestDifficultyUserAgent: "test-agent" },
        ],
        uptime: "1y",
      },
      pool: {
        totalHashrate: 999n,
        blockHeight: 800_000n,
        totalMiners: 99n,
        blocksFound: [],
      },
      network: {
        bits: "0x17034219",
        currentTx: 100n,
        chain: "main",
        difficulty: 999n,
        next: {
          height: 800_001n,
          bits: "0x17034219",
          difficulty: 999n,
          target: "0x000",
        },
        target: "0x000",
        networkHashrate: 500_000_000n,
        pooledTx: 50n,
        currentWeight: 4_000_000n,
      },
    };

    const res = await manager.getActor().add_data({ data: finalData });
    expect("ok" in res).toBe(true);

    const last = await manager.getActor().get_last_data();
    expect("ok" in last).toBe(true);
    if ("ok" in last) {
      expect(last.ok.data.pool.totalHashrate).toBe(999n);
    }

    const count = await manager.getActor().get_data_count();
    expect("ok" in count).toBe(true);
    if ("ok" in count) expect(count.ok).toBe(BigInt(TOTAL_ENTRIES + 1));
  });
});
