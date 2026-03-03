import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Block {
  'id' : bigint,
  'height' : bigint,
  'blockData' : string,
  'minerAddress' : string,
  'sessionId' : string,
  'worker' : string,
}
export interface DataPoint { 'data' : MiningData, 'timestamp' : bigint }
export interface MinerData {
  'highScores' : Array<
    {
      'bestDifficulty' : bigint,
      'updatedAt' : string,
      'bestDifficultyUserAgent' : string,
    }
  >,
  'userAgents' : Array<
    {
      'bestDifficulty' : bigint,
      'count' : bigint,
      'totalHashrate' : bigint,
      'userAgent' : string,
    }
  >,
  'uptime' : string,
}
export interface MiningData {
  'miner' : MinerData,
  'pool' : PoolData,
  'network' : NetworkData,
}
export interface NetworkData {
  'bits' : string,
  'currentTx' : bigint,
  'chain' : string,
  'difficulty' : bigint,
  'next' : {
    'height' : bigint,
    'bits' : string,
    'difficulty' : bigint,
    'target' : string,
  },
  'target' : string,
  'networkHashrate' : bigint,
  'pooledTx' : bigint,
  'currentWeight' : bigint,
}
export interface PoolData {
  'totalMiners' : bigint,
  'totalHashrate' : bigint,
  'blockHeight' : bigint,
  'blocksFound' : Array<Block>,
}
export type Result = { 'ok' : DataPoint } |
  { 'err' : string };
export type Result_1 = { 'ok' : Array<DataPoint> } |
  { 'err' : string };
export type Result_2 = { 'ok' : bigint } |
  { 'err' : string };
export type Result_3 = { 'ok' : bigint } |
  { 'err' : string };
export type Result_4 = { 'ok' : null } |
  { 'err' : string };
export interface UtxoGrid {
  /**
   * / Add a new admin. Only existing admins can call this.
   */
  'add_admin' : ActorMethod<[{ 'principal' : Principal }], Result_4>,
  /**
   * / Record a new data snapshot at the current time. Admin only.
   */
  'add_data' : ActorMethod<[{ 'data' : MiningData }], Result_3>,
  /**
   * / Total number of data points stored.
   */
  'get_data_count' : ActorMethod<[], Result_2>,
  /**
   * / Get the N most recent data points (descending → reversed to ascending for charting).
   */
  'get_history_count' : ActorMethod<[{ 'count' : bigint }], Result_1>,
  /**
   * / Get data points within a time range [startTime, endTime] (inclusive).
   * / Both values are nanosecond timestamps. Pass 0 for startTime and
   * / a far-future value for endTime to get everything.
   */
  'get_history_range' : ActorMethod<
    [{ 'startTime' : bigint, 'endTime' : bigint }],
    Result_1
  >,
  /**
   * / Get the most recent miner data point, or null if none recorded yet.
   */
  'get_last_data' : ActorMethod<[], Result>,
}
export interface _SERVICE extends UtxoGrid {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
