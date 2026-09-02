import os
import requests
from PIL import Image, ExifTags

def is_location_on_land(latitude: float, longitude: float) -> bool:
    """
    Checks if a (latitude, longitude) coordinate falls on land using global_land_mask
    and Open-Meteo Elevation API fallback.
    Returns True if location is on land, False if ocean/sea.
    """
    # Check 1: global_land_mask
    try:
        from global_land_mask import globe
        if globe.is_land(latitude, longitude):
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


def is_in_ocean(latitude: float, longitude: float) -> bool:
    """
    Returns True if coordinates are strictly in maritime ocean waters,
    filtering out Indian subcontinent, Sri Lanka, Pakistan, Iran, Oman, and Asian land masses using global_land_mask.
    """
    lat, lon = float(latitude), float(longitude)

    # 1. Primary check: High-resolution global_land_mask
    try:
        from global_land_mask import globe
        if globe.is_land(lat, lon):
            return False
    except Exception as e:
        print(f"global_land_mask check error in is_in_ocean: {e}", flush=True)

    # 2. Mathematical shoreline boundary checks
    if 8.0 <= lat <= 15.0 and lon < 77.5:
        west_coast_lon = 77.5 - (lat - 8.0) * (3.7 / 7.0)
        if lon >= west_coast_lon:
            return False

    if 15.0 < lat <= 20.0 and lon < 73.8:
        west_coast_lon = 73.8 - (lat - 15.0) * (1.0 / 5.0)
        if lon >= west_coast_lon:
            return False

    if 20.0 < lat <= 23.5 and 68.5 <= lon <= 73.5:
        if lon >= 72.2 or (lat > 21.0 and lon >= 69.5 and lon <= 72.5):
            return False

    if 8.0 <= lat < 13.0 and lon >= 77.5:
        east_coast_lon = 77.5 + (lat - 8.0) * (2.8 / 5.0)
        if lon <= east_coast_lon:
            return False

    if 13.0 <= lat <= 21.8 and lon >= 80.3:
        east_coast_lon = 80.3 + (lat - 13.0) * (7.9 / 8.8)
        if lon <= east_coast_lon:
            return False

    if lat > 21.8 and 68.5 <= lon <= 89.0:
        return False

    if 24.0 <= lat <= 30.0 and 56.0 <= lon <= 68.5:
        if lat >= 24.8:
            return False

    if 5.9 <= lat <= 9.8 and 79.6 <= lon <= 81.8:
        return False

    if -5.0 <= lat <= 5.5 and 95.5 <= lon <= 104.0:
        if 1.2 <= lat <= 4.2 and 98.8 <= lon <= 101.2:
            return True
        return False

    if lat >= 22.5 and lon <= 59.5:
        return False

    return True



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


def extract_image_coordinates(file_path: str):
    """
    Extracts geographic GPS coordinates (latitude, longitude) from uploaded SAR images:
    - GeoTIFF files (.tif, .tiff) via rasterio CRS/bounds transformation.
    - Standard image files (.jpg, .jpeg, .png) via PIL EXIF tags.
    Returns (latitude, longitude, has_metadata).
    """
    ext = os.path.splitext(file_path)[1].lower()

    # 1. Try Rasterio for GeoTIFF / Sentinel-1 imagery
    if ext in ('.tif', '.tiff'):
        try:
            import rasterio
            from pyproj import Transformer
            with rasterio.open(file_path) as src:
                # 1A. Sentinel-1 Ground Control Points (GCPs) extraction
                if src.gcps and len(src.gcps[0]) > 0:
                    gcps, crs = src.gcps
                    lats = [g.y for g in gcps]
                    lons = [g.x for g in gcps]
                    mean_lat = float(sum(lats) / len(lats))
                    mean_lon = float(sum(lons) / len(lons))
                    if abs(mean_lat) <= 90.0 and abs(mean_lon) <= 180.0:
                        return round(mean_lat, 6), round(mean_lon, 6), True

                # 1B. Standard GeoTIFF bounds & CRS transformation
                if src.bounds:
                    b = src.bounds
                    cx = (b.left + b.right) / 2.0
                    cy = (b.bottom + b.top) / 2.0
                    if src.crs:
                        crs_str = src.crs.to_string()
                        if crs_str != 'EPSG:4326':
                            transformer = Transformer.from_crs(src.crs, 'EPSG:4326', always_xy=True)
                            lon, lat = transformer.transform(cx, cy)
                        else:
                            lon, lat = cx, cy
                        if abs(lat) <= 90.0 and abs(lon) <= 180.0:
                            return round(float(lat), 6), round(float(lon), 6), True
        except Exception as e:
            print(f"GeoTIFF metadata extraction error: {e}", flush=True)

    # 2. Try PIL EXIF for JPEG / PNG imagery
    try:
        img = Image.open(file_path)
        exif = img._getexif()
        if exif:
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
                    return round(float(lat), 6), round(float(lon), 6), True
    except Exception as e:
        print(f"EXIF metadata extraction error: {e}", flush=True)

    return None, None, False


def validate_sar_image_characteristics(file_path: str):
    """
    Validates if an uploaded image file has valid SAR (Synthetic Aperture Radar) satellite image characteristics:
    - Grayscale / single-channel radar intensity profile (rejects standard color photos).
    - Non-blank / non-solid contrast variation.
    Returns (is_valid: bool, reason: str).
    """
    try:
        import cv2
        import numpy as np

        img = cv2.imread(file_path)
        if img is None:
            return False, "Unreadable or corrupted image file format."

        # Check dimensions
        h, w = img.shape[:2]
        if h < 32 or w < 32:
            return False, "Image dimensions are too small to be a valid SAR satellite scene."

        # 1. Color distribution check (SAR satellite images are single-channel grayscale radar intensity)
        if len(img.shape) == 3 and img.shape[2] == 3:
            b, g, r = cv2.split(img)
            diff_rg = np.mean(np.abs(r.astype(float) - g.astype(float)))
            diff_gb = np.mean(np.abs(g.astype(float) - b.astype(float)))
            # Standard color photos, screenshots, wallpapers, and non-SAR images have color variation across RGB channels
            if diff_rg > 2.5 or diff_gb > 2.5:
                return False, "Uploaded file is a standard color photo/image, not a grayscale SAR satellite radar scan. Please upload a valid SAR satellite image."

        # 2. Radar intensity & contrast variance check
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        std_dev = np.std(gray)
        if std_dev < 5.0:
            return False, "Invalid image: Uploaded file has no radar contrast (blank, dark, or solid color image)."

        return True, "Valid SAR satellite radar image format."

    except Exception as e:
        print(f"SAR validation error: {e}", flush=True)
        return True, "Validation skipped."
