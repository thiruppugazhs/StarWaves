import logging
import os
import smtplib
from email.message import EmailMessage
from pathlib import Path

import jinja2

from app.core.config import settings

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "email"


class EmailDeliveryError(RuntimeError):
    pass


def render_template(template_name: str, context: dict) -> str:
    template_path = TEMPLATES_DIR / template_name
    if not template_path.exists():
        raise FileNotFoundError(f"Email template not found: {template_path}")

    content = template_path.read_text(encoding="utf-8")
    env = jinja2.Environment(autoescape=jinja2.select_autoescape(["html", "xml"]))
    template = env.from_string(content)
    return template.render(**context)


def send_email(
    to_email: str,
    subject: str,
    body_html: str,
    body_text: str | None = None,
) -> bool:
    if not settings.smtp_host:
        logger.warning("SMTP host is not configured. Skipping email delivery to %s", to_email)
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_email
    msg["To"] = to_email

    if body_text:
        msg.set_content(body_text)
    msg.add_alternative(body_html, subtype="html")

    try:
        if getattr(settings, "smtp_use_ssl", False) or settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10) as server:
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        elif settings.smtp_use_tls:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
                server.starttls()
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        logger.info("Successfully sent SMTP email to %s", to_email)
        return True
    except Exception as exc:
        logger.error("Failed to send SMTP email to %s: %s", to_email, exc)
        raise EmailDeliveryError(str(exc)) from exc


def send_welcome_email(to_email: str, user_name: str) -> bool:
    subject = "Welcome to StarWaves"
    display_name = user_name or to_email.split("@")[0]
    body_html = render_template(
        "welcome.html",
        {"user_name": display_name, "app_url": settings.frontend_url},
    )
    body_text = f"Welcome to StarWaves, {display_name}! Visit {settings.frontend_url} to get started."
    return send_email(to_email, subject, body_html, body_text)


def send_otp_email(to_email: str, user_name: str, otp_code: str) -> bool:
    subject = f"{otp_code} is your StarWaves verification code"
    display_name = user_name or to_email.split("@")[0]
    body_html = render_template(
        "email_otp.html",
        {"user_name": display_name, "otp_code": otp_code},
    )
    body_text = f"Hello {display_name},\n\nYour StarWaves verification code is: {otp_code}\n\nThis code will expire in 10 minutes.\n\nPlan clearly. Build consistently."
    return send_email(to_email, subject, body_html, body_text)


def send_verification_email(to_email: str, user_name: str, verification_token: str) -> bool:
    verify_url = f"{settings.frontend_url}/#verify-email?token={verification_token}"
    subject = "Verify Your Email Address - StarWaves"
    display_name = user_name or to_email.split("@")[0]
    body_html = render_template(
        "email_verification.html",
        {"user_name": display_name, "verify_url": verify_url},
    )
    body_text = f"Verify your StarWaves email address by visiting: {verify_url}"
    return send_email(to_email, subject, body_html, body_text)


def send_password_reset_email(to_email: str, reset_token: str, otp_code: str = "") -> bool:
    reset_url = f"{settings.frontend_url}/#reset-token={reset_token}"
    subject = "Password Reset Request - StarWaves"
    body_html = render_template(
        "password_reset.html",
        {"reset_url": reset_url, "otp_code": otp_code},
    )
    code_msg = f"Your 6-digit verification code is: {otp_code}\n\n" if otp_code else ""
    body_text = f"{code_msg}Reset your StarWaves password using this link: {reset_url}"
    return send_email(to_email, subject, body_html, body_text)


def send_account_combine_email(to_email: str, owner_email: str, token: str) -> bool:
    verify_url = f"{settings.frontend_url}/#combine-account?token={token}"
    subject = f"Account Combination Request from {owner_email} - StarWaves"
    body_html = render_template(
        "combine_account_invite.html",
        {
            "target_email": to_email,
            "owner_email": owner_email,
            "verify_url": verify_url,
        },
    )
    body_text = (
        f"User {owner_email} requested to combine accounts with your email ({to_email}). "
        f"Verify and link accounts by visiting: {verify_url}"
    )
    return send_email(to_email, subject, body_html, body_text)


def send_security_alert_email(
    to_email: str,
    user_name: str,
    event_type: str,
    details: str,
    ip_address: str = "Unknown",
) -> bool:
    subject = f"Security Alert: {event_type} - StarWaves"
    display_name = user_name or to_email.split("@")[0]
    body_html = render_template(
        "security_alert.html",
        {
            "user_name": display_name,
            "event_type": event_type,
            "details": details,
            "ip_address": ip_address,
            "app_url": settings.frontend_url,
        },
    )
    body_text = (
        f"Security Alert for StarWaves account: {event_type}\n"
        f"Details: {details}\n"
        f"IP Address: {ip_address}\n"
        f"Manage settings at: {settings.frontend_url}"
    )
    return send_email(to_email, subject, body_html, body_text)


def send_announcement_email(
    to_email: str,
    user_name: str,
    title: str,
    message: str,
) -> bool:
    subject = f"Announcement: {title} - StarWaves"
    display_name = user_name or to_email.split("@")[0]
    body_html = render_template(
        "announcement.html",
        {
            "user_name": display_name,
            "title": title,
            "message": message,
            "app_url": settings.frontend_url,
        },
    )
    body_text = f"StarWaves Announcement - {title}\n\n{message}\n\nVisit {settings.frontend_url}"
    return send_email(to_email, subject, body_html, body_text)


def send_reminder_email(
    to_email: str,
    user_name: str,
    reminder_title: str,
    reminder_type: str = "Task Reminder",
    due_time: str = "Today",
    description: str = "",
) -> bool:
    subject = f"Reminder: {reminder_title} - StarWaves"
    display_name = user_name or to_email.split("@")[0]
    description_escaped = jinja2.escape(description) if description else ""
    description_block = f"<p><strong>Details:</strong> {description_escaped}</p>" if description else ""

    body_html = render_template(
        "reminder.html",
        {
            "user_name": display_name,
            "reminder_title": reminder_title,
            "reminder_type": reminder_type,
            "due_time": due_time,
            "description_block": description_block,
            "app_url": settings.frontend_url,
        },
    )
    body_text = (
        f"StarWaves Reminder ({reminder_type}): {reminder_title}\n"
        f"Due Time: {due_time}\n"
        f"{'Details: ' + description if description else ''}\n"
        f"Open Workspace: {settings.frontend_url}"
    )
    return send_email(to_email, subject, body_html, body_text)

