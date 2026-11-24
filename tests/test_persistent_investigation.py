
import unittest

from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.api import app

from backend.history_router import (
    get_database_path,
)

from database.investigations import (
    get_investigation,
    get_investigation_statistics,
)


# =========================================
# TEST CONFIGURATION
# =========================================

SAMPLE_EMAIL = (
    "URGENT! Your account has been suspended. "
    "Verify your password immediately at "
    "http://192.0.2.50/verify-account"
)

SAMPLE_LOGS = "\n".join(
    f"Nov 24 10:00:{index:02d} server "
    f"sshd[{1000 + index}]: "
    f"Failed password for invalid user admin "
    f"from 192.0.2.10 port {50000 + index} ssh2"
    for index in range(12)
)

INVALID_LOGS = "This is not a security log."


# =========================================
# ISOLATED TEST FOUNDATION
# =========================================

class PersistentInvestigationTestCase(
    unittest.TestCase
):

    def setUp(self):

        self.temp_directory = TemporaryDirectory()

        self.addCleanup(
            self.temp_directory.cleanup
        )

        self.db_path = (
            Path(self.temp_directory.name)
            / "test_investigations.db"
        )

        previous_overrides = (
            app.dependency_overrides.copy()
        )

        self.addCleanup(
            self.restore_overrides,
            previous_overrides,
        )

        app.dependency_overrides[
            get_database_path
        ] = lambda: self.db_path

        self.client = TestClient(app)

        self.client.__enter__()

        self.addCleanup(
            self.client.__exit__,
            None,
            None,
            None,
        )


    def restore_overrides(self, overrides):

        app.dependency_overrides.clear()

        app.dependency_overrides.update(
            overrides
        )


    def investigation_count(self):

        statistics = get_investigation_statistics(
            db_path=self.db_path
        )

        return statistics[
            "total_investigations"
        ]


    def run_phishing(self, **options):

        payload = {

            "email_text": SAMPLE_EMAIL,

            "include_ai_report": False,

            **options,

        }

        return self.client.post(
            "/phishing",
            json=payload,
        )


    def run_logs(self, **options):

        payload = {

            "log_text": SAMPLE_LOGS,

            "include_ai_report": False,

            **options,

        }

        return self.client.post(
            "/logs",
            json=payload,
        )


    def run_anomaly(self, **options):

        payload = {

            "log_text": SAMPLE_LOGS,

            "include_ai_report": False,

            **options,

        }

        return self.client.post(
            "/anomaly",
            json=payload,
        )


    def assert_saved(
        self,
        response,
        investigation_type
    ):

        self.assertEqual(
            response.status_code,
            200
        )

        data = response.json()

        self.assertTrue(
            data["history_saved"]
        )

        self.assertIsNotNone(
            data["investigation_id"]
        )

        self.assertIsNone(
            data["storage_warning"]
        )

        investigation = get_investigation(

            data["investigation_id"],

            db_path=self.db_path,

        )

        self.assertIsNotNone(
            investigation
        )

        self.assertEqual(

            investigation["investigation_type"],

            investigation_type,

        )

        self.assertEqual(

            investigation["analysis"],

            data["analysis"],

        )

        return investigation


# =========================================
# PHISHING PERSISTENCE TESTS
# =========================================

class TestPhishingPersistence(
    PersistentInvestigationTestCase
):

    def test_temporary_phishing_not_saved(self):

        response = self.run_phishing()

        self.assertEqual(
            response.status_code,
            200
        )

        self.assertEqual(
            self.investigation_count(),
            0
        )

        self.assertNotIn(
            "investigation_id",
            response.json()
        )


    def test_phishing_saved_successfully(self):

        response = self.run_phishing(
            save_history=True
        )

        investigation = self.assert_saved(
            response,
            "phishing"
        )

        self.assertEqual(

            investigation["risk_level"],

            response.json()["analysis"]["risk_level"],

        )

        self.assertEqual(
            self.investigation_count(),
            1
        )


    def test_custom_investigation_title(self):

        response = self.run_phishing(

            save_history=True,

            title="Suspicious account verification",

        )

        investigation = self.assert_saved(
            response,
            "phishing"
        )

        self.assertEqual(

            investigation["title"],

            "Suspicious account verification",

        )


    def test_phishing_ai_report_saved(self):

        report = (
            "Review the suspicious URL and "
            "verify the sender independently."
        )

        with patch(

            "backend.api.generate_phishing_report",

            return_value=report,

        ):

            response = self.run_phishing(

                save_history=True,

                include_ai_report=True,

            )

        investigation = self.assert_saved(
            response,
            "phishing"
        )

        self.assertEqual(
            investigation["ai_report"],
            report
        )


    def test_phishing_saved_without_ollama(self):

        with patch(

            "backend.api.generate_phishing_report",

            side_effect=RuntimeError(
                "Simulated AI failure"
            ),

        ):

            response = self.run_phishing(

                save_history=True,

                include_ai_report=True,

            )

        investigation = self.assert_saved(
            response,
            "phishing"
        )

        self.assertEqual(

            investigation["status"],

            "analysis_completed_ai_unavailable",

        )

        self.assertIsNone(
            investigation["ai_report"]
        )


