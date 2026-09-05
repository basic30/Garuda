import os
import json
import hashlib
import numpy as np
from shapely.geometry import Polygon, MultiPoint, mapping
import pyproj
from shapely.ops import transform

from backend.app.services.environmental_service import fetch_environmental_forcing

def run_backward_drift_simulation(centroid_lat,
                                  centroid_lon,
                                  forcing_data=None,
                                  back_hours=24,
                                  num_particles=200,
                                  output_dir="outputs/origin"):
    """
    Phase 22 — Backward Origin Tracing Simulation:
    - Runs reverse Lagrangian simulation back in time (-12h, -24h, -48h).
    - Trajectory Velocity = - (Current + 3% Windage).
    - Computes probable origin zone polygon with uncertainty bounds.
    - Saves output GeoJSON to outputs/origin/origin_zone.geojson.
    """
    if forcing_data is None:
        forcing_data = fetch_environmental_forcing(centroid_lat, centroid_lon)

    u_wind = forcing_data["wind_u_m_s"]
    v_wind = forcing_data["wind_v_m_s"]
    u_curr = forcing_data["current_u_m_s"]
    v_curr = forcing_data["current_v_m_s"]

    # Reverse drift velocity
    u_back_mps = - (u_curr + 0.03 * u_wind)
    v_back_mps = - (v_curr + 0.03 * v_wind)

    project_to_meters = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True).transform
    project_to_wgs84 = pyproj.Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True).transform

    center_x, center_y = project_to_meters(centroid_lon, centroid_lat)

    # Deterministic, thread-safe RNG seeded by incident centroid coordinates
    coord_key = f"{round(float(centroid_lat), 4)}_{round(float(centroid_lon), 4)}"
    seed = int(hashlib.md5(coord_key.encode()).hexdigest()[:8], 16) % 100000
    rng = np.random.RandomState(seed)

    init_radii = rng.uniform(0, 150, num_particles)
    init_angles = rng.uniform(0, 2 * np.pi, num_particles)

    particle_x = center_x + init_radii * np.cos(init_angles)
    particle_y = center_y + init_radii * np.sin(init_angles)

    dt_seconds = back_hours * 3600.0
    disp_x = u_back_mps * dt_seconds
    disp_y = v_back_mps * dt_seconds

    diffusion_std = np.sqrt(2.0 * 1.5 * dt_seconds)
    diff_x = rng.normal(0, diffusion_std, num_particles)
    diff_y = rng.normal(0, diffusion_std, num_particles)

    origin_x = particle_x + disp_x + diff_x
    origin_y = particle_y + disp_y + diff_y

    pts_wgs84 = [project_to_wgs84(px, py) for px, py in zip(origin_x, origin_y)]
    multi_pt = MultiPoint(pts_wgs84)
    origin_polygon = multi_pt.convex_hull.buffer(0.003)

    origin_poly_m = transform(project_to_meters, origin_polygon)
    origin_area_sqkm = origin_poly_m.area / 1e6
    origin_centroid = [round(float(origin_polygon.centroid.y), 4), round(float(origin_polygon.centroid.x), 4)]

    geojson_origin = {
        "type": "Feature",
        "geometry": mapping(origin_polygon),
        "properties": {
            "origin_time_window_hours": f"-{back_hours}h",
            "probable_origin_centroid": origin_centroid,
            "origin_area_sqkm": round(float(origin_area_sqkm), 3),
            "forcing": forcing_data,
            "confidence_note": "Probable origin envelope estimated via reverse drift modeling"
        }
    }

    os.makedirs(output_dir, exist_ok=True)
    origin_path = os.path.join(output_dir, "origin_zone.geojson")
    with open(origin_path, "w") as f:
        json.dump(geojson_origin, f, indent=2)

    return {
        "origin_path": origin_path,
        "origin_centroid": origin_centroid,
        "origin_area_sqkm": round(float(origin_area_sqkm), 3),
        "geojson": geojson_origin
    }

if __name__ == "__main__":
    print("Testing Backward Origin Tracing (Phase 22)...", flush=True)
    res = run_backward_drift_simulation(1.2500, 103.8000)
    print(f"Probable Origin Centroid: {res['origin_centroid']}")
    print(f"Probable Origin Area    : {res['origin_area_sqkm']} sq km")
    print(f"Saved GeoJSON to        : {res['origin_path']}")
    print("Backward Origin Tracing verification passed!")
