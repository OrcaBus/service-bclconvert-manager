#!/usr/bin/env python3

"""
Create a new workflow run update object with one of the following inputs:

# From SRM ( most common route )
* seqOrcabusId

# From ICA
* projectId
* pipelineId
* analysisId

This should only occur after a retry given SRM doesn't produce a new event if a new bclconvert workflow run is initiated

We expect the following outputs in return:

# From SRM mode -
We're in the bare-bones stages at the moment:
* tags:
  * instrumentRunId
  * basespaceRunId
  * experimentRunName

* engineParameters
  * projectId

# From ICA mode -
We're clearly up and running now, ICA status will need to be converted into WRU status.

If the following don't exist in the existing payload, they will be created:

* inputs
  * inputUri
  * sampleSheetUri

* engineParameters
  * projectId
  * pipelineId
  * analysisId

"""

# Standard library imports
import secrets
from typing import List, Literal
from os import environ
from datetime import datetime, timezone

# Wrapica imports
from wrapica.project_analysis import (
    get_project_analysis_inputs,
)

# Layer imports
from orcabus_api_tools.utils.aws_helpers import get_ssm_value
from orcabus_api_tools.workflow import list_workflows
from orcabus_api_tools.metadata import get_libraries_list_from_library_id_list
from icav2_tools import set_icav2_env_vars

# BSSH Imports
from bssh_tool_kit import (
    get_instrument_run_id_from_run_info_xml,
    get_experiment_name_from_instrument_run_id,
    get_basespace_run_id_from_instrument_run_id,
    get_run_folder_input_uri_from_ica_inputs,
    get_sample_sheet_uri_from_ica_inputs, get_library_ids_from_samplesheet_uri,
    get_samplesheet_md5sum_from_samplesheet_uri
)

# Globals
DEFAULT_PAYLOAD_VERSION = "2025.10.10"
WORKFLOW_NAME = 'bclconvert'
WORKFLOW_PREFIXES = [
    'bssh',
    'autolaunch',
]
DEFAULT_WORKFLOW_VERSION_SSM_PARAMETER_NAME_ENV_VAR = 'DEFAULT_WORKFLOW_VERSION_SSM_PARAMETER_NAME'
SAMPLESHEET_CHECKSUM_TYPE = Literal[
    'md5'
]
DEFAULT_SAMPLESHEET_CHECKSUM_TYPE: SAMPLESHEET_CHECKSUM_TYPE = 'md5'


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

    # Inputs
    # ICA Mode
    project_id = event.get("projectId")
    pipeline_id = event.get("pipelineId")
    analysis_id = event.get("analysisId")

    # Check one mode is used
    if not (
            project_id and
            pipeline_id and
            analysis_id
    ):
        raise ValueError("Must provide either projectId + pipelineId + analysisId")

    # Set ICAv2 env vars
    set_icav2_env_vars()

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
    samplesheet_uri = get_sample_sheet_uri_from_ica_inputs(
        ica_inputs,
        project_id=project_id,
    )

    # Get the instrument run id, used to get tags and libraries
    instrument_run_id = get_instrument_run_id_from_run_info_xml(
        run_info_xml_uri=(input_uri + 'RunInfo.xml')
    )

    # Query libraries from the sample sheet
    library_id_list = get_library_ids_from_samplesheet_uri(
        samplesheet_uri=samplesheet_uri
    )

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
                "inputs": {
                    "inputUri": input_uri,
                    "sampleSheetUri": samplesheet_uri,
                },
                "tags": {
                    "instrumentRunId": instrument_run_id,
                    "experimentRunName": get_experiment_name_from_instrument_run_id(instrument_run_id),
                    "basespaceRunId": int(get_basespace_run_id_from_instrument_run_id(instrument_run_id)),
                    "samplesheetChecksum": get_samplesheet_md5sum_from_samplesheet_uri(
                        samplesheet_uri=samplesheet_uri
                    ),
                    "samplesheetChecksumType": DEFAULT_SAMPLESHEET_CHECKSUM_TYPE
                },
                "engineParameters": {
                    "projectId": project_id,
                    "pipelineId": pipeline_id,
                    "analysisId": analysis_id,
                }
            }
        },
        "libraries": list(map(
            lambda library_obj_: {
                "libraryId": library_obj_['libraryId'],
                "orcabusId": library_obj_['orcabusId'],
            },
            get_libraries_list_from_library_id_list(
                library_id_list,
                accept_missing=True
            )
        ))
    }

    return {
        "workflowRunObject": workflow_run_object
    }
