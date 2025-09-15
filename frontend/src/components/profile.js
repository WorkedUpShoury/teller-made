// src/Profile.js

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./Login.css"; 

const EyeIcon = ({ off = false }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {off ? (
      <>
        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.54-1.22 1.3-2.35 2.24-3.32" />
        <path d="M22.94 11c-.5-1.2-1.2-2.31-2.06-3.28C18.75 5.05 15.52 4 12 4c-.9 0-1.78.1-2.63.3" />
        <line x1="1" y1="1" x2="23" y2="23" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

export default function Profile() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [skills, setSkills] = useState("");
  const [status, setStatus] = useState("");
  const [college, setCollege] = useState("");
  const [degree, setDegree] = useState("");
  const [major, setMajor] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [semester, setSemester] = useState("");
  const [gpa, setGpa] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [yoe, setYoe] = useState("");
  const [current, setCurrent] = useState(true);
  const [notice, setNotice] = useState("");
  const [ctc, setCtc] = useState("");
  const [lastAffiliation, setLastAffiliation] = useState("");
  const [highestEdu, setHighestEdu] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [availability, setAvailability] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const STATUSES = ["Student", "Working Professional", "Not Working"];

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser) {
      setUser(storedUser);
      setName(storedUser.full_name || "");
      setEmail(storedUser.email || "");
      setPhone(storedUser.phone || "");
      setLocation(storedUser.location || "");
      setDob(storedUser.dob ? storedUser.dob.split('T')[0] : "");
      setGender(storedUser.gender || "");
      setLinkedin(storedUser.linkedin || "");
      setPortfolio(storedUser.portfolio || "");
      setSkills(Array.isArray(storedUser.skills) ? storedUser.skills.join(", ") : storedUser.skills || "");
      setStatus(storedUser.user_type === "not-working" ? "Not Working" : storedUser.user_type.charAt(0).toUpperCase() + storedUser.user_type.slice(1) || "");
      
      if (storedUser.user_type === "student") {
        setCollege(storedUser.college_name || "");
        setDegree(storedUser.degree || "");
        setMajor(storedUser.major || "");
        setGradYear(String(storedUser.grad_year || "")); // FIX: Convert number to string
        setSemester(storedUser.semester || "");
        setGpa(storedUser.gpa || "");
      } else if (storedUser.user_type === "working") {
        setCompany(storedUser.institution_name || "");
        setTitle(storedUser.title || "");
        setIndustry(storedUser.industry || "");
        setYoe(String(storedUser.yoe || "")); // FIX: Convert number to string
        setCurrent(storedUser.currently_employed ?? true);
        setNotice(storedUser.notice || "");
        setCtc(storedUser.ctc || "");
      } else if (storedUser.user_type === "not-working") {
        setLastAffiliation(storedUser.last_affiliation || "");
        setHighestEdu(storedUser.highest_education || "");
        setTargetRole(storedUser.target_role || "");
        setAvailability(storedUser.availability || "");
        setPreferredLocation(storedUser.preferred_location || "");
      }
    }
  }, []);

  const validateStep = (n) => {
    const errs = {};
    if (n === 1) {
      if (!name.trim()) errs.name = "Please enter your full name.";
      if (!phone.trim()) errs.phone = "Please enter a phone number.";
    }
    if (n === 2) {
      if (!location.trim()) errs.location = "Please enter your city and country.";
    }
    if (n === 3) {
      if (!status) errs.status = "Select your current status.";
      if (status === "Student") {
        if (!college.trim()) errs.college = "Please enter your college name.";
        if (!degree.trim()) errs.degree = "Please enter your degree.";
        if (!major.trim()) errs.major = "Please enter your major/branch.";
        if (!String(gradYear).trim()) errs.gradYear = "Please enter your graduation year."; // FIX: Ensure gradYear is a string
      }
      if (status === "Working Professional") {
        if (!company.trim()) errs.company = "Please enter your institution/company.";
        if (!title.trim()) errs.title = "Please enter your job title.";
        if (!industry.trim()) errs.industry = "Please enter your industry.";
        if (!String(yoe).trim()) errs.yoe = "Please enter years of experience."; // FIX: Ensure yoe is a string
      }
      if (status === "Not Working") {
        if (!highestEdu.trim()) errs.highestEdu = "Please enter your highest education.";
        if (!targetRole.trim()) errs.targetRole = "Please enter your target role.";
        if (!availability.trim()) errs.availability = "Please enter your availability.";
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    
    if (!validateStep(1)) {
        setFormError("Please fill out all required fields on Step 1.");
        setStep(1); 
        return;
    }
    if (!validateStep(2)) {
        setFormError("Please fill out all required fields on Step 2.");
        setStep(2); 
        return;
    }
    if (!validateStep(3)) {
        setFormError("Please fill out all required fields on Step 3.");
        setStep(3); 
        return;
    }
    
    try {
      setLoading(true);
      setFormError("");
      setFormSuccess("");
      
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication token not found.");

      const payload = {
        fullName: name,
        phone: phone,
        location: location,
        dob: dob,
        gender: gender,
        linkedin: linkedin,
        portfolio: portfolio,
        skills: skills,
        userType: status.toLowerCase().replace(" ", "-"),
      };
      
      if (status === "Student") {
        payload.collegeName = college;
        payload.degree = degree;
        payload.major = major;
        payload.gradYear = gradYear;
        payload.semester = semester;
        payload.gpa = gpa;
      } else if (status === "Working Professional") {
        payload.institutionName = company;
        payload.title = title;
        payload.industry = industry;
        payload.yoe = yoe;
        payload.current = current;
        payload.notice = notice;
        payload.ctc = ctc;
      } else if (status === "Not Working") {
        payload.lastAffiliation = lastAffiliation;
        payload.highestEdu = highestEdu;
        payload.targetRole = targetRole;
        payload.availability = availability;
        payload.preferredLocation = preferredLocation;
      }

      const res = await fetch("http://localhost:5001/api/me/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update profile.");

      localStorage.setItem("user", JSON.stringify(data.user));
      setFormSuccess("Profile updated successfully! 🎉");
      window.location.reload();
    } catch (err) {
      console.error(err);
      setFormError(err?.message || "Failed to update your account. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const Stepper = () => (
    <ol className="stepper compact" aria-label="Registration steps">
      {[{ id: 1, label: "Account" }, { id: 2, label: "About you" }, { id: 3, label: "Status & details" }].map(({ id, label }) => (
        <li key={id} className={`step ${step === id ? "active" : step > id ? "done" : ""}`}>
          <span className="step-index" aria-hidden>{id}</span>
          <span className="step-label">{label}</span>
        </li>
      ))}
    </ol>
  );

  const next = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(3, s + 1));
    }
  };
  
  const back = () => setStep((s) => Math.max(1, s - 1));

  return (
    <div className="auth-root register-neo">
      <div className="auth-card compact-card" aria-busy={loading}>
        <header className="auth-head">
          <span className="auth-badge" aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 14a5 5 0 1 0-6 0" />
              <circle cx="12" cy="7" r="3" />
            </svg>
          </span>
          <div>
            <h1 className="auth-title">Edit Your Profile</h1>
            <p className="auth-subtitle">Update your personal details and career status</p>
          </div>
        </header>
        
        {formError && <div role="alert" className="auth-alert error-text">{formError}</div>}
        {formSuccess && <div role="alert" className="auth-alert success-text">{formSuccess}</div>}

        <Stepper />

        <form onSubmit={handleSubmit} className="auth-form compact-form" noValidate>
          {step === 1 && (
            <section>
              <div className="field">
                <label htmlFor="name">Full name</label>
                <input id="name" type="text" required placeholder="Enter full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!fieldErrors.name} />
                {fieldErrors.name && <p className="field-help error-text">{fieldErrors.name}</p>}
              </div>

              <div className="field">
                <label htmlFor="email">Email address</label>
                <input id="email" type="email" required placeholder="Email address" value={email} disabled />
                <p className="field-help">Your email cannot be changed.</p>
              </div>

              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input id="phone" type="tel" required placeholder="Enter phone number" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" aria-invalid={!!fieldErrors.phone} />
                {fieldErrors.phone && <p className="field-help error-text">{fieldErrors.phone}</p>}
              </div>
              
              <div className="nav-actions">
                <button type="button" className="btn btn-primary" onClick={next}>Continue</button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <div className="field">
                <label htmlFor="location">Location</label>
                <input id="location" type="text" required placeholder="Enter city, country" value={location} onChange={(e) => setLocation(e.target.value)} aria-invalid={!!fieldErrors.location} />
                {fieldErrors.location && <p className="field-help error-text">{fieldErrors.location}</p>}
              </div>

              <div className="field two-col">
                <div>
                  <label htmlFor="dob">Date of birth (optional)</label>
                  <input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="gender">Gender (optional)</label>
                  <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Prefer not to say</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="field two-col">
                <div>
                  <label htmlFor="linkedin">LinkedIn (optional)</label>
                  <input id="linkedin" type="url" placeholder="Enter LinkedIn URL" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="portfolio">Portfolio / Website (optional)</label>
                  <input id="portfolio" type="url" placeholder="Enter website URL" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} />
                </div>
              </div>

              <div className="field">
                <label htmlFor="skills">Key skills (comma-separated)</label>
                <input id="skills" type="text" placeholder="e.g., React, SQL" value={skills} onChange={(e) => setSkills(e.target.value)} />
              </div>

              <div className="nav-actions">
                <button type="button" className="btn btn-secondary" onClick={back}>Back</button>
                <button type="button" className="btn btn-primary" onClick={next}>Continue</button>
              </div>
            </section>
          )}
          
          {step === 3 && (
            <section>
              <div className="field">
                <label htmlFor="status">Current status</label>
                <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} aria-invalid={!!fieldErrors.status}>
                  <option value="">Select…</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {fieldErrors.status && <p className="field-help error-text">{fieldErrors.status}</p>}
              </div>

              {status === "Student" && (
                <div className="panel compact-panel">
                  <h3 className="panel-title">Student details</h3>
                  <div className="field">
                    <label htmlFor="college">College / University</label>
                    <input id="college" type="text" required placeholder="Enter college/university" value={college} onChange={(e) => setCollege(e.target.value)} aria-invalid={!!fieldErrors.college} />
                    {fieldErrors.college && <p className="field-help error-text">{fieldErrors.college}</p>}
                  </div>
                  <div className="field two-col">
                    <div>
                      <label htmlFor="degree">Degree</label>
                      <input id="degree" type="text" required placeholder="Enter degree" value={degree} onChange={(e) => setDegree(e.target.value)} aria-invalid={!!fieldErrors.degree} />
                      {fieldErrors.degree && <p className="field-help error-text">{fieldErrors.degree}</p>}
                    </div>
                    <div>
                      <label htmlFor="major">Major / Branch</label>
                      <input id="major" type="text" required placeholder="Enter major/branch" value={major} onChange={(e) => setMajor(e.target.value)} aria-invalid={!!fieldErrors.major} />
                      {fieldErrors.major && <p className="field-help error-text">{fieldErrors.major}</p>}
                    </div>
                  </div>
                  <div className="field two-col">
                    <div>
                      <label htmlFor="gradYear">Graduation year</label>
                      <input id="gradYear" type="number" inputMode="numeric" placeholder="Enter graduation year" value={gradYear} onChange={(e) => setGradYear(e.target.value)} aria-invalid={!!fieldErrors.gradYear} />
                      {fieldErrors.gradYear && <p className="field-help error-text">{fieldErrors.gradYear}</p>}
                    </div>
                    <div>
                      <label htmlFor="semester">Current year/semester (optional)</label>
                      <input id="semester" type="text" placeholder="Enter current year/semester" value={semester} onChange={(e) => setSemester(e.target.value)} />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="gpa">GPA (optional)</label>
                    <input id="gpa" type="text" placeholder="Enter GPA (e.g., 8.2/10)" value={gpa} onChange={(e) => setGpa(e.target.value)} />
                  </div>
                </div>
              )}

              {status === "Working Professional" && (
                <div className="panel compact-panel">
                  <h3 className="panel-title">Work details</h3>
                  <div className="field">
                    <label htmlFor="company">Institution / Company</label>
                    <input id="company" type="text" required placeholder="Enter institution/company" value={company} onChange={(e) => setCompany(e.target.value)} aria-invalid={!!fieldErrors.company} />
                    {fieldErrors.company && <p className="field-help error-text">{fieldErrors.company}</p>}
                  </div>
                  <div className="field two-col">
                    <div>
                      <label htmlFor="title">Job title</label>
                      <input id="title" type="text" required placeholder="Enter job title" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!fieldErrors.title} />
                      {fieldErrors.title && <p className="field-help error-text">{fieldErrors.title}</p>}
                    </div>
                    <div>
                      <label htmlFor="industry">Industry</label>
                      <input id="industry" type="text" required placeholder="Enter industry" value={industry} onChange={(e) => setIndustry(e.target.value)} aria-invalid={!!fieldErrors.industry} />
                      {fieldErrors.industry && <p className="field-help error-text">{fieldErrors.industry}</p>}
                    </div>
                  </div>
                  <div className="field two-col">
                    <div>
                      <label htmlFor="yoe">Years of experience</label>
                      <input id="yoe" type="number" inputMode="decimal" placeholder="Enter years of experience" value={yoe} onChange={(e) => setYoe(e.target.value)} aria-invalid={!!fieldErrors.yoe} />
                      {fieldErrors.yoe && <p className="field-help error-text">{fieldErrors.yoe}</p>}
                    </div>
                    <div>
                      <label htmlFor="notice">Notice period (optional)</label>
                      <input id="notice" type="text" placeholder="Enter notice period" value={notice} onChange={(e) => setNotice(e.target.value)} />
                    </div>
                  </div>
                  <div className="field two-col">
                    <div>
                      <label htmlFor="ctc">Current CTC (optional)</label>
                      <input id="ctc" type="text" placeholder="Enter current CTC" value={ctc} onChange={(e) => setCtc(e.target.value)} />
                    </div>
                    <div className="remember">
                      <input id="current" type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} />
                      <label htmlFor="current">Currently employed</label>
                    </div>
                  </div>
                </div>
              )}

              {status === "Not Working" && (
                <div className="panel compact-panel">
                  <h3 className="panel-title">Seeking opportunities</h3>
                  <div className="field">
                    <label htmlFor="highestEdu">Highest education</label>
                    <input id="highestEdu" type="text" required placeholder="Enter highest education" value={highestEdu} onChange={(e) => setHighestEdu(e.target.value)} aria-invalid={!!fieldErrors.highestEdu} />
                    {fieldErrors.highestEdu && <p className="field-help error-text">{fieldErrors.highestEdu}</p>}
                  </div>
                  <div className="field two-col">
                    <div>
                      <label htmlFor="lastAffiliation">Last company/college (optional)</label>
                      <input id="lastAffiliation" type="text" placeholder="Enter last affiliation" value={lastAffiliation} onChange={(e) => setLastAffiliation(e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="targetRole">Target role</label>
                      <input id="targetRole" type="text" required placeholder="Enter target role" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} aria-invalid={!!fieldErrors.targetRole} />
                      {fieldErrors.targetRole && <p className="field-help error-text">{fieldErrors.targetRole}</p>}
                    </div>
                  </div>
                  <div className="field two-col">
                    <div>
                      <label htmlFor="availability">Availability</label>
                      <input id="availability" type="text" required placeholder="Enter availability" value={availability} onChange={(e) => setAvailability(e.target.value)} aria-invalid={!!fieldErrors.availability} />
                      {fieldErrors.availability && <p className="field-help error-text">{fieldErrors.availability}</p>}
                    </div>
                    <div>
                      <label htmlFor="preferredLocation">Preferred location (optional)</label>
                      <input id="preferredLocation" type="text" placeholder="Enter preferred location" value={preferredLocation} onChange={(e) => setPreferredLocation(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
              
              <div className="nav-actions">
                <button type="button" className="btn btn-secondary" onClick={back}>Back</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <span className="spinner" aria-hidden /> : null}
                  {loading ? "Updating..." : "Update Profile"}
                </button>
              </div>
            </section>
          )}
        </form>
      </div>

      <style>{`
        .compact-root { padding-top: 2rem; }
        .compact-card { padding: 1.25rem 1.25rem 1rem; max-width: 760px; }
        .compact-form .field { margin-bottom: .75rem; }
        .compact-panel { padding: .6rem; }
        .compact-review { columns: 2; column-gap: 1.25rem; }
        @media (max-width: 720px) { .compact-review { columns: 1; } }

        .stepper.compact { margin: .25rem 0 .75rem; gap: .5rem; }
        .stepper.compact .step-label { font-size: .8rem; }

        .input-wrap { position: relative; }
        .icon-btn { position: absolute; right: .5rem; top: 50%; transform: translateY(-50%); border: none; background: transparent; padding: .25rem; display:grid; place-items:center; cursor: pointer; color: #6b7280; }
        .icon-btn:hover { color: #4b5563; }
        .icon-btn:focus-visible { outline: 2px solid var(--accent, #6c5ce7); outline-offset: 2px; border-radius: .5rem; }

        .btn { transition: background .15s, color .15s, border-color .15s; }
        .btn.btn-primary { background: var(--accent, #6c5ce7); color: #fff; border: 1px solid transparent; }
        .btn.btn-primary:hover { filter: brightness(.95); }
        .btn.btn-primary:active { filter: brightness(.9); color:#fff; }
        .btn.btn-secondary { background: transparent; color: #111827; border: 1px solid var(--surface-4, #d1d5db); }
        .btn.btn-secondary:hover { background: var(--surface-2, #f3f4f6); }
        .btn.btn-secondary:active { background: var(--surface-3, #e5e7eb); color: #111827; }
        .btn:disabled { opacity: .6; cursor: not-allowed; }

        input, select { height: 42px; }
        .field input::placeholder { color: #9ca3af; }
        .auth-alert.success-text { color: #155724; background-color: #d4edda; border-color: #c3e6cb; padding: .75rem; border-radius: .25rem; }
        .auth-alert.error-text { color: #721c24; background-color: #f8d7da; border-color: #f5c6cb; padding: .75rem; border-radius: .25rem; }
      `}</style>
    </div>
  );
}