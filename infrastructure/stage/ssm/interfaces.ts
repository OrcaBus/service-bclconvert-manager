export interface SsmParameterValues {
  // Payload defaults
  workflowName: string;
  workflowVersion: string;
  payloadVersion: string;

  // Engine Parameter defaults
  pipelineIdsList: string[];
}

export interface SsmParameterPaths {
  // Top level prefix
  ssmRootPrefix: string;

  // Payload defaults
  workflowName: string;
  workflowVersion: string;
  payloadVersion: string;

  // Engine Parameter defaults
  pipelineIdsList: string;
}

export interface BuildSsmParameterProps {
  ssmParameterValues: SsmParameterValues;
  ssmParameterPaths: SsmParameterPaths;
}
