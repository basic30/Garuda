import os
import sys
import json
import random
import numpy as np
import torch
import torch.optim as optim
from torch.utils.data import DataLoader
import matplotlib.pyplot as plt

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from ml.src.dataset import OilSpillDataset
from ml.src.model import create_oil_spill_model
from ml.src.losses import BCEDiceLoss
from ml.src.metrics import calculate_segmentation_metrics

def set_seed(seed=42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

def train_model(train_csv="ml/data/splits/train.csv",
                val_csv="ml/data/splits/validation.csv",
                checkpoint_dir="ml/checkpoints",
                results_dir="results",
                epochs=2,
                batch_size=64,
                lr=1e-3,
                device=None):

    print("=" * 70, flush=True)
    print("PHASE 11 — PYTORCH U-NET MODEL TRAINING", flush=True)
    print("=" * 70, flush=True)

    set_seed(42)

    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training Compute Device: {device}", flush=True)

    os.makedirs(checkpoint_dir, exist_ok=True)
    os.makedirs(results_dir, exist_ok=True)

    print("Loading DataLoaders...", flush=True)
    train_dataset = OilSpillDataset(train_csv, is_train=True)
    val_dataset = OilSpillDataset(val_csv, is_train=False)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    print(f"  Training samples  : {len(train_dataset)} ({len(train_loader)} batches)")
    print(f"  Validation samples: {len(val_dataset)} ({len(val_loader)} batches)")
    print("-" * 70, flush=True)

    model = create_oil_spill_model(encoder_name="resnet34", encoder_weights=None).to(device)
    criterion = BCEDiceLoss(bce_weight=0.5, dice_weight=0.5, pos_weight=2.87).to(device)
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='max', factor=0.5, patience=2)

    history = {
        "train_loss": [],
        "val_loss": [],
        "val_iou": [],
        "val_dice": [],
        "val_precision": [],
        "val_recall": [],
        "learning_rate": []
    }

    best_val_iou = -1.0
    best_model_path = os.path.join(checkpoint_dir, "best_model.pth")
    last_model_path = os.path.join(checkpoint_dir, "last_model.pth")

    for epoch in range(1, epochs + 1):
        # Training loop
        model.train()
        running_train_loss = 0.0
        train_count = 0
        for batch_idx, (imgs, masks, _) in enumerate(train_loader):
            if batch_idx >= 5: # Ultra-fast CPU execution pass
                break
            imgs = imgs.to(device)
            masks = masks.to(device)

            optimizer.zero_grad()
            outputs = model(imgs)
            loss = criterion(outputs, masks)
            loss.backward()
            optimizer.step()

            running_train_loss += loss.item() * imgs.size(0)
            train_count += imgs.size(0)

            print(f"  [Epoch {epoch:02d}] Batch {batch_idx + 1}/5 - Batch Loss: {loss.item():.4f}", flush=True)

        epoch_train_loss = running_train_loss / train_count

        # Validation loop
        model.eval()
        running_val_loss = 0.0
        val_preds_list = []
        val_targets_list = []

        with torch.no_grad():
            val_count = 0
            for v_idx, (imgs, masks, _) in enumerate(val_loader):
                if v_idx >= 3:
                    break
                imgs = imgs.to(device)
                masks = masks.to(device)

                outputs = model(imgs)
                loss = criterion(outputs, masks)
                running_val_loss += loss.item() * imgs.size(0)
                val_count += imgs.size(0)

                val_preds_list.append(outputs.cpu())
                val_targets_list.append(masks.cpu())

        epoch_val_loss = running_val_loss / val_count
        val_preds_cat = torch.cat(val_preds_list, dim=0)
        val_targets_cat = torch.cat(val_targets_list, dim=0)

        val_metrics = calculate_segmentation_metrics(val_preds_cat, val_targets_cat)

        current_lr = optimizer.param_groups[0]['lr']

        history["train_loss"].append(epoch_train_loss)
        history["val_loss"].append(epoch_val_loss)
        history["val_iou"].append(val_metrics["iou"])
        history["val_dice"].append(val_metrics["dice"])
        history["val_precision"].append(val_metrics["precision"])
        history["val_recall"].append(val_metrics["recall"])
        history["learning_rate"].append(current_lr)

        print(f"Epoch {epoch:02d}/{epochs:02d} | Train Loss: {epoch_train_loss:.4f} | Val Loss: {epoch_val_loss:.4f} | "
              f"Val IoU: {val_metrics['iou']:.4f} | Val Dice: {val_metrics['dice']:.4f} | "
              f"Val Prec: {val_metrics['precision']:.4f} | Val Rec: {val_metrics['recall']:.4f} | LR: {current_lr:.6f}", flush=True)

        scheduler.step(val_metrics["iou"])

        # Save Checkpoints
        torch.save(model.state_dict(), last_model_path)
        if val_metrics["iou"] > best_val_iou:
            best_val_iou = val_metrics["iou"]
            torch.save(model.state_dict(), best_model_path)
            print(f"  --> Saved new best checkpoint with Validation IoU: {best_val_iou:.4f}", flush=True)

    print("-" * 70, flush=True)
    print(f"Training Complete! Best Validation IoU: {best_val_iou:.4f}")
    print(f"Best Checkpoint Path: {best_model_path}")
    print("=" * 70, flush=True)

    # Phase 12 — Generate Visualization Plots
    print("Generating Training Curve Plots (Phase 12)...", flush=True)

    # 1. Training & Validation Loss Plot
    plt.figure(figsize=(8, 5))
    plt.plot(range(1, epochs + 1), history["train_loss"], label="Training Loss", color="blue", marker="o")
    plt.plot(range(1, epochs + 1), history["val_loss"], label="Validation Loss", color="red", marker="s")
    plt.xlabel("Epoch")
    plt.ylabel("Loss")
    plt.title("Training & Validation Loss Curve")
    plt.grid(True)
    plt.legend()
    plt.savefig(os.path.join(results_dir, "training_loss.png"), dpi=150)
    plt.close()

    # 2. Validation IoU Plot
    plt.figure(figsize=(8, 5))
    plt.plot(range(1, epochs + 1), history["val_iou"], label="Validation IoU", color="green", marker="^")
    plt.xlabel("Epoch")
    plt.ylabel("IoU Score")
    plt.title("Validation IoU Curve")
    plt.grid(True)
    plt.legend()
    plt.savefig(os.path.join(results_dir, "iou_curve.png"), dpi=150)
    plt.close()

    # 3. Validation Dice Plot
    plt.figure(figsize=(8, 5))
    plt.plot(range(1, epochs + 1), history["val_dice"], label="Validation Dice", color="purple", marker="d")
    plt.xlabel("Epoch")
    plt.ylabel("Dice Score")
    plt.title("Validation Dice Score Curve")
    plt.grid(True)
    plt.legend()
    plt.savefig(os.path.join(results_dir, "dice_curve.png"), dpi=150)
    plt.close()

    # Save history json
    with open(os.path.join(results_dir, "training_history.json"), "w") as f:
        json.dump(history, f, indent=2)

    print("Saved plots: training_loss.png, iou_curve.png, dice_curve.png", flush=True)

    return best_model_path, history

if __name__ == "__main__":
    train_model(epochs=2, batch_size=8)
