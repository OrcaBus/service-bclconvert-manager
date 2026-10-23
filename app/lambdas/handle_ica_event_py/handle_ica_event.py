#!/usr/bin/env python3

"""
Durable handler for ICA analysis state change events (ICA_EXEC_028).

This lambda is the SQS event source for the ICA analysis event queue. For each
message it:

  1. De-duplicates the message via a conditional write to the callback DynamoDB
     table (ICA can redeliver the same message).
  2. Registers a durable execution callback and hands the callback id to the
     'handle ica event' step function via the step function input.
  3. Waits (durably) for the step function to unlock the callback id once it has
     finished processing, before moving on to the next message.

Because this is an SQS event source, the durable execution timeout cannot exceed
15 minutes.
https://docs.aws.amazon.com/lambda/latest/dg/durable-invoking-esm.html#durable-esm-duration-limit
"""

# Standard library imports
import json
from os import environ
import boto3
import typing
from datetime import datetime, UTC
from botocore.exceptions import ClientError

# Durable context imports
from aws_durable_execution_sdk_python import (
    DurableContext,
    durable_execution
)
from aws_durable_execution_sdk_python.config import (
    Duration, WaitForCallbackConfig
)
from aws_durable_execution_sdk_python.retries import create_retry_strategy
from aws_durable_execution_sdk_python.types import WaitForCallbackContext

# Type hints
if typing.TYPE_CHECKING:
    from mypy_boto3_stepfunctions.client import SFNClient
    from mypy_boto3_dynamodb.client import DynamoDBClient

# Globals
CALLBACK_DATABASE_NAME_ENV_VAR = "CALLBACK_DATABASE_NAME"
HANDLE_ICA_EVENT_SFN_ARN_ENV_VAR = "HANDLE_ICA_EVENT_SFN_ARN"
SECONDS_PER_DAY = (60 * 60 * 24)  # 60 seconds per min * 60 minutes per hour * 24 hours per day


# Helper functions
def get_dynamodb_client() -> 'DynamoDBClient':
    return boto3.client('dynamodb')


def get_sfn_client() -> 'SFNClient':
    return boto3.client('stepfunctions')


# Atomically write the message id to the database.
# Returns True if the message is a duplicate (already exists), False if newly written.
def is_duplicate_message(message_id: str) -> bool:
    try:
        get_dynamodb_client().put_item(
            Item={
                "id": {
                    "S": message_id,
                },
                "id_type": {
                    "S": "MESSAGE_SQS"
                },
                "ttl": {
                    # Add 24 hours to current epoch timestamp
                    "N": str(
                        int(datetime.now(UTC).timestamp()) +
                        SECONDS_PER_DAY
                    )
                }
            },
            TableName=environ[CALLBACK_DATABASE_NAME_ENV_VAR],
            ConditionExpression='attribute_not_exists(id)',
        )
        return False
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return True
        raise


# Durable step to launch and wait on the handle ica event step function
def handle_ica_execution(
        project_id: str,
        status: str,
        pipeline_id: str,
        analysis_id: str,
        context: DurableContext
):
    def submitter(callback_id: str, callback_context: WaitForCallbackContext):
        """
        Pass callback_id directly to the step function input so it can
        unlock the durable execution without a DynamoDB lookup.
        """
        callback_context.logger.info("Start sfn execution")
        execution = get_sfn_client().start_execution(
            stateMachineArn=environ[HANDLE_ICA_EVENT_SFN_ARN_ENV_VAR],
            input=json.dumps(
                {
                    "projectId": project_id,
                    "status": status,
                    "pipelineId": pipeline_id,
                    "analysisId": analysis_id,
                    "callbackId": callback_id
                },
                separators=(",", ":")
            )
        )
        callback_context.logger.info(f"Running sfn execution {execution['executionArn']}")

    # Wait here for the callback to be invoked by the step function
    context.wait_for_callback(
        submitter=submitter,
        name=None,
        config=WaitForCallbackConfig(
            # Almost 15 minutes
            timeout=Duration.from_seconds(890),
            retry_strategy=create_retry_strategy(
                config=None
            )
        ),
    )


# Durable Lambda Handler
@durable_execution
def handler(event, context: DurableContext):
    """
    Consume ICA analysis state change events (ICA_EXEC_028) from the SQS queue.

    The SQS message body is a JSON object (the ICA_EXEC_028 event) containing a
    top level 'projectId' and a 'payload' with the analysis 'status', 'id' and
    'pipeline'. Some deliveries may batch several event objects into a JSON
    array, so both shapes are supported.
    :param event:
    :param context:
    :return:
    """
    for record in event.get("Records", []):
        # Skip messages we have already processed
        message_id = record.get("messageId")
        if is_duplicate_message(message_id):
            continue

        # The ICA event body is a single analysis object, but tolerate a JSON
        # array of objects in case messages are ever batched.
        record_body = json.loads(record.get("body", "{}"))
        if isinstance(record_body, dict):
            record_body = [record_body]

        for ica_event_object in record_body:
            payload = ica_event_object.get("payload", {})

            # Start the handle ica event step function via a durable callback step
            handle_ica_execution(
                project_id=ica_event_object.get("projectId"),
                status=payload.get("status"),
                pipeline_id=(payload.get("pipeline") or {}).get("id"),
                analysis_id=payload.get("id"),
                context=context,
            )
