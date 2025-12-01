import { PythonUvFunction } from '@orcabus/platform-cdk-constructs/lambda';
import { IStringParameter } from 'aws-cdk-lib/aws-ssm';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { PythonLayerVersion } from '@aws-cdk/aws-lambda-python-alpha';

export type LambdaName =
  // SRM SampleSheet State Change
  | 'createBclconvertWorkflowDraftEventDetail'
  | 'findWorkflowsByInstrumentRunId'
  // ICA State Change
  | 'createNewWorkflowRunObject'
  | 'findWorkflow'
  | 'updateWorkflowRunObject'
  // Shared - validation lambdas
  | 'validateDraftDataCompleteSchema';

export const lambdaNameList: LambdaName[] = [
  // SRM SampleSheet State Change
  'createBclconvertWorkflowDraftEventDetail',
  'findWorkflowsByInstrumentRunId',
  // ICA State Change
  'createNewWorkflowRunObject',
  'findWorkflow',
  'updateWorkflowRunObject',
  // Shared - validation lambdas
  'validateDraftDataCompleteSchema',
];

// Requirements interface for Lambda functions
export interface LambdaRequirements {
  needsOrcabusApiTools?: boolean;
  needsIcav2Tools?: boolean;
  needsSsmParametersAccess?: boolean;
  needsSchemaRegistryAccess?: boolean;
  needsBsshToolsLayer?: boolean;
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
  },
  // ICA State Change lambdas
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
};

export interface LambdaInputs {
  /* Custom layers */
  bsshToolsLayer: PythonLayerVersion;

  /* basespace Parameters */
  basespaceUrlParameterObject: IStringParameter;
  basespaceAccessTokenSecretObject: ISecret;
}

export interface LambdaInput extends LambdaInputs {
  lambdaName: LambdaName;
}

export interface LambdaObject {
  lambdaName: LambdaName;
  lambdaFunction: PythonUvFunction;
}
