import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StatefulApplicationStackConfig } from './interfaces';
import { buildSsmParameters } from './ssm';
import { buildSchemasAndRegistry } from './event-schemas';
import { createEventBridgePipe, getTopicArnFromTopicName } from './sqs';
import {
  DLQ_ALARM_THRESHOLD,
  EVENT_PIPE_NAME,
  ICA_AWS_ACCOUNT_NUMBER,
  ICA_QUEUE_VIZ_TIMEOUT,
  ICA_SQS_NAME,
  SLACK_TOPIC_NAME,
} from './constants';

export type StatefulApplicationStackProps = cdk.StackProps & StatefulApplicationStackConfig;

export class StatefulApplicationStack extends cdk.Stack {
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

    // Build the event sqs pipe
    // Create the event pipe to join the ICA SQS queue to the event bus
    createEventBridgePipe(this, {
      stepFunctionName: 'handleIcaEvent',
      icaEventPipeName: EVENT_PIPE_NAME,
      icaQueueName: ICA_SQS_NAME,
      icaQueueVizTimeout: ICA_QUEUE_VIZ_TIMEOUT,
      slackTopicArn: getTopicArnFromTopicName(SLACK_TOPIC_NAME),
      dlqMessageThreshold: DLQ_ALARM_THRESHOLD,
      icaAwsAccountNumber: ICA_AWS_ACCOUNT_NUMBER,
    });
  }
}
