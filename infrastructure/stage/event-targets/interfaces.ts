import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { Rule } from 'aws-cdk-lib/aws-events';
import { EventBridgeRuleObject } from '../event-rules/interfaces';
import { StepFunctionObject } from '../step-functions/interfaces';

/**
 * EventBridge Target Interfaces
 */
export type EventBridgeTargetName =
  // SRM
  | 'sequenceRunStateChangeEventToHandleSrmEventSfnTarget'
  // Validate draft to ready
  | 'draftLegacyToValidateDraftSfnTarget'
  | 'draftToValidateDraftSfnTarget';

export const eventBridgeTargetsNameList: EventBridgeTargetName[] = [
  // SRM
  'sequenceRunStateChangeEventToHandleSrmEventSfnTarget',
  // Validate draft to ready
  'draftLegacyToValidateDraftSfnTarget',
  'draftToValidateDraftSfnTarget',
];

export interface AddSfnAsEventBridgeTargetProps {
  stateMachineObj: StateMachine;
  eventBridgeRuleObj: Rule;
}

export interface EventBridgeTargetsProps {
  eventBridgeRuleObjects: EventBridgeRuleObject[];
  stepFunctionObjects: StepFunctionObject[];
}
