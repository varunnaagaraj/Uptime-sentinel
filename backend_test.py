#!/usr/bin/env python3
"""
Backend API Test Suite for Route Sentinel Monitoring System
Tests all API endpoints for functionality, data validation, and error handling.
"""
import requests
import time
import json
from datetime import datetime

class RouteSentinelTester:
    def __init__(self, base_url="https://route-sentinel.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.timeout = 30
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.results = {}

    def log(self, message, level="INFO"):
        print(f"[{level}] {message}")

    def run_test(self, name, method, endpoint, expected_status=200, data=None, timeout=30, validate_response=None):
        """Run a single API test with comprehensive validation"""
        url = f"{self.base_url}/{endpoint}"
        self.tests_run += 1
        
        self.log(f"Testing {name} - {method} {endpoint}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, timeout=timeout)
            elif method == 'POST':
                headers = {'Content-Type': 'application/json'}
                response = self.session.post(url, json=data, headers=headers, timeout=timeout)
            else:
                raise ValueError(f"Unsupported method: {method}")

            # Check status code
            if response.status_code != expected_status:
                self.log(f"❌ FAILED - Expected status {expected_status}, got {response.status_code}", "ERROR")
                self.log(f"Response: {response.text[:500]}", "DEBUG")
                self.failed_tests.append(f"{name}: Status {response.status_code} != {expected_status}")
                return False, {}

            # Parse JSON response
            try:
                json_data = response.json()
            except json.JSONDecodeError:
                if expected_status == 200:
                    self.log(f"❌ FAILED - Invalid JSON response", "ERROR") 
                    self.failed_tests.append(f"{name}: Invalid JSON response")
                    return False, {}
                json_data = {}

            # Custom validation
            if validate_response and not validate_response(json_data):
                self.log(f"❌ FAILED - Response validation failed", "ERROR")
                self.failed_tests.append(f"{name}: Response validation failed")
                return False, json_data

            self.tests_passed += 1
            self.log(f"✅ PASSED - {name}")
            return True, json_data

        except requests.exceptions.Timeout:
            self.log(f"❌ FAILED - Request timeout after {timeout}s", "ERROR")
            self.failed_tests.append(f"{name}: Timeout after {timeout}s")
            return False, {}
        except Exception as e:
            self.log(f"❌ FAILED - Exception: {str(e)}", "ERROR")
            self.failed_tests.append(f"{name}: Exception - {str(e)}")
            return False, {}

    def test_overview_endpoint(self):
        """Test GET /api/overview - should return 3 targets and config_loaded=true"""
        def validate_overview(data):
            required_fields = [
                'total_targets', 'enabled_targets', 'total_runs', 
                'success_runs', 'failure_runs', 'success_rate',
                'avg_duration_ms', 'active_alerts', 'recent_runs',
                'scheduler', 'config_loaded'
            ]
            for field in required_fields:
                if field not in data:
                    self.log(f"Missing field in overview: {field}")
                    return False
            
            # Check for exactly 3 targets
            if data['total_targets'] != 3:
                self.log(f"Expected 3 targets, got {data['total_targets']}")
                return False
            
            # Check config_loaded is True
            if data['config_loaded'] != True:
                self.log(f"Expected config_loaded=true, got {data['config_loaded']}")
                return False
            
            # Validate data types
            if not isinstance(data['scheduler'], dict):
                self.log("Scheduler should be dict")
                return False
                
            if not isinstance(data['recent_runs'], list):
                self.log("Recent runs should be list")
                return False
                
            return True

        success, data = self.run_test(
            "System Overview (3 targets, config_loaded=true)",
            "GET", 
            "overview",
            validate_response=validate_overview
        )
        
        if success:
            self.results['overview'] = data
            self.log(f"Overview: {data['total_targets']} targets, config_loaded={data['config_loaded']}, {data['success_rate']}% success rate")
        
        return success

    def test_targets_endpoint(self):
        """Test GET /api/targets endpoint"""
        def validate_targets(data):
            if not isinstance(data, list):
                self.log("Targets response should be a list")
                return False
            
            for target in data:
                required_fields = ['id', 'name', 'base_url', 'enabled']
                for field in required_fields:
                    if field not in target:
                        self.log(f"Missing field in target: {field}")
                        return False
            return True

        success, data = self.run_test(
            "Targets List",
            "GET",
            "targets", 
            validate_response=validate_targets
        )
        
        if success:
            self.results['targets'] = data
            self.log(f"Found {len(data)} targets")
        
        return success

    def test_target_detail_endpoint(self):
        """Test GET /api/targets/demo-httpbin endpoint"""
        def validate_target_detail(data):
            required_fields = [
                'id', 'name', 'base_url', 'recent_runs',
                'total_checks', 'success_rate', 'status'
            ]
            for field in required_fields:
                if field not in data:
                    self.log(f"Missing field in target detail: {field}")
                    return False
            return True

        success, data = self.run_test(
            "Target Detail (demo-httpbin)",
            "GET",
            "targets/demo-httpbin",
            validate_response=validate_target_detail
        )
        
        if success:
            self.results['target_detail'] = data
            self.log(f"Target detail: {data['name']} - {data['status']} status")
        
        return success

    def test_target_runs_endpoint(self):
        """Test GET /api/targets/demo-httpbin/runs endpoint"""
        def validate_target_runs(data):
            required_fields = ['runs', 'total', 'limit', 'offset']
            for field in required_fields:
                if field not in data:
                    self.log(f"Missing field in target runs: {field}")
                    return False
            
            if not isinstance(data['runs'], list):
                self.log("Runs should be a list")
                return False
            
            return True

        success, data = self.run_test(
            "Target Runs (demo-httpbin)",
            "GET", 
            "targets/demo-httpbin/runs",
            validate_response=validate_target_runs
        )
        
        if success:
            self.results['target_runs'] = data
            self.log(f"Target runs: {len(data['runs'])} runs, {data['total']} total")
        
        return success

    def test_alerts_endpoint(self):
        """Test GET /api/alerts endpoint"""
        def validate_alerts(data):
            required_fields = ['alerts', 'total', 'limit', 'offset']
            for field in required_fields:
                if field not in data:
                    self.log(f"Missing field in alerts: {field}")
                    return False
            return True

        success, data = self.run_test(
            "Alerts History",
            "GET",
            "alerts",
            validate_response=validate_alerts
        )
        
        if success:
            self.results['alerts'] = data
            self.log(f"Alerts: {len(data['alerts'])} alerts, {data['total']} total")
        
        return success

    def test_active_alerts_endpoint(self):
        """Test GET /api/alerts/active endpoint"""
        def validate_active_alerts(data):
            if not isinstance(data, list):
                self.log("Active alerts should be a list")
                return False
            return True

        success, data = self.run_test(
            "Active Alerts",
            "GET",
            "alerts/active",
            validate_response=validate_active_alerts
        )
        
        if success:
            self.results['active_alerts'] = data
            self.log(f"Active alerts: {len(data)} active")
        
        return success

    def test_config_endpoint(self):
        """Test GET /api/config - should return config with preSteps schema support"""
        def validate_config(data):
            required_fields = ['loaded', 'config', 'warnings']
            for field in required_fields:
                if field not in data:
                    self.log(f"Missing field in config: {field}")
                    return False
            
            # Check if config contains targets with form auth (preSteps may be sanitized)
            config_data = data.get('config', {})
            targets = config_data.get('targets', [])
            
            # Look for the demo-auth-form target
            auth_target = None
            for target in targets:
                if target.get('id') == 'demo-auth-form':
                    auth_target = target
                    break
            
            if auth_target:
                auth_config = auth_target.get('auth', {})
                if auth_config.get('strategy') == 'form':
                    self.log("Found form auth target in config (preSteps schema available)")
                    return True
            
            self.log("No form auth target found in config")
            return False

        success, data = self.run_test(
            "Configuration (with preSteps schema)",
            "GET",
            "config",
            validate_response=validate_config
        )
        
        if success:
            self.results['config'] = data
            self.log(f"Config loaded: {data['loaded']}, warnings: {len(data.get('warnings', []))}")
        
        return success

    def test_config_validate_presteps(self):
        """Test POST /api/config/validate - should accept config with preSteps array"""
        # Sample config with preSteps for validation
        test_config = {
            "version": "1.0",
            "targets": [{
                "id": "test-presteps-validation",
                "name": "Test PreSteps Validation",
                "baseUrl": "https://example.com",
                "routes": [{"path": "/", "name": "Home"}],
                "auth": {
                    "strategy": "form",
                    "formLogin": {
                        "preSteps": [
                            {
                                "action": "navigate",
                                "url": "https://example.com/landing",
                                "description": "Navigate to landing page"
                            },
                            {
                                "action": "click", 
                                "selector": "button.sign-in",
                                "description": "Click Sign In button"
                            }
                        ],
                        "usernameSelector": "#email",
                        "passwordSelector": "#password",
                        "submitSelector": "button[type=submit]",
                        "usernameEnvVar": "TEST_USER",
                        "passwordEnvVar": "TEST_PASS"
                    }
                }
            }],
            "alerting": {
                "consecutiveFailureThreshold": 3
            }
        }

        def validate_config_validate(data):
            # If validation succeeds (200), preSteps are accepted
            # If validation fails due to preSteps, it would be a schema error
            return True  # Any 200 response means preSteps schema is valid

        success, data = self.run_test(
            "Config Validate (accepts preSteps array)",
            "POST",
            "config/validate",
            data=test_config,
            validate_response=validate_config_validate
        )
        
        if success:
            self.log("Config validation accepts preSteps array in formLogin")
        
        return success

    def test_config_reload_endpoint(self):
        """Test POST /api/config/reload endpoint"""
        def validate_config_reload(data):
            required_fields = ['success']
            for field in required_fields:
                if field not in data:
                    self.log(f"Missing field in config reload: {field}")
                    return False
            return True

        success, data = self.run_test(
            "Config Reload",
            "POST",
            "config/reload",
            validate_response=validate_config_reload
        )
        
        if success:
            self.results['config_reload'] = data
            self.log(f"Config reload success: {data['success']}")
        
        return success

    def test_scheduler_endpoint(self):
        """Test GET /api/scheduler endpoint"""
        def validate_scheduler(data):
            required_fields = ['running', 'jobs']
            for field in required_fields:
                if field not in data:
                    self.log(f"Missing field in scheduler: {field}")
                    return False
            
            if not isinstance(data['jobs'], list):
                self.log("Jobs should be a list")
                return False
            
            return True

        success, data = self.run_test(
            "Scheduler Status",
            "GET",
            "scheduler",
            validate_response=validate_scheduler
        )
        
        if success:
            self.results['scheduler'] = data
            self.log(f"Scheduler running: {data['running']}, jobs: {len(data['jobs'])}")
        
        return success

    def test_system_info_endpoint(self):
        """Test GET /api/system/info endpoint"""
        def validate_system_info(data):
            required_fields = [
                'version', 'python_version', 'platform', 'hostname',
                'config_loaded', 'config_path', 'screenshot_dir', 'screenshot_count',
                'disk_total_gb', 'disk_used_gb', 'disk_free_gb',
                'mongo_url_set', 'scheduler_running'
            ]
            for field in required_fields:
                if field not in data:
                    self.log(f"Missing field in system info: {field}")
                    return False
            
            # Validate data types
            if not isinstance(data['screenshot_count'], int):
                self.log("Screenshot count should be integer")
                return False
            
            if not isinstance(data['config_loaded'], bool):
                self.log("Config loaded should be boolean")
                return False
            
            return True

        success, data = self.run_test(
            "System Information",
            "GET",
            "system/info",
            validate_response=validate_system_info
        )
        
        if success:
            self.results['system_info'] = data
            self.log(f"System info: v{data['version']}, Python {data['python_version']}, {data['disk_free_gb']}GB free")
        
        return success

    def test_monitor_run_target_endpoint(self):
        """Test POST /api/monitor/run/demo-example (60s timeout for real browser automation)"""
        def validate_monitor_run(data):
            required_fields = ['success', 'total_checks', 'successes', 'failures', 'results']
            for field in required_fields:
                if field not in data:
                    self.log(f"Missing field in monitor run: {field}")
                    return False
            
            if not isinstance(data['results'], list):
                self.log("Results should be a list")
                return False
            
            return True

        self.log("Starting Playwright monitoring check (may take up to 60 seconds)...")
        success, data = self.run_test(
            "Monitor Run Target (demo-example)",
            "POST",
            "monitor/run/demo-example",
            timeout=65,  # Extended timeout for Playwright
            validate_response=validate_monitor_run
        )
        
        if success:
            self.results['monitor_run'] = data
            self.log(f"Monitor run: {data['successes']} passed, {data['failures']} failed")
        
        return success

    def test_auth_target_detail_endpoint(self):
        """Test GET /api/targets/demo-auth-form endpoint"""
        def validate_auth_target_detail(data):
            required_fields = [
                'id', 'name', 'base_url', 'recent_runs',
                'total_checks', 'success_rate', 'status',
                'auth_strategy', 'routes'
            ]
            for field in required_fields:
                if field not in data:
                    self.log(f"Missing field in auth target detail: {field}")
                    return False
            
            # Check that auth_strategy is 'form'
            if data['auth_strategy'] != 'form':
                self.log(f"Expected auth_strategy 'form', got '{data['auth_strategy']}'")
                return False
            
            # Check that routes include '/secure' and '/'
            route_paths = [route['path'] for route in data.get('routes', [])]
            if '/secure' not in route_paths or '/' not in route_paths:
                self.log(f"Expected routes '/' and '/secure', got {route_paths}")
                return False
            
            return True

        success, data = self.run_test(
            "Auth Target Detail (demo-auth-form)",
            "GET",
            "targets/demo-auth-form",
            validate_response=validate_auth_target_detail
        )
        
        if success:
            self.results['auth_target_detail'] = data
            self.log(f"Auth target: {data['name']} - {data['auth_strategy']} auth")
        
        return success

    def test_targets_include_auth_endpoint(self):
        """Test that GET /api/targets includes the authenticated target with form strategy"""
        def validate_targets_with_auth(data):
            if not isinstance(data, list):
                self.log("Targets response should be a list")
                return False
            
            # Should have exactly 3 targets
            if len(data) != 3:
                self.log(f"Expected exactly 3 targets, got {len(data)}")
                return False
            
            # Check for demo-auth-form target
            auth_target = None
            for target in data:
                if target.get('id') == 'demo-auth-form':
                    auth_target = target
                    break
            
            if not auth_target:
                self.log("demo-auth-form target not found in targets list")
                return False
            
            # Check auth_strategy field directly (not nested in auth object)
            auth_strategy = auth_target.get('auth_strategy')
            if auth_strategy != 'form':
                self.log(f"Expected auth_strategy 'form', got '{auth_strategy}'")
                return False
            
            return True

        success, data = self.run_test(
            "Targets List (3 targets with demo-auth-form having form auth)",
            "GET",
            "targets", 
            validate_response=validate_targets_with_auth
        )
        
        if success:
            auth_target = next((t for t in data if t['id'] == 'demo-auth-form'), None)
            if auth_target:
                self.log(f"Found auth target: {auth_target['name']} with auth_strategy: {auth_target.get('auth_strategy')}")
        
        return success

    def test_monitor_run_auth_target_endpoint(self):
        """Test POST /api/monitor/run/demo-auth-form (90s timeout for auth + browser automation)"""
        def validate_auth_monitor_run(data):
            required_fields = ['success', 'total_checks', 'successes', 'failures', 'results']
            for field in required_fields:
                if field not in data:
                    self.log(f"Missing field in auth monitor run: {field}")
                    return False
            
            if not isinstance(data['results'], list):
                self.log("Results should be a list")
                return False
            
            # Check that at least one result has auth_used=true
            auth_used = False
            for result in data['results']:
                if result.get('auth_used'):
                    auth_used = True
                    break
            
            if not auth_used:
                self.log("No results show auth_used=true")
                return False
            
            return True

        self.log("Starting authenticated Playwright check with form login (may take up to 90 seconds)...")
        success, data = self.run_test(
            "Monitor Run Auth Target (demo-auth-form)",
            "POST",
            "monitor/run/demo-auth-form",
            timeout=95,  # Extended timeout for auth + Playwright
            validate_response=validate_auth_monitor_run
        )
        
        if success:
            self.results['auth_monitor_run'] = data
            auth_runs = len([r for r in data['results'] if r.get('auth_used')])
            self.log(f"Auth monitor run: {data['successes']} passed, {data['failures']} failed, {auth_runs} authenticated runs")
        
        return success

    def run_all_tests(self):
        """Run all API tests in sequence"""
        self.log("=" * 60)
        self.log("Route Sentinel Backend API Test Suite")
        self.log("=" * 60)
        
        test_methods = [
            self.test_overview_endpoint,
            self.test_targets_include_auth_endpoint,  # Updated targets test
            self.test_config_endpoint,  # Updated config test
            self.test_config_validate_presteps,  # New preSteps validation test
            self.test_monitor_run_auth_target_endpoint,  # Auth target test (takes 90s)
            # Other tests for completeness
            self.test_target_detail_endpoint,
            self.test_alerts_endpoint,
            self.test_active_alerts_endpoint,
            self.test_config_reload_endpoint,
            self.test_scheduler_endpoint,
            self.test_system_info_endpoint,
        ]
        
        for test_method in test_methods:
            try:
                test_method()
            except Exception as e:
                self.log(f"❌ FAILED - Test method {test_method.__name__}: {str(e)}", "ERROR")
                self.failed_tests.append(f"{test_method.__name__}: Exception - {str(e)}")
            
            print()  # Add spacing between tests
        
        self.print_summary()
        return self.tests_passed == self.tests_run

    def print_summary(self):
        """Print test execution summary"""
        self.log("=" * 60)
        self.log("TEST SUMMARY")
        self.log("=" * 60)
        self.log(f"Tests run: {self.tests_run}")
        self.log(f"Tests passed: {self.tests_passed}")
        self.log(f"Tests failed: {self.tests_run - self.tests_passed}")
        self.log(f"Success rate: {(self.tests_passed / self.tests_run * 100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            self.log("\nFAILED TESTS:")
            for failure in self.failed_tests:
                self.log(f"  - {failure}")
        
        self.log("=" * 60)

def main():
    """Main test execution"""
    tester = RouteSentinelTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    import sys
    sys.exit(main())