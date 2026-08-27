import { Schema, Types } from 'mongoose';
import { currentHospitalId } from './context';

const QUERY_HOOKS = [
  'countDocuments', 'deleteMany', 'deleteOne', 'find', 'findOne',
  'findOneAndDelete', 'findOneAndReplace', 'findOneAndUpdate',
  'replaceOne', 'updateMany', 'updateOne',
] as const;

/** Adds tenant ownership and transparently scopes queries executed in an authenticated request. */
export function tenantPlugin(schema: Schema): void {
  schema.add({ hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', index: true } });

  schema.pre('validate', function tenantDocument(next) {
    const hospitalId = currentHospitalId();
    if (hospitalId && !this.get('hospitalId')) this.set('hospitalId', new Types.ObjectId(hospitalId));
    next();
  });

  for (const hook of QUERY_HOOKS) {
    schema.pre(hook, function tenantQuery(next) {
      const hospitalId = currentHospitalId();
      if (hospitalId) this.where({ hospitalId: new Types.ObjectId(hospitalId) });
      next();
    });
  }

  schema.pre('aggregate', function tenantAggregate(next) {
    const hospitalId = currentHospitalId();
    if (hospitalId) this.pipeline().unshift({ $match: { hospitalId: new Types.ObjectId(hospitalId) } });
    next();
  });
}

