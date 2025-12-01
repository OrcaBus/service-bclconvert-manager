#!/usr/bin/env python3

# Standard library imports
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import List, Dict, Union
from os import environ
import requests

# V2 Samplesheet imports
from v2_samplesheet_maker.functions.run_info_reader import (
    run_info_xml_reader
)
from v2_samplesheet_maker.functions.v2_samplesheet_reader import (
    v2_samplesheet_reader
)

# Wrapica imports
from libica.openapi.v3 import AnalysisInput
from wrapica.project_data import (
    convert_project_data_obj_to_uri,
    get_project_data_obj_by_id,
    read_icav2_file_contents,
    convert_uri_to_project_data_obj
)

# Layer imports
from orcabus_api_tools.utils.aws_helpers import get_ssm_value
from orcabus_api_tools.utils.aws_helpers import get_secret_value

# Local imports
from .globals import (
    BASESPACE_ACCESS_TOKEN_SECRET_NAME_ENV_VAR,
    BASESPACE_URL_SSM_PARAMETER_NAME_ENV_VAR
)


def get_basespace_url() -> str:
    """
    Return the BaseSpace URL from SSM.
    :return:
    """
    return get_ssm_value(
        parameter_name=environ[BASESPACE_URL_SSM_PARAMETER_NAME_ENV_VAR]
    )


def get_basespace_access_token() -> str:
    """
    Return the BaseSpace access token from Secrets Manager.
    :return:
    """
    return get_secret_value(
        secret_id=environ[BASESPACE_ACCESS_TOKEN_SECRET_NAME_ENV_VAR]
    )


def get_basespace_run_from_instrument_run_id(
        instrument_run_id: str,
) -> Dict[str, Union[Dict, str, int]]:
    """
    Get the BaseSpace run given an experiment name.
    :param instrument_run_id:
    :return:
    """
    headers = {
        "Accept": "application/json",
        "x-access-token": get_basespace_access_token()
    }

    params = {
        "Limit": 1000
    }

    # Make the request
    response = requests.get(
        f"{get_basespace_url()}/v2/runs",
        headers=headers,
        params=params,
    )

    # Raise for status
    response.raise_for_status()

    # Return the run
    basespace_run_object = next(filter(
        lambda run_item_iter_: run_item_iter_['Name'] == instrument_run_id,
        response.json()['Items']
    ))

    return basespace_run_object


def get_basespace_run_id_from_instrument_run_id(
        instrument_run_id: str,
) -> int:
    """
    Get the BaseSpace run ID given an experiment name.
    :param instrument_run_id:
    :return:
    """
    basespace_run = get_basespace_run_from_instrument_run_id(
        instrument_run_id=instrument_run_id
    )
    return basespace_run['V1Pre3Id']


def get_experiment_name_from_instrument_run_id(
        instrument_run_id: str,
) -> str:
    """
    Given an instrument run id, return the experiment name.
    :param instrument_run_id:
    :return:
    """
    basespace_run = get_basespace_run_from_instrument_run_id(
        instrument_run_id=instrument_run_id
    )
    return basespace_run['ExperimentName']


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


def get_library_ids_from_samplesheet_uri(
        samplesheet_uri: str,
):
    """
    Given a samplesheet URI, return the experiment run name.
    :param samplesheet_uri:
    :return:
    """
    with NamedTemporaryFile(suffix=".csv") as temp_samplesheet_file:
        # Download the samplesheet to a temporary file
        samplesheet_path = Path(temp_samplesheet_file.name)

        # Get the samplesheet uri as a project data object
        project_data_obj = convert_uri_to_project_data_obj(
            samplesheet_uri
        )

        # Read the samplesheet contents
        read_icav2_file_contents(
            project_id=project_data_obj.project_id,
            data_id=project_data_obj.data.id,
            output_path=samplesheet_path,
        )

        # Read the samplesheet into a DataFrame
        library_id_list = list(map(
            lambda bclconvert_data_row_iter_: bclconvert_data_row_iter_['sample_id'],
            v2_samplesheet_reader(
                samplesheet_path
            )['bclconvert_data']
        ))

        return library_id_list


def get_instrument_run_id_from_run_info_xml(
        run_info_xml_uri: str,
) -> str:
    """
    Given a run info XML path, return the instrument run id.
    :param run_info_xml_uri:
    :return:
    """
    with NamedTemporaryFile(suffix=".xml") as temp_xml_file:
        # Download the samplesheet to a temporary file
        run_info_xml_path = Path(temp_xml_file.name)

        # Get the samplesheet uri as a project data object
        project_data_obj = convert_uri_to_project_data_obj(
            run_info_xml_uri
        )

        # Read the samplesheet contents
        read_icav2_file_contents(
            project_id=project_data_obj.project_id,
            data_id=project_data_obj.data.id,
            output_path=run_info_xml_path,
        )

        # Read the samplesheet into a DataFrame
        run_info_obj = run_info_xml_reader(
            run_info_xml_path
        )

        return run_info_obj["RunInfo"]["Run"]["@Id"]
