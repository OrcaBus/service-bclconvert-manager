#!/usr/bin/env python3

"""
Get the sequence run object from an orcabus id

Input:
  seqOrcabusId

Output:
  sequenceRunObject
"""

# Standard imports
from pathlib import Path

# Layer imports
from orcabus_api_tools.sequence import get_sequence_request
from orcabus_api_tools.sequence.globals import SEQUENCE_RUN_ENDPOINT


def handler(event, context):
    return {
        "sequenceRunObject": get_sequence_request(
            endpoint=str(Path(SEQUENCE_RUN_ENDPOINT) / event["seqOrcabusId"])
        )
    }
