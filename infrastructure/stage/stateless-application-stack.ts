import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsManager from 'aws-cdk-lib/aws-secretsmanager';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { StatelessApplicationStackConfig } from './interfaces';
import { buildAllLambdas, buildBsshToolsLayer } from './lambda';
import { buildAllStepFunctions } from './step-functions';
import { buildAllEventRules } from './event-rules';
import { buildAllEventBridgeTargets } from './event-targets';
import { CALLBACK_TABLE_NAME, ICA_SQS_NAME } from './constants';
import { StageName } from '@orcabus/platform-cdk-constructs/shared-config/accounts';
import { GitStack } from '@orcabus/platform-cdk-constructs/deployment-stack-pipeline';

export type StatelessApplicationStackProps = cdk.StackProps & StatelessApplicationStackConfig;

export class StatelessApplicationStack extends GitStack {
  // Set stagename
  public readonly stageName: StageName;

  constructor(scope: Construct, id: string, props: StatelessApplicationStackProps) {
    super(scope, id, props);

    // Initialise stagename
    this.stageName = props.stageName;

    /**
     * BCLConvert Stack
     * Deploys the BCLConvert orchestration services
     */
    // Get the event bus as a construct
    const orcabusMainEventBus = events.EventBus.fromEventBusName(
      this,
      props.eventBusName,
      props.eventBusName
    );

    // Get the basespace api url ssm parameter
    // And the basespace access token secret object
    const basespaceSsmParameterObject = ssm.StringParameter.fromStringParameterName(
      this,
      'basespaceApiUrlParameter',
      props.basespaceBaseUrlSsmParameterName
    );

    const basespaceAccessTokenSecretObject = secretsManager.Secret.fromSecretNameV2(
      this,
      'basespaceAccessTokenSecret',
      props.basespaceAccessTokenSecretId
    );

    // Get the ICA event SQS queue (built in the stateful stack) as a construct
    const icaEventQueue = sqs.Queue.fromQueueArn(
      this,
      ICA_SQS_NAME,
      `arn:aws:sqs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${ICA_SQS_NAME}`
    );

    // Get the callback DynamoDB table (built in the stateful stack) as a construct
    const callbackTable = dynamodb.TableV2.fromTableName(
      this,
      CALLBACK_TABLE_NAME,
      CALLBACK_TABLE_NAME
    );

    // Build the bssh lambda layer
    // Build BSSH Tools Layer
    const bsshToolsLayer = buildBsshToolsLayer(this);

    // Build the lambdas
    const lambdas = buildAllLambdas(this, {
      bsshToolsLayer: bsshToolsLayer,
      basespaceUrlParameterObject: basespaceSsmParameterObject,
      basespaceAccessTokenSecretObject: basespaceAccessTokenSecretObject,
      icaEventQueue: icaEventQueue,
      callbackTable: callbackTable,
      handleIcaEventSfnName: 'handleIcaEvent',
    });

    // Build the state machines
    const stateMachines = buildAllStepFunctions(this, {
      lambdaObjects: lambdas,
      eventBus: orcabusMainEventBus,
      ssmParameterPaths: props.ssmParameterPaths,
    });

    // Add event rules
    const eventRules = buildAllEventRules(this, {
      eventBus: orcabusMainEventBus,
    });

    // Add event targets
    buildAllEventBridgeTargets({
      eventBridgeRuleObjects: eventRules,
      stepFunctionObjects: stateMachines,
    });
  }
}
