import pytest

from app.utils.geo_utils import calculate_distance_km, create_geopoint


def test_london_coordinates_create_stable_geopoint():
    assert create_geopoint(51.4360997, -0.1606866) == "gcpus7duz"


@pytest.mark.parametrize(
    "latitude,longitude",
    [(91, 0), (-91, 0), (0, 181), (0, -181), (None, 0), (0, "bad")],
)
def test_create_geopoint_rejects_invalid_coordinates(latitude, longitude):
    with pytest.raises(ValueError):
        create_geopoint(latitude, longitude)


def test_same_point_distance_is_zero():
    assert calculate_distance_km(51.5, -0.1, 51.5, -0.1) == 0.0


def test_known_london_distance_is_reasonable():
    distance = calculate_distance_km(51.4360997, -0.1606866, 51.5033, -0.1195)
    assert 7.0 < distance < 9.0


@pytest.mark.parametrize("latitude,longitude", [(None, None), ("", 1), (91, 1)])
def test_missing_or_invalid_target_returns_none(latitude, longitude):
    assert calculate_distance_km(51.5, -0.1, latitude, longitude) is None
