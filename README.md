BCLConvert Manager
================================================================================

- [BCLConvert Manager](#bclconvert-manager)
  - [Service Description](#service-description)
    - [Summary](#summary)
    - [Events Overview](#events-overview)
    - [Consumed Events](#consumed-events)
    - [Published Events](#published-events)
    - [Draft Event](#draft-event)
      - [Draft Data Schema Validation](#draft-data-schema-validation)
    - [Release management](#release-management)
    - [Related Services](#related-services)
      - [Downstream Pipelines](#downstream-pipelines)
  - [Infrastructure \& Deployment](#infrastructure--deployment)
    - [Stateful](#stateful)
    - [Stateless](#stateless)
    - [CDK Commands](#cdk-commands)
    - [Stacks](#stacks)
  - [Development](#development)
    - [Project Structure](#project-structure)
    - [Setup](#setup)
      - [Requirements](#requirements)
      - [Install Dependencies](#install-dependencies)
    - [Conventions](#conventions)
    - [Linting \& Formatting](#linting--formatting)
    - [Testing](#testing)
  - [Glossary \& References](#glossary--references)

## Service Description

### Summary

This is the BCLConvert Manager service, responsible for
managing BCLConvert through the Autolaunch system.

This service doesn't actually run BCLConvert itself since that is done through BSSH Autolaunch.
However, we link the autolaunch job to our own internal portal run id for the workflow manager
and track the status of the job through to completion.

We use events from the SequenceRunManager and the ICA State Change events in order to
track the status of the BCLConvert job.

### Events Overview

We listen to SequenceRunManager State Change events from the main event bus.
These are usually events that occur prior to BCLConvert actually starting.
This allows us to register a workflow run in DRAFT mode to the BCLConvert job before
we know anything about it.

We also forward SQS messages from ICA into our Step Functions to track the ICA State Change events.
We need to then link the ICA Workflow Run State Change event to the workflow run which we assigned
to the BCLConvert job when we received the SequenceRunManager event.

![Events Overview](./docs/draw-io-exports/draft-to-ready.drawio.svg)

### Consumed Events

| Name / DetailType              | Source                       | Schema Link                                                                                                                                                                         | Description                |
|--------------------------------|------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------|
| `SequenceRunSampleSheetChange` | `orcabus.sequencerunmanager` | [SequenceRunSampleSheetChange](https://github.com/OrcaBus/service-sequence-run-manager/blob/main/docs/events/SequenceRunSampleSheetChange/SequenceRunSampleSheetChange.schema.json) | SRM Run State Changed      |
| `WorkflowRunStateChange`       | `orcabus.workflowmanager`    | [WorkflowRunStateChange](https://github.com/OrcaBus/service-workflow-manager/blob/main/docs/events/WorkflowRunStateChange/WorkflowRunStateChange.schema.json)                       | Workflow Run State Changed |

### Published Events

| Name / DetailType   | Source               | Schema Link                                                                       | Description                        |
|---------------------|----------------------|-----------------------------------------------------------------------------------|------------------------------------|
| `WorkflowRunUpdate` | `orcabus.bclconvert` | [BCLConvert WorkflowRunUpdate](app/event-schemas/complete-data-draft-schema.json) | Announces BCLConvert state changes |

### Draft Event

A workflow run must be placed into a DRAFT state before it can be started.
We set the draft event after the SRM stage, but before the ICA stage.

Once we have an analysis ID, we set the stage from DRAFT to READY (even though the bclconvert analysis is now already
running).

#### Draft Data Schema Validation

We have generated JSON schemas for the complete DRAFT WRU event **data** which you can find in the
[`app/event-schemas` directory](app/event-schemas).

You can interactively check if your DRAFT event data payload matches the schema using the following links:

- [Complete DRAFT WRU Event Data Schema Page](https://www.jsonschemavalidator.net/s/GnMkTIff)

### Release management

The service employs a fully automated CI/CD pipeline that
automatically builds and releases all changes to the `main` code branch.

### Related Services

#### Downstream Pipelines

- [BSSH TO AWS S3 Copy Manager](https://github.com/OrcaBus/service-bssh-to-aws-s3-copy-manager)

## Infrastructure & Deployment

Infrastructure and deployment are managed via CDK.
This template provides two types of CDK entry points: `cdk-stateless`
and `cdk-stateful`.

### Stateful

- SSM Parameters
- Event Schemas
- Event Bridge Pipe (Connects ICA events to the Step Function)

### Stateless

- Lambdas
- StepFunctions
- EventBridge Rules
- EventBridge Targets


### External Setup Requirements

Please view [the ica events setup docs](docs/operation/ica-events-setup/README.md) for instructions on setting up
the necessary ICA notifications to forward events to the SQS queue.

### CDK Commands

You can access CDK commands using the `pnpm` wrapper script.

- **`cdk-stateless`**: Used to deploy stacks containing stateless resources (e.g., AWS Lambda), which can be easily
  redeployed without side effects.
- **`cdk-stateful`**: Used to deploy stacks containing stateful resources (e.g., AWS DynamoDB, AWS RDS), where
  redeployment may not be ideal due to potential side effects.

The type of stack to deploy is determined by the context set in the `./bin/deploy.ts` file. This ensures the correct
stack is executed based on the provided context.

For example:

```sh
# Deploy a stateless stack
pnpm cdk-stateless <command>

# Deploy a stateful stack
pnpm cdk-stateful <command>
```

### Stacks

This CDK project manages multiple stacks. The root stack (the only one that does not include `DeploymentPipeline` in its
stack ID) is deployed in the toolchain account and sets up a CodePipeline for cross-environment deployments to `beta`,
`gamma`, and `prod`.

To list all available stateful stacks, run:

```sh
pnpm cdk-stateful ls
pnpm cdk-stateless ls
```

```sh
# Stateful
StatefulBclConvertPipeline
StatefulBclConvertPipeline/BclConvertStatefulDeployPipeline/OrcaBusBeta/BclConvertStatefulDeployStack (OrcaBusBeta-BclConvertStatefulDeployStack)
StatefulBclConvertPipeline/BclConvertStatefulDeployPipeline/OrcaBusGamma/BclConvertStatefulDeployStack (OrcaBusGamma-BclConvertStatefulDeployStack)
StatefulBclConvertPipeline/BclConvertStatefulDeployPipeline/OrcaBusProd/BclConvertStatefulDeployStack (OrcaBusProd-BclConvertStatefulDeployStack)
# Stateless
StatelessBclConvertPipelineManager
StatelessBclConvertPipelineManager/BclConvertStatelessDeploymentPipeline/OrcaBusBeta/BclConvertStatelessDeployStack (OrcaBusBeta-BclConvertStatelessDeployStack)
StatelessBclConvertPipelineManager/BclConvertStatelessDeploymentPipeline/OrcaBusGamma/BclConvertStatelessDeployStack (OrcaBusGamma-BclConvertStatelessDeployStack)
StatelessBclConvertPipelineManager/BclConvertStatelessDeploymentPipeline/OrcaBusProd/BclConvertStatelessDeployStack (OrcaBusProd-BclConvertStatelessDeployStack)
```

## Development

### Project Structure

The root of the project is an AWS CDK project where the main application logic lives inside the `./app` folder.

The project is organized into the following key directories:

- **`./app`**:
    - Contains the main application logic (lambdas / step functions / event schemas)

- **`./bin/deploy.ts`**:
    - Serves as the entry point of the application.
    - It initializes two root stacks: `stateless` and `stateful`.

- **`./infrastructure`**: Contains the infrastructure code for the project:
    - **`./infrastructure/toolchain`**: Includes stacks for the stateless and stateful resources deployed in the
      toolchain account. These stacks primarily set up the CodePipeline for cross-environment deployments.
    - **`./infrastructure/stage`**: Defines the stage stacks for different environments:
        - **`./infrastructure/stage/interfaces`**: The TypeScript interfaces used across constants, and stack
          configurations.
        - **`./infrastructure/stage/constants.ts`**: Constants used across different stacks and stages.
        - **`./infrastructure/stage/config.ts`**: Contains environment-specific configuration files (e.g., `beta`,
          `gamma`, `prod`).
        - **`./infrastructure/stage/stateful-application-stack.ts`**: The CDK stack entry point for provisioning
          resources required by the
          application in `./app`.
        - **`./infrastructure/stage/stateless-application-stack.ts`**: The CDK stack entry point for provisioning
          stateless resources required by the
          application in `./app`.
        - **`./infrastructure/stage/<aws-service-constructs>/`**: Contains AWS service-specific constructs used in the
          stacks.
            - Each AWS service construct is called from either the `stateful-application-stack.ts` or
              `stateless-application-stack.ts`.
            - Each AWS service folder contains an `index.ts` and `interfaces.ts` file.

- **`.github/workflows/pr-tests.yml`**:
    - Configures GitHub Actions to run tests for `make check` (linting and code
      style), tests defined in `./test`.

- **`./test`**: Contains tests for CDK code compliance against `cdk-nag`.

### Setup

#### Requirements

```sh
node --version
v22.9.0

# Update Corepack (if necessary, as per pnpm documentation)
npm install --global corepack@latest

# Enable Corepack to use pnpm
corepack enable pnpm

```

#### Install Dependencies

To install all required dependencies, run:

```sh
make install
```

### Conventions

### Linting & Formatting

Automated checks are enforces via pre-commit hooks, ensuring only checked code is committed. For details consult the
`.pre-commit-config.yaml` file.

Manual, on-demand checking is also available via `make` targets (see below). For details consult the `Makefile` in the
root of the project.

To run linting and formatting checks on the root project, use:

```sh
make check
```

To automatically fix issues with ESLint and Prettier, run:

```sh
make fix
```

### Testing

Unit tests are available for most of the business logic. Test code is hosted alongside business in `/tests/`
directories.

```sh
make test
```

## Glossary & References

For general terms and expressions used across OrcaBus services, please see the
platform [documentation](https://github.com/OrcaBus/wiki/blob/main/orcabus-platform/README.md#glossary--references).
