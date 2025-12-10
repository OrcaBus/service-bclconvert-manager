#!/usr/bin/env python3

"""
Find bclconvert workflows by the instrument run id,

Here we only want to find the workflows in where the payload is not empty and the payload.data.tags has
a key 'instrumentRunId' with the given value and where we have a matching samplesheet to the value stored in the SRM.

If we have a matching samplesheet, chances are we have a link with this BCLConvert run already.

Otherwise return an empty list
"""

# Standard library imports
from functools import reduce
from operator import concat

# Layer
from orcabus_api_tools.workflow import (
    list_workflow_runs,
    get_latest_payload_from_workflow_run,
)
from bssh_tool_kit.basespace_helpers import get_samplesheet_md5sum_from_instrument_run_id

# Globals
WORKFLOW_RUN_NAME = 'bclconvert'


def handler(event, context):
    # Get inputs
    instrument_run_id = event.get('instrumentRunId')

    # Get latest samplesheet from instrument run id
    samplesheet_md5sum = get_samplesheet_md5sum_from_instrument_run_id(instrument_run_id)

    # Get bclconvert workflow objects
    bclconvert_workflow_list = list_workflow_runs(
        workflow_name=WORKFLOW_RUN_NAME,
    )

    # If no workflows found, return empty
    if len(bclconvert_workflow_list) == 0:
        return None

    # Check if any of the workflow objects have the given instrument run id
    # in their latest payload
    bclconvert_workflow_list = list(reduce(
        concat,
        list(map(
            lambda status_iter_: list_workflow_runs(
                workflow_name=WORKFLOW_RUN_NAME,
                current_status=status_iter_
            ),
            [
                "DRAFT",
                "READY",
                "STARTING",
                "RUNNING",
                "SUCCEEDED",
            ]
        ))
    ))

    # No runs with the status of interest, return empty
    if len(bclconvert_workflow_list) == 0:
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
                        (
                                get_latest_payload_from_workflow_run(workflow_iter_['orcabusId'])
                                .get("data", {})
                                .get("tags", {})
                                .get("samplesheetChecksum")
                        ) == samplesheet_md5sum
                        and
                        (
                            get_latest_payload_from_workflow_run(workflow_iter_['orcabusId'])
                            .get("data", {})
                            .get("tags", {})
                            .get("samplesheetChecksumType")
                        ) == "md5"
                )
            ),
            bclconvert_workflow_list
        ))
    except StopIteration:
        return {
            "workflowRunsList": []
        }

    return {
        "workflowRunsList": [workflow_run_object]
    }
