install:
	@pip install -r deps/requirements-test.txt

test-translator-service:
	@echo "Running tests for translator service"
	@PYTHONPATH=./translator_service:$$PYTHONPATH \
	python -m unittest translator_service/tests/test_icav2_event_translator.py
	@echo "Tests for translator service passed"

test: install test-translator-service

check: lint

lint:
	@black -t py312 --check . --exclude .venv

lint-fix:
	@black -t py312 . --exclude .venv
