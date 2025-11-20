#!/usr/bin/env python3

"""
Find a BCLConvert workflow

There are two modes for input in this lambda:

# From the SRM event

* basespaceRunId, aka (v1pre3id),
* status (DRAFT)

# From the ICA event

* analysisId

For both events we must query the workflow manager for all bclconvert workflows and filter to the one we want
"""

# Standard imports
from typing import List

# Layer
from orcabus_api_tools.workflow import (
    list_workflow_runs_by_workflow_name,
    get_latest_payload_from_workflow_run,
    get_workflow_request_response_results
)
from orcabus_api_tools.workflow.globals import WORKFLOW_RUN_ENDPOINT
from orcabus_api_tools.workflow.models import WorkflowRunDetail

# Globals
WORKFLOW_RUN_NAME = 'bclconvert'


def handler(event, context):
    # Get inputs
    # ICA Mode
    project_id = event.get('projectId')
    analysis_id = event.get('analysisId')

    # Check one mode is used
    if (
            not (analysis_id and project_id)
    ):
        raise ValueError("Must provide projectId + analysisId (ICA mode)")

    # Get bclconvert workflow objects
    bclconvert_workflow_list = list_workflow_runs_by_workflow_name(WORKFLOW_RUN_NAME)

    if len(bclconvert_workflow_list) == 0:
        return None

    # ICA mode
    try:
        workflow_run_object = next(filter(
            lambda workflow_iter_: (
                get_latest_payload_from_workflow_run(workflow_iter_['orcabusId']).get("data", {}).get("engineParameters", {}).get("analysisId") == analysis_id
            ),
            bclconvert_workflow_list
        ))
    except StopIteration:
        return None


    return {
        "workflowRunObject": workflow_run_object
    }
