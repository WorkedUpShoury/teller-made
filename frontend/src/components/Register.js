import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css"; // Reuse shared styles

// simple eye / eye-off icon
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

export default function Register() {
  const navigate = useNavigate();

  // --- Step control ---
  const [step, setStep] = useState(1); // 1=Account, 2=AboutYou, 3=Status, 4=Review

  // --- Shared form state ---
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const [location, setLocation] = useState(""); // City, Country
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState(""); // optional
  const [linkedin, setLinkedin] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [skills, setSkills] = useState(""); // comma or space separated

  // --- Status branching ---
  const STATUSES = ["Student", "Working Professional", "Not Working"];
  const [status, setStatus] = useState("");

  // Student fields
  const [college, setCollege] = useState("");
  const [degree, setDegree] = useState(""); // e.g., B.Tech / B.Sc / M.Tech
  const [major, setMajor] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [semester, setSemester] = useState("");
  const [gpa, setGpa] = useState("");

  // Working professional fields
  const [company, setCompany] = useState(""); // institution/organization
  const [title, setTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [yoe, setYoe] = useState(""); // years of experience
  const [current, setCurrent] = useState(true); // currently employed
  const [notice, setNotice] = useState(""); // notice period
  const [ctc, setCtc] = useState(""); // optional salary/current CTC

  // Not working fields
  const [lastAffiliation, setLastAffiliation] = useState(""); // last company/college
  const [highestEdu, setHighestEdu] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [availability, setAvailability] = useState(""); // e.g., Immediate / date
  const [preferredLocation, setPreferredLocation] = useState("");

  // Resume upload (store as File; API can accept FormData)
  const [resumeFile, setResumeFile] = useState(null);

  // --- UI/Network ---
  const [accept, setAccept] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // --- Derived ---
  const emailValid = useMemo(() => /[^\s@]+@[^\s@]+\.[^\s@]+/.test(email), [email]);
  const pwScore = useMemo(() => {
    const checks = [
      password.length >= 8,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /\d/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ];
    return checks.filter(Boolean).length; // 0..5
  }, [password]);
  const passwordsMatch = password && confirm && password === confirm;

  const canNextFromAccount = name.trim() && emailValid && pwScore >= 4 && passwordsMatch;
  const canNextFromAbout = phone.trim() && location.trim();
  const canSubmit = accept && status !== "";

  // --- Validation helpers ---
  const validateStep = (n) => {
    const errs = {};
    if (n === 1) {
      if (!name.trim()) errs.name = "Please enter your full name.";
      if (!emailValid) errs.email = "Please enter a valid email.";
      if (pwScore < 4) errs.password = "Use 8+ chars with upper/lower/number/symbol.";
      if (!passwordsMatch) errs.confirm = "Passwords don’t match.";
    }
    if (n === 2) {
      if (!phone.trim()) errs.phone = "Please enter a phone number.";
      if (!location.trim()) errs.location = "Please enter your city and country.";
    }
    if (n === 3) {
      if (!status) errs.status = "Select your current status.";
      if (status === "Student") {
        if (!college.trim()) errs.college = "Please enter your college name.";
        if (!degree.trim()) errs.degree = "Please enter your degree.";
        if (!major.trim()) errs.major = "Please enter your major/branch.";
        if (!gradYear.trim()) errs.gradYear = "Please enter your graduation year.";
      }
      if (status === "Working Professional") {
        if (!company.trim()) errs.company = "Please enter your institution/company.";
        if (!title.trim()) errs.title = "Please enter your job title.";
        if (!industry.trim()) errs.industry = "Please enter your industry.";
        if (!yoe.trim()) errs.yoe = "Please enter years of experience.";
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

  // --- Submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!validateStep(3) || !canSubmit) return;

    try {
      setLoading(true);
      setFormError("");

      // Use FormData so resume file can be uploaded when backend supports it
      const form = new FormData();
      form.append("name", name.trim());
      form.append("email", email.trim());
      form.append("phone", phone.trim());
      form.append("password", password);
      form.append("location", location.trim());
      form.append("dob", dob);
      form.append("gender", gender);
      form.append("linkedin", linkedin.trim());
      form.append("portfolio", portfolio.trim());
      form.append("skills", skills.trim());
      form.append("status", status);

      if (status === "Student") {
        form.append("college", college.trim());
        form.append("degree", degree.trim());
        form.append("major", major.trim());
        form.append("gradYear", gradYear.trim());
        form.append("semester", semester.trim());
        form.append("gpa", gpa.trim());
      } else if (status === "Working Professional") {
        form.append("company", company.trim());
        form.append("title", title.trim());
        form.append("industry", industry.trim());
        form.append("yoe", yoe.trim());
        form.append("current", String(current));
        form.append("notice", notice.trim());
        form.append("ctc", ctc.trim());
      } else if (status === "Not Working") {
        form.append("lastAffiliation", lastAffiliation.trim());
        form.append("highestEdu", highestEdu.trim());
        form.append("targetRole", targetRole.trim());
        form.append("availability", availability.trim());
        form.append("preferredLocation", preferredLocation.trim());
      }

      if (resumeFile) form.append("resume", resumeFile);

      const res = await fetch("http://localhost:5001/api/register", {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Registration failed");

      if (data?.token) localStorage.setItem("token", data.token);
      if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));

      navigate("/login");
    } catch (err) {
      console.error(err);
      setFormError(err?.message || "Failed to create your account. Try again.");
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  // --- UI helpers ---
  const strengthLabel = ["Very weak", "Weak", "Okay", "Good", "Strong", "Very strong"][pwScore] || "";
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


  const Stepper = () => (
    <ol className="stepper compact" aria-label="Registration steps">
      {[{ id: 1, label: "Account" }, { id: 2, label: "About you" }, { id: 3, label: "Status & details" }, { id: 4, label: "Review" }].map(({ id, label }) => (
        <li key={id} className={`step ${step === id ? "active" : step > id ? "done" : ""}`}>
          <span className="step-index" aria-hidden>{id}</span>
          <span className="step-label">{label}</span>
        </li>
      ))}
    </ol>
  );

  const next = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(4, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  return (
    <div className="auth-root register-neo">
      <div className="auth-card compact-card" aria-busy={loading}>
        <header className="auth-head">
          <span className="auth-badge" aria-hidden>
            {/* user-plus */}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 14a5 5 0 1 0-6 0" />
              <circle cx="12" cy="7" r="3" />
              <path d="M19 8v6M16 11h6" />
            </svg>
          </span>
          <div>
            <h1 className="auth-title">Create your TellerMade account</h1>
            <p className="auth-subtitle">We’ll tailor fields to your current status</p>
          </div>
        </header>

        {formError ? <div role="alert" className="auth-alert">{formError}</div> : null}

        <Stepper />

        <form onSubmit={handleSubmit} className="auth-form compact-form" noValidate>
          {/* STEP 1: Account */}
          {step === 1 && (
            <section>
              <div className="field">
                <label htmlFor="name">Full name</label>
                <input id="name" type="text" required placeholder="Enter full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!fieldErrors.name} />
                {fieldErrors.name && <p className="field-help error-text">{fieldErrors.name}</p>}
              </div>

              <div className="field">
                <label htmlFor="email">Email address</label>
                <input id="email" type="email" required placeholder="Enter email address" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!fieldErrors.email} />
                {fieldErrors.email && <p className="field-help error-text">{fieldErrors.email}</p>}
              </div>

              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input id="phone" type="tel" required placeholder="Enter phone number" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" aria-invalid={!!fieldErrors.phone} />
                {fieldErrors.phone && <p className="field-help error-text">{fieldErrors.phone}</p>}
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>
                <div className="input-wrap">
                  <input id="password" type={showPw ? "text" : "password"} required placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" aria-invalid={!!fieldErrors.password} aria-describedby="pw-help" />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw(s => !s)} aria-label={showPw ? "Hide password" : "Show password"}>
                    <EyeIcon off={showPw} />
                  </button>

                </div>
                <div className={`pw-strength score-${pwScore}`} aria-live="polite">
                  <div className="pw-strength-bar" data-active={pwScore >= 1} />
                  <div className="pw-strength-bar" data-active={pwScore >= 2} />
                  <div className="pw-strength-bar" data-active={pwScore >= 3} />
                  <div className="pw-strength-bar" data-active={pwScore >= 4} />
                  <div className="pw-strength-bar" data-active={pwScore >= 5} />
                  <span className="pw-strength-label">{password ? strengthLabel : ""}</span>
                </div>
                <p id="pw-help" className="field-help">Use at least 8 characters including upper/lowercase, a number and a symbol.</p>
                {fieldErrors.password && <p className="field-help error-text">{fieldErrors.password}</p>}
              </div>

              <div className="field">
                <label htmlFor="confirm">Confirm password</label>
                <div className="input-wrap">
                  <input id="confirm" type={showPw2 ? "text" : "password"} required placeholder="Re-enter password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" aria-invalid={!!fieldErrors.confirm} />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw2(s => !s)} aria-label={showPw2 ? "Hide password" : "Show password"}>
                    <EyeIcon off={showPw2} />
                  </button>
                </div>
                {fieldErrors.confirm && <p className="field-help error-text">{fieldErrors.confirm}</p>}
              </div>

              <div className="nav-actions">
                <button type="button" className="btn btn-primary" onClick={next} disabled={!canNextFromAccount}>Continue</button>
              </div>
            </section>
          )}

          {/* STEP 2: About you */}
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
                <input id="skills" type="text" placeholder="Enter key skills (e.g., React, SQL)" value={skills} onChange={(e) => setSkills(e.target.value)} />
              </div>

              <div className="nav-actions">
                <button type="button" className="btn btn-secondary" onClick={back}>Back</button>
                <button type="button" className="btn btn-primary" onClick={next} disabled={!canNextFromAbout}>Continue</button>
              </div>
            </section>
          )}

          {/* STEP 3: Status & details */}
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

              <div className="field">
                <label htmlFor="resume">Upload resume (PDF/DOC, optional)</label>
                <input id="resume" type="file" accept=".pdf,.doc,.docx" onChange={(e) => setResumeFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
              </div>

              <div className="form-meta">
                <div className="remember">
                  <input id="accept" type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
                  <label htmlFor="accept">
                    I agree to the <Link to="/terms" className="link">Terms</Link> and <Link to="/privacy" className="link">Privacy Policy</Link>
                  </label>
                </div>
                <span className="spacer" />
                <Link to="/login" className="link">Already have an account?</Link>
              </div>

              <div className="nav-actions">
                <button type="button" className="btn btn-secondary" onClick={back}>Back</button>
                <button type="button" className="btn btn-primary" onClick={() => setStep(4)} disabled={!canSubmit}>Review</button>
              </div>
            </section>
          )}

          {/* STEP 4: Review & submit */}
          {step === 4 && (
            <section className="panel compact-panel">
              <h3 className="panel-title">Review your details</h3>
              <ul className="review-list compact-review">
                <li><strong>Name:</strong> {name}</li>
                <li><strong>Email:</strong> {email}</li>
                <li><strong>Phone:</strong> {phone}</li>
                <li><strong>Location:</strong> {location}</li>
                {dob && <li><strong>DOB:</strong> {dob}</li>}
                {gender && <li><strong>Gender:</strong> {gender}</li>}
                {linkedin && <li><strong>LinkedIn:</strong> {linkedin}</li>}
                {portfolio && <li><strong>Portfolio:</strong> {portfolio}</li>}
                {skills && <li><strong>Skills:</strong> {skills}</li>}
                <li><strong>Status:</strong> {status}</li>
                {status === "Student" && (
                  <>
                    <li><strong>College:</strong> {college}</li>
                    <li><strong>Degree:</strong> {degree}</li>
                    <li><strong>Major:</strong> {major}</li>
                    <li><strong>Graduation:</strong> {gradYear}</li>
                    {semester && <li><strong>Sem/Year:</strong> {semester}</li>}
                    {gpa && <li><strong>GPA:</strong> {gpa}</li>}
                  </>
                )}
                {status === "Working Professional" && (
                  <>
                    <li><strong>Institution/Company:</strong> {company}</li>
                    <li><strong>Title:</strong> {title}</li>
                    <li><strong>Industry:</strong> {industry}</li>
                    <li><strong>Experience:</strong> {yoe} years</li>
                    <li><strong>Currently employed:</strong> {current ? "Yes" : "No"}</li>
                    {notice && <li><strong>Notice:</strong> {notice}</li>}
                    {ctc && <li><strong>CTC:</strong> {ctc}</li>}
                  </>
                )}
                {status === "Not Working" && (
                  <>
                    <li><strong>Highest education:</strong> {highestEdu}</li>
                    {lastAffiliation && <li><strong>Last affiliation:</strong> {lastAffiliation}</li>}
                    <li><strong>Target role:</strong> {targetRole}</li>
                    <li><strong>Availability:</strong> {availability}</li>
                    {preferredLocation && <li><strong>Preferred location:</strong> {preferredLocation}</li>}
                  </>
                )}
                {resumeFile && <li><strong>Resume:</strong> {resumeFile.name}</li>}
              </ul>

              <div className="nav-actions">
                <button type="button" className="btn btn-secondary" onClick={back}>Back</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <span className="spinner" aria-hidden /> : null}
                  {loading ? "Creating account…" : "Create account"}
                </button>
              </div>
            </section>
          )}
        </form>

        <p className="auth-foot">Already registered? <Link to="/login" className="link-strong">Sign in</Link></p>
      </div>

      {/* Compact tweaks and consistent button/icon styles */}
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

        /* Inputs compact */
        input, select { height: 42px; }
        .field input::placeholder { color: #9ca3af; }
      `}</style>
    </div>
  );
}
