/* Directory constants */
import path from 'path';
import { StageName } from '@orcabus/platform-cdk-constructs/shared-config/accounts';
import { PipelineId, WorkflowVersionType } from './interfaces';
import { DATA_SCHEMA_REGISTRY_NAME } from '@orcabus/platform-cdk-constructs/shared-config/event-bridge';
import { Duration } from 'aws-cdk-lib';

export const APP_ROOT = path.join(__dirname, '../../app');
export const LAMBDA_DIR = path.join(APP_ROOT, 'lambdas');
export const STEP_FUNCTIONS_DIR = path.join(APP_ROOT, 'step-functions-templates');
export const EVENT_SCHEMAS_DIR = path.join(APP_ROOT, 'event-schemas');
export const LAYERS_DIR = path.join(APP_ROOT, 'layers');

/* Workflow constants */
export const WORKFLOW_NAME = 'bclconvert';
export const DEFAULT_WORKFLOW_VERSION: WorkflowVersionType = '4.4.4';
export const DEFAULT_PAYLOAD_VERSION = '2025.10.10';

/* SSM Parameter Paths */
export const SSM_PARAMETER_PATH_PREFIX = path.join(`/orcabus/workflows/${WORKFLOW_NAME}/`);
// Workflow Parameters
export const SSM_PARAMETER_PATH_WORKFLOW_NAME = path.join(
  SSM_PARAMETER_PATH_PREFIX,
  'workflow-name'
);
export const SSM_PARAMETER_PATH_WORKFLOW_VERSION = path.join(
  SSM_PARAMETER_PATH_PREFIX,
  'workflow-version'
);
export const SSM_PARAMETER_PATH_PAYLOAD_VERSION = path.join(
  SSM_PARAMETER_PATH_PREFIX,
  'payload-version'
);
// Engine Parameters
export const SSM_PARAMETER_PATH_PREFIX_PIPELINE_IDS_BY_WORKFLOW_VERSION = path.join(
  SSM_PARAMETER_PATH_PREFIX,
  'pipeline-ids-by-list'
);

/* Event Constants */
export const EVENT_BUS_NAME = 'OrcaBusMain';
export const EVENT_SOURCE = 'orcabus.bclconvert';
export const WORKFLOW_RUN_STATE_CHANGE_DETAIL_TYPE = 'WorkflowRunStateChange';
export const WORKFLOW_RUN_UPDATE_EVENT_DETAIL_TYPE = 'WorkflowRunUpdate';
export const WORKFLOW_MANAGER_EVENT_SOURCE = 'orcabus.workflowmanager';
export const SEQUENCE_RUN_MANAGER_SAMPLESHEET_CHANGE_DETAIL_TYPE = 'SequenceRunSampleSheetChange';
export const SEQUENCE_RUN_MANAGER_SOURCE = 'orcabus.sequencerunmanager';

/* Event rule constants */
export const DRAFT_STATUS = 'DRAFT';
export const READY_STATUS = 'READY';
export const SUCCEEDED_STATUS = 'SUCCEEDED';

/* Schema constants */
export const SCHEMA_REGISTRY_NAME = DATA_SCHEMA_REGISTRY_NAME;
export const SSM_SCHEMA_ROOT = path.join(SSM_PARAMETER_PATH_PREFIX, 'schemas');

/* SQS Queue constants */
export const EVENT_PIPE_NAME = 'BclConvertAnalysisEventPipe';
// The SQS name should be noted since the ARN is required when
// setting up the notifications of the project
export const ICA_SQS_NAME = 'BclConvertAnalysisSqsQueue';
export const ICA_QUEUE_VIZ_TIMEOUT = Duration.seconds(300); // 5 minutes - duration of express state machine.
export const DLQ_ALARM_THRESHOLD = 1;
export const ICA_AWS_ACCOUNT_NUMBER = '079623148045';

// External SSMs/ Secrets
export const BASESPACE_API_URL_SSM_PARAMETER_NAME = '/manual/BaseSpaceApiUrl'; // "https://api.aps2.sh.basespace.illumina.com"
export const BASESPACE_ACCESS_TOKEN_SECRET_ID = '/manual/BaseSpaceAccessTokenSecret';

/* UMCCR / CCGCM constants */
/* Slack constants */
export const SLACK_TOPIC_NAME = 'AwsChatBotTopic';

export const PIPELINE_IDS_LIST: Record<StageName, PipelineId[]> = {
  BETA: ['ef5501df-51e1-444b-b484-c9b5f28ac4dc'],
  GAMMA: ['ef5501df-51e1-444b-b484-c9b5f28ac4dc'],
  PROD: ['ef5501df-51e1-444b-b484-c9b5f28ac4dc'],
};

// Used to group event rules and step functions
export const STACK_PREFIX = 'orca-bclconvert';
