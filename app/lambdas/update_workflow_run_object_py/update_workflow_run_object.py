#!/usr/bin/env python3

"""
Update a workflow run object:

Two main methods of input here:

# SRM

portalRunId
seqOrcabusId

# ICA

portalRunId
projectId
pipelineId
analysisId

We return the updated workflow run object and output is determined on the input method

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

AND IF the workflow status is SUCCEEDED we also add in the outputUri into the engine parameters.
"""

# Wrapica imports
from wrapica.project_analysis import (
    get_project_analysis_inputs,
    get_analysis_obj_from_analysis_id,
    get_analysis_output_object_from_analysis_output_code
)
from wrapica.project_data import (
    convert_project_data_obj_to_uri,
    get_project_data_obj_by_id
)

# Layer imports
from orcabus_api_tools.metadata import get_libraries_list_from_library_id_list
from orcabus_api_tools.sequence import get_library_id_list_from_instrument_run_id
from orcabus_api_tools.workflow import get_workflow_run_from_portal_run_id, get_latest_payload_from_workflow_run
from icav2_tools import set_icav2_env_vars

from bssh_tool_kit import (
    get_instrument_run_id_from_run_info_xml,
    get_experiment_name_from_instrument_run_id,
    get_basespace_run_id_from_instrument_run_id,
    get_run_folder_input_uri_from_ica_inputs,
    get_sample_sheet_uri_from_ica_inputs
)

# Globals
DEFAULT_PAYLOAD_VERSION = "2025.10.10"

STATUS_MAP = {
    "INITIALIZING": "STARTING",
    "IN_PROGRESS": "RUNNING",
    "SUCCEEDED": "SUCCEEDED",
    "FAILED": "FAILED",
    "ABORTED": "ABORTED"
}

def handler(event, context):
    """
    Given the input event, update the workflow run object accordingly.
    :param event:
    :param context:
    :return:
    """

    # Get inputs
    portal_run_id = event.get('portalRunId')

    # ICA Mode
    project_id = event.get("projectId")
    pipeline_id = event.get("pipelineId")
    analysis_id = event.get("analysisId")

    # Check one mode is used
    if (
        # ICA mode
        not (
            portal_run_id and
            project_id and
            pipeline_id and
            analysis_id
        )
    ):
        raise ValueError("Must provide either portalRunId + projectId + pipelineId + analysisId (ICA mode)")

    # Set ICAv2 env vars (this takes a second which is why we don't do it unless we need to)
    set_icav2_env_vars()

    # Get the workflow run object
    workflow_run_object = get_workflow_run_from_portal_run_id(portal_run_id)

    # Get the latest payload
    latest_payload = get_latest_payload_from_workflow_run(workflow_run_object['orcabusId'])

    # Check if the payload data exists
    if latest_payload is None:
        latest_payload = {}

    # Set the payload version if not set
    latest_data = latest_payload.get('data', {})

    # Inputs
    inputs = latest_data.get('inputs', {})

    # Create tags
    # Need to make sure we have an input uri to get information first though.
    tags = latest_data.get('tags', {})
    if inputs.get("inputUri") is not None:
        # Create tags
        instrument_run_id = get_instrument_run_id_from_run_info_xml(
            run_info_xml_uri=(inputs['inputUri'] + 'RunInfo.xml')
        )
        tags.update({
            "instrumentRunId": instrument_run_id,
            "experimentRunName": get_experiment_name_from_instrument_run_id(instrument_run_id),
            "basespaceRunId": int(get_basespace_run_id_from_instrument_run_id(instrument_run_id)),
        })

    # Also set the payload version if not set
    if not latest_payload.get('version'):
        latest_payload['version'] = DEFAULT_PAYLOAD_VERSION

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

    # Get the analysis status
    status = get_analysis_obj_from_analysis_id(
        project_id=project_id,
        analysis_id=analysis_id,
    ).status

    # Update the workflow run status based on the ICA analysis status
    workflow_run_object['status'] = STATUS_MAP[status]

    # If workflow status is SUCCEEDED, add outputUri
    if status == 'SUCCEEDED':
        # Get the workflow output object
        analysis_output_object = get_analysis_output_object_from_analysis_output_code(
            project_id=project_id,
            analysis_id=analysis_id,
            analysis_output_code='Output'
        )
        # Update the engine parameter output uri
        engine_parameters['outputUri'] = convert_project_data_obj_to_uri(
            get_project_data_obj_by_id(
                project_id=analysis_output_object.project_id,
                data_id=analysis_output_object.data[0].data_id
            )
        )

    # Also update the libraries, assuming that the SRM has done its job
    # Update libraries, assuming that the SRM has ingested these into the samplesheet
    if not workflow_run_object.get("libraries"):
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
    # And drop the currentState attribute
    _ = workflow_run_object.pop('currentState', None)
    workflow_run_object['payload'] = latest_payload

    # If the status is DRAFT, we cannot update it to anything else
    if get_workflow_run_from_portal_run_id(portal_run_id)['currentState']['status'] == 'DRAFT':
        workflow_run_object['status'] = 'DRAFT'

    # Return the object
    return {
        "workflowRunObject": workflow_run_object
    }
