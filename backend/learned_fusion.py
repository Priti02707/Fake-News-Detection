"""Optional PyTorch research module; never imported by the production API."""
import torch
from torch import nn


class MultimodalClassifier(nn.Module):
    def __init__(self, dimensions, mode="attention", hidden=32):
        super().__init__()
        if mode not in {"early", "late", "attention"} or hidden < 4 or hidden % 4:
            raise ValueError("Choose early/late/attention fusion with a hidden dimension divisible by four.")
        self.modalities, self.mode = list(dimensions), mode
        self.projections = nn.ModuleDict({name: nn.Sequential(nn.Linear(dimension, hidden), nn.GELU(), nn.LayerNorm(hidden)) for name, dimension in dimensions.items()})
        self.modality_embeddings = nn.Parameter(torch.zeros(len(dimensions), hidden))
        if mode == "attention":
            self.query = nn.Parameter(torch.randn(1, 1, hidden) * .02)
            self.attention = nn.MultiheadAttention(hidden, 4, batch_first=True)
            self.head = nn.Linear(hidden, 2)
        elif mode == "early":
            self.head = nn.Sequential(nn.Linear(len(dimensions) * (hidden + 1), hidden), nn.GELU(), nn.Linear(hidden, 2))
        else:
            self.heads = nn.ModuleList([nn.Linear(hidden, 2) for _ in dimensions])
            self.gates = nn.Parameter(torch.zeros(len(dimensions)))

    def forward(self, features, mask):
        mask = mask.bool()
        if not torch.all(mask.any(dim=1)):
            raise ValueError("At least one observed modality is required per example.")
        projected = torch.stack([self.projections[name](features[name]) for name in self.modalities], dim=1)
        projected = (projected + self.modality_embeddings) * mask.unsqueeze(-1)
        if self.mode == "early":
            return self.head(torch.cat([projected, mask.unsqueeze(-1).float()], dim=-1).flatten(1))
        if self.mode == "late":
            scores = torch.stack([head(projected[:, index]) for index, head in enumerate(self.heads)], dim=1)
            weights = self.gates.unsqueeze(0).expand(mask.shape).masked_fill(~mask, float("-inf")).softmax(dim=1)
            return (scores * weights.unsqueeze(-1)).sum(dim=1)
        output, _ = self.attention(self.query.expand(mask.shape[0], -1, -1), projected, projected, key_padding_mask=~mask, need_weights=False)
        return self.head(output[:, 0])
