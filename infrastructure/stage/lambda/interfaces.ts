import { PythonUvFunction } from '@orcabus/platform-cdk-constructs/lambda';
import { IStringParameter } from 'aws-cdk-lib/aws-ssm';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { PythonLayerVersion } from '@aws-cdk/aws-lambda-python-alpha';
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { ITableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { StateMachineName } from '../step-functions/interfaces';

export type LambdaName =
  // SRM SampleSheet State Change
  | 'createBclconvertWorkflowDraftEventDetail'
  | 'findWorkflowsByInstrumentRunId'
  // ICA State Change
  | 'handleIcaEvent'
  | 'addSamplesheetToSrm'
  | 'checkSamplesheetInSrm'
  | 'createNewWorkflowRunObject'
  | 'findWorkflow'
  | 'updateWorkflowRunObject'
  // Shared - validation lambdas
  | 'validateDraftDataCompleteSchema'
  // Shared - callback lambdas
  | 'unlockCallbackId';

export const lambdaNameList: LambdaName[] = [
  // SRM SampleSheet State Change
  'createBclconvertWorkflowDraftEventDetail',
  'findWorkflowsByInstrumentRunId',
  // ICA State Change
  'handleIcaEvent',
  'addSamplesheetToSrm',
  'checkSamplesheetInSrm',
  'createNewWorkflowRunObject',
  'findWorkflow',
  'updateWorkflowRunObject',
  // Shared - validation lambdas
  'validateDraftDataCompleteSchema',
  // Shared - callback lambdas
  'unlockCallbackId',
];

// Requirements interface for Lambda functions
export interface LambdaRequirements {
  needsOrcabusApiTools?: boolean;
  needsIcav2Tools?: boolean;
  needsSsmParametersAccess?: boolean;
  needsSchemaRegistryAccess?: boolean;
  needsBsshToolsLayer?: boolean;
  needsExtendedTimeout?: boolean;
  // Durable execution / callback requirements
  needsDurableExecutionPermissions?: boolean;
  needsCallbackDbPermissions?: boolean;
  needsCallbackPermissions?: boolean;
  needsIcaEventQueueEventSource?: boolean;
}

// Lambda requirements mapping
export const lambdaRequirementsMap: Record<LambdaName, LambdaRequirements> = {
  // SRM SampleSheet State Change
  createBclconvertWorkflowDraftEventDetail: {
    needsOrcabusApiTools: true,
    needsIcav2Tools: true,
    needsSsmParametersAccess: true,
    needsBsshToolsLayer: true,
  },
  findWorkflowsByInstrumentRunId: {
    needsOrcabusApiTools: true,
    needsIcav2Tools: true,
    needsBsshToolsLayer: true,
    needsExtendedTimeout: true,
  },
  // ICA State Change lambdas
  // Durable handler: consumes the ICA SQS queue and starts the handleIcaEvent
  // step function asynchronously with a durable callback id
  handleIcaEvent: {
    needsDurableExecutionPermissions: true,
    needsCallbackDbPermissions: true,
    needsIcaEventQueueEventSource: true,
  },
  addSamplesheetToSrm: {
    needsOrcabusApiTools: true,
    needsIcav2Tools: true,
    needsBsshToolsLayer: true,
  },
  checkSamplesheetInSrm: {
    needsOrcabusApiTools: true,
    needsIcav2Tools: true,
    needsBsshToolsLayer: true,
  },
  createNewWorkflowRunObject: {
    needsOrcabusApiTools: true,
    needsIcav2Tools: true,
    needsBsshToolsLayer: true,
    needsSsmParametersAccess: true,
  },
  findWorkflow: {
    needsOrcabusApiTools: true,
    needsIcav2Tools: true,
    needsBsshToolsLayer: true,
  },
  updateWorkflowRunObject: {
    needsOrcabusApiTools: true,
    needsIcav2Tools: true,
    needsBsshToolsLayer: true,
  },
  // Shared - validation lambdas
  validateDraftDataCompleteSchema: {
    needsSchemaRegistryAccess: true,
    needsSsmParametersAccess: true,
  },
  // Shared - callback lambdas
  // Unlocks the durable execution callback id once the step function completes
  unlockCallbackId: {
    needsCallbackPermissions: true,
  },
};

export interface LambdaInputs {
  /* Custom layers */
  bsshToolsLayer: PythonLayerVersion;

  /* basespace Parameters */
  basespaceUrlParameterObject: IStringParameter;
  basespaceAccessTokenSecretObject: ISecret;

  /* ICA event handling (durable lambda) */
  icaEventQueue: IQueue;
  callbackTable: ITableV2;
  handleIcaEventSfnName: StateMachineName;
}

export interface LambdaInput extends LambdaInputs {
  lambdaName: LambdaName;
}

export interface LambdaObject {
  lambdaName: LambdaName;
  lambdaFunction: PythonUvFunction;
}
