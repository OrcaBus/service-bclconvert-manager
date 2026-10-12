import {
  LambdaInput,
  LambdaInputs,
  lambdaNameList,
  LambdaObject,
  lambdaRequirementsMap,
} from './interfaces';
import { getPythonUvDockerImage, PythonUvFunction } from '@orcabus/platform-cdk-constructs/lambda';
import {
  LAMBDA_DIR,
  LAYERS_DIR,
  SSM_PARAMETER_PATH_PREFIX,
  SSM_PARAMETER_PATH_WORKFLOW_VERSION,
} from '../constants';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import {
  SSM_SCHEMA_ROOT,
  SCHEMA_REGISTRY_NAME,
  STACK_PREFIX,
  ICA_EVENT_QUEUE_MAX_CONCURRENCY,
} from '../constants';
import { Duration } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { camelCaseToKebabCase, camelCaseToSnakeCase } from '../utils';
import * as path from 'path';
import { SchemaNames } from '../event-schemas/interfaces';
import { PythonLayerVersion } from '@aws-cdk/aws-lambda-python-alpha';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export function buildBsshToolsLayer(scope: Construct): PythonLayerVersion {
  /**
        Build the bssh tools layer, used by lambdas that need BaseSpace/BSSH functionality
   */
  return new PythonLayerVersion(scope, 'bssh-lambda-layer', {
    entry: path.join(LAYERS_DIR, 'bssh_tool_kit'),
    compatibleRuntimes: [lambda.Runtime.PYTHON_3_14],
    compatibleArchitectures: [lambda.Architecture.ARM_64],
    bundling: {
      image: getPythonUvDockerImage(),
      commandHooks: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        beforeBundling(inputDir: string, outputDir: string): string[] {
          return [];
        },
        afterBundling(inputDir: string, outputDir: string): string[] {
          return [
            `pip install ${inputDir} --target ${outputDir}`,
            // Delete the tests directory from pandas
            `rm -rf ${outputDir}/pandas/tests`,
            // Delete the *pyc files and __pycache__ directories
            `find ${outputDir} -type f -name '*.pyc' -delete`,
            // Delete the __pycache__ directories contents
            `find ${outputDir} -type d -name '__pycache__' -exec rm -rf {}/* \\;`,
            // Delete the __pycache__ directories themselves
            `find ${outputDir} -type d -name '__pycache__' -delete`,
            // Delete pandas / numpy since we will always have icav2 tools layer installed
            `pip uninstall pandas numpy`,
            `rm -rf ${outputDir}/pandas ${outputDir}/numpy`,
          ];
        },
      },
    },
  });
}

