"""Call schemas: WebRTC call records and signaling between StarWaves users."""

from datetime import datetime

from pydantic import BaseModel, Field


class CallUser(BaseModel):
    uid: str = Field(min_length=1, max_length=200)
    name: str = Field(default="")
    email: str = Field(default="")


class SignalMessage(BaseModel):
    id: str
    from_uid: str
    type: str
    payload: str
    created_at: str


class CallCreate(BaseModel):
    callee_identifier: str = Field(min_length=1, max_length=320)
    mode: str = Field(default="video", pattern="^(audio|video)$")
    provider: str = Field(default="in_app", pattern="^(in_app|twilio)$")
    phone_number: str | None = Field(default=None, description="E.164 phone for Twilio PSTN, e.g. +14155551234")


class TwilioCallCreate(BaseModel):
    phone_number: str = Field(min_length=8, max_length=20, description="E.164 destination")
    message: str | None = Field(default=None, max_length=1600)
    mode: str = Field(default="audio", pattern="^(audio|video)$")


class EveTwilioCallRequest(BaseModel):
    phone_number: str = Field(min_length=8, max_length=20)
    prompt: str | None = Field(default=None, max_length=1600)
    mode: str = Field(default="audio", pattern="^(audio|video)$")


class CallStatusUpdate(BaseModel):
    status: str = Field(pattern="^(ringing|active|declined|ended|missed)$")


class SignalCreate(BaseModel):
    type: str = Field(pattern="^(offer|answer|ice-candidate)$")
    payload: str = Field(min_length=1, max_length=20000)


class CallResponse(BaseModel):
    id: str
    caller: CallUser
    callee: CallUser
    mode: str
    status: str
    provider: str = Field(default="in_app")
    phone_number: str | None = None
    external_sid: str | None = None
    messages: list[SignalMessage] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None