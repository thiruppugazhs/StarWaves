"""Eve media tool definitions — single responsibility: image, video, and audio generation."""

MEDIA_TOOLS = [
    {
        "type": "function",
        "name": "generate_image",
        "description": "Generate an image from a text prompt using an AI image model. Returns the workspace path of the saved PNG.",
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "minLength": 1, "description": "Description of the image to generate"},
                "size": {
                    "type": "string",
                    "enum": ["1024x1024", "1024x1536", "1536x1024"],
                    "description": "Image dimensions: square, portrait, or landscape (default 1024x1024)",
                },
            },
            "required": ["prompt"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "generate_video",
        "description": "Generate a short video clip from a text prompt using an AI video model (Gemini Veo). Takes up to a few minutes. Returns the workspace path of the saved MP4.",
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "minLength": 1, "description": "Description of the video scene to generate"},
            },
            "required": ["prompt"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "text_to_speech",
        "description": "Convert text into a spoken audio file (MP3) saved to the workspace, using the user's configured TTS provider.",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "minLength": 1, "description": "The text to speak"},
            },
            "required": ["text"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "speech_to_text",
        "description": "Transcribe an audio file to text using the user's configured STT provider. Accepts a workspace file path or an external URL.",
        "parameters": {
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Workspace file path (e.g. media/note.mp3) or HTTP(S) URL of the audio",
                },
            },
            "required": ["source"],
            "additionalProperties": False,
        },
        "strict": False,
    },
]