# =========================================
# SECURITY LOG PERSISTENCE TESTS
# =========================================

class TestLogPersistence(
    PersistentInvestigationTestCase
):

    def test_temporary_logs_not_saved(self):

        response = self.run_logs()

        self.assertEqual(
            response.status_code,
            200
        )

        self.assertEqual(
            self.investigation_count(),
            0
        )


    def test_security_logs_saved(self):

        response = self.run_logs(
            save_history=True
        )

        investigation = self.assert_saved(
            response,
            "logs"
        )

        self.assertEqual(

            investigation["risk_level"],

            "Critical",

        )

        self.assertEqual(

            investigation["analysis"]
            ["summary"]["failed_logins"],

            12,

        )


    def test_invalid_logs_not_saved(self):

        response = self.run_logs(

            log_text=INVALID_LOGS,

            save_history=True,

        )

        self.assertEqual(
            response.status_code,
            200
        )

        data = response.json()

        self.assertEqual(
            data["status"],
            "no_valid_events"
        )

        self.assertFalse(
            data["history_saved"]
        )

        self.assertIsNotNone(
            data["storage_warning"]
        )

        self.assertEqual(
            self.investigation_count(),
            0
        )


    def test_logs_saved_without_ai_report(self):

        response = self.run_logs(

            save_history=True,

            include_ai_report=False,

        )

        investigation = self.assert_saved(
            response,
            "logs"
        )

        self.assertIsNone(
            investigation["ai_report"]
        )


# =========================================
# ML ANOMALY PERSISTENCE TESTS
# =========================================

class TestAnomalyPersistence(
    PersistentInvestigationTestCase
):

    def test_temporary_anomaly_not_saved(self):

        response = self.run_anomaly()

        self.assertEqual(
            response.status_code,
            200
        )

        self.assertEqual(
            self.investigation_count(),
            0
        )


    def test_anomaly_results_saved(self):

        response = self.run_anomaly(
            save_history=True
        )

        investigation = self.assert_saved(
            response,
            "anomaly"
        )

        self.assertGreater(

            investigation["analysis"]
            ["total_windows"],

            0,

        )

        self.assertIsNone(
            investigation["risk_level"]
        )


    def test_invalid_anomaly_input_not_saved(self):

        response = self.run_anomaly(

            log_text=INVALID_LOGS,

            save_history=True,

        )

        self.assertEqual(
            response.status_code,
            200
        )

        data = response.json()

        self.assertEqual(
            data["status"],
            "no_valid_windows"
        )

        self.assertFalse(
            data["history_saved"]
        )

        self.assertEqual(
            self.investigation_count(),
            0
        )


# =========================================
# STORAGE FAILURE AND HISTORY TESTS
# =========================================

class TestInvestigationIntegration(
    PersistentInvestigationTestCase
):

    def test_storage_failure_preserves_analysis(self):

        with patch(

            "backend.persistent_investigation."
            "save_investigation",

            side_effect=RuntimeError(
                "Simulated storage failure"
            ),

        ):

            response = self.run_phishing(
                save_history=True
            )

        self.assertEqual(
            response.status_code,
            200
        )

        data = response.json()

        self.assertEqual(
            data["status"],
            "success"
        )

        self.assertFalse(
            data["history_saved"]
        )

        self.assertIsNotNone(
            data["storage_warning"]
        )

        self.assertIn(
            "risk_score",
            data["analysis"]
        )

        self.assertEqual(
            self.investigation_count(),
            0
        )


    def test_saved_investigations_appear_in_history(self):

        responses = [

            self.run_phishing(save_history=True),

            self.run_logs(save_history=True),

            self.run_anomaly(save_history=True),

        ]

        for response in responses:

            self.assertEqual(
                response.status_code,
                200
            )

            self.assertTrue(
                response.json()["history_saved"]
            )

        response = self.client.get(
            "/history/investigations"
        )

        self.assertEqual(
            response.status_code,
            200
        )

        data = response.json()

        self.assertEqual(
            data["count"],
            3
        )

        types = {

            item["investigation_type"]

            for item in data["investigations"]

        }

        self.assertEqual(

            types,

            {"phishing", "logs", "anomaly"},

        )


    def test_saved_investigation_can_be_deleted(self):

        response = self.run_phishing(
            save_history=True
        )

        investigation = self.assert_saved(
            response,
            "phishing"
        )

        investigation_id = investigation["id"]

        response = self.client.delete(

            f"/history/investigations/"
            f"{investigation_id}"

        )

        self.assertEqual(
            response.status_code,
            200
        )

        self.assertEqual(
            self.investigation_count(),
            0
        )

        retrieved = self.client.get(

            f"/history/investigations/"
            f"{investigation_id}"

        )

        self.assertEqual(
            retrieved.status_code,
            404
        )


# =========================================
# TEST RUNNER
# =========================================

if __name__ == "__main__":

    unittest.main(verbosity=2)
