import torch
import numpy as np

def calculate_segmentation_metrics(pred_masks, target_masks, threshold=0.5, eps=1e-7):
    """
    Calculate IoU (Jaccard), Dice (F1), Precision, and Recall.
    pred_masks: torch.Tensor or numpy.ndarray of predicted probabilities or logits
    target_masks: torch.Tensor or numpy.ndarray of ground truth binary masks (0 or 1)
    """
    if isinstance(pred_masks, torch.Tensor):
        if pred_masks.requires_grad:
            pred_masks = pred_masks.detach()
        # If logits, convert via sigmoid
        if pred_masks.min() < 0 or pred_masks.max() > 1:
            pred_masks = torch.sigmoid(pred_masks)
        preds = (pred_masks > threshold).cpu().numpy().astype(bool)
    else:
        preds = (pred_masks > threshold).astype(bool)

    if isinstance(target_masks, torch.Tensor):
        targets = (target_masks > 0.5).cpu().numpy().astype(bool)
    else:
        targets = (target_masks > 0.5).astype(bool)

    intersection = np.logical_and(preds, targets).sum()
    union = np.logical_or(preds, targets).sum()

    pred_sum = preds.sum()
    target_sum = targets.sum()

    iou = (intersection + eps) / (union + eps)
    dice = (2.0 * intersection + eps) / (pred_sum + target_sum + eps)
    precision = (intersection + eps) / (pred_sum + eps)
    recall = (intersection + eps) / (target_sum + eps)
    f1 = 2 * (precision * recall) / (precision + recall + eps)

    return {
        "iou": float(iou),
        "dice": float(dice),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1)
    }

if __name__ == "__main__":
    print("Testing Metrics Calculation...", flush=True)
    preds = torch.tensor([[[[0.8, 0.2], [0.9, 0.1]]]])
    targets = torch.tensor([[[[1.0, 0.0], [1.0, 0.0]]]])
    metrics = calculate_segmentation_metrics(preds, targets)
    print(f"Metrics Output: {metrics}")
    print("Metrics implementation verified successfully!")
