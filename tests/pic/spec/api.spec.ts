import { Manager } from "../setup/manager";
import { createIdentity } from "@dfinity/pic";
import { MinerData } from "../../../src/declarations/utxogrid_api.did.js";

describe("API", () => {
  let manager: Manager;

  beforeAll(async () => {
    manager = await Manager.beforeAll();
  });

  afterAll(async () => {
    await manager.afterAll();
  });

  // ── Admin guard ──────────────────────────────────────────────────────

  it("should reject add_miner_data from non-admin", async () => {
    const nobody = createIdentity("nobodyPassword");
    manager.setActorIdentity(nobody);

    const res = await manager.getActor().add_miner_data({
      data: { currentTH: "1.0", bestDifficulty: "1.0", totalMiners: 1n },
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
    const res = await manager.getActor().add_miner_data({
      data: { currentTH: "5.0", bestDifficulty: "2.0", totalMiners: 3n },
    });
    expect("ok" in res).toBe(true);

    manager.resetIdentity();
  });

  // ── Data & queries ───────────────────────────────────────────────────

  const mockData: MinerData[] = [
    { currentTH: "10.0", bestDifficulty: "100.0", totalMiners: 5n },
    { currentTH: "20.0", bestDifficulty: "200.0", totalMiners: 10n },
    { currentTH: "30.0", bestDifficulty: "300.0", totalMiners: 15n },
  ];

  let timestamps: bigint[] = [];

  it("should add multiple miner data points", async () => {
    for (const data of mockData) {
      // advance time so each entry gets a unique timestamp
      await manager.advanceTime(1);
      await manager.advanceBlocks(1);

      const res = await manager.getActor().add_miner_data({ data });
      expect("ok" in res).toBe(true);
      if ("ok" in res) timestamps.push(res.ok);
    }
    expect(timestamps.length).toBe(3);
  });

  it("get_miner_data_count returns correct count", async () => {
    const res = await manager.getActor().get_miner_data_count();
    // 3 from mockData + 1 from the admin test earlier
    expect("ok" in res).toBe(true);
    if ("ok" in res) expect(res.ok).toBe(4n);
  });

  it("get_last_miner_data returns the most recent entry", async () => {
    const res = await manager.getActor().get_last_miner_data();
    expect("ok" in res).toBe(true);
    if ("ok" in res) {
      expect(res.ok.data.currentTH).toBe("30.0");
      expect(res.ok.data.totalMiners).toBe(15n);
    }
  });

  it("get_miner_history_count returns N most recent in chronological order", async () => {
    const res = await manager.getActor().get_miner_history_count({ count: 2n });
    expect("ok" in res).toBe(true);
    if ("ok" in res) {
      const points = res.ok;
      expect(points.length).toBe(2);
      // Should be ordered oldest → newest
      expect(points[0].data.currentTH).toBe("20.0");
      expect(points[1].data.currentTH).toBe("30.0");
      expect(points[0].timestamp < points[1].timestamp).toBe(true);
    }
  });

  it("get_miner_history_range filters by time range", async () => {
    // Query only the range covering the last two mock entries
    const res = await manager.getActor().get_miner_history_range({
      startTime: timestamps[1],
      endTime: timestamps[2],
    });
    expect("ok" in res).toBe(true);
    if ("ok" in res) {
      const points = res.ok;
      expect(points.length).toBe(2);
      expect(points[0].data.currentTH).toBe("20.0");
      expect(points[1].data.currentTH).toBe("30.0");
    }
  });

  it("get_miner_history_range with 0 to max returns all entries", async () => {
    const res = await manager.getActor().get_miner_history_range({
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

    const res = await manager.getActor().add_miner_data({
      data: { currentTH: "40.0", bestDifficulty: "400.0", totalMiners: 20n },
    });
    expect("ok" in res).toBe(true);
    if ("ok" in res) {
      const newTs = res.ok;
      expect(newTs > prevLastTs).toBe(true);
      timestamps.push(newTs);
    }

    // Verify get_last_miner_data reflects the new entry
    const last = await manager.getActor().get_last_miner_data();
    expect("ok" in last).toBe(true);
    if ("ok" in last) {
      expect(last.ok.data.currentTH).toBe("40.0");
      expect(last.ok.timestamp > prevLastTs).toBe(true);
    }
  });

  it("all stored timestamps are unique and strictly ascending", async () => {
    // Advance another hour, add one more entry
    await manager.advanceTime(60);
    await manager.advanceBlocks(2);

    const res = await manager.getActor().add_miner_data({
      data: { currentTH: "50.0", bestDifficulty: "500.0", totalMiners: 25n },
    });
    expect("ok" in res).toBe(true);
    if ("ok" in res) timestamps.push(res.ok);

    // Fetch all entries and verify every timestamp is strictly increasing
    const all = await manager.getActor().get_miner_history_range({
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
