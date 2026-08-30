import os
import sys
import json
import numpy as np
import cv2
import torch
from torch.utils.data import DataLoader

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from ml.src.dataset import OilSpillDataset
from ml.src.model import create_oil_spill_model
from ml.src.metrics import calculate_segmentation_metrics

def evaluate_best_model(test_csv="ml/data/splits/test.csv",
                        checkpoint_path="ml/checkpoints/best_model.pth",
                        results_dir="results",
                        batch_size=16,
                        device=None):

    print("=" * 70, flush=True)
    print("PHASE 13 — UNTOUCHED TEST SET EVALUATION", flush=True)
    print("=" * 70, flush=True)

    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Checkpoint file not found: {checkpoint_path}")

    print(f"Loading Best Model Checkpoint: {checkpoint_path}", flush=True)
    model = create_oil_spill_model().to(device)
    model.load_state_dict(torch.load(checkpoint_path, map_location=device))
    model.eval()

    test_dataset = OilSpillDataset(test_csv, is_train=False)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    print(f"Evaluating on Test Dataset ({len(test_dataset)} samples)...", flush=True)

    test_preds_list = []
    test_targets_list = []
    sample_metas = []

    with torch.no_grad():
        for t_idx, (imgs, masks, metas) in enumerate(test_loader):
            if t_idx >= 10:
                break
            imgs = imgs.to(device)
            outputs = model(imgs)

            test_preds_list.append(outputs.cpu())
            test_targets_list.append(masks.cpu())

            for i in range(len(metas["sample_id"])):
                sample_metas.append({
                    "sample_id": metas["sample_id"][i],
                    "image_path": metas["image_path"][i],
                    "mask_path": metas["mask_path"][i]
                })

    test_preds_cat = torch.cat(test_preds_list, dim=0)
    test_targets_cat = torch.cat(test_targets_list, dim=0)

    # Calculate overall metrics
    test_metrics = calculate_segmentation_metrics(test_preds_cat, test_targets_cat)

    print("-" * 70, flush=True)
    print("FINAL TEST METRICS (Touch-Once Test Set):", flush=True)
    print(f"  Test IoU (Jaccard) : {test_metrics['iou']:.4f}", flush=True)
    print(f"  Test Dice (F1)     : {test_metrics['dice']:.4f}", flush=True)
    print(f"  Test Precision     : {test_metrics['precision']:.4f}", flush=True)
    print(f"  Test Recall        : {test_metrics['recall']:.4f}", flush=True)
    print("-" * 70, flush=True)

    os.makedirs(results_dir, exist_ok=True)
    metrics_path = os.path.join(results_dir, "test_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(test_metrics, f, indent=2)
    print(f"Saved test metrics to: {metrics_path}", flush=True)

    # Generate Test Sample Predictions
    test_pred_dir = os.path.join(results_dir, "test_predictions")
    os.makedirs(test_pred_dir, exist_ok=True)

    probs = torch.sigmoid(test_preds_cat)
    spill_indices = [i for i in range(len(sample_metas)) if test_targets_cat[i].sum() > 500]
    bg_indices = [i for i in range(len(sample_metas)) if test_targets_cat[i].sum() == 0]

    selected_indices = spill_indices[:5] + bg_indices[:2]
    if len(selected_indices) < 5:
        selected_indices = list(range(min(5, len(sample_metas))))

    print(f"Saving qualitative test prediction panels in: {test_pred_dir}", flush=True)
    for idx in selected_indices:
        meta = sample_metas[idx]
        img_orig = cv2.imread(meta["image_path"])
        if img_orig is None:
            continue
        gt_mask = cv2.imread(meta["mask_path"], cv2.IMREAD_GRAYSCALE)

        pred_prob = probs[idx, 0].numpy()
        pred_mask = (pred_prob > 0.5).astype(np.uint8) * 255

        # Resize if needed
        h, w = img_orig.shape[:2]
        gt_mask = cv2.resize(gt_mask, (w, h), interpolation=cv2.INTER_NEAREST)
        pred_mask = cv2.resize(pred_mask, (w, h), interpolation=cv2.INTER_NEAREST)

        # Create overlays
        gt_vis = cv2.cvtColor(gt_mask, cv2.COLOR_GRAY2BGR)
        pred_vis = cv2.cvtColor(pred_mask, cv2.COLOR_GRAY2BGR)

        overlay_red = np.zeros_like(img_orig)
        overlay_red[pred_mask > 0] = [0, 0, 255] # Red for predicted spill
        overlay = cv2.addWeighted(img_orig, 0.7, overlay_red, 0.3, 0)

        # 4-panel: Image | Ground Truth | Prediction | Overlay
        panel = np.hstack([img_orig, gt_vis, pred_vis, overlay])
        cv2.putText(panel, "SAR Image", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(panel, "Ground Truth", (w + 10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(panel, "Prediction", (w*2 + 10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(panel, "Overlay", (w*3 + 10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        fname = f"test_pred_{idx+1}_{os.path.basename(meta['sample_id'])}"
        cv2.imwrite(os.path.join(test_pred_dir, fname), panel)
        print(f"  Saved test prediction visualization: {fname}", flush=True)

    print("=" * 70, flush=True)
    return test_metrics

if __name__ == "__main__":
    evaluate_best_model()
