/** Step Function stuff */
import {
  BuildStepFunctionProps,
  BuildStepFunctionsProps,
  stateMachineNameList,
  StepFunctionObject,
  stepFunctionsRequirementsMap,
  stepFunctionToLambdasMap,
  WireUpPermissionsProps,
} from './interfaces';
import { NagSuppressions } from 'cdk-nag';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { LogLevel, StateMachineType } from 'aws-cdk-lib/aws-stepfunctions';
import path from 'path';
import {
  DEFAULT_PAYLOAD_VERSION,
  DRAFT_STATUS,
  EVENT_SOURCE,
  READY_STATUS,
  STACK_PREFIX,
  STEP_FUNCTIONS_DIR,
  SUCCEEDED_STATUS,
  WORKFLOW_RUN_STATE_CHANGE_DETAIL_TYPE,
  WORKFLOW_RUN_UPDATE_DETAIL_TYPE,
} from '../constants';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { camelCaseToSnakeCase } from '../utils';
import * as awsLogs from 'aws-cdk-lib/aws-logs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

function createStateMachineDefinitionSubstitutions(props: BuildStepFunctionProps): {
  [key: string]: string;
} {
  const definitionSubstitutions: { [key: string]: string } = {};

  const sfnRequirements = stepFunctionsRequirementsMap[props.stateMachineName];
  const lambdaFunctionNamesInSfn = stepFunctionToLambdasMap[props.stateMachineName];
  const lambdaFunctions = props.lambdaObjects.filter((lambdaObject) =>
    lambdaFunctionNamesInSfn.includes(lambdaObject.lambdaName)
  );

  /* Substitute lambdas in the state machine definition */
  for (const lambdaObject of lambdaFunctions) {
    const sfnSubstitutionKey = `__${camelCaseToSnakeCase(lambdaObject.lambdaName)}_lambda_function_arn__`;
    definitionSubstitutions[sfnSubstitutionKey] =
      lambdaObject.lambdaFunction.currentVersion.functionArn;
  }

  // Miscellaneous substitutions
  definitionSubstitutions['__succeeded_status__'] = SUCCEEDED_STATUS;
  definitionSubstitutions['__draft_status__'] = DRAFT_STATUS;

  /* Sfn Requirements */

  // Events
  if (sfnRequirements.needsEventPutPermission) {
    definitionSubstitutions['__event_bus_name__'] = props.eventBus.eventBusName;
    definitionSubstitutions['__workflow_run_state_change_event_detail_type__'] =
      WORKFLOW_RUN_STATE_CHANGE_DETAIL_TYPE;
    definitionSubstitutions['__workflow_run_update_event_detail_type__'] =
      WORKFLOW_RUN_UPDATE_DETAIL_TYPE;
    definitionSubstitutions['__stack_source__'] = EVENT_SOURCE;
    definitionSubstitutions['__ready_event_status__'] = READY_STATUS;
    definitionSubstitutions['__draft_event_status__'] = DRAFT_STATUS;
    definitionSubstitutions['__new_workflow_manager_is_deployed__'] =
      props.isNewWorkflowManagerDeployed.toString();
    definitionSubstitutions['__default_payload_version__'] = DEFAULT_PAYLOAD_VERSION;
  }

  // SSM Parameters
  if (sfnRequirements.needsSsmParameterStoreAccess) {
    // Default parameter paths
    definitionSubstitutions['__valid_pipeline_id_list_ssm_parameter_name__'] =
      props.ssmParameterPaths.pipelineIdsList;
  }

  return definitionSubstitutions;
}

function wireUpStateMachinePermissions(props: WireUpPermissionsProps): void {
  /* Wire up lambda permissions */
  const sfnRequirements = stepFunctionsRequirementsMap[props.stateMachineName];

  const lambdaFunctionNamesInSfn = stepFunctionToLambdasMap[props.stateMachineName];
  const lambdaFunctions = props.lambdaObjects.filter((lambdaObject) =>
    lambdaFunctionNamesInSfn.includes(lambdaObject.lambdaName)
  );

  // Step functions requirements
  if (sfnRequirements.needsEventPutPermission) {
    props.eventBus.grantPutEventsTo(props.sfnObject);
  }

  /* SSM Permissions */
  if (sfnRequirements.needsSsmParameterStoreAccess) {
    // We give access to the full prefix
    // At the cost of needing a nag suppression
    props.sfnObject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [
          `arn:aws:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter${path.join(props.ssmParameterPaths.ssmRootPrefix, '/*')}`,
        ],
      })
    );

    NagSuppressions.addResourceSuppressions(
      props.sfnObject,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'We need to give access to the full prefix for the SSM parameter store',
        },
      ],
      true
    );
  }

  /* Allow the state machine to invoke the lambda function */
  for (const lambdaObject of lambdaFunctions) {
    lambdaObject.lambdaFunction.currentVersion.grantInvoke(props.sfnObject);
  }
}

function buildStepFunction(scope: Construct, props: BuildStepFunctionProps): StepFunctionObject {
  const sfnNameToSnakeCase = camelCaseToSnakeCase(props.stateMachineName);
  const sfnRequirements = stepFunctionsRequirementsMap[props.stateMachineName];

  /* Create the state machine definition substitutions */
  const stateMachine = new sfn.StateMachine(scope, props.stateMachineName, {
    stateMachineName: `${STACK_PREFIX}--${props.stateMachineName}`,
    definitionBody: sfn.DefinitionBody.fromFile(
      path.join(STEP_FUNCTIONS_DIR, sfnNameToSnakeCase + `_sfn_template.asl.json`)
    ),
    definitionSubstitutions: createStateMachineDefinitionSubstitutions(props),
    stateMachineType: sfnRequirements.isExpressSfn
      ? StateMachineType.EXPRESS
      : StateMachineType.STANDARD,
    logs: sfnRequirements.isExpressSfn
      ? // Enable logging on the state machine
        {
          level: LogLevel.ALL,
          // Create a new log group for the state machine
          destination: new awsLogs.LogGroup(scope, `${props.stateMachineName}-logs`, {
            retention: RetentionDays.ONE_DAY,
          }),
          includeExecutionData: true,
        }
      : undefined,
  });

  /* Grant the state machine permissions */
  wireUpStateMachinePermissions({
    sfnObject: stateMachine,
    ...props,
  });

  /* Nag Suppressions */
  /* AwsSolutions-SF1 - We don't need ALL events to be logged */
  /* AwsSolutions-SF2 - We also don't need X-Ray tracing */
  NagSuppressions.addResourceSuppressions(
    stateMachine,
    [
      {
        id: 'AwsSolutions-SF1',
        reason: 'We do not need all events to be logged',
      },
      {
        id: 'AwsSolutions-SF2',
        reason: 'We do not need X-Ray tracing',
      },
    ],
    true
  );

  /* Return as a state machine object property */
  return {
    ...props,
    sfnObject: stateMachine,
  };
}

export function buildAllStepFunctions(
  scope: Construct,
  props: BuildStepFunctionsProps
): StepFunctionObject[] {
  const stepFunctionObjects: StepFunctionObject[] = [];

  for (const stepFunctionName of stateMachineNameList) {
    stepFunctionObjects.push(
      buildStepFunction(scope, {
        stateMachineName: stepFunctionName,
        ...props,
      })
    );
  }

  return stepFunctionObjects;
}
