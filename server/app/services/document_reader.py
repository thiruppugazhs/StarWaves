"""Document reading service — extracts text from images (OCR) and PDFs via vision models.

Falls back across configured providers: Gemini handles both images and PDFs
inline; OpenAI handles images. No local OCR/PDF binaries required.
"""

import logging

from app.core.config import settings
from app.services.ai_models.config import effective_api_key

logger = logging.getLogger(__name__)

GEMINI_VISION_MODEL = "gemini-2.5-flash"
OPENAI_VISION_MODEL = "gpt-4o-mini"
OCR_MAX_BYTES = 15 * 1024 * 1024
PDF_MAX_BYTES = 20 * 1024 * 1024
EXTRACTION_PROMPT = (
    "Extract all text content from this document. Return only the text, "
    "preserving the reading order. If there is no text, say so."
)


class DocumentReadError(RuntimeError):
    """Raised when a document cannot be read by any provider."""


def _read_with_gemini(data: bytes, mime_type: str) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)
    response = client.models.generate_content(
        model=GEMINI_VISION_MODEL,
        contents=[
            EXTRACTION_PROMPT,
            types.Part.from_bytes(data=data, mime_type=mime_type),
        ],
    )
    text = (response.text or "").strip()
    if not text:
        raise DocumentReadError("Gemini returned no text.")
    return text


def _read_image_with_openai(data: bytes, mime_type: str) -> str:
    import base64

    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key, base_url=None)
    data_url = f"data:{mime_type};base64,{base64.b64encode(data).decode('ascii')}"
    response = client.chat.completions.create(
        model=OPENAI_VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": EXTRACTION_PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
    )
    text = (response.choices[0].message.content or "").strip()
    if not text:
        raise DocumentReadError("OpenAI returned no text.")
    return text


def extract_image_text(data: bytes, mime_type: str = "image/png") -> str:
    """OCR an image via a vision model, preferring whichever provider is configured."""
    if len(data) > OCR_MAX_BYTES:
        raise DocumentReadError("Image exceeds the 15MB size limit.")
    if effective_api_key("gemini", {}):
        return _read_with_gemini(data, mime_type)
    if effective_api_key("openai", {}):
        return _read_image_with_openai(data, mime_type)
    raise DocumentReadError("OCR requires a Gemini or OpenAI API key.")


def extract_pdf_text(data: bytes) -> str:
    """Extract text from a PDF via Gemini's inline document support."""
    if len(data) > PDF_MAX_BYTES:
        raise DocumentReadError("PDF exceeds the 20MB size limit.")
    if not effective_api_key("gemini", {}):
        raise DocumentReadError("PDF reading requires a Gemini API key.")
    return _read_with_gemini(data, "application/pdf")
