# BclConvert Manager Infrastructure Stack

This directory contains the AWS CDK infrastructure code for the BclConvert Manager service, which translates external ICA events to internal OrcaBus events following the defined schema `orcabus.bclconvertmanager@WorkflowRunStateChange`.

## Overview

The BclConvert Manager service is a stateless service that processes ICA execution events and translates them into OrcaBus internal events. It consists of:

- **ICAv2 Event Translator Lambda Function**: Processes incoming ICA events and translates them to OrcaBus format
- **DynamoDB Table**: Stores audit records of event translations
- **EventBridge Rules**: Filters and routes relevant ICA events to the translator
- **Security Groups**: Controls network access for the Lambda function

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ICA Events    │───▶│  EventBridge     │───▶│ Lambda Function │
│   (External)    │    │  Rule Filter     │    │ (Translator)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ OrcaBus Events  │◀───│  EventBridge     │◀───│   DynamoDB      │
│   (Internal)    │    │  Event Bus       │    │   (Audit Log)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Stack Components

### 1. ICAv2 Event Translator Lambda Function

**Purpose**: Translates external ICA events to internal OrcaBus events

**Configuration**:
- **Architecture**: ARM64
- **Memory**: 1024 MB
- **Timeout**: 120 seconds
- **Concurrent Executions**: 1 (reserved)
- **Runtime**: Docker container

**Environment Variables**:
- `TABLE_NAME`: DynamoDB table name for audit logging
- `EVENT_BUS_NAME`: OrcaBus event bus name
- `ICAV2_BASE_URL`: ICA API base URL (`https://ica.illumina.com/ica/rest`)
- `ICAV2_ACCESS_TOKEN_SECRET_ID`: Secret Manager path for ICA JWT token

**Permissions**:
- DynamoDB read/write access to audit table
- Secrets Manager read access for ICA JWT token
- EventBridge `PutEvents` permission

### 2. DynamoDB Audit Table

**Purpose**: Stores audit records of event translations for compliance and debugging

**Table Name**: `BclConvertManagerTranslatorTable`

**Schema**:
| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key (portal_run_id, analysis_id, or db_uuid) |
| `id_type` | String | Type of ID (portal_run_id, analysis_id, db_uuid) |
| `analysis_id` | String | ICA analysis identifier |
| `analysis_status` | String | Current analysis status |
| `portal_run_id` | String | Portal run identifier |
| `db_uuid` | String | Database UUID |
| `original_external_event` | JSON | Original ICA event payload |
| `translated_internal_ica_event` | JSON | Translated OrcaBus event |
| `timestamp` | String | Event timestamp |

### 3. EventBridge Rule

**Purpose**: Filters and routes relevant ICA events to the translator function

**Event Pattern**:
```json
{
  "account": ["<account-id>"],
  "detail": {
    "ica-event": {
      "eventCode": ["ICA_EXEC_028"],
      "projectId": [{ "exists": true }],
      "payload": {
        "pipeline": {
          "code": [
            { "prefix": "BclConvert" },
            { "prefix": "BCL_Convert" }
          ]
        }
      }
    }
  }
}
```

**Target Configuration**:
- **Max Event Age**: 60 seconds
- **Retry Attempts**: 3

### 4. Security Group

**Purpose**: Controls network access for the Lambda function

**Name**: `OrcaBusBclConvertManagerSecurityGroup`

**Configuration**:
- **VPC**: Looked up from shared configuration
- **Outbound**: All traffic allowed
- **Description**: Security group for BclConvert Manager Lambda function egress

## Configuration

### Environment-Specific Configuration

The stack uses environment-specific configuration defined in `config.ts`:

```typescript
export const getBclConvertManagerStackProps = (stage: StageName): BclConvertManagerStackProps => ({
  icav2EventTranslatorDynamodbTableName: 'BclConvertManagerTranslatorTable',
  eventBusName: EVENT_BUS_NAME,
  vpcProps: VPC_LOOKUP_PROPS,
  lambdaSecurityGroupName: 'OrcaBusBclConvertManagerSecurityGroup',
  icav2JwtSecretsManagerPath: ICAV2_ACCESS_TOKEN_SECRET_ID[stage],
});
```

