# app/models.py
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Type, cast

from pydantic import BaseModel, Field, ConfigDict, model_validator


# ---------- Primitives ----------
class ProfileLink(BaseModel):
    label: Optional[str] = ""
    url: Optional[str] = None  # keep free-form strings

# Accepts 'YYYY-MM' OR free text; normalization can happen elsewhere
MonthStr = str


# ---------- Item types aligned to SmartResumeEditor SECTION_TEMPLATES ----------
class ItemBase(BaseModel):
    # Open container to allow future keys without breaking
    model_config = ConfigDict(extra="allow")


# Experience / Volunteer share timebox + bullets
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

# Give ITEMS_MAP a precise type to satisfy .get(...) typing
ITEMS_MAP: Dict[str, Type[BaseModel]] = {
    "experience": ExperienceItem,
    "projects": ProjectItem,
    "education": EducationItem,
    "certifications": CertificationItem,
    "awards": AwardItem,
    "publications": PublicationItem,
    "volunteer": VolunteerItem,
    "courses": CourseItem,
    "languages": LanguageItem,
    "interests": InterestItem,
    "references": ReferenceItem,
    "achievements": AchievementItem,
    "patents": PatentItem,
    "talks": TalkItem,
    "custom": CustomItem,
    "skillsets": SkillsetsItem,
}


class Section(BaseModel):
    id: Optional[str] = None
    type: SectionType
    title: Optional[str] = None
    items: List[Dict[str, Any]] = Field(default_factory=list)  # validated/coerced below

    model_config = ConfigDict(extra="allow")

    @model_validator(mode="before")
    @classmethod
    def _defaults_and_item_coercion(cls, data: Any) -> Any:
        """
        v2-style pre-processing:
        - If title is missing/blank, set a sensible default based on type.
        - Coerce items into the concrete Pydantic models defined in ITEMS_MAP, then dump to dicts.
        """
        if not isinstance(data, dict):
            return data

        # Ensure we use str for keys and defaults with .get(...)
        t: str = cast(str, data.get("type") or "")
        title_current = cast(str, (data.get("title") or "").strip())

        if not title_current:
            data["title"] = {
                "experience": "Experience",
                "projects": "Projects",
                "education": "Education",
                "certifications": "Certifications",
                "awards": "Awards",
                "publications": "Publications",
                "volunteer": "Volunteer",
                "courses": "Courses",
                "languages": "Languages",
                "interests": "Interests",
                "references": "References",
                "achievements": "Achievements",
                "patents": "Patents",
                "talks": "Talks",
                "custom": "Custom (freeform)",
                "skillsets": "Skills (by category)",
            }.get(t, t)

        model = ITEMS_MAP.get(t)
        raw_items = data.get("items") or []
        if model and isinstance(raw_items, list):
            coerced: List[Dict[str, Any]] = []
            for it in raw_items:
                if isinstance(it, dict):
                    coerced.append(model(**it).model_dump())
                else:
                    coerced.append(it)  # keep as-is if not a dict
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
    skills: List[str] = Field(default_factory=list)  # legacy flat skills
    sections: List[Section] = Field(default_factory=list)

    model_config = ConfigDict(extra="allow")  # tolerate unknown keys from older clients


# ---------- Patch API contracts ----------
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


class RenderRequest(BaseModel):
    form: ResumeForm

    model_config = ConfigDict(extra="allow")


class HealthResponse(BaseModel):
    status: str = "ok"

    model_config = ConfigDict(extra="allow")
