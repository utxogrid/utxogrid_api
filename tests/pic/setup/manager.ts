import { _SERVICE as UTXOGRID_API } from "../../../src/declarations/utxogrid_api.did.js";
import { Actor, PocketIc, createIdentity, SubnetStateType } from "@dfinity/pic";
import { Principal } from "@dfinity/principal";
import UtxoGridApi from "./utxogrid_api/utxogrid_api";

export class Manager {
  private readonly me: ReturnType<typeof createIdentity>;
  private readonly pic: PocketIc;
  private readonly utxogridActor: Actor<UTXOGRID_API>;

  constructor(
    pic: PocketIc,
    me: ReturnType<typeof createIdentity>,
    utxogridActor: Actor<UTXOGRID_API>,
  ) {
    this.pic = pic;
    this.me = me;
    this.utxogridActor = utxogridActor;

    // set identitys as me
    this.utxogridActor.setIdentity(this.me);
  }

  public static async beforeAll(): Promise<Manager> {
    let pic = await PocketIc.create(process.env.PIC_URL, {
      application: [{ state: { type: SubnetStateType.New } }],
    });

    await pic.setTime(new Date().getTime());
    await pic.tick();

    let identity = createIdentity("superSecretAlicePassword");

    // setup canister with identity as sender so `me` is the owner/admin
    let canisterFixture = await UtxoGridApi(pic, Principal.fromText(identity.getPrincipal().toText()));

    return new Manager(pic, identity, canisterFixture.actor);
  }

  public async afterAll(): Promise<void> {
    await this.pic.tearDown();
  }

  public getMe(): Principal {
    return Principal.fromText(this.me.getPrincipal().toText());
  }

  public getActor(): Actor<UTXOGRID_API> {
    return this.utxogridActor;
  }

  public setActorIdentity(identity: ReturnType<typeof createIdentity>): void {
    this.utxogridActor.setIdentity(identity);
  }

  public resetIdentity(): void {
    this.utxogridActor.setIdentity(this.me);
  }

  public async getNow(): Promise<bigint> {
    let time = await this.pic.getTime();
    return BigInt(Math.trunc(time));
  }

  public async advanceTime(mins: number): Promise<void> {
    await this.pic.advanceTime(mins * 60 * 1000);
  }

  public async advanceBlocks(blocks: number): Promise<void> {
    await this.pic.tick(blocks);
  }
}
