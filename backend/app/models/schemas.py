from typing import List, Optional
from pydantic import BaseModel

class ResumeInfo(BaseModel):
    first_name: Optional[str]
    last_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    education_history: Optional[List[str]]
    work_experience_summary: Optional[str]
    skills: Optional[List[str]]
    current_position: Optional[str]
    years_of_experience: Optional[float]
