#!/usr/bin/env python3

"""
Unlock the callback id used when handling an ICA analysis state change event.

The durable 'handle ica event' lambda registers a callback id and hands it to the
'handle ica event' step function via its input payload. When the step function
completes it invokes this lambda to release (unlock) the durable execution so the
lambda can move on to the next SQS message.

https://docs.aws.amazon.com/lambda/latest/api/API_SendDurableExecutionCallbackSuccess.html
"""

# Standard library imports
import boto3
import typing

# Type hints
if typing.TYPE_CHECKING:
    from mypy_boto3_lambda.client import LambdaClient


def get_lambda_client() -> 'LambdaClient':
    return boto3.client('lambda')


def handler(event, context):
    """
    Given a callback id, unlock it.
    :param event: { "callbackId": "<callback-id>" }
    :param context:
    :return:
    """
    lambda_client = get_lambda_client()
    try:
        lambda_client.send_durable_execution_callback_success(
            CallbackId=event['callbackId'],
            Result="SUCCESS"
        )
    except lambda_client.exceptions.InvalidParameterValueException as e:
        raise ValueError(f"Invalid callback id: {event['callbackId']}") from e
