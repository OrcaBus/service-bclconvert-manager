import { Construct } from 'constructs';
import { BuildSsmParameterProps } from './interfaces';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export function buildSsmParameters(scope: Construct, props: BuildSsmParameterProps) {
  /**
   * SSM Stack here
   *
   * */

  /**
   * Detail Level SSM Parameters
   */
  // Workflow name
  new ssm.StringParameter(scope, 'workflow-name', {
    parameterName: props.ssmParameterPaths.workflowName,
    stringValue: props.ssmParameterValues.workflowName,
  });

  // Workflow version
  new ssm.StringParameter(scope, 'workflow-version', {
    parameterName: props.ssmParameterPaths.workflowVersion,
    stringValue: props.ssmParameterValues.workflowVersion,
  });

  /**
   * Payload level SSM Parameters
   */
  // Payload version
  new ssm.StringParameter(scope, 'payload-version', {
    parameterName: props.ssmParameterPaths.payloadVersion,
    stringValue: props.ssmParameterValues.payloadVersion,
  });

  /**
   * Engine Parameters
   */
  // ICAV2 pipeline IDs
  new ssm.StringParameter(scope, 'pipeline-ids-list', {
    parameterName: props.ssmParameterPaths.pipelineIdsList,
    stringValue: JSON.stringify(props.ssmParameterValues.pipelineIdsList),
  });
}
