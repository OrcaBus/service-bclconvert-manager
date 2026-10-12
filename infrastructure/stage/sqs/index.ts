import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IcaSqsQueueConstructProps } from './interfaces';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { MonitoredQueue } from 'sqs-dlq-monitoring';
import * as iam from 'aws-cdk-lib/aws-iam';

export function getTopicArnFromTopicName(topicName: string): string {
  return `arn:aws:sns:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${topicName}`;
}

// Create the INPUT SQS queue that will receive the ICA events
// This should have a DLQ and be monitored via CloudWatch alarm and Slack notifications.
// The queue is consumed directly by the durable handleIcaEvent lambda (SQS event source).
export function createMonitoredQueue(scope: Construct, props: IcaSqsQueueConstructProps): Queue {
  // Note: the construct MonitoredQueue demands a "Topic" construct as it usually modifies the topic adding subscriptions.
  // However, our use case, as we don't add any additional subscriptions, does not require topic modification, so we can pass on an "ITopic" as "Topic".
  const topic: Topic = Topic.fromTopicArn(scope, 'SlackTopic', props.slackTopicArn) as Topic;

  const mq = new MonitoredQueue(scope, props.icaQueueName, {
    queueProps: {
      queueName: props.icaQueueName,
      enforceSSL: true,
      visibilityTimeout: props.icaQueueVizTimeout,
    },
    dlqProps: {
      queueName: props.icaQueueName + '-dlq',
      enforceSSL: true,
      visibilityTimeout: props.icaQueueVizTimeout,
    },
    messageThreshold: props.dlqMessageThreshold,
    topic: topic,
  });
  mq.queue.grantSendMessages(new iam.AccountPrincipal(props.icaAwsAccountNumber));

  return mq.queue;
}
