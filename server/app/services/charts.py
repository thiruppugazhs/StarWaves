"""Chart rendering service — renders simple charts as PNG bytes using matplotlib (Agg)."""

import io

import matplotlib

matplotlib.use("Agg")  # headless rendering, must be set before pyplot import
import matplotlib.pyplot as plt  # noqa: E402

CHART_TYPES = ("bar", "line", "pie")
MAX_DATA_POINTS = 60
FIGSIZE_INCHES = (8, 5)
DPI = 120
MAX_TITLE_LENGTH = 100


class ChartError(ValueError):
    """Raised when a chart cannot be rendered from the given data."""


def render_chart(chart_type: str, labels: list[str], values: list[float], title: str = "") -> bytes:
    """Render a bar, line, or pie chart to PNG bytes. Monochrome styling."""
    if chart_type not in CHART_TYPES:
        raise ChartError(f"chart_type must be one of {CHART_TYPES}.")
    if not labels or not values:
        raise ChartError("labels and values must not be empty.")
    if len(labels) != len(values):
        raise ChartError("labels and values must have the same length.")
    if len(values) > MAX_DATA_POINTS:
        raise ChartError(f"Too many data points (max {MAX_DATA_POINTS}).")

    fig, ax = plt.subplots(figsize=FIGSIZE_INCHES, dpi=DPI)
    title = (title or "")[:MAX_TITLE_LENGTH]
    try:
        if chart_type == "bar":
            ax.bar(labels, values, color="#18181b")
            ax.set_title(title)
        elif chart_type == "line":
            ax.plot(labels, values, color="#18181b", marker="o", linewidth=1.5)
            ax.set_title(title)
        else:
            grayscale = plt.cm.gray([0.15 + 0.75 * i / max(len(values) - 1, 1) for i in range(len(values))])
            ax.pie(values, labels=labels, colors=grayscale)
            ax.set_title(title)
        fig.tight_layout()
        buffer = io.BytesIO()
        fig.savefig(buffer, format="png")
        return buffer.getvalue()
    finally:
        plt.close(fig)
