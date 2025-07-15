import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DeploymentStackPipeline } from '@orcabus/platform-cdk-constructs/deployment-stack-pipeline';
import { getBclConvertManagerStackProps } from '../stage/config';
import { BclConvertManagerStack } from '../stage/stack';

export class StatelessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new DeploymentStackPipeline(this, 'DeploymentPipeline', {
      githubBranch: 'main',
      githubRepo: 'service-bclconvert-manager',
      stack: BclConvertManagerStack,
      stackName: 'BclConvertManagerStack',
      stackConfig: {
        beta: getBclConvertManagerStackProps('BETA'),
        gamma: getBclConvertManagerStackProps('GAMMA'),
        prod: getBclConvertManagerStackProps('PROD'),
      },
      pipelineName: 'OrcaBus-StatelessBclConvertManager',
      cdkSynthCmd: ['pnpm install --frozen-lockfile --ignore-scripts', 'pnpm cdk-stateless synth'],
    });
  }
}
