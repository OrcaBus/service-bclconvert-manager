import { EventPattern, IEventBus, Rule } from 'aws-cdk-lib/aws-events';

export type EventBridgeRuleName =
  // Handle WRSC events
  'wrscEventRule';

export const eventBridgeRuleNameList: Array<EventBridgeRuleName> = [
  // Handle WRSC events
  'wrscEventRule',
];

export interface EventBridgeRuleProps {
  ruleName: EventBridgeRuleName;
  eventBus: IEventBus;
  eventPattern: EventPattern;
}

export interface EventBridgeRuleObject {
  ruleName: EventBridgeRuleName;
  ruleObject: Rule;
}

export interface BuildStandardRuleProps {
  ruleName: EventBridgeRuleName;
  eventBus: IEventBus;
}

export interface BuildEventBridgeRulesProps {
  /* Event Buses */
  eventBus: IEventBus;
}
