"""Eve utility tool definitions — single responsibility: QR, chart, PDF, and OCR helpers."""

UTILITY_TOOLS = [
    {
        "type": "function",
        "name": "generate_qr_code",
        "description": "Generate a QR code image from text or a URL and save it to the workspace as a PNG.",
        "parameters": {
            "type": "object",
            "properties": {
                "data": {"type": "string", "minLength": 1, "description": "The text or URL to encode in the QR code"},
            },
            "required": ["data"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "create_chart",
        "description": "Render a bar, line, or pie chart from data points and save it to the workspace as a PNG.",
        "parameters": {
            "type": "object",
            "properties": {
                "chart_type": {"type": "string", "enum": ["bar", "line", "pie"], "description": "Type of chart to render"},
                "labels": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 1,
                    "description": "Category labels, one per data point",
                },
                "values": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 1,
                    "description": "Numeric values matching the labels",
                },
                "title": {"type": "string", "description": "Optional chart title"},
            },
            "required": ["chart_type", "labels", "values"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "read_pdf_file",
        "description": "Extract the text content of a PDF file using an AI document model. Accepts a workspace file path or an HTTP(S) URL.",
        "parameters": {
            "type": "object",
            "properties": {
                "source": {"type": "string", "minLength": 1, "description": "Workspace file path or URL of the PDF"},
            },
            "required": ["source"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "extract_text_from_image",
        "description": "Perform OCR on an image (PNG/JPG/WebP) to extract its text. Accepts a workspace file path or an HTTP(S) URL.",
        "parameters": {
            "type": "object",
            "properties": {
                "source": {"type": "string", "minLength": 1, "description": "Workspace file path or URL of the image"},
            },
            "required": ["source"],
            "additionalProperties": False,
        },
        "strict": False,
    },
]
