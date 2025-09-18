# backend/app/models/schemas.py
from __future__ import annotations
from typing import Any, Dict, List, Literal, Optional, Type, cast
from pydantic import BaseModel, Field, ConfigDict, model_validator

# ---------- Primitives ----------
class ProfileLink(BaseModel):
    label: Optional[str] = ""
    url: Optional[str] = None

MonthStr = str

# ---------- Item types aligned to SmartResumeEditor SECTION_TEMPLATES ----------
class ItemBase(BaseModel):
    model_config = ConfigDict(extra="allow")

class Timebox(ItemBase):
    start: Optional[MonthStr] = ""
    end: Optional[MonthStr] = ""
    current: bool = False
    location: Optional[str] = ""

class Bulleted(ItemBase):
    bullets: Optional[List[str]] = Field(default_factory=list)

class ExperienceItem(Timebox, Bulleted):
    company: Optional[str] = ""
    role: Optional[str] = ""

class VolunteerItem(Timebox, Bulleted):
    organization: Optional[str] = ""
    role: Optional[str] = ""

class ProjectItem(Bulleted):
    name: Optional[str] = ""
    link: Optional[str] = ""
    summary: Optional[str] = ""

class EducationItem(ItemBase):
    school: Optional[str] = ""
    degree: Optional[str] = ""
    field: Optional[str] = ""
    start: Optional[MonthStr] = ""
    end: Optional[MonthStr] = ""
    location: Optional[str] = ""
    score: Optional[str] = ""

class CertificationItem(ItemBase):
    name: Optional[str] = ""
    authority: Optional[str] = ""
    id: Optional[str] = ""
    url: Optional[str] = ""
    date: Optional[MonthStr] = ""

class AwardItem(Bulleted):
    name: Optional[str] = ""
    issuer: Optional[str] = ""
    date: Optional[MonthStr] = ""
    location: Optional[str] = ""
    url: Optional[str] = ""

class PublicationItem(Bulleted):
    title: Optional[str] = ""
    venue: Optional[str] = ""
    authors: Optional[str] = ""
    date: Optional[MonthStr] = ""
    link: Optional[str] = ""

class CourseItem(ItemBase):
    name: Optional[str] = ""
    provider: Optional[str] = ""
    date: Optional[MonthStr] = ""
    link: Optional[str] = ""

class LanguageItem(ItemBase):
    name: Optional[str] = ""
    proficiency: Optional[str] = ""

class InterestItem(ItemBase):
    name: Optional[str] = ""
    details: Optional[str] = ""

class ReferenceItem(ItemBase):
    name: Optional[str] = ""
    relation: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""

class AchievementItem(Bulleted):
    title: Optional[str] = ""
    date: Optional[MonthStr] = ""
    summary: Optional[str] = ""
    link: Optional[str] = ""

class PatentItem(ItemBase):
    title: Optional[str] = ""
    number: Optional[str] = ""
    date: Optional[MonthStr] = ""
    link: Optional[str] = ""

class TalkItem(Bulleted):
    title: Optional[str] = ""
    event: Optional[str] = ""
    location: Optional[str] = ""
    date: Optional[MonthStr] = ""
    link: Optional[str] = ""

class CustomItem(ItemBase):
    content: Optional[str] = ""

class SkillsetsItem(ItemBase):
    languages: List[str] = Field(default_factory=list)
    soft: List[str] = Field(default_factory=list)
    concepts: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    platforms: List[str] = Field(default_factory=list)

# ---------- Section model ----------
SectionType = Literal[
    "experience", "projects", "education", "certifications", "awards",
    "publications", "volunteer", "courses", "languages", "interests",
    "references", "achievements", "patents", "talks", "custom", "skillsets",
]

ITEMS_MAP: Dict[str, Type[BaseModel]] = {
    "experience": ExperienceItem, "projects": ProjectItem, "education": EducationItem,
    "certifications": CertificationItem, "awards": AwardItem, "publications": PublicationItem,
    "volunteer": VolunteerItem, "courses": CourseItem, "languages": LanguageItem,
    "interests": InterestItem, "references": ReferenceItem, "achievements": AchievementItem,
    "patents": PatentItem, "talks": TalkItem, "custom": CustomItem, "skillsets": SkillsetsItem,
}

class Section(BaseModel):
    id: Optional[str] = None
    type: SectionType
    title: Optional[str] = None
    items: List[Dict[str, Any]] = Field(default_factory=list)
    model_config = ConfigDict(extra="allow")

    @model_validator(mode="before")
    @classmethod
    def _defaults_and_item_coercion(cls, data: Any) -> Any:
        if not isinstance(data, dict): return data
        t: str = cast(str, data.get("type") or "")
        if not (data.get("title") or "").strip():
            # A simple title default based on the type
            data["title"] = t.replace("_", " ").title()
        model = ITEMS_MAP.get(t)
        raw_items = data.get("items") or []
        if model and isinstance(raw_items, list):
            coerced = [model(**it).model_dump() if isinstance(it, dict) else it for it in raw_items]
            data["items"] = coerced
        return data

# ---------- Resume root ----------
class ResumeForm(BaseModel):
    fullName: str = ""
    title: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    profiles: List[ProfileLink] = Field(default_factory=list)
    summary: str = ""
    skills: List[str] = Field(default_factory=list)
    sections: List[Section] = Field(default_factory=list)
    model_config = ConfigDict(extra="allow")

# ---------- API contracts ----------
class Version(BaseModel):
    name: str
    content: Dict[str, Any]

class VersionCreate(Version):
    pass

class VersionInDB(Version):
    id: str = Field(...)

class HealthResponse(BaseModel):
    status: str = "ok"
    model_config = ConfigDict(extra="allow")

class RenderRequest(BaseModel):
    form: ResumeForm
    model_config = ConfigDict(extra="allow")

class JsonPatchOp(BaseModel):
    op: Literal["add", "remove", "replace", "move", "copy", "test"]
    path: str
    value: Optional[Any] = None
    from_: Optional[str] = Field(default=None, alias="from")
    model_config = ConfigDict(populate_by_name=True, extra="allow")

class PatchRequest(BaseModel):
    base: ResumeForm
    ops: List[JsonPatchOp] = Field(default_factory=list)
    render: Optional[Literal["none", "tex", "pdf", "both"]] = "none"
    model_config = ConfigDict(extra="allow")

class PatchResponse(BaseModel):
    updated: ResumeForm
    rendered_tex: Optional[str] = None
    rendered_pdf_b64: Optional[str] = None
    model_config = ConfigDict(extra="allow")