export const idlFactory = ({ IDL }) => {
  const Result_4 = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const MinerData = IDL.Record({
    'totalMiners' : IDL.Nat,
    'bestDifficulty' : IDL.Text,
    'currentTH' : IDL.Text,
  });
  const Result_3 = IDL.Variant({ 'ok' : IDL.Nat64, 'err' : IDL.Text });
  const MinerDataPoint = IDL.Record({
    'data' : MinerData,
    'timestamp' : IDL.Nat64,
  });
  const Result_2 = IDL.Variant({ 'ok' : MinerDataPoint, 'err' : IDL.Text });
  const Result_1 = IDL.Variant({ 'ok' : IDL.Nat, 'err' : IDL.Text });
  const Result = IDL.Variant({
    'ok' : IDL.Vec(MinerDataPoint),
    'err' : IDL.Text,
  });
  const UtxoGrid = IDL.Service({
    'add_admin' : IDL.Func(
        [IDL.Record({ 'principal' : IDL.Principal })],
        [Result_4],
        [],
      ),
    'add_miner_data' : IDL.Func(
        [IDL.Record({ 'data' : MinerData })],
        [Result_3],
        [],
      ),
    'get_last_miner_data' : IDL.Func([], [Result_2], ['query']),
    'get_miner_data_count' : IDL.Func([], [Result_1], ['query']),
    'get_miner_history_count' : IDL.Func(
        [IDL.Record({ 'count' : IDL.Nat })],
        [Result],
        ['query'],
      ),
    'get_miner_history_range' : IDL.Func(
        [IDL.Record({ 'startTime' : IDL.Nat64, 'endTime' : IDL.Nat64 })],
        [Result],
        ['query'],
      ),
  });
  return UtxoGrid;
};
export const init = ({ IDL }) => { return []; };
