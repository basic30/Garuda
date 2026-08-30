import torch
import torch.nn as nn
import torch.nn.functional as F

class DiceLoss(nn.Module):
    def __init__(self, smooth=1.0):
        super(DiceLoss, self).__init__()
        self.smooth = smooth

    def forward(self, logits, targets):
        probs = torch.sigmoid(logits)
        probs_flat = probs.view(-1)
        targets_flat = targets.view(-1)

        intersection = (probs_flat * targets_flat).sum()
        dice = (2.0 * intersection + self.smooth) / (probs_flat.sum() + targets_flat.sum() + self.smooth)
        return 1.0 - dice

class BCEDiceLoss(nn.Module):
    def __init__(self, bce_weight=0.5, dice_weight=0.5, pos_weight=None):
        super(BCEDiceLoss, self).__init__()
        self.bce_weight = bce_weight
        self.dice_weight = dice_weight
        if pos_weight is not None:
            self.bce = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([pos_weight]))
        else:
            self.bce = nn.BCEWithLogitsLoss()
        self.dice = DiceLoss()

    def forward(self, logits, targets):
        if hasattr(self.bce, 'pos_weight') and self.bce.pos_weight is not None:
            self.bce.pos_weight = self.bce.pos_weight.to(logits.device)
        bce_loss = self.bce(logits, targets)
        dice_loss = self.dice(logits, targets)
        return self.bce_weight * bce_loss + self.dice_weight * dice_loss

if __name__ == "__main__":
    print("Testing Loss Functions...", flush=True)
    criterion = BCEDiceLoss(pos_weight=2.87)
    pred_logits = torch.randn(4, 1, 256, 256, requires_grad=True)
    targets = torch.randint(0, 2, (4, 1, 256, 256)).float()
    loss = criterion(pred_logits, targets)
    loss.backward()
    print(f"Calculated BCE+Dice Loss: {loss.item():.4f}")
    print("Loss functions implementation verified successfully!")
