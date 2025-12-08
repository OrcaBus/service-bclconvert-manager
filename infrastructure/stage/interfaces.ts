import { SsmParameterPaths, SsmParameterValues } from './ssm/interfaces';
import { StageName } from '@orcabus/platform-cdk-constructs/shared-config/accounts';

export type WorkflowVersionType = '4.4.4';

export type PipelineId = 'ef5501df-51e1-444b-b484-c9b5f28ac4dc';

export interface StatefulApplicationStackConfig {
  // Values
  // Detail
  ssmParameterValues: SsmParameterValues;

  // Keys
  ssmParameterPaths: SsmParameterPaths;
}

/**
 * Stateless application stack interface.
 */
export interface StatelessApplicationStackConfig {
  // Event Stuff
  eventBusName: string;

  // SSM Parameters
  ssmParameterPaths: SsmParameterPaths;

  // Stagename helper
  stageName: StageName;

  // Basespace Stuff
  basespaceBaseUrlSsmParameterName: string;
  basespaceAccessTokenSecretId: string;
}
