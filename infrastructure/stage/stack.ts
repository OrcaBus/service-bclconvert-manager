import { Construct } from 'constructs';
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { Architecture, DockerImageFunction, DockerImageCode } from 'aws-cdk-lib/aws-lambda';
import { Vpc, VpcLookupOptions, SecurityGroup, IVpc, ISecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import * as path from 'path';

export interface BclConvertManagerStackProps {
  /** dynamodb name and event bus name */
  icav2EventTranslatorDynamodbTableName: string;
  eventBusName: string;
  /** vpc ann SG for lambda function */
  vpcProps: VpcLookupOptions;
  lambdaSecurityGroupName: string;
  /** secrets manager path for icav2 api call*/
  icav2JwtSecretsManagerPath: string;
  /** icav2 base url for api call */
  icav2BaseUrl: string;
}

export class BclConvertManagerStack extends Stack {
  private readonly vpc: IVpc;
  private readonly lambdaSG: ISecurityGroup;

  constructor(scope: Construct, id: string, props: StackProps & BclConvertManagerStackProps) {
    super(scope, id, props);

    this.vpc = Vpc.fromLookup(this, 'MainVpc', props.vpcProps);
    this.lambdaSG = new SecurityGroup(this, 'IcaEventTranslatorLambdaSG', {
      vpc: this.vpc,
      securityGroupName: props.lambdaSecurityGroupName,
      allowAllOutbound: true,
      description:
        'Security group that allows the Ica Event Translator (BclConvertManager) function to egress out.',
    });

    // Create the ICAv2 Event Translator service
    this.createICAv2EventTranslator(props);
  }

  private createICAv2EventTranslator(props: BclConvertManagerStackProps) {
    //Get the orcabus, vpc, dynamodb table, cav2 jwt secret from lookup
    const mainBus = EventBus.fromEventBusName(this, 'EventBus', props.eventBusName);
    const dynamoDBTable = TableV2.fromTableName(
      this,
      'Icav2EventTranslatorDynamoDBTable',
      props.icav2EventTranslatorDynamodbTableName
    );
    const icav2JwtSecretsManagerObj = Secret.fromSecretNameV2(
      this,
      'icav2_jwt_secret',
      props.icav2JwtSecretsManagerPath
    );

    const EventTranslatorFunction = new DockerImageFunction(this, 'EventTranslator', {
      code: DockerImageCode.fromImageAsset(path.join(__dirname, '../../app/'), {
        file: 'Dockerfile',
      }),
      timeout: Duration.seconds(120),
      memorySize: 1024,
      environment: {
        TABLE_NAME: props.icav2EventTranslatorDynamodbTableName,
        EVENT_BUS_NAME: props.eventBusName,
        ICAV2_BASE_URL: props.icav2BaseUrl,
        ICAV2_ACCESS_TOKEN_SECRET_ID: icav2JwtSecretsManagerObj.secretName,
      },
      architecture: Architecture.ARM_64,
      reservedConcurrentExecutions: 1,
    });

    dynamoDBTable.grantReadWriteData(EventTranslatorFunction);
    icav2JwtSecretsManagerObj.grantRead(EventTranslatorFunction);

    // Create a rule to trigger the Lambda function from the EventBus ICAV2_EXTERNAL_EVENT
    const rule = new Rule(this, 'Rule', {
      eventBus: mainBus,
      eventPattern: {
        account: [Stack.of(this).account],
        detail: {
          'ica-event': {
            eventCode: ['ICA_EXEC_028'],
            projectId: [{ exists: true }],
            payload: {
              pipeline: {
                code: [
                  {
                    prefix: 'BclConvert',
                  },
                  {
                    prefix: 'BCL_Convert',
                  },
                ],
              },
            },
          },
        },
      },
    });

    rule.addTarget(
      new LambdaFunction(EventTranslatorFunction, {
        maxEventAge: Duration.seconds(60), // Maximum age for an event to be retried, Member must have value greater than or equal to 60 (Service: EventBridge)
        retryAttempts: 3, // Retry up to 3 times
      })
    );

    // Optional: If the Lambda function needs more permissions for the DynamoDB table and the event bus
    EventTranslatorFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['events:PutEvents'],
        resources: [mainBus.eventBusArn],
      })
    );
  }
}
