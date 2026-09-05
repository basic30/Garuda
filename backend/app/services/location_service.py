import os
import requests
import numpy as np
from PIL import Image, ExifTags

def is_location_on_land(latitude: float, longitude: float) -> bool:
    """
    Checks if a (latitude, longitude) coordinate falls on land using global_land_mask
    and Open-Meteo Elevation API fallback.
    Returns True if location is on land, False if ocean/sea.
    """
    # Check 1: global_land_mask (dynamically imported to prevent IDE linter warnings)
    try:
        import importlib
        glm_spec = importlib.util.find_spec("global_land_mask")
        if glm_spec is not None:
            globe_mod = importlib.import_module("global_land_mask.globe")
            if globe_mod.is_land(latitude, longitude):
                return True
    except Exception as e:
        print(f"global_land_mask check error: {e}", flush=True)

    # Check 2: Open-Meteo elevation API check (elevation > 2m above sea level is land)
    try:
        url = f"https://api.open-meteo.com/v1/elevation?latitude={latitude}&longitude={longitude}"
        res = requests.get(url, timeout=4)
        if res.status_code == 200:
            elev = res.json().get("elevation", [0.0])[0]
            if elev is not None and elev > 2.0:
                return True
    except Exception as e:
        print(f"Open-Meteo elevation check error: {e}", flush=True)

    return False


def _convert_exif_deg(value):
    """Helper to convert EXIF GPS coordinate tuple (degrees, minutes, seconds) to decimal degrees."""
    try:
        d, m, s = value
        d_val = float(d)
        m_val = float(m)
        s_val = float(s)
        return d_val + (m_val / 60.0) + (s_val / 3600.0)
    except Exception:
        return None


import datetime

def parse_image_datetime(raw_dt_str):
    """Helper to parse raw EXIF or GeoTIFF timestamp strings into standard ISO 8601 UTC format."""
    if not raw_dt_str:
        return None
    raw_str = str(raw_dt_str).strip()
    formats = [
        "%Y:%m:%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y%m%d_%H%M%S"
    ]
    for fmt in formats:
        try:
            dt = datetime.datetime.strptime(raw_str, fmt)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            pass
    return None


def extract_image_coordinates(file_path: str):
    """
    Extracts geographic GPS coordinates (latitude, longitude) and image capture timestamp
    from uploaded SAR satellite images:
    - GeoTIFF files (.tif, .tiff) via rasterio CRS/GCPs/bounds transformation & TIFFTAG_DATETIME tags.
    - Standard image files (.jpg, .jpeg, .png) via PIL EXIF tags.
    Returns (latitude, longitude, timestamp_iso, has_metadata).
    """
    ext = os.path.splitext(file_path)[1].lower()
    dt_iso = None

    # 1. Try Rasterio for GeoTIFF / Sentinel-1 imagery
    if ext in ('.tif', '.tiff'):
        try:
            import rasterio
            from pyproj import Transformer

            with rasterio.open(file_path) as src:
                # Extract capture timestamp from TIFF tags
                tags = src.tags()
                raw_time = tags.get('TIFFTAG_DATETIME') or tags.get('DATETIME') or tags.get('DATE_TIME') or tags.get('TIFFTAG_DATETIME_ORIGINAL')
                dt_iso = parse_image_datetime(raw_time)

                # 1A. Check Ground Control Points (GCPs) - common in Sentinel-1 GRD TIFFs
                if src.gcps and len(src.gcps[0]) > 0:
                    gcps, crs = src.gcps
                    xs = [g.x for g in gcps]
                    ys = [g.y for g in gcps]
                    mean_x = float(sum(xs) / len(xs))
                    mean_y = float(sum(ys) / len(ys))

                    # Direct WGS84 check (mean_y = latitude, mean_x = longitude)
                    if abs(mean_y) <= 90.0 and abs(mean_x) <= 180.0 and (abs(mean_y) > 0.01 or abs(mean_x) > 0.01):
                        return round(mean_y, 6), round(mean_x, 6), dt_iso, True

                    # Direct WGS84 inverted check (mean_x = latitude, mean_y = longitude)
                    if abs(mean_x) <= 90.0 and abs(mean_y) <= 180.0 and (abs(mean_x) > 0.01 or abs(mean_y) > 0.01):
                        return round(mean_x, 6), round(mean_y, 6), dt_iso, True

                    # Projected CRS check (UTM / Mercator / polar stereographic)
                    if crs is not None:
                        try:
                            transformer = Transformer.from_crs(crs, 'EPSG:4326', always_xy=True)
                            lon, lat = transformer.transform(mean_x, mean_y)
                            if abs(lat) <= 90.0 and abs(lon) <= 180.0:
                                return round(float(lat), 6), round(float(lon), 6), dt_iso, True
                        except Exception:
                            pass

                # 1B. Standard GeoTIFF bounds & CRS transformation
                if src.bounds:
                    b = src.bounds
                    cx = (b.left + b.right) / 2.0
                    cy = (b.bottom + b.top) / 2.0

                    # Direct WGS84 bounds check
                    if abs(cy) <= 90.0 and abs(cx) <= 180.0 and (abs(cy) > 0.01 or abs(cx) > 0.01):
                        return round(float(cy), 6), round(float(cx), 6), dt_iso, True

                    if src.crs:
                        try:
                            crs_str = src.crs.to_string()
                            if crs_str != 'EPSG:4326':
                                transformer = Transformer.from_crs(src.crs, 'EPSG:4326', always_xy=True)
                                lon, lat = transformer.transform(cx, cy)
                            else:
                                lon, lat = cx, cy
                            if abs(lat) <= 90.0 and abs(lon) <= 180.0:
                                return round(float(lat), 6), round(float(lon), 6), dt_iso, True
                        except Exception:
                            pass

        except Exception as e:
            print(f"GeoTIFF rasterio extraction error: {e}", flush=True)

        # 1C. Try PIL GeoTIFF tags (ModelTiepointTag 33922)
        try:
            with Image.open(file_path) as img:
                tags = getattr(img, 'tag_v2', {})
                if not dt_iso and 306 in tags:
                    dt_iso = parse_image_datetime(tags[306])
                if 33922 in tags:
                    tiepoints = tags[33922]
                    if len(tiepoints) >= 6:
                        x_val, y_val = float(tiepoints[3]), float(tiepoints[4])
                        if abs(y_val) <= 90.0 and abs(x_val) <= 180.0 and (abs(y_val) > 0.01 or abs(x_val) > 0.01):
                            return round(y_val, 6), round(x_val, 6), dt_iso, True
                        if abs(x_val) <= 90.0 and abs(y_val) <= 180.0 and (abs(x_val) > 0.01 or abs(y_val) > 0.01):
                            return round(x_val, 6), round(y_val, 6), dt_iso, True
        except Exception as e:
            print(f"PIL GeoTIFF tag extraction error: {e}", flush=True)

    # 2. Try PIL EXIF for JPEG / PNG imagery
    try:
        with Image.open(file_path) as img:
            exif = img.getexif() if hasattr(img, 'getexif') else (img._getexif() if hasattr(img, '_getexif') else None)
            if exif:
                if not dt_iso:
                    raw_dt = exif.get(36867) or exif.get(306) or exif.get(36868)
                    dt_iso = parse_image_datetime(raw_dt)

                gps_info = {}
                for tag, val in exif.items():
                    tag_name = ExifTags.TAGS.get(tag, tag)
                    if tag_name == 'GPSInfo':
                        for key in val:
                            sub_tag = ExifTags.GPSTAGS.get(key, key)
                            gps_info[sub_tag] = val[key]

                if 'GPSLatitude' in gps_info and 'GPSLongitude' in gps_info:
                    lat = _convert_exif_deg(gps_info['GPSLatitude'])
                    lon = _convert_exif_deg(gps_info['GPSLongitude'])
                    if lat is not None and lon is not None:
                        if gps_info.get('GPSLatitudeRef') == 'S':
                            lat = -lat
                        if gps_info.get('GPSLongitudeRef') == 'W':
                            lon = -lon
                        return round(float(lat), 6), round(float(lon), 6), dt_iso, True
    except Exception as e:
        print(f"EXIF metadata extraction error: {e}", flush=True)

    return None, None, dt_iso, False


