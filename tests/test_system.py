
import json
import sqlite3
import tempfile
import unittest

from pathlib import Path
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient

from backend.config import (
    APP_NAME,
    APP_VERSION,
    OLLAMA_MODEL,
    ML_FEATURES,
)

from backend.system_service import (
    get_application_information,
    get_system_information,
    get_package_version,
    check_ollama,
    check_ml_model,
    check_database,
    get_privacy_information,
    get_system_diagnostics,
)

from backend.api import app
from backend.history_router import get_database_path

from database.db import initialize_database


# =========================================
# APPLICATION INFORMATION TESTS
# =========================================

class TestApplicationInformation(unittest.TestCase):

    def test_application_name(self):

        result = get_application_information()

        self.assertEqual(result["name"], APP_NAME)

    def test_application_version(self):

        result = get_application_information()

        self.assertEqual(result["version"], APP_VERSION)

    def test_local_deployment(self):

        result = get_application_information()

        self.assertEqual(result["deployment"], "local")


# =========================================
# SYSTEM ENVIRONMENT TESTS
# =========================================

class TestSystemInformation(unittest.TestCase):

    def test_system_information(self):

        result = get_system_information()

        self.assertTrue(result["operating_system"])
        self.assertTrue(result["python_version"])
        self.assertTrue(result["sqlite_version"])
        self.assertTrue(result["architecture"])

    def test_python_architecture(self):

        result = get_system_information()

        self.assertIn(result["python_bits"], [32, 64])

    def test_installed_package(self):

        result = get_package_version("fastapi")

        self.assertIsNotNone(result)

    def test_missing_package(self):

        result = get_package_version(
            "sentinel-nonexistent-test-package"
        )

        self.assertIsNone(result)


# =========================================
# OLLAMA DIAGNOSTICS TESTS
# =========================================

class TestOllamaDiagnostics(unittest.TestCase):

    def mock_response(self, models):

        response = MagicMock()

        response.__enter__.return_value.read.return_value = (
            json.dumps({"models": models}).encode("utf-8")
        )

        return response

    @patch("backend.system_service.urlopen")
    def test_ollama_healthy(self, mock_urlopen):

        mock_urlopen.return_value = self.mock_response([
            {"name": OLLAMA_MODEL},
        ])

        result = check_ollama()

        self.assertEqual(result["status"], "healthy")
        self.assertTrue(result["connected"])
        self.assertTrue(result["model_available"])
        self.assertIn(
            OLLAMA_MODEL,
            result["available_models"],
        )

    @patch("backend.system_service.urlopen")
    def test_configured_model_missing(self, mock_urlopen):

        mock_urlopen.return_value = self.mock_response([
            {"name": "another-model:latest"},
        ])

        result = check_ollama()

        self.assertEqual(result["status"], "degraded")
        self.assertTrue(result["connected"])
        self.assertFalse(result["model_available"])

    @patch("backend.system_service.urlopen")
    def test_ollama_unavailable(self, mock_urlopen):

        mock_urlopen.side_effect = ConnectionError(
            "Service unavailable"
        )

        result = check_ollama()

        self.assertEqual(result["status"], "unavailable")
        self.assertFalse(result["connected"])
        self.assertFalse(result["model_available"])

    @patch("backend.system_service.urlopen")
    def test_ollama_timeout(self, mock_urlopen):

        mock_urlopen.side_effect = TimeoutError()

        result = check_ollama()

        self.assertEqual(result["status"], "unavailable")
        self.assertFalse(result["connected"])

    @patch("backend.system_service.urlopen")
    def test_invalid_ollama_response(self, mock_urlopen):

        response = MagicMock()

        response.__enter__.return_value.read.return_value = (
            b"invalid json"
        )

        mock_urlopen.return_value = response

        result = check_ollama()

        self.assertEqual(result["status"], "unavailable")

    @patch("backend.system_service.urlopen")
    def test_empty_model_list(self, mock_urlopen):

        mock_urlopen.return_value = self.mock_response([])

        result = check_ollama()

        self.assertTrue(result["connected"])
        self.assertFalse(result["model_available"])
        self.assertEqual(result["status"], "degraded")


