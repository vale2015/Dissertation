"""Geographical helpers for nearby-event searches."""

from math import asin, cos, radians, sin, sqrt

import pygeohash


GEOHASH_PRECISION = 9
EARTH_RADIUS_KM = 6371.0088


def _coordinate(value, minimum, maximum, label):
    if isinstance(value, bool):
        raise ValueError(f"{label} must be a valid coordinate.")
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{label} must be a valid coordinate.") from error
    if not minimum <= number <= maximum:
        raise ValueError(f"{label} must be between {minimum} and {maximum}.")
    return number


def create_geopoint(latitude, longitude):
    """Return a stable Ticketmaster geoPoint for valid coordinates."""

    latitude_value = _coordinate(latitude, -90, 90, "Latitude")
    longitude_value = _coordinate(longitude, -180, 180, "Longitude")
    geo_point = pygeohash.encode(
        latitude_value,
        longitude_value,
        precision=GEOHASH_PRECISION,
    )
    if not geo_point:
        raise ValueError("Unable to create a geoPoint.")
    return geo_point


def calculate_distance_km(
    origin_latitude,
    origin_longitude,
    target_latitude,
    target_longitude,
):
    """Return the Haversine distance in kilometres, or None for bad targets."""

    try:
        origin_lat = _coordinate(origin_latitude, -90, 90, "Latitude")
        origin_lon = _coordinate(origin_longitude, -180, 180, "Longitude")
        target_lat = _coordinate(target_latitude, -90, 90, "Latitude")
        target_lon = _coordinate(target_longitude, -180, 180, "Longitude")
    except ValueError:
        return None

    latitude_delta = radians(target_lat - origin_lat)
    longitude_delta = radians(target_lon - origin_lon)
    origin_radians = radians(origin_lat)
    target_radians = radians(target_lat)

    haversine = (
        sin(latitude_delta / 2) ** 2
        + cos(origin_radians)
        * cos(target_radians)
        * sin(longitude_delta / 2) ** 2
    )
    haversine = min(1.0, max(0.0, haversine))
    distance = 2 * EARTH_RADIUS_KM * asin(sqrt(haversine))
    return round(distance, 1)