function buildLambda(scope: Construct, props: LambdaInput): LambdaObject {
  const lambdaNameToSnakeCase = camelCaseToSnakeCase(props.lambdaName);
  const lambdaRequirements = lambdaRequirementsMap[props.lambdaName];

  // Create the lambda function
  const lambdaFunction = new PythonUvFunction(scope, props.lambdaName, {
    entry: path.join(LAMBDA_DIR, lambdaNameToSnakeCase + '_py'),
    runtime: lambda.Runtime.PYTHON_3_14,
    architecture: lambda.Architecture.ARM_64,
    index: lambdaNameToSnakeCase + '.py',
    handler: 'handler',
    timeout: lambdaRequirements.needsExtendedTimeout ? Duration.minutes(5) : Duration.minutes(1),
    memorySize: 2048,
    includeOrcabusApiToolsLayer: lambdaRequirements.needsOrcabusApiTools,
    includeIcav2Layer: lambdaRequirements.needsIcav2Tools,
    durableConfig: lambdaRequirements.needsDurableExecutionPermissions
      ? {
          // Cannot exceed 15 minutes when used as an SQS event source
          // https://docs.aws.amazon.com/lambda/latest/dg/durable-invoking-esm.html#durable-esm-duration-limit
          executionTimeout: Duration.minutes(15),
          retentionPeriod: Duration.days(1),
        }
      : undefined,
  });

  // AwsSolutions-IAM4 - We need to add this for the lambda to work
  NagSuppressions.addResourceSuppressions(
    lambdaFunction,
    [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'We use the basic execution role for lambda functions',
      },
    ],
    true
  );

  /*
    Add in SSM permissions for the lambda function
    */
  if (lambdaRequirements.needsSsmParametersAccess) {
    lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [
          `arn:aws:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter${path.join(SSM_PARAMETER_PATH_PREFIX, '/*')}`,
        ],
      })
    );
    /* Since we dont ask which schema, we give the lambda access to all schemas in the registry */
    /* As such we need to add the wildcard to the resource */
    NagSuppressions.addResourceSuppressions(
      lambdaFunction,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'We need to give the lambda access to all schemas in the registry',
        },
      ],
      true
    );
  }

  /*
    For the schema validation lambdas we need to give them the access to the schema
    */
  if (lambdaRequirements.needsSchemaRegistryAccess) {
    // Add the schema registry access to the lambda function
    lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['schemas:DescribeRegistry', 'schemas:DescribeSchema'],
        resources: [
          `arn:aws:schemas:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:registry/${SCHEMA_REGISTRY_NAME}`,
          `arn:aws:schemas:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:schema/${path.join(SCHEMA_REGISTRY_NAME, '/*')}`,
        ],
      })
    );

    /* Since we dont ask which schema, we give the lambda access to all schemas in the registry */
    /* As such we need to add the wildcard to the resource */
    NagSuppressions.addResourceSuppressions(
      lambdaFunction,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'We need to give the lambda access to all schemas in the registry',
        },
      ],
      true
    );
  }

  if (lambdaRequirements.needsBsshToolsLayer) {
    /* Give the lambda function access to BaseSpace */
    /* Set the environment variables as required */
    props.basespaceUrlParameterObject.grantRead(lambdaFunction.currentVersion);
    lambdaFunction.addEnvironment(
      'BASESPACE_URL_SSM_PARAMETER_NAME',
      props.basespaceUrlParameterObject.parameterName
    );
    props.basespaceAccessTokenSecretObject.grantRead(lambdaFunction.currentVersion);
    lambdaFunction.addEnvironment(
      'BASESPACE_ACCESS_TOKEN_SECRET_ID',
      props.basespaceAccessTokenSecretObject.secretName
    );

    /* Add the bssh tools layer */
    lambdaFunction.addLayers(props.bsshToolsLayer);
  }

  /*
    Special if the lambdaName is createNewWorkflowRunObject or , we need to add in the ssm parameters
    DEFAULT_WORKFLOW_VERSION_SSM_PARAMETER_NAME as the workflow version is stored in SSM
   */
  if (
    ['createNewWorkflowRunObject', 'createBclconvertWorkflowDraftEventDetail'].includes(
      props.lambdaName
    )
  ) {
    lambdaFunction.addEnvironment(
      'DEFAULT_WORKFLOW_VERSION_SSM_PARAMETER_NAME',
      path.join(SSM_PARAMETER_PATH_WORKFLOW_VERSION)
    );
  }

  /*
    Special if the lambdaName is 'validateDraftCompleteSchema', we need to add in the ssm parameters
    to the REGISTRY_NAME and SCHEMA_NAME
   */
  if (props.lambdaName === 'validateDraftDataCompleteSchema') {
    const draftSchemaName: SchemaNames = 'completeDataDraft';
    lambdaFunction.addEnvironment('SSM_REGISTRY_NAME', path.join(SSM_SCHEMA_ROOT, 'registry'));
    lambdaFunction.addEnvironment(
      'SSM_SCHEMA_NAME',
      path.join(SSM_SCHEMA_ROOT, camelCaseToKebabCase(draftSchemaName), 'latest')
    );
  }

  /*
    The durable handleIcaEvent lambda consumes the ICA event SQS queue directly.
    It starts the handleIcaEvent step function asynchronously (passing a durable
    callback id) and needs to know the step function ARN. The permission to start
    the step function is granted when the step function is built.
   */
  if (lambdaRequirements.needsIcaEventQueueEventSource) {
    lambdaFunction.addEnvironment(
      'HANDLE_ICA_EVENT_SFN_ARN',
      `arn:aws:states:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:stateMachine:${STACK_PREFIX}--${props.handleIcaEventSfnName}`
    );

    lambdaFunction.currentVersion.addEventSource(
      new SqsEventSource(props.icaEventQueue, {
        // Process one message at a time with bounded concurrency
        maxConcurrency: ICA_EVENT_QUEUE_MAX_CONCURRENCY,
        batchSize: 1,
      })
    );
  }

  /*
    The durable handler dedups SQS messages via the callback DynamoDB table.
   */
  if (lambdaRequirements.needsCallbackDbPermissions) {
    props.callbackTable.grantReadWriteData(lambdaFunction);
    lambdaFunction.addEnvironment('CALLBACK_DATABASE_NAME', props.callbackTable.tableName);
  }

  /*
    The unlockCallbackId lambda releases the durable execution callback once the
    step function completes. The resource ARNs are created dynamically, so we
    grant on a wildcard and suppress the resulting cdk-nag finding.
   */
  if (lambdaRequirements.needsCallbackPermissions) {
    lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['lambda:SendDurableExecutionCallbackSuccess'],
        resources: [
          `arn:aws:lambda:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:function:*:*/durable-execution/*/*`,
        ],
      })
    );
    NagSuppressions.addResourceSuppressions(
      lambdaFunction,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Send DurableExecutionCallback success permissions to dynamic resources.',
          appliesTo: [
            'Resource::arn:aws:lambda:<AWS::Region>:<AWS::AccountId>:function:*:*/durable-execution/*/*',
          ],
        },
      ],
      true
    );
  }

  /* Return the function */
  return {
    lambdaName: props.lambdaName,
    lambdaFunction: lambdaFunction,
  };
}

export function buildAllLambdas(scope: Construct, props: LambdaInputs): LambdaObject[] {
  // Iterate over lambdaLayerToMapping and create the lambda functions
  const lambdaObjects: LambdaObject[] = [];
  for (const lambdaName of lambdaNameList) {
    lambdaObjects.push(
      buildLambda(scope, {
        lambdaName: lambdaName,
        ...props,
      })
    );
  }

  return lambdaObjects;
}
