
import { Schema, model } from 'mongoose';

interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const Counter = model<ICounter>('Counter', CounterSchema);

export async function nextSequence(key: string, prefix: string, width = 4): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (!counter) throw new Error(`Unable to generate sequence for ${key}`);
  return `${prefix}-${String(counter.seq).padStart(width, '0')}`;
}
