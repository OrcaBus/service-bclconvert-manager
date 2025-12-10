#!/usr/bin/env python3

"""
Given just an instrument run id, generate a draft event detail.

This lambda comes from the SRM, where we only have the instrument run id.

Tags:
We can query BSSH to get the samplesheet / experiment name and the basespace run id.

# Libraries
We can query the SRM to get the library id list for the run.

# Readsets
We can also query the fastq manager to get all the readsets for the run.

We do not intend to set the inputs or the engine parameters here
"""

# Standard library imports
import secrets
from typing import List
from os import environ
from datetime import datetime, timezone

# Layer imports
from orcabus_api_tools.utils.aws_helpers import get_ssm_value
from orcabus_api_tools.sequence import (
    get_library_id_list_from_instrument_run_id,
)
from orcabus_api_tools.workflow import list_workflows
from orcabus_api_tools.metadata import get_libraries_list_from_library_id_list

from bssh_tool_kit.basespace_helpers import get_samplesheet_md5sum_from_instrument_run_id
from bssh_tool_kit import (
    get_experiment_name_from_instrument_run_id,
    get_basespace_run_id_from_instrument_run_id, DEFAULT_SAMPLESHEET_CHECKSUM_TYPE,
)

# Globals
DEFAULT_PAYLOAD_VERSION = "2025.10.10"
WORKFLOW_NAME = 'bclconvert'
WORKFLOW_PREFIXES = [
    'bssh',
    'autolaunch',
]
DEFAULT_WORKFLOW_VERSION_SSM_PARAMETER_NAME_ENV_VAR = 'DEFAULT_WORKFLOW_VERSION_SSM_PARAMETER_NAME'


def create_portal_run_id():
    """
    Return YYYYMMDD + 8 random hexadecimal characters.
    :return:
    """
    return (
        datetime.now(timezone.utc).strftime("%Y%m%d") +
        # 4 bytes = 8 hex characters
        secrets.token_hex(4)
    )


def create_workflow_name(
    workflow_prefix: List[str],
    workflow_name: str,
    workflow_version: str,
    portal_run_id: str,
):
    """
    Create a workflow name given the inputs.
    :param workflow_prefix:
    :param workflow_name:
    :param workflow_version:
    :param portal_run_id:
    :return:
    """
    return "--".join([
        *workflow_prefix,
        workflow_name.lower(),
        workflow_version.replace('.', '-'),
        portal_run_id,
    ])


def handler(event, context):
    """
    Given the input event, update the workflow run object accordingly.
    :param event:
    :param context:
    :return:
    """
    # ICA Mode
    instrument_run_id = event.get("instrumentRunId")

    # Generate the portal run id
    portal_run_id = create_portal_run_id()

    # Get the bclconvert workflow object from the workflow manager
    try:
        workflow_object = next(iter(
            list_workflows(
                workflow_name=WORKFLOW_NAME,
                workflow_version=get_ssm_value(environ[DEFAULT_WORKFLOW_VERSION_SSM_PARAMETER_NAME_ENV_VAR]),
            )
        ))
    except StopIteration:
        workflow_object = {
            "name": WORKFLOW_NAME,
            "version": get_ssm_value(environ[DEFAULT_WORKFLOW_VERSION_SSM_PARAMETER_NAME_ENV_VAR]),
        }

    # Generate the workflow run object
    workflow_run_object = {
        "status": "DRAFT",
        "workflow": workflow_object,
        "portalRunId": portal_run_id,
        "workflowRunName": create_workflow_name(
            workflow_prefix=WORKFLOW_PREFIXES,
            workflow_name=WORKFLOW_NAME,
            workflow_version=get_ssm_value(environ[DEFAULT_WORKFLOW_VERSION_SSM_PARAMETER_NAME_ENV_VAR]),
            portal_run_id=portal_run_id,
        ),
        "payload": {
            "version": DEFAULT_PAYLOAD_VERSION,
            "data": {
                "tags": {
                    "instrumentRunId": instrument_run_id,
                    "experimentRunName": get_experiment_name_from_instrument_run_id(instrument_run_id),
                    "basespaceRunId": int(get_basespace_run_id_from_instrument_run_id(instrument_run_id)),
                    "samplesheetChecksum": get_samplesheet_md5sum_from_instrument_run_id(instrument_run_id),
                    "samplesheetChecksumType": DEFAULT_SAMPLESHEET_CHECKSUM_TYPE,
                }
            }
        }
    }

    # Use the SRM
    library_id_list_srm = get_library_id_list_from_instrument_run_id(
        instrument_run_id=instrument_run_id
    )

    # Update libraries
    workflow_run_object['libraries'] = list(map(
        lambda library_obj_: {
            "libraryId": library_obj_['libraryId'],
            "orcabusId": library_obj_['orcabusId'],
        },
        get_libraries_list_from_library_id_list(
            library_id_list_srm,
            accept_missing=True
        )
    ))

    return {
        "eventDetail": workflow_run_object
    }
