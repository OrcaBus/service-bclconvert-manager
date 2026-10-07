import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CallbackTableProps } from './interfaces';

/**
 * Build the callback table.
 *
 * Used by the durable handleIcaEvent lambda to de-duplicate incoming SQS
 * messages. Items are short-lived (TTL) so the table is disposable.
 */
export function buildCallbackTable(scope: Construct, props: CallbackTableProps): dynamodb.TableV2 {
  return new dynamodb.TableV2(scope, props.tableName, {
    partitionKey: {
      name: 'id',
      type: AttributeType.STRING,
    },
    sortKey: {
      name: 'id_type',
      type: AttributeType.STRING,
    },
    timeToLiveAttribute: 'ttl',
    tableName: props.tableName,
    // We don't need to keep the callback table
    removalPolicy: RemovalPolicy.DESTROY,
    pointInTimeRecoverySpecification: {
      pointInTimeRecoveryEnabled: true,
    },
  });
}
