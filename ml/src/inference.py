import os
import sys
import json
import numpy as np
import cv2
import torch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from ml.src.preprocess import preprocess_sar_image
from ml.src.model import create_oil_spill_model

def post_process_mask(binary_mask, min_component_size=50):
    """
    Phase 15 — Post-Processing:
    - Perform connected component analysis.
    - Filter out small noisy components below min_component_size pixels.
    - Perform morphological closing to smooth boundary regions.
    - Returns cleaned binary mask and component metadata report.
    """
    mask_uint8 = (binary_mask > 0).astype(np.uint8)

    # 1. Morphological closing
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    closed_mask = cv2.morphologyEx(mask_uint8, cv2.MORPH_CLOSE, kernel)

    # 2. Connected Component Analysis
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(closed_mask, connectivity=8)

    cleaned_mask = np.zeros_like(closed_mask)
    component_details = []

    for i in range(1, num_labels): # Skip background (index 0)
        area = stats[i, cv2.CC_STAT_AREA]
        centroid = centroids[i].tolist()

        if area >= min_component_size:
            cleaned_mask[labels == i] = 1
            component_details.append({
                "component_id": i,
                "area_pixels": int(area),
                "centroid_px": [float(centroid[0]), float(centroid[1])],
                "bounding_box": [
                    int(stats[i, cv2.CC_STAT_LEFT]),
                    int(stats[i, cv2.CC_STAT_TOP]),
                    int(stats[i, cv2.CC_STAT_WIDTH]),
                    int(stats[i, cv2.CC_STAT_HEIGHT])
                ]
            })

    report = {
        "raw_connected_components": int(num_labels - 1),
        "retained_spill_components": len(component_details),
        "filtered_noise_components": int((num_labels - 1) - len(component_details)),
        "min_component_size_threshold": min_component_size,
        "components": component_details
    }

    return cleaned_mask, report

def run_inference(image_path,
                  checkpoint_path="ml/checkpoints/best_model.pth",
                  output_dir="outputs/masks",
                  threshold=0.5,
                  device=None):

    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Input SAR image not found: {image_path}")

    # Load model
    model = create_oil_spill_model().to(device)
    model.load_state_dict(torch.load(checkpoint_path, map_location=device))
    model.eval()

    # Read original image for sizing
    orig_img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    orig_h, orig_w = orig_img.shape[:2]

    # Preprocess
    img_tensor = preprocess_sar_image(image_path, target_size=(256, 256)).unsqueeze(0).to(device)

    # Predict
    with torch.no_grad():
        logits = model(img_tensor)
        probs = torch.sigmoid(logits).cpu().squeeze().numpy()

    # Resize probability map back to original dimensions
    prob_map_orig = cv2.resize(probs, (orig_w, orig_h), interpolation=cv2.INTER_LINEAR)
    raw_binary_mask = (prob_map_orig > threshold).astype(np.uint8)

    # Post-processing (Phase 15)
    final_mask, post_report = post_process_mask(raw_binary_mask, min_component_size=50)

    # Save output files
    os.makedirs(output_dir, exist_ok=True)
    base_name = os.path.basename(image_path)
    mask_out_path = os.path.join(output_dir, f"spill_mask_{base_name}")
    cv2.imwrite(mask_out_path, final_mask * 255)

    report_out_path = os.path.join(output_dir, f"post_report_{os.path.splitext(base_name)[0]}.json")
    with open(report_out_path, "w") as f:
        json.dump(post_report, f, indent=2)

    return {
        "image_path": image_path,
        "mask_out_path": mask_out_path,
        "prob_map": prob_map_orig,
        "final_mask": final_mask,
        "post_report": post_report
    }

if __name__ == "__main__":
    print("Testing Inference & Post-Processing Pipeline...", flush=True)
    # Test on a dataset sample if checkpoint exists
    ckpt = "ml/checkpoints/best_model.pth"
    test_csv = "ml/data/splits/test.csv"
    if os.path.exists(ckpt) and os.path.exists(test_csv):
        import pandas as pd
        df = pd.read_csv(test_csv)
        sample_img = df.iloc[0]["image_path"]
        res = run_inference(sample_img)
        print(f"Inference complete! Output saved to: {res['mask_out_path']}")
        print(f"Retained Spill Components: {res['post_report']['retained_spill_components']}")
