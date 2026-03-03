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

    public type Block = {
        id : Nat64;
        height : Nat64;
        minerAddress : Text;
        worker : Text;
        sessionId : Text;
        blockData : Text;
    };

    public type PoolData = {
        totalHashrate : Nat64;
        blockHeight : Nat64;
        totalMiners : Nat64;
        blocksFound : [Block];
    };

    public type NetworkData = {
        currentWeight : Nat64;
        currentTx : Nat64;
        bits : Text;
        difficulty : Nat64;
        target : Text;
        networkHashrate : Nat64;
        pooledTx : Nat64;
        chain : Text;
        next : {
            height : Nat64;
            bits : Text;
            difficulty : Nat64;
            target : Text;
        };
    };

    public type MinerData = {
        userAgents : [{
            userAgent : Text;
            count : Nat64;
            bestDifficulty : Nat64;
            totalHashrate : Nat64;
        }];
        highScores : [{
            updatedAt : Text;
            bestDifficulty : Nat64;
            bestDifficultyUserAgent : Text;
        }];
        uptime : Text;
    };

    public type MiningData = {
        pool : PoolData;
        network : NetworkData;
        miner : MinerData;
    };

    /// A time-stamped miner data point (returned to the UI).
    public type DataPoint = {
        timestamp : Nat64; // nanoseconds since epoch
        data : MiningData;
    };

    public type Result<X, Y> = {
        #ok : X;
        #err : Y;
    };

    // ── State ──────────────────────────────────────────────────────────────

    /// Time-series map: timestamp (Nat64, nanoseconds) → DataPoint.
    /// Entries are kept in ascending chronological order by the B-tree.
    let timeSeries = Map.empty<Nat64, DataPoint>();

    var admins : [Principal] = [owner];

    // ── Admin management ─────────────────────────────────────────────────

    /// Add a new admin. Only existing admins can call this.
    public shared ({ caller }) func add_admin({ principal : Principal }) : async Result<(), Text> {
        if (Option.isNull(Array.indexOf(admins, Principal.equal, caller))) return #err("Only admins can add new admins");
        admins := Array.tabulate<Principal>(admins.size() + 1, func i = if (i < admins.size()) { admins[i] } else { principal });
        #ok();
    };

    // ── Update functions ───────────────────────────────────────────────────

    /// Record a new data snapshot at the current time. Admin only.
    public shared ({ caller }) func add_data({ data : MiningData }) : async Result<Nat64, Text> {
        if (Option.isNull(Array.indexOf(admins, Principal.equal, caller))) return #err("Only admins can add miner data");
        let now = Nat64.fromNat(Int.abs(Time.now()));
        Map.add(timeSeries, Nat64.compare, now, { timestamp = now; data = data });
        #ok(now) // return the timestamp used
    };

    // ── Query functions ────────────────────────────────────────────────────

    /// Get the most recent miner data point, or null if none recorded yet.
    public query func get_last_data() : async Result<DataPoint, Text> {
        switch (Map.maxEntry(timeSeries)) {
            case null { #err("No miner data recorded yet") };
            case (?(ts, d)) { #ok({ timestamp = ts; data = d.data }) };
        };
    };

    /// Get data points within a time range [startTime, endTime] (inclusive).
    /// Both values are nanosecond timestamps. Pass 0 for startTime and
    /// a far-future value for endTime to get everything.
    public query func get_history_range({
        startTime : Nat64;
        endTime : Nat64;
    }) : async Result<[DataPoint], Text> {
        let iter = Map.entriesFrom(timeSeries, Nat64.compare, startTime);
        let filtered = Iter.map<(Nat64, DataPoint), DataPoint>(
            Iter.takeWhile<(Nat64, DataPoint)>(iter, func((ts, _)) = ts <= endTime),
            func((ts, d)) = { timestamp = ts; data = d.data },
        );
        #ok(Iter.toArray(filtered));
    };

    /// Get the N most recent data points (descending → reversed to ascending for charting).
    public query func get_history_count({ count : Nat }) : async Result<[DataPoint], Text> {
        let descIter = Map.reverseEntries(timeSeries);
        let taken = Iter.toArray(
            Iter.map<(Nat64, DataPoint), DataPoint>(
                Iter.take(descIter, count),
                func((ts, d)) = { timestamp = ts; data = d.data },
            )
        );
        // Reverse so the UI gets chronological order (oldest → newest).
        #ok(Array.reverse(taken));
    };

    /// Total number of data points stored.
    public query func get_data_count() : async Result<Nat, Text> {
        #ok(Map.size(timeSeries));
    };

};
