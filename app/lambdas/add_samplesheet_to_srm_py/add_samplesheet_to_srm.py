#!/usr/bin/env python3

"""
Add samplesheet to SRM manager

We have a samplesheet for this instrument run that is not in the SRM.

This may happen if the BCLConvert analysis was requeued from BaseSpace
"""

# Standard imports
from pathlib import Path
from tempfile import NamedTemporaryFile
from textwrap import dedent

# Layer imports
from orcabus_api_tools.sequence import add_samplesheet
from bssh_tool_kit import download_samplesheet_to_path_from_uri

# Globals
DEFAULT_COMMENT = dedent(
    """
Could not find samplesheet in SRM for this instrument run '{__INSTRUMENT_RUN_ID__}'
when running analysis id '{__ANALYSIS_ID__}'.
"""
)
DEFAULT_CREATOR = "service-bclconvert-manager"


def handler(event, context):
    """
    Add samplesheet to SRM manager
    :param event:
    :param context:
    :return:
    """

    # Inputs
    instrument_run_id = event.get("instrumentRunId")
    samplesheet_uri = event.get("samplesheetUri")
    analysis_id = event.get("analysisId")

    with NamedTemporaryFile(suffix=".csv") as temp_samplesheet_file:
        # Download the samplesheet to a temporary file
        samplesheet_path = Path(temp_samplesheet_file.name)
        download_samplesheet_to_path_from_uri(
            samplesheet_uri=samplesheet_uri,
            output_path=samplesheet_path
        )

        # Add samplesheet to SRM
        add_samplesheet(
            instrument_run_id=instrument_run_id,
            samplesheet_path=samplesheet_path,
            created_by=DEFAULT_CREATOR,
            comment=DEFAULT_COMMENT.format(
                __INSTRUMENT_RUN_ID__=instrument_run_id,
                __ANALYSIS_ID__=analysis_id
            )
        )
