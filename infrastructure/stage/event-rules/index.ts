import {
  BuildStandardRuleProps,
  BuildEventBridgeRulesProps,
  eventBridgeRuleNameList,
  EventBridgeRuleObject,
  EventBridgeRuleProps,
} from './interfaces';
import { EventPattern } from 'aws-cdk-lib/aws-events/lib/event-pattern';
import { Rule } from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import {
  DRAFT_STATUS,
  SEQUENCE_RUN_MANAGER_SAMPLESHEET_CHANGE_DETAIL_TYPE,
  SEQUENCE_RUN_MANAGER_SOURCE,
  WORKFLOW_MANAGER_EVENT_SOURCE,
  WORKFLOW_NAME,
  WORKFLOW_RUN_STATE_CHANGE_DETAIL_TYPE,
} from '../constants';

/** Event bridge rules stuff */
function buildSrmSampleSheetStateChangeEventPattern(): EventPattern {
  return {
    detailType: [SEQUENCE_RUN_MANAGER_SAMPLESHEET_CHANGE_DETAIL_TYPE],
    source: [SEQUENCE_RUN_MANAGER_SOURCE],
  };
}

function buildWorkflowManagerDraftEventPattern(): EventPattern {
  return {
    detailType: [WORKFLOW_RUN_STATE_CHANGE_DETAIL_TYPE],
    source: [WORKFLOW_MANAGER_EVENT_SOURCE],
    detail: {
      workflow: {
        name: [WORKFLOW_NAME],
      },
      status: [DRAFT_STATUS],
    },
  };
}

function buildEventRule(scope: Construct, props: EventBridgeRuleProps): Rule {
  return new events.Rule(scope, props.ruleName, {
    ruleName: props.ruleName,
    eventPattern: props.eventPattern,
    eventBus: props.eventBus,
  });
}

function buildSrmSampleSheetChangeDraftEventRule(
  scope: Construct,
  props: BuildStandardRuleProps
): Rule {
  return buildEventRule(scope, {
    ruleName: props.ruleName,
    eventPattern: buildSrmSampleSheetStateChangeEventPattern(),
    eventBus: props.eventBus,
  });
}

function buildWorkflowRunStateChangeDraftEventRule(
  scope: Construct,
  props: BuildStandardRuleProps
): Rule {
  return buildEventRule(scope, {
    ruleName: props.ruleName,
    eventPattern: buildWorkflowManagerDraftEventPattern(),
    eventBus: props.eventBus,
  });
}

export function buildAllEventRules(
  scope: Construct,
  props: BuildEventBridgeRulesProps
): EventBridgeRuleObject[] {
  const eventBridgeObjects: EventBridgeRuleObject[] = [];
  for (const eventBridgeRuleName of eventBridgeRuleNameList) {
    switch (eventBridgeRuleName) {
      // SampleSheet State Change event rule
      case 'srmSampleSheetUpdateEventRule': {
        eventBridgeObjects.push({
          ruleName: eventBridgeRuleName,
          ruleObject: buildSrmSampleSheetChangeDraftEventRule(scope, {
            ruleName: eventBridgeRuleName,
            eventBus: props.eventBus,
          }),
        });
        break;
      }
      // BCLConvert Workflow Run State Change
      case 'wrscEventRule': {
        eventBridgeObjects.push({
          ruleName: eventBridgeRuleName,
          ruleObject: buildWorkflowRunStateChangeDraftEventRule(scope, {
            ruleName: eventBridgeRuleName,
            eventBus: props.eventBus,
          }),
        });
        break;
      }
    }
  }
  return eventBridgeObjects;
}
