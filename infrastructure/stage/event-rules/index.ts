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
  SEQUENCE_RUN_MANAGER_DETAIL_TYPE,
  SEQUENCE_RUN_MANAGER_SOURCE,
  WORKFLOW_MANAGER_EVENT_SOURCE,
  WORKFLOW_NAME,
  WORKFLOW_RUN_STATE_CHANGE_DETAIL_TYPE,
} from '../constants';

/** Event bridge rules stuff */

function buildSequenceRunManagerEventPattern(): EventPattern {
  return {
    detailType: [SEQUENCE_RUN_MANAGER_DETAIL_TYPE],
    source: [SEQUENCE_RUN_MANAGER_SOURCE],
  };
}

function buildWorkflowManagerLegacyDraftEventPattern(): EventPattern {
  return {
    detailType: [WORKFLOW_RUN_STATE_CHANGE_DETAIL_TYPE],
    source: [WORKFLOW_MANAGER_EVENT_SOURCE],
    detail: {
      workflowName: [WORKFLOW_NAME],
      status: [DRAFT_STATUS],
    },
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

function buildSequenceRunStateChangeRule(scope: Construct, props: BuildStandardRuleProps): Rule {
  return buildEventRule(scope, {
    ruleName: props.ruleName,
    eventPattern: buildSequenceRunManagerEventPattern(),
    eventBus: props.eventBus,
  });
}

function buildWorkflowRunStateChangeDraftLegacyEventRule(
  scope: Construct,
  props: BuildStandardRuleProps
): Rule {
  return buildEventRule(scope, {
    ruleName: props.ruleName,
    eventPattern: buildWorkflowManagerLegacyDraftEventPattern(),
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
      // SRM Updates
      case 'sequenceRunStateChangeRule': {
        eventBridgeObjects.push({
          ruleName: eventBridgeRuleName,
          ruleObject: buildSequenceRunStateChangeRule(scope, {
            ruleName: eventBridgeRuleName,
            eventBus: props.eventBus,
          }),
        });
        break;
      }
      // Workflow Manager Draft Updates - Legacy
      // Populate Draft Data events
      case 'wrscEventRule': {
        eventBridgeObjects.push({
          ruleName: eventBridgeRuleName,
          ruleObject: buildWorkflowRunStateChangeDraftLegacyEventRule(scope, {
            ruleName: eventBridgeRuleName,
            eventBus: props.eventBus,
          }),
        });
        break;
      }
      // Workflow Manager Draft Updates - New
      case 'wrscEventRuleLegacy': {
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
