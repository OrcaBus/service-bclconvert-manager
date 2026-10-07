import { App, Aspects, Stack } from 'aws-cdk-lib';
import { Annotations, Match, Template } from 'aws-cdk-lib/assertions';
import { SynthesisMessage } from 'aws-cdk-lib/cx-api';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { StatelessApplicationStack } from '../infrastructure/stage/stateless-application-stack';
import { getStatelessStackProps } from '../infrastructure/stage/config';

function synthesisMessageToString(sm: SynthesisMessage): string {
  return `${sm.entry.data} [${sm.id}]`;
}

/**
 * Find the synthesized timeout of the Lambda function whose construct id (and therefore
 * logical id prefix) matches the given camelCase lambda name. Each Lambda is created with
 * `new PythonUvFunction(scope, props.lambdaName, ...)`, so its logical id is the lambda name
 * followed by an 8-character CloudFormation hash (e.g. `findWorkflowAA4B3705`).
 */
function getLambdaTimeout(template: Template, lambdaName: string): number {
  const functions = template.findResources('AWS::Lambda::Function');
  const matches = Object.entries(functions).filter(([logicalId]) =>
    new RegExp(`^${lambdaName}[0-9A-F]{8}$`).test(logicalId)
  );
  expect(matches).toHaveLength(1);
  return matches[0][1].Properties.Timeout;
}

describe('cdk-nag-stateless-toolchain-stack', () => {
  const app = new App({});

  // You should configure all stack (stateless, stateful) to be tested
  const applicationStack = new StatelessApplicationStack(
    app,
    'DeployStack',
    // Pick the prod environment to test as it is the most strict
    getStatelessStackProps('PROD')
  );

  Aspects.of(applicationStack).add(new AwsSolutionsChecks());
  applyNagSuppression(applicationStack);

  test(`cdk-nag AwsSolutions Pack errors`, () => {
    const errors = Annotations.fromStack(applicationStack)
      .findError('*', Match.stringLikeRegexp('AwsSolutions-.*'))
      .map(synthesisMessageToString);
    expect(errors).toHaveLength(0);
  });

  test(`cdk-nag AwsSolutions Pack warnings`, () => {
    const warnings = Annotations.fromStack(applicationStack)
      .findWarning('*', Match.stringLikeRegexp('AwsSolutions-.*'))
      .map(synthesisMessageToString);
    expect(warnings).toHaveLength(0);
  });
});

describe('lambda-timeout-synthesis', () => {
  const app = new App({});
  const applicationStack = new StatelessApplicationStack(
    app,
    'TimeoutTestStack',
    getStatelessStackProps('PROD')
  );
  const template = Template.fromStack(applicationStack);

  // Property 1: Extended timeout (5 minutes / 300s) is applied when needsExtendedTimeout is declared.
  test('findWorkflow synthesizes with the extended timeout of 300 seconds', () => {
    expect(getLambdaTimeout(template, 'findWorkflow')).toEqual(300);
  });

  // Property 2: Default timeout (1 minute / 60s) is applied when needsExtendedTimeout is omitted.
  test('updateWorkflowRunObject synthesizes with the default timeout of 60 seconds', () => {
    expect(getLambdaTimeout(template, 'updateWorkflowRunObject')).toEqual(60);
  });
});

/**
 * apply nag suppression
 * @param stack
 */
function applyNagSuppression(stack: Stack) {
  // These are example suppressions for this stack and should be removed and replaced with the
  // service-specific suppressions of your app.
  NagSuppressions.addStackSuppressions(
    stack,
    [{ id: 'AwsSolutions-S10', reason: 'not require requests to use SSL' }],
    true
  );
  NagSuppressions.addStackSuppressions(
    stack,
    [{ id: 'AwsSolutions-S1', reason: 'this is an example bucket' }],
    true
  );
}
