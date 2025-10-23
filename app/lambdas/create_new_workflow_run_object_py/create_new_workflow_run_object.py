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
from pathlib import Path
from typing import List
from os import environ
from datetime import datetime, timezone

# Wrapica imports
from libica.openapi.v3 import AnalysisInput
from wrapica.project_analysis import (
    get_project_analysis_inputs,
    get_analysis_obj_from_analysis_id,
)
from wrapica.project_data import (
    convert_project_data_obj_to_uri,
    get_project_data_obj_by_id
)

# Layer imports
from orcabus_api_tools.utils.aws_helpers import get_ssm_value
from orcabus_api_tools.sequence import (
    get_library_id_list_from_instrument_run_id
)
from orcabus_api_tools.workflow import list_workflows
from orcabus_api_tools.metadata import get_libraries_list_from_library_id_list
from icav2_tools import set_icav2_env_vars

# Globals
DEFAULT_PAYLOAD_VERSION = "2025.10.10"
WORKFLOW_NAME = 'bclconvert'
WORKFLOW_PREFIXES = [
    'bssh',
    'autolaunch',
]
DEFAULT_WORKFLOW_VERSION_SSM_PARAMETER_NAME_ENV_VAR = 'DEFAULT_WORKFLOW_VERSION_SSM_PARAMETER_NAME'


def get_input_uri_from_ica_inputs(
    ica_inputs: List[AnalysisInput],
    project_id: str,
    input_code: str,
) -> str:
    """
    Given the ICA inputs, return the input URI for the given input code.
    :param ica_inputs:
    :param input_code:
    :return:
    """
    analysis_input_object: AnalysisInput = next(filter(
        lambda input_item_iter_: input_item_iter_.code == input_code,
        ica_inputs
    ))

    return convert_project_data_obj_to_uri(
        get_project_data_obj_by_id(
            project_id=project_id,
            data_id=analysis_input_object.analysis_data[0].data_id
        )
    )


def get_run_folder_input_uri_from_ica_inputs(
        ica_inputs: List[AnalysisInput],
        project_id: str,
) -> str:
    """
    Given the ICA inputs, return the run folder input URI.
    :param ica_inputs:
    :return:
    """
    return get_input_uri_from_ica_inputs(
        ica_inputs=ica_inputs,
        project_id=project_id,
        input_code='run_folder'
    )

def get_sample_sheet_uri_from_ica_inputs(
        ica_inputs: List[AnalysisInput],
        project_id: str,
):
    """
    Given the ICA inputs, return the sample sheet input URI.
    :param ica_inputs:
    :return:
    """
    return get_input_uri_from_ica_inputs(
        ica_inputs=ica_inputs,
        project_id=project_id,
        input_code='sample_sheet'
    )


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
    project_id = event.get("projectId")
    pipeline_id = event.get("pipelineId")
    analysis_id = event.get("analysisId")

    # Check one mode is used
    if (
        # ICA mode
        not (
            project_id and
            pipeline_id and
            analysis_id
        )
    ):
        raise ValueError("Must provide either projectId + pipelineId + analysisId (ICA mode)")

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
            "data": {}
        }
    }

    # Get the latest payload
    latest_payload = workflow_run_object['payload']

    # Set the payload version if not set
    latest_data = latest_payload.get('data', {})

    # Set the tags
    tags = latest_data.get('tags', {})

    # Inputs
    inputs = latest_data.get('inputs', {})

    # ICA Mode
    set_icav2_env_vars()

    # ICA Inputs
    ica_inputs = get_project_analysis_inputs(
        project_id=project_id,
        analysis_id=analysis_id,
    )

    # Run folder input
    if 'inputUri' not in inputs:
        inputs['inputUri'] = get_run_folder_input_uri_from_ica_inputs(
            ica_inputs,
            project_id=project_id,
        )
    if 'sampleSheetUri' not in inputs:
        inputs['sampleSheetUri'] = get_sample_sheet_uri_from_ica_inputs(
            ica_inputs,
            project_id=project_id,
        )

    # Update Engine Parameters
    engine_parameters = latest_data.get('engineParameters', {})
    engine_parameters['projectId'] = project_id
    engine_parameters['pipelineId'] = pipeline_id
    engine_parameters['analysisId'] = analysis_id

    # Check if tags are none and set if so
    if not tags:
        # Get the basespace run id from the analysis id
        # Workflow session tags look like this
        # {
        #   "technicalTags": [
        #     "/ilmn-runs/bssh_aps2-sh-prod_6051045/",
        #     "e4320dcb-2f23-4d08-bf0c-1a957709036b",
        #     "ctTSO-Tsqn-NebR241021_24Oct24",
        #     "241024_A00130_0336_BHW7MVDSXC"
        #   ],
        #   "userTags": [
        #     "/ilmn-runs/bssh_aps2-sh-prod_6051045/"
        #   ]
        # }
        analysis_obj = get_analysis_obj_from_analysis_id(
            project_id=project_id,
            analysis_id=analysis_id
        )
        tags = {
            "instrumentRunId": analysis_obj.workflow_session.tags.technical_tags[-1],
            "basespaceRunId": int(Path(analysis_obj.workflow_session.tags.user_tags[0]).name.rsplit("_", 1)[-1]),
            "experimentRunName": analysis_obj.workflow_session.tags.technical_tags[-2],
        }

    if not workflow_run_object.get("libraries"):
        # Update libraries, assuming that the SRM has ingested these into the samplesheet
        workflow_run_object['libraries'] = list(map(
            lambda library_obj_: {
                "libraryId": library_obj_['libraryId'],
                "orcabusId": library_obj_['orcabusId'],
            },
            get_libraries_list_from_library_id_list(
                get_library_id_list_from_instrument_run_id(
                    instrument_run_id=tags.get('instrumentRunId')
                )
            )
        ))

    # Update the latest data
    latest_data['inputs'] = inputs
    latest_data['tags'] = tags
    latest_data['engineParameters'] = engine_parameters

    # Update the payload
    latest_payload['data'] = latest_data

    # Update the workflow run object
    workflow_run_object['payload'] = latest_payload



    return {
        "workflowRunObject": workflow_run_object
    }