### Required Parameters

| Parameter | Type | Description | Source |
|-----------|------|-------------|--------|
| `icav2EventTranslatorDynamodbTableName` | String | DynamoDB table name | Hardcoded |
| `eventBusName` | String | OrcaBus event bus name | Shared config |
| `vpcProps` | VpcLookupOptions | VPC lookup properties | Shared config |
| `lambdaSecurityGroupName` | String | Security group name | Hardcoded |
| `icav2JwtSecretsManagerPath` | String | ICA JWT secret path | Stage-specific |

## Deployment

### Prerequisites

1. **Shared Infrastructure**: The stack depends on shared OrcaBus infrastructure:
   - EventBridge event bus
   - VPC configuration
   - Secrets Manager for ICA JWT tokens

2. **Dependencies**: Ensure the following are available:
   - DynamoDB table `BclConvertManagerTranslatorTable`
   - ICA JWT secret in Secrets Manager
   - VPC with appropriate subnets

### Deployment Commands

```bash
# List available stacks
pnpm cdk-stateless ls
```

Example output:

```sh
OrcaBusStatelessBclConvertManagerStack
OrcaBusStatelessBclConvertManagerStack/DeploymentPipeline/OrcaBusBeta/BclConvertManagerStack (OrcaBusBeta-BclConvertManagerStack)
OrcaBusStatelessBclConvertManagerStack/DeploymentPipeline/OrcaBusGamma/BclConvertManagerStack (OrcaBusGamma-BclConvertManagerStack)
OrcaBusStatelessBclConvertManagerStack/DeploymentPipeline/OrcaBusProd/BclConvertManagerStack (OrcaBusProd-BclConvertManagerStack)
```

# Destroy stack (if needed)

```bash
pnpm cdk-stateless destroy
```

### Deployment Pipeline

The stack is deployed through a CodePipeline that automatically deploys to:
- **Beta** environment
- **Gamma** environment
- **Production** environment

AWS SSO login session
```sh
aws sso login --profile dev && export AWS_PROFILE=dev
```

To build the CICD pipeline for workflow manager
```sh
pnpm cdk deploy -e OrcaBusStatelessBclConvertManagerStack
```

To build (test) in the dev account
```sh
pnpm cdk-stateless synth -e OrcaBusStatelessBclConvertManagerStack/DeploymentPipeline/OrcaBusBeta/BclConvertManagerStack
pnpm cdk-stateless diff -e OrcaBusStatelessBclConvertManagerStack/DeploymentPipeline/OrcaBusBeta/BclConvertManagerStack
pnpm cdk-stateless deploy -e OrcaBusStatelessBclConvertManagerStack/DeploymentPipeline/OrcaBusBeta/BclConvertManagerStack
```

## Event Flow

### Input Events

The service processes ICA execution events with the following structure:

```json
{
  "version": "0",
  "id": "3xxxxxx-fxxxxx-2xxx-axxx-cxxxxxxxx",
  "detail-type": "Event from aws:sqs",
  "source": "Pipe IcaEventPipeName",
  "account": "xxxxxxxxx",
  "time": "2024-00-00T00:01:00Z",
  "region": "ap-southeast-x",
  "resources": [],
  "detail": {
    "ica-event": {
      "correlationId": "xxxxxx-xxxxxx-xxxxxx-xxxxxx-xxxxxx",
      "timestamp": "2024-03-25T10:07:09.990Z",
      "eventCode": "ICA_EXEC_028",
      "eventParameters": {
        "pipelineExecution": "xxxxxx-xxxxxx-xxxxxx-xxxxxx-xxxxxx",
        "analysisPreviousStatus": "INPROGRESS",
        "analysisStatus": "SUCCEEDED"
      },
      "projectId": "xxxxxx-xxxxxx-xxxxxx-xxxxxx-xxxxxx",
      "payload": {
        "id": "xxxxxx-xxxxxx-xxxxxx-xxxxxx-xxxxxx",
        "pipeline": {
          "code": "BclConvert v0_0_0",
          "urn": "urn:ilmn:ica:pipeline:...",
          "description": "This is an autolaunch BclConvert pipeline..."
        }
      }
    }
  }
}
```

