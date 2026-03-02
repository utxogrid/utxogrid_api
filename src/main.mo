import Map "mo:core/Map";
import Nat64 "mo:core/Nat64";
import Int "mo:core/Int";
import Time "mo:core/Time";
import Iter "mo:core/Iter";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Option "mo:core/Option";


shared ({ caller = owner }) persistent actor class UtxoGrid() = this {

    // ── Types ──────────────────────────────────────────────────────────────

    /// A single miner data snapshot.
    public type MinerData = {
        currentTH : Text; // current terahash rate
        bestDifficulty : Text; // best difficulty achieved
        totalMiners : Nat; // number of miners running
    };

    /// A time-stamped miner data point (returned to the UI).
    public type MinerDataPoint = {
        timestamp : Nat64; // nanoseconds since epoch
        data : MinerData;
    };

    public type Result<X, Y> = {
        #ok : X;
        #err : Y;
    };

    // ── State ──────────────────────────────────────────────────────────────

    /// Time-series map: timestamp (Nat64, nanoseconds) → MinerData.
    /// Entries are kept in ascending chronological order by the B-tree.
    let minerTimeSeries = Map.empty<Nat64, MinerData>();

    var admins : [Principal] = [owner];

    // ── Admin management ─────────────────────────────────────────────────

    /// Add a new admin. Only existing admins can call this.
    public shared ({ caller }) func add_admin({ principal : Principal }) : async Result<(), Text> {
        if (Option.isNull(Array.indexOf(admins, Principal.equal, caller))) return #err("Only admins can add new admins");
        admins := Array.tabulate<Principal>(admins.size() + 1, func i = if (i < admins.size()) { admins[i] } else { principal });
        #ok();
    };

    // ── Update functions ───────────────────────────────────────────────────

    /// Record a new miner data snapshot at the current time. Admin only.
    public shared ({ caller }) func add_miner_data({ data : MinerData }) : async Result<Nat64, Text> {
        if (Option.isNull(Array.indexOf(admins, Principal.equal, caller))) return #err("Only admins can add miner data");
        let now = Nat64.fromNat(Int.abs(Time.now()));
        Map.add(minerTimeSeries, Nat64.compare, now, data);
        #ok(now) // return the timestamp used
    };

    // ── Query functions ────────────────────────────────────────────────────

    /// Get the most recent miner data point, or null if none recorded yet.
    public query func get_last_miner_data() : async Result<MinerDataPoint, Text> {
        switch (Map.maxEntry(minerTimeSeries)) {
            case null { #err("No miner data recorded yet") };
            case (?(ts, d)) { #ok({ timestamp = ts; data = d }) };
        };
    };

    /// Get data points within a time range [startTime, endTime] (inclusive).
    /// Both values are nanosecond timestamps. Pass 0 for startTime and
    /// a far-future value for endTime to get everything.
    public query func get_miner_history_range({
        startTime : Nat64;
        endTime : Nat64;
    }) : async Result<[MinerDataPoint], Text> {
        let iter = Map.entriesFrom(minerTimeSeries, Nat64.compare, startTime);
        let filtered = Iter.map<(Nat64, MinerData), MinerDataPoint>(
            Iter.takeWhile<(Nat64, MinerData)>(iter, func((ts, _)) = ts <= endTime),
            func((ts, d)) = { timestamp = ts; data = d },
        );
        #ok(Iter.toArray(filtered));
    };

    /// Get the N most recent data points (descending → reversed to ascending for charting).
    public query func get_miner_history_count({ count : Nat }) : async Result<[MinerDataPoint], Text> {
        let descIter = Map.reverseEntries(minerTimeSeries);
        let taken = Iter.toArray(
            Iter.map<(Nat64, MinerData), MinerDataPoint>(
                Iter.take(descIter, count),
                func((ts, d)) = { timestamp = ts; data = d },
            )
        );
        // Reverse so the UI gets chronological order (oldest → newest).
        #ok(Array.reverse(taken));
    };

    /// Total number of data points stored.
    public query func get_miner_data_count() : async Result<Nat, Text> {
        #ok(Map.size(minerTimeSeries));
    };

};
