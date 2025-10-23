import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { StatelessApplicationStackConfig } from './interfaces';
import { buildAllLambdas } from './lambda';
import { buildAllStepFunctions } from './step-functions';
import { buildAllEventRules } from './event-rules';
import { buildAllEventBridgeTargets } from './event-targets';
import { StageName } from '@orcabus/platform-cdk-constructs/shared-config/accounts';

export type StatelessApplicationStackProps = cdk.StackProps & StatelessApplicationStackConfig;

export class StatelessApplicationStack extends cdk.Stack {
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

    // Build the lambdas
    const lambdas = buildAllLambdas(this);

    // Build the state machines
    const stateMachines = buildAllStepFunctions(this, {
      lambdaObjects: lambdas,
      eventBus: orcabusMainEventBus,
      isNewWorkflowManagerDeployed: props.isNewWorkflowManagerDeployed,
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
