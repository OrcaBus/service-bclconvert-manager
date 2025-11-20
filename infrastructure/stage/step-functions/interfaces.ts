import { IEventBus } from 'aws-cdk-lib/aws-events';
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';

import { LambdaName, LambdaObject } from '../lambda/interfaces';
import { SsmParameterPaths } from '../ssm/interfaces';

/**
 * Step Function Interfaces
 */
export type StateMachineName =
  // Handle ICA Event
  | 'handleIcaEvent'
  // Validate Draft Data to Ready
  | 'validateDraftToReady';

export const stateMachineNameList: StateMachineName[] = [
  // Handle ICA Event
  'handleIcaEvent',
  // Validate Draft Data to Ready
  'validateDraftToReady',
];

// Requirements interface for Step Functions
export interface StepFunctionRequirements {
  // Event stuff
  needsEventPutPermission?: boolean;
  // SSM Stuff
  needsSsmParameterStoreAccess?: boolean;
  // Is Express Step Function
  isExpressSfn?: boolean;
}

export interface StepFunctionInput {
  stateMachineName: StateMachineName;
}

export interface BuildStepFunctionProps extends StepFunctionInput {
  lambdaObjects: LambdaObject[];
  eventBus: IEventBus;
  ssmParameterPaths: SsmParameterPaths;
}

export interface StepFunctionObject extends StepFunctionInput {
  sfnObject: StateMachine;
}

export type WireUpPermissionsProps = BuildStepFunctionProps & StepFunctionObject;

export type BuildStepFunctionsProps = Omit<BuildStepFunctionProps, 'stateMachineName'>;

export const stepFunctionsRequirementsMap: Record<StateMachineName, StepFunctionRequirements> = {
  // Handle ICA Event
  handleIcaEvent: {
    needsSsmParameterStoreAccess: true,
    needsEventPutPermission: true,
    isExpressSfn: true,
  },
  // Validate Draft Data to Ready
  validateDraftToReady: {
    needsEventPutPermission: true,
  },
};

export const stepFunctionToLambdasMap: Record<StateMachineName, LambdaName[]> = {
  // Handle ICA Event
  handleIcaEvent: [
    // Shared SRM / ICA lambdas
    'createNewWorkflowRunObject',
    'findWorkflow',
    'updateWorkflowRunObject',
  ],
  // Validate Draft Data to Ready
  validateDraftToReady: [
    // Shared - validation lambdas
    'validateDraftDataCompleteSchema',
  ],
};
