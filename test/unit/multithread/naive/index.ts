import {spawn, Pool, Worker, Thread} from "threads";
import {Implementation, PointFormat, PublicKey, Signature} from "../../../../src";
import {WorkerApi} from "./worker";

type ThreadType = {
  [K in keyof WorkerApi]: (...args: Parameters<WorkerApi[K]>) => Promise<ReturnType<WorkerApi[K]>>;
};

export class BlsMultiThreadNaive {
  impl: Implementation;
  pool: Pool<Thread & ThreadType>;
  format: PointFormat;

  constructor(impl: Implementation, workerCount?: number) {
    this.impl = impl;
    // Use compressed for herumi for now.
    // THe worker is not able to deserialize from uncompressed
    // `Error: err _wrapDeserialize`
    this.format = impl === "blst-native" ? PointFormat.uncompressed : PointFormat.compressed;
    this.pool = Pool(() => (spawn(new Worker("./worker")) as any) as Promise<Thread & ThreadType>, workerCount);
  }

  async destroy(): Promise<void> {
    await this.pool.terminate(true);
  }

  async verify(pk: PublicKey, msg: Uint8Array, sig: Signature): Promise<boolean> {
    return this.pool.queue((worker) =>
      worker.verify(this.impl, pk.toBytes(PointFormat.uncompressed), msg, sig.toBytes(PointFormat.uncompressed))
    );
  }

  async verifyMultipleAggregateSignatures(
    sets: {publicKey: PublicKey; message: Uint8Array; signature: Signature}[]
  ): Promise<boolean> {
    return this.pool.queue((worker) =>
      worker.verifyMultipleAggregateSignatures(
        this.impl,
        sets.map((s) => ({
          publicKey: s.publicKey.toBytes(PointFormat.uncompressed),
          message: s.message,
          signature: s.signature.toBytes(PointFormat.uncompressed),
        }))
      )
    );
  }
}
