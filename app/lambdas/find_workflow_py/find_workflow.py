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
from pathlib import Path

from icav2_tools import set_icav2_env_vars
# Imports
# Standard

# Layer
from orcabus_api_tools.workflow import (
    list_workflow_runs_by_workflow_name,
    get_latest_payload_from_workflow_run, get_workflow_run_from_portal_run_id
)

# Wrapica imports
from wrapica.project_analysis import get_analysis_obj_from_analysis_id

# Globals
WORKFLOW_RUN_NAME = 'bclconvert'

def handler(event, context):
    # Get inputs
    # SRM Mode
    basespace_run_id = event.get('basespaceRunId')
    status = event.get('status')
    # ICA Mode
    project_id = event.get('projectId')
    analysis_id = event.get('analysisId')

    # Check one mode is used
    if (
            not (basespace_run_id and status) and
            not (analysis_id and project_id)
    ):
        raise ValueError("Must provide either basespaceRunId + status (SRM mode) or analysisId (ICA mode)")

    # Get bclconvert workflow objects
    bclconvert_workflow_list = list_workflow_runs_by_workflow_name(WORKFLOW_RUN_NAME)

    if len(bclconvert_workflow_list) == 0:
        return None

    # SRM mode
    if (basespace_run_id and status):
        try:
            workflow_run_object = next(filter(
                lambda workflow_iter_: (
                    get_workflow_run_from_portal_run_id(workflow_iter_['portalRunId'])['currentState']['status'] == status and
                    ( get_latest_payload_from_workflow_run(workflow_iter_['orcabusId']).get("data", {}).get("tags", {}).get("basespaceRunId") == basespace_run_id )
                ),
                bclconvert_workflow_list
            ))
        except StopIteration:
            return None

    # ICA mode
    else:
        set_icav2_env_vars()
        try:
            workflow_run_object = next(filter(
                lambda workflow_iter_: (
                    get_latest_payload_from_workflow_run(workflow_iter_['orcabusId']).get("data", {}).get("engineParameters", {}).get("analysisId") == analysis_id
                ),
                bclconvert_workflow_list
            ))
        except StopIteration:
            # Get the basespace run id from the analysis id
            analysis_obj = get_analysis_obj_from_analysis_id(
                project_id=project_id,
                analysis_id=analysis_id
            )

            # From the tags.userTags[0] rsplit(_) the path to get the basespace run id
            #       "userTags": [
            #         "/ilmn-runs/bssh_aps2-sh-prod_6052046/"
            #       ]
            basespace_run_id = int(Path(analysis_obj.workflow_session.tags.user_tags[0]).name.rsplit("_", 1)[-1])
            try:
                workflow_run_object = next(filter(
                    lambda workflow_iter_: (
                            get_latest_payload_from_workflow_run(workflow_iter_['orcabusId']).get("data", {}).get("tags", {}).get("basespaceRunId") == basespace_run_id
                    ),
                    bclconvert_workflow_list
                ))
            except StopIteration:
                return None

    return {
        "workflowRunObject": workflow_run_object
    }