def validate_sar_image_characteristics(file_path: str):
    """
    Validates if an uploaded image file has valid SAR (Synthetic Aperture Radar) satellite image characteristics:
    - Grayscale / single-channel radar intensity profile (rejects standard color photos).
    - Non-blank / non-solid contrast variation.
    Fast & memory efficient: uses downsampled thumbnail (max 512x512) for instant processing on large TIFFs.
    """
    import cv2
    try:
        # Load image (supporting large GeoTIFFs, 16-bit SAR radar files, PNG/JPG)
        img = cv2.imread(file_path, cv2.IMREAD_UNCHANGED)
        if img is None:
            # Fallback to PIL for specialized GeoTIFFs
            try:
                with Image.open(file_path) as pil_img:
                    img = np.array(pil_img)
            except Exception:
                return False, "Unable to decode image file format."

        if img is None:
            return False, "Unable to read image file data."

        # Downsample for lightning-fast contrast analysis if image is huge
        h, w = img.shape[:2]
        if max(h, w) > 512:
            scale = 512.0 / max(h, w)
            new_w = max(16, int(w * scale))
            new_h = max(16, int(h * scale))
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

        h, w = img.shape[:2]
        if h < 16 or w < 16:
            return False, "Image dimensions are too small to be a valid SAR satellite scene."

        # 1. Color distribution check (SAR satellite images are single-channel grayscale radar intensity)
        if len(img.shape) == 3 and img.shape[2] == 3:
            b, g, r = cv2.split(img)
            diff_rg = float(np.mean(np.abs(r.astype(float) - g.astype(float))))
            diff_gb = float(np.mean(np.abs(g.astype(float) - b.astype(float))))
            # Standard color photos, screenshots, wallpapers have color variation across RGB channels
            if diff_rg > 3.0 or diff_gb > 3.0:
                return False, "Uploaded file is a standard color photo/image, not a grayscale SAR satellite radar scan. Please upload a valid SAR satellite image."

        # 2. Radar intensity & contrast variance check
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        std_dev = float(np.std(gray))
        if std_dev < 4.0:
            return False, "Invalid image: Uploaded file has no radar contrast (blank, dark, or solid color image)."

        return True, "Valid SAR satellite radar image format."

    except Exception as e:
        print(f"SAR validation error: {e}", flush=True)
        return True, "Validation skipped."



def is_in_ocean(latitude: float, longitude: float) -> bool:
    """
    Returns True if coordinates are strictly in maritime ocean waters,
    False if on land, using high-resolution global_land_mask (GSHHG 1-km global database).
    """
    lat, lon = float(latitude), float(longitude)

    # 1. Primary check: High-resolution global_land_mask
    try:
        from global_land_mask import globe
        return not globe.is_land(lat, lon)
    except Exception:
        pass

    # 2. Fallback check: is_location_on_land
    return not is_location_on_land(lat, lon)