### Output Events

The service publishes `WorkflowRunStateChange` events to the OrcaBus event bus:

```json
{
  "version": "0",
  "id": "f71aaaaa-5b36-40c2-f7dc-804ca6270cd6",
  "detail-type": "WorkflowRunStateChange",
  "source": "orcabus.bclconvertmanager",
  "account": "123456789012",
  "time": "2024-05-01T09:25:44Z",
  "region": "ap-southeast-2",
  "resources": [],
  "detail": {
    "portalRunId": "202405012397actg",
    "timestamp": "2024-05-01T09:25:44Z",
    "status": "SUCCEEDED",
    "workflowName": "BclConvert",
    "workflowVersion": "4.2.7",
    "workflowRunName": "540424_A01001_0193_BBBBMMDRX5_c754de_bd822f",
    "payload": {
      "version": "0.1.0",
      "data": {
        "projectId": "bxxxxxxxx-dxxx-4xxxx-adcc-xxxxxxxxx",
        "analysisId": "aaaaafe8-238c-4200-b632-d5dd8c8db94a",
        "userReference": "540424_A01001_0193_BBBBMMDRX5_c754de_bd822f",
        "timeCreated": "2024-05-01T10:11:35Z",
        "timeModified": "2024-05-01T11:24:29Z",
        "pipelineId": "bfffffff-cb27-4dfa-846e-acd6eb081aca",
        "pipelineCode": "BclConvert v4_2_7",
        "pipelineDescription": "This is an autolaunch BclConvert pipeline for use by the metaworkflow",
        "pipelineUrn": "urn:ilmn:ica:pipeline:bfffffff-cb27-4dfa-846e-acd6eb081aca#BclConvert_v4_2_7",
        "instrumentRunId": "12345_A12345_1234_ABCDE12345",
        "basespaceRunId": "1234567",
        "samplesheetB64gz": "H4sIAFGBVWYC/9VaUW+jOBD+Kyvu9VqBgST0njhWh046..."
      }
    }
  }
}
```

## Monitoring and Troubleshooting

### CloudWatch Logs

Lambda function logs are available in CloudWatch Logs with the log group name pattern:
```
/aws/lambda/<stack-name>-EventTranslator-<random-suffix>
```

### DynamoDB Audit Records

All event translations are logged to the DynamoDB table for audit purposes. Query by:
- `portal_run_id` for specific run tracking
- `analysis_id` for ICA analysis tracking
- `timestamp` for time-based queries

### Common Issues

1. **Event Not Processed**: Check EventBridge rule pattern matches
2. **Translation Failures**: Review Lambda CloudWatch logs
3. **Permission Errors**: Verify IAM roles and policies
4. **Network Issues**: Check VPC and security group configuration

## Security

### IAM Permissions

The Lambda function has minimal required permissions:
- DynamoDB read/write access to audit table only
- Secrets Manager read access to ICA JWT token
- EventBridge `PutEvents` permission to publish events

### Network Security

- Lambda function runs in VPC with restricted security group
- Only outbound traffic allowed (no inbound rules)
- Uses private subnets for enhanced security

### Secrets Management

- ICA JWT tokens stored in AWS Secrets Manager
- Access controlled via IAM policies
- Automatic rotation supported

## Development

### Local Development

For local development and testing, refer to the main application README in `../app/README.md`.

### Testing

```bash
# Run infrastructure tests
pnpm test

# Run application tests
cd ../app && make test
```

### Linting and Formatting

```bash
# Check code quality
make check

# Fix formatting issues
make fix
```

## Related Documentation

- [Application README](../app/README.md) - Service logic and business rules
- [Main Project README](../../README.md) - Overall project documentation
- [OrcaBus Platform Documentation](https://github.com/OrcaBus/wiki/blob/main/orcabus-platform/README.md) - Platform-wide documentation
