import { resolve } from "node:path";
import { PocketIc } from "@dfinity/pic";
import { IDL } from "@dfinity/candid";
import {
  _SERVICE as UTXOGRID_API,
  idlFactory,
  init as UtxoGridInit,
} from "../../../../src/declarations/utxogrid_api.did.js";

const WASM_PATH = resolve(__dirname, "../../../../src/wasm/utxogrid_api.wasm.gz");

export async function UtxoGridApi(pic: PocketIc, sender?: any) {
  const subnets = await pic.getApplicationSubnets();

  const fixture = await pic.setupCanister<UTXOGRID_API>({
    idlFactory,
    wasm: WASM_PATH,
    arg: IDL.encode(UtxoGridInit({ IDL }), []),
    targetSubnetId: subnets[0].id,
    ...(sender ? { sender } : {}),
  });

  return fixture;
}

export default UtxoGridApi;
