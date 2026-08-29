"""Eve tool catalog — composes per-domain tool lists into EVE_TOOLS."""

from app.services.eve.tools.browser import BROWSER_TOOLS
from app.services.eve.tools.calendar import CALENDAR_TOOLS
from app.services.eve.tools.email import EMAIL_TOOLS
from app.services.eve.tools.files import FILES_TOOLS
from app.services.eve.tools.http import HTTP_TOOLS
from app.services.eve.tools.media import MEDIA_TOOLS
from app.services.eve.tools.memory import MEMORY_TOOLS
from app.services.eve.tools.navigation import NAVIGATION_TOOLS
from app.services.eve.tools.schedule import SCHEDULE_TOOLS
from app.services.eve.tools.search import SEARCH_TOOLS
from app.services.eve.tools.studio import STUDIO_TOOLS
from app.services.eve.tools.ui import UI_TOOLS
from app.services.eve.tools.utility import UTILITY_TOOLS
from app.services.eve.tools.web import WEB_TOOLS
from app.services.eve.tools.whatsapp import WHATSAPP_TOOLS
from app.services.eve.tools.workspace import WORKSPACE_TOOLS

EVE_TOOLS = (
    WORKSPACE_TOOLS
    + NAVIGATION_TOOLS
    + SEARCH_TOOLS
    + MEMORY_TOOLS
    + SCHEDULE_TOOLS
    + FILES_TOOLS
    + WHATSAPP_TOOLS
    + WEB_TOOLS
    + STUDIO_TOOLS
    + MEDIA_TOOLS
    + BROWSER_TOOLS
    + UTILITY_TOOLS
    + EMAIL_TOOLS
    + CALENDAR_TOOLS
    + HTTP_TOOLS
    + UI_TOOLS
)
