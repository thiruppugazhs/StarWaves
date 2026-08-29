"""QR code service — renders QR codes as PNG bytes using the qrcode library."""

import io

import qrcode


QR_DEFAULT_BOX_SIZE = 10
QR_DEFAULT_BORDER = 2


class QrCodeError(ValueError):
    """Raised when a QR code cannot be rendered."""


def generate_qr_png(data: str, box_size: int = QR_DEFAULT_BOX_SIZE) -> bytes:
    """Render the given text/URL as a QR code PNG image."""
    if not data or not data.strip():
        raise QrCodeError("QR data must not be empty.")
    code = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=QR_DEFAULT_BORDER,
    )
    code.add_data(data)
    code.make(fit=True)
    image = code.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
