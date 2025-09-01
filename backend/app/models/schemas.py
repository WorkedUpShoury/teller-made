from pydantic import BaseModel, EmailStr
from typing import List, Optional

class EducationItem(BaseModel):
    institution: str
    degree: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    gpa: Optional[str] = None
    relevant_courses: Optional[List[str]] = None
    details: Optional[List[str]] = None

class ExperienceItem(BaseModel):
    company: str
    role: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    bullets: Optional[List[str]] = None
    technologies: Optional[List[str]] = None

class ProjectItem(BaseModel):
    name: str
    tech_stack: Optional[List[str]] = None
    link: Optional[str] = None
    bullets: Optional[List[str]] = None

class CertificationItem(BaseModel):
    name: str
    issuer: Optional[str] = None
    date: Optional[str] = None
    link: Optional[str] = None
    description: Optional[str] = None

class ResumeInfo(BaseModel):
    # header
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    city: Optional[str] = None
    region: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    website: Optional[str] = None

    # summary / objective (optional)
    summary: Optional[str] = None

    # sections
    education: Optional[List[EducationItem]] = None
    experience: Optional[List[ExperienceItem]] = None
    projects: Optional[List[ProjectItem]] = None
    skills_programming: Optional[List[str]] = None
    skills_tools: Optional[List[str]] = None
    skills_databases: Optional[List[str]] = None
    skills_concepts: Optional[List[str]] = None

    certifications: Optional[List[CertificationItem]] = None