# =========================================
# ML MODEL DIAGNOSTICS TESTS
# =========================================

class TestMLModelDiagnostics(unittest.TestCase):

    def setUp(self):

        self.temp_dir = tempfile.TemporaryDirectory()

        self.model_path = (
            Path(self.temp_dir.name) / "test_model.joblib"
        )

    def tearDown(self):

        self.temp_dir.cleanup()

    def test_model_file_available(self):

        self.model_path.write_bytes(b"test model data")

        result = check_ml_model(self.model_path)

        self.assertTrue(result["available"])
        self.assertEqual(result["status"], "available")
        self.assertGreater(result["size_bytes"], 0)

    def test_model_file_missing(self):

        result = check_ml_model(self.model_path)

        self.assertFalse(result["available"])
        self.assertEqual(result["status"], "unavailable")

    def test_empty_model_file(self):

        self.model_path.touch()

        result = check_ml_model(self.model_path)

        self.assertFalse(result["available"])
        self.assertEqual(result["size_bytes"], 0)

    def test_model_features(self):

        result = check_ml_model(self.model_path)

        self.assertEqual(
            result["feature_count"],
            len(ML_FEATURES),
        )

        self.assertEqual(
            result["features"],
            list(ML_FEATURES),
        )


# =========================================
# DATABASE DIAGNOSTICS TESTS
# =========================================

class TestDatabaseDiagnostics(unittest.TestCase):

    def setUp(self):

        self.temp_dir = tempfile.TemporaryDirectory()

        self.db_path = (
            Path(self.temp_dir.name) / "test.db"
        )

    def tearDown(self):

        self.temp_dir.cleanup()

    def test_healthy_database(self):

        initialize_database(self.db_path)

        result = check_database(self.db_path)

        self.assertTrue(result["available"])
        self.assertEqual(result["status"], "healthy")
        self.assertEqual(result["integrity"], "ok")

    def test_missing_database(self):

        result = check_database(self.db_path)

        self.assertFalse(result["available"])
        self.assertEqual(result["status"], "unavailable")

        self.assertFalse(self.db_path.exists())

    def test_database_tables(self):

        initialize_database(self.db_path)

        result = check_database(self.db_path)

        for table in [
            "conversations",
            "messages",
            "investigations",
        ]:

            self.assertIn(table, result["tables"])

    def test_database_size(self):

        initialize_database(self.db_path)

        result = check_database(self.db_path)

        self.assertGreater(result["size_bytes"], 0)

    def test_database_schema_version(self):

        initialize_database(self.db_path)

        result = check_database(self.db_path)

        self.assertEqual(result["schema_version"], 1)

    def test_invalid_database(self):

        self.db_path.write_bytes(
            b"this is not a SQLite database"
        )

        result = check_database(self.db_path)

        self.assertFalse(result["available"])
        self.assertEqual(result["status"], "unavailable")


# =========================================
# PRIVACY CONFIGURATION TESTS
# =========================================

class TestPrivacyInformation(unittest.TestCase):

    def test_local_processing(self):

        result = get_privacy_information()

        self.assertTrue(result["local_processing"])
        self.assertFalse(result["external_ai_api_required"])

    def test_opt_in_storage(self):

        result = get_privacy_information()

        self.assertFalse(
            result["conversation_storage_default"]
        )

        self.assertFalse(
            result["investigation_storage_default"]
        )

        self.assertEqual(result["storage_mode"], "opt-in")

    def test_encryption_disclosure(self):

        result = get_privacy_information()

        self.assertFalse(result["database_encrypted"])


# =========================================
# COMPLETE SYSTEM DIAGNOSTICS TESTS
# =========================================

