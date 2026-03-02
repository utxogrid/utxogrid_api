import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface MinerData {
  'totalMiners' : bigint,
  'bestDifficulty' : string,
  'currentTH' : string,
}
export interface MinerDataPoint { 'data' : MinerData, 'timestamp' : bigint }
export type Result = { 'ok' : Array<MinerDataPoint> } |
  { 'err' : string };
export type Result_1 = { 'ok' : bigint } |
  { 'err' : string };
export type Result_2 = { 'ok' : MinerDataPoint } |
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
   * / Record a new miner data snapshot at the current time. Admin only.
   */
  'add_miner_data' : ActorMethod<[{ 'data' : MinerData }], Result_3>,
  /**
   * / Get the most recent miner data point, or null if none recorded yet.
   */
  'get_last_miner_data' : ActorMethod<[], Result_2>,
  /**
   * / Total number of data points stored.
   */
  'get_miner_data_count' : ActorMethod<[], Result_1>,
  /**
   * / Get the N most recent data points (descending → reversed to ascending for charting).
   */
  'get_miner_history_count' : ActorMethod<[{ 'count' : bigint }], Result>,
  /**
   * / Get data points within a time range [startTime, endTime] (inclusive).
   * / Both values are nanosecond timestamps. Pass 0 for startTime and
   * / a far-future value for endTime to get everything.
   */
  'get_miner_history_range' : ActorMethod<
    [{ 'startTime' : bigint, 'endTime' : bigint }],
    Result
  >,
}
export interface _SERVICE extends UtxoGrid {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
