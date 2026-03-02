import { Manager } from "../setup/manager";
import { MinerData } from "../../../src/declarations/utxogrid_api.did.js";

/**
 * Stress-test: simulate 1 year+ of hourly miner data (8,800 entries).
 * Verifies the canister handles sustained writes and queries at scale.
 */
describe("Memory – 1 year of hourly data", () => {
  let manager: Manager;

  const TOTAL_ENTRIES = 8_800; // ~1 year + a few extra days
  const INTERVAL_MINS = 60; // 1 entry per hour
  const BATCH_SIZE = 733; // ~1 month per batch (for progress tracking)

  beforeAll(async () => {
    manager = await Manager.beforeAll();
  }, 60_000);

  afterAll(async () => {
    await manager.afterAll();
  });

  // ── Bulk load ────────────────────────────────────────────────────────

  it(
    "should insert ~8,800 data points (1 year of hourly data)",
    async () => {
      let inserted = 0;

      while (inserted < TOTAL_ENTRIES) {
        const batchEnd = Math.min(inserted + BATCH_SIZE, TOTAL_ENTRIES);

        for (let i = inserted; i < batchEnd; i++) {
          await manager.advanceTime(INTERVAL_MINS);

          const data: MinerData = {
            currentTH: `${(100 + (i % 50)).toFixed(1)}`,
            bestDifficulty: `${(500 + (i % 200)).toFixed(1)}`,
            totalMiners: BigInt(10 + (i % 30)),
          };

          const res = await manager.getActor().add_miner_data({ data });
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
    const res = await manager.getActor().get_miner_data_count();
    expect("ok" in res).toBe(true);
    if ("ok" in res) expect(res.ok).toBe(BigInt(TOTAL_ENTRIES));
  });

  // ── Last entry ───────────────────────────────────────────────────────

  it("get_last_miner_data returns the final entry", async () => {
    const res = await manager.getActor().get_last_miner_data();
    expect("ok" in res).toBe(true);
    if ("ok" in res) {
      // Last entry index = TOTAL_ENTRIES - 1
      const i = TOTAL_ENTRIES - 1;
      expect(res.ok.data.currentTH).toBe(`${(100 + (i % 50)).toFixed(1)}`);
      expect(res.ok.data.totalMiners).toBe(BigInt(10 + (i % 30)));
    }
  });

  // ── History count query ──────────────────────────────────────────────

  it("get_miner_history_count returns correct N entries in order", async () => {
    const N = 100n;
    const res = await manager.getActor().get_miner_history_count({ count: N });
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

  it("get_miner_history_range with full range returns all entries", async () => {
    const res = await manager.getActor().get_miner_history_range({
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

  it("get_miner_history_range with narrow window returns subset", async () => {
    // Grab all entries to pick timestamps from the middle
    const all = await manager.getActor().get_miner_history_range({
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

      const rangeRes = await manager.getActor().get_miner_history_range({
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

    const res = await manager.getActor().add_miner_data({
      data: { currentTH: "999.9", bestDifficulty: "999.9", totalMiners: 99n },
    });
    expect("ok" in res).toBe(true);

    const last = await manager.getActor().get_last_miner_data();
    expect("ok" in last).toBe(true);
    if ("ok" in last) {
      expect(last.ok.data.currentTH).toBe("999.9");
    }

    const count = await manager.getActor().get_miner_data_count();
    expect("ok" in count).toBe(true);
    if ("ok" in count) expect(count.ok).toBe(BigInt(TOTAL_ENTRIES + 1));
  });
});
