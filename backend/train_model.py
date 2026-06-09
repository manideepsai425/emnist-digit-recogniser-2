"""
PyTorch model training script for EMNIST digit recognition.

This script:
1. Downloads the EMNIST Digits dataset (70,000 images)
2. Builds a CNN architecture
3. Trains the model with validation
4. Saves the checkpoint to models/emnist_cnn.pt
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
import os
from pathlib import Path


# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
BATCH_SIZE = 64
EPOCHS = 10
LEARNING_RATE = 0.001
DATA_DIR = "./data"
MODELS_DIR = "./models"

# Ensure model directory exists
Path(MODELS_DIR).mkdir(exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# Model Architecture
# ─────────────────────────────────────────────────────────────────────────────

class EMNISTNet(nn.Module):
    """
    Convolutional Neural Network for EMNIST digit classification.
    
    Architecture:
    - Conv3 blocks with BatchNorm and MaxPool
    - Two fully-connected layers
    - Softmax output (10 classes: 0-9)
    """
    
    def __init__(self):
        super(EMNISTNet, self).__init__()
        
        # Block 1: Conv → BN → ReLU → MaxPool
        self.conv1 = nn.Conv2d(1, 32, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(32)
        self.pool1 = nn.MaxPool2d(2, 2)
        
        # Block 2: Conv → BN → ReLU → MaxPool
        self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(64)
        self.pool2 = nn.MaxPool2d(2, 2)
        
        # Block 3: Conv → BN → ReLU → MaxPool
        self.conv3 = nn.Conv2d(64, 128, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm2d(128)
        self.pool3 = nn.MaxPool2d(2, 2)
        
        # After 3 pools: 28×28 → 14×14 → 7×7 → 3×3
        # 128 channels × 3×3 = 1152 features
        self.fc1 = nn.Linear(128 * 3 * 3, 256)
        self.dropout = nn.Dropout(0.5)
        self.fc2 = nn.Linear(256, 10)  # 10 digit classes
    
    def forward(self, x):
        # Block 1
        x = self.conv1(x)
        x = self.bn1(x)
        x = torch.relu(x)
        x = self.pool1(x)
        
        # Block 2
        x = self.conv2(x)
        x = self.bn2(x)
        x = torch.relu(x)
        x = self.pool2(x)
        
        # Block 3
        x = self.conv3(x)
        x = self.bn3(x)
        x = torch.relu(x)
        x = self.pool3(x)
        
        # Flatten
        x = x.view(x.size(0), -1)
        
        # FC layers
        x = self.fc1(x)
        x = torch.relu(x)
        x = self.dropout(x)
        x = self.fc2(x)
        
        return x


# ─────────────────────────────────────────────────────────────────────────────
# Data Loading
# ─────────────────────────────────────────────────────────────────────────────

def get_dataloaders(batch_size: int):
    """Download and prepare EMNIST dataloaders."""
    
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.1307], std=[0.3081]),  # MNIST/EMNIST means
    ])
    
    # Download EMNIST Digits split (official dataset split for 0-9)
    train_dataset = datasets.EMNIST(
        root=DATA_DIR,
        split="digits",
        train=True,
        transform=transform,
        download=True,
    )
    
    test_dataset = datasets.EMNIST(
        root=DATA_DIR,
        split="digits",
        train=False,
        transform=transform,
        download=True,
    )
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)
    
    return train_loader, test_loader


# ─────────────────────────────────────────────────────────────────────────────
# Training & Validation
# ─────────────────────────────────────────────────────────────────────────────

def train_epoch(model, train_loader, optimizer, criterion, device):
    """Train for one epoch."""
    model.train()
    total_loss = 0.0
    correct = 0
    total = 0
    
    for batch_idx, (images, labels) in enumerate(train_loader):
        images, labels = images.to(device), labels.to(device)
        
        # Forward pass
        outputs = model(images)
        loss = criterion(outputs, labels)
        
        # Backward pass
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        
        # Stats
        total_loss += loss.item()
        _, predicted = torch.max(outputs.data, 1)
        correct += (predicted == labels).sum().item()
        total += labels.size(0)
        
        if (batch_idx + 1) % 100 == 0:
            print(f"  Batch {batch_idx + 1}/{len(train_loader)}, Loss: {loss.item():.4f}")
    
    avg_loss = total_loss / len(train_loader)
    accuracy = 100 * correct / total
    
    return avg_loss, accuracy


def validate(model, test_loader, criterion, device):
    """Validate on test set."""
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0
    
    with torch.no_grad():
        for images, labels in test_loader:
            images, labels = images.to(device), labels.to(device)
            
            outputs = model(images)
            loss = criterion(outputs, labels)
            
            total_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            correct += (predicted == labels).sum().item()
            total += labels.size(0)
    
    avg_loss = total_loss / len(test_loader)
    accuracy = 100 * correct / total
    
    return avg_loss, accuracy


# ─────────────────────────────────────────────────────────────────────────────
# Main Training Loop
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print(f"Device: {DEVICE}")
    print(f"Epochs: {EPOCHS}, Batch Size: {BATCH_SIZE}, LR: {LEARNING_RATE}")
    print()
    
    # Initialize model
    model = EMNISTNet().to(DEVICE)
    print(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")
    print()
    
    # Loss and optimizer
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=3, gamma=0.1)
    
    # Load data
    print("Loading EMNIST Digits dataset...")
    train_loader, test_loader = get_dataloaders(BATCH_SIZE)
    print(f"Train batches: {len(train_loader)}, Test batches: {len(test_loader)}")
    print()
    
    # Training loop
    best_accuracy = 0.0
    
    for epoch in range(1, EPOCHS + 1):
        print(f"Epoch {epoch}/{EPOCHS}")
        
        train_loss, train_acc = train_epoch(model, train_loader, optimizer, criterion, DEVICE)
        test_loss, test_acc = validate(model, test_loader, criterion, DEVICE)
        scheduler.step()
        
        print(f"  Train Loss: {train_loss:.4f}, Acc: {train_acc:.2f}%")
        print(f"  Test  Loss: {test_loss:.4f}, Acc: {test_acc:.2f}%")
        print()
        
        # Save best model
        if test_acc > best_accuracy:
            best_accuracy = test_acc
            checkpoint = {
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "accuracy": test_acc,
                "model_version": "v2",
            }
            model_path = os.path.join(MODELS_DIR, "emnist_cnn.pt")
            torch.save(checkpoint, model_path)
            print(f"✓ Saved best model: {model_path} (Acc: {test_acc:.2f}%)")
            print()
    
    print(f"Training complete! Best accuracy: {best_accuracy:.2f}%")


if __name__ == "__main__":
    main()