class TestCompleteDiagnostics(unittest.TestCase):

    @patch("backend.system_service.check_database")
    @patch("backend.system_service.check_ml_model")
    @patch("backend.system_service.check_ollama")
    def test_all_services_healthy(
        self,
        mock_ollama,
        mock_ml,
        mock_database,
    ):

        mock_ollama.return_value = {
            "status": "healthy",
        }

        mock_ml.return_value = {
            "available": True,
        }

        mock_database.return_value = {
            "status": "healthy",
        }

        result = get_system_diagnostics()

        self.assertEqual(result["status"], "healthy")
        self.assertIn("checked_at", result)
        self.assertIn("application", result)
        self.assertIn("system", result)
        self.assertIn("services", result)
        self.assertIn("privacy", result)

    @patch("backend.system_service.check_database")
    @patch("backend.system_service.check_ml_model")
    @patch("backend.system_service.check_ollama")
    def test_degraded_system(
        self,
        mock_ollama,
        mock_ml,
        mock_database,
    ):

        mock_ollama.return_value = {
            "status": "unavailable",
        }

        mock_ml.return_value = {
            "available": True,
        }

        mock_database.return_value = {
            "status": "healthy",
        }

        result = get_system_diagnostics()

        self.assertEqual(result["status"], "degraded")


# =========================================
# SYSTEM API INTEGRATION TESTS
# =========================================

class TestSystemAPI(unittest.TestCase):

    def setUp(self):

        self.temp_dir = tempfile.TemporaryDirectory()

        self.db_path = (
            Path(self.temp_dir.name) / "api_test.db"
        )

        self.previous_overrides = (
            app.dependency_overrides.copy()
        )

        app.dependency_overrides[get_database_path] = (
            lambda: self.db_path
        )

        self.client = TestClient(app)

        self.client.__enter__()

    def tearDown(self):

        try:

            self.client.__exit__(None, None, None)

        finally:

            app.dependency_overrides.clear()

            app.dependency_overrides.update(
                self.previous_overrides
            )

            self.temp_dir.cleanup()

    def test_application_endpoint(self):

        response = self.client.get("/system/application")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["version"],
            APP_VERSION,
        )

    def test_environment_endpoint(self):

        response = self.client.get("/system/environment")

        self.assertEqual(response.status_code, 200)

        self.assertIn(
            "python_version",
            response.json(),
        )

    @patch("backend.system_router.check_ollama")
    def test_ollama_endpoint(self, mock_ollama):

        mock_ollama.return_value = {
            "status": "healthy",
            "connected": True,
        }

        response = self.client.get("/system/ollama")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["connected"])

        self.assertEqual(
            response.headers["Cache-Control"],
            "no-store",
        )

    @patch("backend.system_router.check_ml_model")
    def test_model_endpoint(self, mock_ml):

        mock_ml.return_value = {
            "status": "available",
            "available": True,
        }

        response = self.client.get("/system/model")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["available"])

    def test_database_endpoint(self):

        response = self.client.get("/system/database")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["integrity"], "ok")

    def test_privacy_endpoint(self):

        response = self.client.get("/system/privacy")

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            response.json()["storage_mode"],
            "opt-in",
        )

    @patch("backend.system_router.get_system_diagnostics")
    def test_diagnostics_endpoint(self, mock_diagnostics):

        mock_diagnostics.return_value = {
            "status": "healthy",
            "application": {
                "name": APP_NAME,
            },
        }

        response = self.client.get("/system/diagnostics")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

        mock_diagnostics.assert_called_once_with(
            db_path=self.db_path
        )

        self.assertEqual(
            response.headers["Cache-Control"],
            "no-store",
        )

    def test_root_version(self):

        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["version"],
            APP_VERSION,
        )

    def test_existing_health_endpoint(self):

        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")


if __name__ == "__main__":

    unittest.main()
