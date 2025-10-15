import { PythonUvFunction } from '@orcabus/platform-cdk-constructs/lambda';

export type LambdaName =
  // Shared SRM / ICA lambdas
  | 'createNewWorkflowRunObject'
  | 'findWorkflow'
  | 'getSequenceRunObject'
  | 'updateWorkflowRunObject'
  // Shared - validation lambdas
  | 'validateDraftDataCompleteSchema';

export const lambdaNameList: LambdaName[] = [
  // Shared SRM / ICA lambdas
  'createNewWorkflowRunObject',
  'findWorkflow',
  'getSequenceRunObject',
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
}

// Lambda requirements mapping
export const lambdaRequirementsMap: Record<LambdaName, LambdaRequirements> = {
  // Shared SRM / ICA lambdas
  createNewWorkflowRunObject: {
    needsOrcabusApiTools: true,
    needsIcav2Tools: true,
    needsSsmParametersAccess: true,
  },
  findWorkflow: {
    needsOrcabusApiTools: true,
    needsIcav2Tools: true,
  },
  getSequenceRunObject: {
    needsOrcabusApiTools: true,
  },
  updateWorkflowRunObject: {
    needsOrcabusApiTools: true,
    needsIcav2Tools: true,
  },
  // Shared - validation lambdas
  validateDraftDataCompleteSchema: {
    needsSchemaRegistryAccess: true,
    needsSsmParametersAccess: true,
  },
};

export interface LambdaInput {
  lambdaName: LambdaName;
}

export interface LambdaObject extends LambdaInput {
  lambdaFunction: PythonUvFunction;
}
