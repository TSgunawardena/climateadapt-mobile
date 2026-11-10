"""Run with the web project's venv: python -m unittest discover -s <this folder>.

Contract/failure tests use in-memory fixtures, not actual Nelson predictions.
"""
import copy
import importlib.util
from pathlib import Path
import tempfile
import unittest
import sys

from fastapi.testclient import TestClient
import requests

spec = importlib.util.spec_from_file_location("mobile_bff", Path(__file__).with_name("54_run_mobile_bff.py"))
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)

CATALOGUE = {"nelson": ("Nelson CBD", -41.2746, 173.2839)}
PLACE = {"name": "Nelson CBD", "latitude": -41.2746, "longitude": 173.2839}


class Service:
    def __init__(self, root):
        self.root, self.missing, self.calls = root, [], 0
        self.status, self.fail = "analysis_ready", False

    def missing_files(self):
        return self.missing

    def resolve_place(self, query, lat=None, lon=None):
        self.calls += 1
        if query == "not found":
            raise ValueError("No trustworthy match found.")
        if lat is None:
            name, lat, lon = CATALOGUE.get(query.lower(), (query, -41.2746, 173.2839))
        else:
            name = query
        return {"display_name": name, "latitude": lat, "longitude": lon,
                "source": "manual_coordinate" if query == PLACE["name"] else "offline_nelson_catalogue"}

    def analyse(self, place, radius):
        if self.fail:
            raise RuntimeError("Fixture failure")
        relative = "outputs/place_analysis_v3/run/map.png"
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"fixture-map")
        return {"status": self.status, "reason": "Outside prepared land coverage.",
                "score_is_calibrated_probability": False, "model": "V3 logistic regression",
                "place": place, "radius_metres": radius, "run_id": "fixture123",
                "artifacts": {"local_map": relative, "analysis_json": "/private/laptop/path"}}


def valid_point():
    return {"prediction": {"susceptibility_score": .012, "operational_threshold": .004,
                            "susceptible": True, "score_is_calibrated_probability": False},
            "location": {"wgs84": {"latitude": PLACE["latitude"], "longitude": PLACE["longitude"]}},
            "coverage": {"valid_model_coverage": True},
            "human_review": {"required": True}, "provenance": {"model": "V3 logistic regression"}}


class Response:
    def __init__(self, data, status=200):
        self.data, self.status_code = data, status

    def json(self):
        return copy.deepcopy(self.data)

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError("Fixture upstream failure")


class HTTP:
    def __init__(self):
        self.value, self.status, self.fail, self.last_body = valid_point(), 200, False, None

    def get(self, url, **kwargs):
        if self.fail:
            raise requests.ConnectionError("Fixture offline")
        return Response({"primary_model": "V3 logistic regression", "score_is_calibrated_probability": False})

    def post(self, url, json, **kwargs):
        self.last_body = json
        return Response(self.value, self.status)


class MobileBFFTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.service, self.http = Service(self.root), HTTP()
        self.time = 10
        self.client = self.make_client()

    def tearDown(self):
        self.temp.cleanup()

    def make_client(self, online=False):
        return TestClient(module.create_app(self.service, CATALOGUE, lambda q: q.strip().lower(), self.root,
                                           online=online, http=self.http, clock=lambda: self.time))

    def test_health_and_catalogue_work_without_runtime(self):
        self.service.missing = [self.root / "missing.tif"]
        result = self.client.get("/api/health")
        self.assertEqual(result.json()["mode"], "live_places")
        self.assertFalse(result.json()["area_ready"])
        self.assertEqual(result.headers["cache-control"], "no-store")
        self.assertEqual(len(self.client.get("/api/places").json()["places"]), 1)
        self.assertEqual(self.client.post("/api/places/analyse", json=PLACE).status_code, 503)

    def test_search_builtin_and_online_disabled(self):
        self.assertEqual(self.client.post("/api/places/resolve", json={"query": "nelson"}).json()["place"]["latitude"], PLACE["latitude"])
        self.assertEqual(self.client.post("/api/places/resolve", json={"query": "address"}).status_code, 422)
        self.assertEqual(self.service.calls, 1)

    def test_online_search_is_cached_and_rate_limited(self):
        client = self.make_client(online=True)
        self.assertEqual(client.post("/api/places/resolve", json={"query": "address one"}).status_code, 200)
        self.assertEqual(client.post("/api/places/resolve", json={"query": "address one"}).status_code, 200)
        self.assertEqual(self.service.calls, 1)
        self.assertEqual(client.post("/api/places/resolve", json={"query": "address two"}).status_code, 429)
        self.time += 2
        self.assertEqual(client.post("/api/places/resolve", json={"query": "not found"}).status_code, 422)

    def test_invalid_coordinate_radius_and_blank_query_rejected(self):
        for invalid in [{**PLACE, "latitude": -91}, {**PLACE, "longitude": 181}, {**PLACE, "radius_metres": 3000}]:
            self.assertEqual(self.client.post("/api/places/analyse", json=invalid).status_code, 422)
        self.assertEqual(self.client.post("/api/places/resolve", json={"query": "   "}).status_code, 422)

    def test_point_contract_and_upstream_unavailable(self):
        result = self.client.post("/api/places/point", json=PLACE)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(self.http.last_body["location_name"], PLACE["name"])
        self.assertEqual(result.json()["point"]["prediction"]["susceptibility_score"], .012)
        self.http.fail = True
        self.assertEqual(self.client.post("/api/places/point", json=PLACE).status_code, 503)

    def test_point_outside_coverage_and_malformed_upstream_never_succeed(self):
        self.http.status = 404
        self.assertEqual(self.client.post("/api/places/point", json=PLACE).status_code, 422)
        self.http.status = 200
        for mutate in [lambda v: v.clear(),
                       lambda v: v["prediction"].update(susceptibility_score=float("nan")),
                       lambda v: v["prediction"].update(score_is_calibrated_probability=True),
                       lambda v: v["location"]["wgs84"].update(latitude=-40),
                       lambda v: v["human_review"].update(required=False)]:
            self.http.value = valid_point()
            mutate(self.http.value)
            self.assertEqual(self.client.post("/api/places/point", json=PLACE).status_code, 502)

    def test_area_returns_map_without_filesystem_paths(self):
        result = self.client.post("/api/places/analyse", json={**PLACE, "radius_metres": 500})
        self.assertEqual(result.status_code, 200)
        self.assertNotIn("artifacts", result.json()["area"])
        self.assertEqual(self.client.get(result.json()["map_url"]).content, b"fixture-map")
        self.assertEqual(self.client.get("/api/places/maps/unknown").status_code, 404)
        self.service.status = "data_unavailable"
        self.assertEqual(self.client.post("/api/places/analyse", json=PLACE).status_code, 422)


if __name__ == "__main__":
    unittest.main()
