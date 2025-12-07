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

# Wrapica imports
from wrapica.project_analysis import get_project_analysis_inputs

# Layer
from icav2_tools import set_icav2_env_vars
from orcabus_api_tools.workflow import (
    list_workflow_runs,
    get_latest_payload_from_workflow_run,
)

from bssh_tool_kit import (
    get_instrument_run_id_from_run_info_xml,
    get_basespace_run_id_from_instrument_run_id,
    get_run_folder_input_uri_from_ica_inputs,
)

# Globals
WORKFLOW_RUN_NAME = 'bclconvert'


def handler(event, context):
    # Get inputs
    project_id = event.get('projectId')
    analysis_id = event.get('analysisId')

    # Check both inputs are provided
    if (
            not (analysis_id and project_id)
    ):
        raise ValueError("Must provide projectId + analysisId")

    # Get bclconvert workflow objects
    bclconvert_workflow_list = list_workflow_runs(
        workflow_name=WORKFLOW_RUN_NAME,
    )

    if len(bclconvert_workflow_list) == 0:
        return None

    # ICA Mode
    set_icav2_env_vars()

    # ICA Inputs
    ica_inputs = get_project_analysis_inputs(
        project_id=project_id,
        analysis_id=analysis_id,
    )

    # Run folder input
    input_uri = get_run_folder_input_uri_from_ica_inputs(
        ica_inputs,
        project_id=project_id,
    )

    # Get the instrument run id from the RunInfo.xml file
    instrument_run_id = get_instrument_run_id_from_run_info_xml(
        run_info_xml_uri=(input_uri + 'RunInfo.xml')
    )

    # Get the basespace run id from the API endpoint
    basespace_run_id = get_basespace_run_id_from_instrument_run_id(instrument_run_id)

    # From SRM event
    bclconvert_draft_workflow_list = list_workflow_runs(
        workflow_name=WORKFLOW_RUN_NAME,
        current_status="DRAFT"
    )
    # Try link on the basespace run id tag
    if len(bclconvert_draft_workflow_list) > 0:
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
                        .get("basespaceRunId")
                    ) == basespace_run_id
                ),
                bclconvert_draft_workflow_list
            ))
        except StopIteration:
            workflow_run_object = None

        if workflow_run_object is not None:
            return {
                "workflowRunObject": workflow_run_object
            }

    # We have a running workflow, link on that using the analysis id
    # ICA mode
    try:
        workflow_run_object = next(filter(
            lambda workflow_iter_: (
                False
                if get_latest_payload_from_workflow_run(workflow_iter_['orcabusId']) is None
                else
                (
                    get_latest_payload_from_workflow_run(workflow_iter_['orcabusId'])
                    .get("data", {})
                    .get("engineParameters", {})
                    .get("analysisId")
                ) == analysis_id
            ),
            bclconvert_workflow_list
        ))
    except StopIteration:
        return None

    # Return the workflow run object
    return {
        "workflowRunObject": workflow_run_object
    }
