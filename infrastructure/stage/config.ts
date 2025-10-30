import { StageName } from '@orcabus/platform-cdk-constructs/shared-config/accounts';
import { StatefulApplicationStackConfig, StatelessApplicationStackConfig } from './interfaces';
import {
  DEFAULT_PAYLOAD_VERSION,
  EVENT_BUS_NAME,
  SSM_PARAMETER_PATH_PREFIX,
  SSM_PARAMETER_PATH_PREFIX_PIPELINE_IDS_BY_WORKFLOW_VERSION,
  SSM_PARAMETER_PATH_WORKFLOW_NAME,
  WORKFLOW_NAME,
  PIPELINE_IDS_LIST,
  DEFAULT_WORKFLOW_VERSION,
  SSM_PARAMETER_PATH_WORKFLOW_VERSION,
  SSM_PARAMETER_PATH_PAYLOAD_VERSION,
} from './constants';
import { SsmParameterPaths, SsmParameterValues } from './ssm/interfaces';

export const getSsmParameterValues = (stage: StageName): SsmParameterValues => {
  return {
    // Values
    // Detail
    workflowName: WORKFLOW_NAME,
    workflowVersion: DEFAULT_WORKFLOW_VERSION,

    // Payload
    payloadVersion: DEFAULT_PAYLOAD_VERSION,

    // Engine Parameters
    pipelineIdsList: PIPELINE_IDS_LIST[stage],
  };
};

export const getSsmParameterPaths = (): SsmParameterPaths => {
  return {
    // Top level prefix
    ssmRootPrefix: SSM_PARAMETER_PATH_PREFIX,

    // Detail
    workflowName: SSM_PARAMETER_PATH_WORKFLOW_NAME,
    workflowVersion: SSM_PARAMETER_PATH_WORKFLOW_VERSION,

    // Payload
    payloadVersion: SSM_PARAMETER_PATH_PAYLOAD_VERSION,

    // Engine Parameters
    pipelineIdsList: SSM_PARAMETER_PATH_PREFIX_PIPELINE_IDS_BY_WORKFLOW_VERSION,
  };
};

export const getStatefulStackProps = (stage: StageName): StatefulApplicationStackConfig => {
  return {
    ssmParameterValues: getSsmParameterValues(stage),
    ssmParameterPaths: getSsmParameterPaths(),
  };
};

export const getStatelessStackProps = (stage: StageName): StatelessApplicationStackConfig => {
  // Get stateless application stack props
  return {
    // Event bus object
    eventBusName: EVENT_BUS_NAME,
    // SSM Parameter Paths
    ssmParameterPaths: getSsmParameterPaths(),
    // Stagename
    stageName: stage,
  };
};
