# app/utils.py
# Image preprocessing helpers.
# The raw canvas PNG is fine for Claude's vision, but we validate and
# optionally enhance contrast so faint strokes are easier to read.

import base64
import io
from PIL import Image, ImageOps, ImageFilter


def decode_and_validate(base64_str: str) -> Image.Image:
    """
    Decode a base64 PNG string and return a PIL Image.
    Raises ValueError for corrupt or non-image data.
    """
    try:
        raw = base64.b64decode(base64_str)
        img = Image.open(io.BytesIO(raw))
        img.verify()                        # Checks file integrity
        img = Image.open(io.BytesIO(raw))   # Re-open after verify (verify seeks to end)
        return img.convert("RGB")
    except Exception as exc:
        raise ValueError(f"Invalid image data: {exc}") from exc


def preprocess_for_claude(base64_str: str) -> str:
    """
    Optionally enhance the image before sending to Claude:
      • Resize to 280×280 (in case frontend sends something different)
      • Boost contrast so light pencil strokes are visible
      • Re-encode as base64 PNG
    Returns a new base64 string ready for the Anthropic API.
    """
    img = decode_and_validate(base64_str)

    # Ensure consistent canvas size
    img = img.resize((280, 280), Image.LANCZOS)

    # Boost contrast to make faint strokes clearer for the model
    img = ImageOps.autocontrast(img, cutoff=2)

    # Mild sharpening — helps with blurry touch strokes
    img = img.filter(ImageFilter.SHARPEN)

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def is_blank_image(base64_str: str, threshold: float = 0.98) -> bool:
    """
    Return True if the image is nearly all white (nothing drawn).
    Prevents wasting an API call on an empty canvas.
    """
    img = decode_and_validate(base64_str).convert("L")  # grayscale
    pixels = list(img.getdata())
    white_ratio = sum(1 for p in pixels if p > 240) / len(pixels)
    return white_ratio > threshold
