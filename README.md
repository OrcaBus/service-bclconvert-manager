BCLConvert Manager
================================================================================

- [Service Description](#service-description)
  - [Summary](#summary)
  - [Events Overview](#events-overview)
  - [Consumed Events](#consumed-events)
  - [Published Events](#published-events)
  - [Step Functions Overview](#step-functions-overview)
    - [Handle SRM Event](#handle-srm-event)
    - [Handle ICA Event](#handle-ica-event)
    - [Validate Draft to Ready](#validate-draft-to-ready)
- [Infrastructure \& Deployment](#infrastructure--deployment)
  - [Stateful](#stateful)
  - [Stateless](#stateless)
  - [CDK Commands](#cdk-commands)
  - [Stacks](#stacks)
    - [Stateful](#stateful-1)
    - [Stateless](#stateless-1)
- [Development](#development)
  - [Project Structure](#project-structure)
  - [Setup](#setup)
    - [Requirements](#requirements)
    - [Install Dependencies](#install-dependencies)
    - [First Steps](#first-steps)
  - [Conventions](#conventions)
  - [Linting \& Formatting](#linting--formatting)
  - [Testing](#testing)
- [Glossary \& References](#glossary--references)


Service Description
--------------------------------------------------------------------------------

### Summary

This is the BCLConvert Manager service, responsible for
managing BCLConvert through the Autolaunch system.

This service doesn't actually run BCLConvert itself since that is done through BSSH Autolaunch.
However we link the autolaunch job to our own internal portal run id for the workflow manager
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

![Events Overview](./docs/events-diagrams/events-overview.drawio.svg)

### Consumed Events

| Name / DetailType        | Source                       | Schema Link   | Description           |
|--------------------------|------------------------------|---------------|-----------------------|
| `SequenceRunStateChange` | `orcabus.sequencerunmanager` | <schema link> | SRM Run State Changed |

### Published Events

| Name / DetailType   | Source               | Schema Link   | Description                        |
|---------------------|----------------------|---------------|------------------------------------|
| `WorkflowRunUpdate` | `orcabus.bclconvert` | <schema link> | Announces BCLConvert state changes |

### Step Functions Overview

#### Handle SRM Event

![Handle SRM Event](./docs/workflow-studio-exports/handle-srm-event.svg)

#### Handle ICA Event

![Handle ICA Event](./docs/workflow-studio-exports/handle-ica-event.svg)

#### Validate Draft to Ready

![Validate Draft To Ready](./docs/workflow-studio-exports/validate-draft-to-ready.svg)


Infrastructure & Deployment
--------------------------------------------------------------------------------

Infrastructure and deployment are managed via CDK. This template provides two types of CDK entry points: `cdk-stateless`
and `cdk-stateful`.

### Stateful

- SQS For ICA Events
- SSM Parameters
- Complete Event Data Schema

### Stateless

- Lambdas
- StepFunctions
- EventBridge Rules
- EventBridge Targets

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

#### Stateful

To list all available stateful stacks, run:

```sh
pnpm cdk-stateful ls
```

```sh
StatefulBclConvertPipeline
StatefulBclConvertPipeline/BclConvertStatefulDeployPipeline/OrcaBusBeta/BclConvertStatefulDeployStack (OrcaBusBeta-BclConvertStatefulDeployStack)
StatefulBclConvertPipeline/BclConvertStatefulDeployPipeline/OrcaBusGamma/BclConvertStatefulDeployStack (OrcaBusGamma-BclConvertStatefulDeployStack)
StatefulBclConvertPipeline/BclConvertStatefulDeployPipeline/OrcaBusProd/BclConvertStatefulDeployStack (OrcaBusProd-BclConvertStatefulDeployStack)
```


#### Stateless

To list all available stateless stacks, run:

```sh
pnpm cdk-stateless ls
```


Development
--------------------------------------------------------------------------------

### Project Structure

The root of the project is an AWS CDK project where the main application logic lives inside the `./app` folder.

The project is organized into the following key directories:

- **`./app`**: Contains the main application logic. You can open the code editor directly in this folder, and the
  application should run independently.

- **`./bin/deploy.ts`**: Serves as the entry point of the application. It initializes two root stacks: `stateless` and
  `stateful`. You can remove one of these if your service does not require it.

- **`./infrastructure`**: Contains the infrastructure code for the project:
    - **`./infrastructure/toolchain`**: Includes stacks for the stateless and stateful resources deployed in the
      toolchain account. These stacks primarily set up the CodePipeline for cross-environment deployments.
    - **`./infrastructure/stage`**: Defines the stage stacks for different environments:
        - **`./infrastructure/stage/config.ts`**: Contains environment-specific configuration files (e.g., `beta`,
          `gamma`, `prod`).
        - **`./infrastructure/stage/stack.ts`**: The CDK stack entry point for provisioning resources required by the
          application in `./app`.

- **`.github/workflows/pr-tests.yml`**: Configures GitHub Actions to run tests for `make check` (linting and code
  style), tests defined in `./test`, and `make test` for the `./app` directory. Modify this file as needed to ensure the
  tests are properly configured for your environment.

- **`./test`**: Contains tests for CDK code compliance against `cdk-nag`. You should modify these test files to match
  the resources defined in the `./infrastructure` folder.

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

#### First Steps

Before using this template, search for all instances of `TODO:` comments in the codebase and update them as appropriate
for your service. This includes replacing placeholder values (such as stack names).

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

Glossary & References
--------------------------------------------------------------------------------

For general terms and expressions used across OrcaBus services, please see the
platform [documentation](https://github.com/OrcaBus/wiki/blob/main/orcabus-platform/README.md#glossary--references).

Service specific terms:

| Term | Description |
|------|-------------|
| Foo  | ...         |
| Bar  | ...         |
