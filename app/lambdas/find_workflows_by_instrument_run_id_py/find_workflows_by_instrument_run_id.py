#!/usr/bin/env python3

"""
Find bclconvert workflows by the instrument run id,

Here we only want to find the workflows in 'DRAFT' mode, where the payload is not empty and the payload.data.tags has
a key 'instrumentRunId' with the given value.

Otherwise return an empty list
"""

# Layer
from orcabus_api_tools.workflow import (
    list_workflow_runs,
    get_latest_payload_from_workflow_run,
)

# Globals
WORKFLOW_RUN_NAME = 'bclconvert'


def handler(event, context):
    # Get inputs
    instrument_run_id = event.get('instrumentRunId')

    # Get bclconvert workflow objects
    bclconvert_workflow_list = list_workflow_runs(
        workflow_name=WORKFLOW_RUN_NAME,
    )

    if len(bclconvert_workflow_list) == 0:
        return None

    # From SRM event
    bclconvert_draft_workflow_list = list_workflow_runs(
        workflow_name=WORKFLOW_RUN_NAME,
        current_status="DRAFT"
    )

    if len(bclconvert_draft_workflow_list) == 0:
        return {
            "workflowRunsList": []
        }

    try:
        workflow_run_object = next(filter(
            lambda workflow_iter_: (
                False
                if get_latest_payload_from_workflow_run(workflow_iter_['orcabusId']) is None
                else
                (
                        get_latest_payload_from_workflow_run(workflow_iter_['orcabusId'])
                        .get("data", {})
                        .get("tags", {})
                        .get("instrumentRunId")
                ) == instrument_run_id
            ),
            bclconvert_draft_workflow_list
        ))
    except StopIteration:
        return {
            "workflowRunsList": []
        }

    return {
        "workflowRunsList": [workflow_run_object]
    }
