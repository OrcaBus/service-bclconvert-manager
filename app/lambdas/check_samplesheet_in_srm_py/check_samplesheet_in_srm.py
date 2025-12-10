#!/usr/bin/env python3

"""
Check if the samplesheet exists in the SRM manager for the given instrument run id.
"""
from icav2_tools import set_icav2_env_vars

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

# Layer imports
from bssh_tool_kit.basespace_helpers import (
    get_samplesheet_md5sum_from_instrument_run_id,
    get_samplesheet_md5sum_from_samplesheet_uri
)

def handler(event, context):
    """
    Given the input event, update the workflow run object accordingly.
    :param event:
    :param context:
    :return:
    """
    # Set ica env vars
    set_icav2_env_vars()

    # ICA Mode
    instrument_run_id = event.get("instrumentRunId")
    samplesheet_uri = event.get("samplesheetUri")

    # Compare the samplesheet checksum from the event with the one from SRM
    srm_samplesheet_checksum = get_samplesheet_md5sum_from_instrument_run_id(instrument_run_id),
    bclconvert_samplesheet_checksum = get_samplesheet_md5sum_from_samplesheet_uri(
        samplesheet_uri=samplesheet_uri
    )

    return {
        "srmHasSamplesheet": (
            srm_samplesheet_checksum == bclconvert_samplesheet_checksum
        )
    }
