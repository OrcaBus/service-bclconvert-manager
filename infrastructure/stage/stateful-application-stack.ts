import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StatefulApplicationStackConfig } from './interfaces';
import { buildSsmParameters } from './ssm';
import { buildSchemasAndRegistry } from './event-schemas';
import { createMonitoredQueue, getTopicArnFromTopicName } from './sqs';
import { buildCallbackTable } from './dynamodb';
import {
  CALLBACK_TABLE_NAME,
  DLQ_ALARM_THRESHOLD,
  ICA_AWS_ACCOUNT_NUMBER,
  ICA_QUEUE_VIZ_TIMEOUT,
  ICA_SQS_NAME,
  SLACK_TOPIC_NAME,
} from './constants';
import { GitStack } from '@orcabus/platform-cdk-constructs/deployment-stack-pipeline';

export type StatefulApplicationStackProps = cdk.StackProps & StatefulApplicationStackConfig;

export class StatefulApplicationStack extends GitStack {
  constructor(scope: Construct, id: string, props: StatefulApplicationStackProps) {
    super(scope, id, props);

    /**
     * Define your stack to be deployed in stages here
     *
     * Build the ssm parameters stack
     */

    // Build SSM Parameters
    buildSsmParameters(this, {
      ssmParameterPaths: props.ssmParameterPaths,
      ssmParameterValues: props.ssmParameterValues,
    });

    // Add to the schema registry
    buildSchemasAndRegistry(this);

    // Create the monitored ICA SQS queue.
    // This queue is consumed directly by the durable handleIcaEvent lambda
    // (wired up as an SQS event source in the stateless stack).
    createMonitoredQueue(this, {
      icaQueueName: ICA_SQS_NAME,
      icaQueueVizTimeout: ICA_QUEUE_VIZ_TIMEOUT,
      slackTopicArn: getTopicArnFromTopicName(SLACK_TOPIC_NAME),
      dlqMessageThreshold: DLQ_ALARM_THRESHOLD,
      icaAwsAccountNumber: ICA_AWS_ACCOUNT_NUMBER,
    });

    // Build the callback table used by the durable handleIcaEvent lambda to
    // de-duplicate incoming SQS messages.
    buildCallbackTable(this, {
      tableName: CALLBACK_TABLE_NAME,
    });
  }
}
