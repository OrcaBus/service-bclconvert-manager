import { EVENT_BUS_NAME } from '@orcabus/platform-cdk-constructs/shared-config/event-bridge';
import { StageName } from '@orcabus/platform-cdk-constructs/shared-config/accounts';
import { VPC_LOOKUP_PROPS } from '@orcabus/platform-cdk-constructs/shared-config/networking';
import {
  ICAV2_ACCESS_TOKEN_SECRET_ID,
  ICAV2_BASE_URL,
} from '@orcabus/platform-cdk-constructs/shared-config/icav2';
import { BclConvertManagerStackProps } from './stack';

export const getBclConvertManagerStackProps = (stage: StageName): BclConvertManagerStackProps => ({
  icav2EventTranslatorDynamodbTableName: 'BclConvertManagerTranslatorTable',
  eventBusName: EVENT_BUS_NAME,
  vpcProps: VPC_LOOKUP_PROPS,
  lambdaSecurityGroupName: 'OrcaBusBclConvertManagerSecurityGroup',
  icav2JwtSecretsManagerPath: ICAV2_ACCESS_TOKEN_SECRET_ID[stage],
  icav2BaseUrl: ICAV2_BASE_URL,
});
