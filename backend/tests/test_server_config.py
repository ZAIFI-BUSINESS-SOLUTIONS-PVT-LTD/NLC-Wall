"""Tests for main._load_server_config startup restoration behavior."""

import json

import database
import main as main_module
from pledge_defaults import DEFAULT_PLEDGE_CONFIG


def test_load_server_config_merges_stored_pledge_over_defaults():
    database.db_config_set("pledge_config", json.dumps({"english": "Stored", "duration_seconds": 45}))
    main_module._pledge_config = {}

    main_module._load_server_config()

    assert main_module._pledge_config["english"] == "Stored"
    assert main_module._pledge_config["duration_seconds"] == 45
    assert main_module._pledge_config["tamil"] == DEFAULT_PLEDGE_CONFIG["tamil"]


def test_load_server_config_restores_chief_guest_config():
    stored = {"enabled": True, "retention_mode": "until_datetime", "retention_until": 1_900_000_000_000}
    database.db_config_set("cg_config", json.dumps(stored))

    main_module._load_server_config()

    assert main_module._cg_config == stored


def test_load_server_config_ignores_malformed_json_and_keeps_current_values():
    main_module._pledge_config = dict(DEFAULT_PLEDGE_CONFIG)
    main_module._cg_config = {"enabled": False, "retention_mode": "forever", "retention_until": None}
    database.db_config_set("pledge_config", "{not-json")
    database.db_config_set("cg_config", "{not-json")

    main_module._load_server_config()

    assert main_module._pledge_config == dict(DEFAULT_PLEDGE_CONFIG)
    assert main_module._cg_config == {"enabled": False, "retention_mode": "forever", "retention_until": None}
