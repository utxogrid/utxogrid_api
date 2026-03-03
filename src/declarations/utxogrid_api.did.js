export const idlFactory = ({ IDL }) => {
  const Result_4 = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const MinerData = IDL.Record({
    'highScores' : IDL.Vec(
      IDL.Record({
        'bestDifficulty' : IDL.Nat64,
        'updatedAt' : IDL.Text,
        'bestDifficultyUserAgent' : IDL.Text,
      })
    ),
    'userAgents' : IDL.Vec(
      IDL.Record({
        'bestDifficulty' : IDL.Nat64,
        'count' : IDL.Nat64,
        'totalHashrate' : IDL.Nat64,
        'userAgent' : IDL.Text,
      })
    ),
    'uptime' : IDL.Text,
  });
  const Block = IDL.Record({
    'id' : IDL.Nat64,
    'height' : IDL.Nat64,
    'blockData' : IDL.Text,
    'minerAddress' : IDL.Text,
    'sessionId' : IDL.Text,
    'worker' : IDL.Text,
  });
  const PoolData = IDL.Record({
    'totalMiners' : IDL.Nat64,
    'totalHashrate' : IDL.Nat64,
    'blockHeight' : IDL.Nat64,
    'blocksFound' : IDL.Vec(Block),
  });
  const NetworkData = IDL.Record({
    'bits' : IDL.Text,
    'currentTx' : IDL.Nat64,
    'chain' : IDL.Text,
    'difficulty' : IDL.Nat64,
    'next' : IDL.Record({
      'height' : IDL.Nat64,
      'bits' : IDL.Text,
      'difficulty' : IDL.Nat64,
      'target' : IDL.Text,
    }),
    'target' : IDL.Text,
    'networkHashrate' : IDL.Nat64,
    'pooledTx' : IDL.Nat64,
    'currentWeight' : IDL.Nat64,
  });
  const MiningData = IDL.Record({
    'miner' : MinerData,
    'pool' : PoolData,
    'network' : NetworkData,
  });
  const Result_3 = IDL.Variant({ 'ok' : IDL.Nat64, 'err' : IDL.Text });
  const Result_2 = IDL.Variant({ 'ok' : IDL.Nat, 'err' : IDL.Text });
  const DataPoint = IDL.Record({
    'data' : MiningData,
    'timestamp' : IDL.Nat64,
  });
  const Result_1 = IDL.Variant({ 'ok' : IDL.Vec(DataPoint), 'err' : IDL.Text });
  const Result = IDL.Variant({ 'ok' : DataPoint, 'err' : IDL.Text });
  const UtxoGrid = IDL.Service({
    'add_admin' : IDL.Func(
        [IDL.Record({ 'principal' : IDL.Principal })],
        [Result_4],
        [],
      ),
    'add_data' : IDL.Func(
        [IDL.Record({ 'data' : MiningData })],
        [Result_3],
        [],
      ),
    'get_data_count' : IDL.Func([], [Result_2], ['query']),
    'get_history_count' : IDL.Func(
        [IDL.Record({ 'count' : IDL.Nat })],
        [Result_1],
        ['query'],
      ),
    'get_history_range' : IDL.Func(
        [IDL.Record({ 'startTime' : IDL.Nat64, 'endTime' : IDL.Nat64 })],
        [Result_1],
        ['query'],
      ),
    'get_last_data' : IDL.Func([], [Result], ['query']),
  });
  return UtxoGrid;
};
export const init = ({ IDL }) => { return []; };
