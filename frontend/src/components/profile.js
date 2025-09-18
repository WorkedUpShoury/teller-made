import React, { useState, useEffect, useRef } from "react";
// Link is not used in the provided code, so it can be removed or left for future use
// import { Link } from "react-router-dom";
import "./Login.css"; 
import '../styles/Profile.css';
import DefaultProfileIcon from '../styles/icons/profile.png';

// The EyeIcon component remains unchanged
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

// Progress Bar Component remains unchanged
const ProgressBar = ({ percentage }) => (
    <div className="progress-bar-container">
        <div className="progress-bar-info">
            <span className="progress-label">Profile Completion</span>
            <span className="progress-percentage">{percentage}%</span>
        </div>
        <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${percentage}%` }}></div>
        </div>
    </div>
);


export default function Profile() {
  // All state variables and hooks remain the same
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [profilePicUrl, setProfilePicUrl] = useState(""); 
  const [profilePicFile, setProfilePicFile] = useState(null); 
  const fileInputRef = useRef(null);
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [country, setCountry] = useState("");
  const [completionPercentage, setCompletionPercentage] = useState(0);

  const STATUSES = ["Student", "Working Professional", "Not Working"];

  // The two useEffect hooks for populating data and calculating progress remain unchanged
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser) {
        setUser(storedUser);
        setName(storedUser.full_name || "");
        setEmail(storedUser.email || "");
        setPhone(storedUser.phone || "");
        setDob(storedUser.dob ? storedUser.dob.split('T')[0] : "");
        setGender(storedUser.gender || "");
        setLinkedin(storedUser.linkedin || "");
        setPortfolio(storedUser.portfolio || "");
        setSkills(Array.isArray(storedUser.skills) ? storedUser.skills.join(", ") : storedUser.skills || "");
        const userStatus = storedUser.user_type === "not-working" ? "Not Working" : storedUser.user_type.charAt(0).toUpperCase() + storedUser.user_type.slice(1) || "";
        setStatus(userStatus);
        
        setProfilePicUrl(storedUser.profile_pic_url || DefaultProfileIcon);
        if (storedUser.address) {
            setAddressLine(storedUser.address.line || "");
            setCity(storedUser.address.city || "");
            setAddressState(storedUser.address.state || "");
            setZipCode(storedUser.address.zipCode || "");
            setCountry(storedUser.address.country || "");
        }
        
        if (userStatus === "Student") {
            setCollege(storedUser.college_name || "");
            setDegree(storedUser.degree || "");
            setMajor(storedUser.major || "");
            setGradYear(String(storedUser.grad_year || ""));
            setSemester(storedUser.semester || "");
            setGpa(storedUser.gpa || "");
        } else if (userStatus === "Working Professional") {
            setCompany(storedUser.institution_name || "");
            setTitle(storedUser.title || "");
            setIndustry(storedUser.industry || "");
            setYoe(String(storedUser.yoe || ""));
            setCurrent(storedUser.currently_employed ?? true);
            setNotice(storedUser.notice || "");
            setCtc(storedUser.ctc || "");
        } else if (userStatus === "Not Working") {
            setLastAffiliation(storedUser.last_affiliation || "");
            setHighestEdu(storedUser.highest_education || "");
            setTargetRole(storedUser.target_role || "");
            setAvailability(storedUser.availability || "");
            setPreferredLocation(storedUser.preferred_location || "");
        }
    }
  }, []);

  useEffect(() => {
    const calculateProgress = () => {
        const coreFields = [name, phone, city, country, status, skills];
        const hasProfilePic = profilePicUrl && profilePicUrl !== DefaultProfileIcon;
        
        let totalFields = coreFields.length + 1; // +1 for profile picture
        let filledFields = coreFields.filter(field => String(field).trim() !== "").length;
        if (hasProfilePic) {
            filledFields++;
        }

        if (status === "Student") {
            const studentFields = [college, degree, major, gradYear];
            totalFields += studentFields.length;
            filledFields += studentFields.filter(field => String(field).trim() !== "").length;
        } else if (status === "Working Professional") {
            const workingFields = [company, title, industry, yoe];
            totalFields += workingFields.length;
            filledFields += workingFields.filter(field => String(field).trim() !== "").length;
        } else if (status === "Not Working") {
            const notWorkingFields = [highestEdu, targetRole, availability];
            totalFields += notWorkingFields.length;
            filledFields += notWorkingFields.filter(field => String(field).trim() !== "").length;
        }
        
        const percentage = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
        setCompletionPercentage(percentage);
    };

    calculateProgress();
  }, [
    name, phone, city, country, status, skills, profilePicUrl, 
    college, degree, major, gradYear, 
    company, title, industry, yoe,
    highestEdu, targetRole, availability
  ]);
  
  // The handleProfilePicChange, validateStep, and handleSubmit functions remain unchanged
  const handleProfilePicChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfilePicFile(file);
      setProfilePicUrl(URL.createObjectURL(file));
    }
  };

  const validateStep = (n) => {
    const errs = {};
    if (n === 1) {
        if (!name.trim()) errs.name = "Please enter your full name.";
        if (!phone.trim()) errs.phone = "Please enter a phone number.";
    }
    if (n === 2) {
        if (!city.trim()) errs.city = "Please enter your city.";
        if (!country.trim()) errs.country = "Please enter your country.";
    }
    if (n === 3) {
        if (!status) errs.status = "Select your current status.";
        if (status === "Student") {
            if (!college.trim()) errs.college = "Please enter your college name.";
            if (!degree.trim()) errs.degree = "Please enter your degree.";
            if (!major.trim()) errs.major = "Please enter your major/branch.";
            if (!String(gradYear).trim()) errs.gradYear = "Please enter your graduation year.";
        }
        if (status === "Working Professional") {
            if (!company.trim()) errs.company = "Please enter your institution/company.";
            if (!title.trim()) errs.title = "Please enter your job title.";
            if (!industry.trim()) errs.industry = "Please enter your industry.";
            if (!String(yoe).trim()) errs.yoe = "Please enter years of experience.";
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
    
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
        setFormError("Please fill out all required fields in every step before submitting.");
        if (!validateStep(1)) setStep(1);
        else if (!validateStep(2)) setStep(2);
        else setStep(3);
        return;
    }
    
    try {
        setLoading(true);
        setFormError("");
        setFormSuccess("");
        
        const token = localStorage.getItem("token");
        if (!token) throw new Error("Authentication token not found.");
        
        const formData = new FormData();
        if (profilePicFile) {
            formData.append("profilePic", profilePicFile);
        }
        
        formData.append("fullName", name);
        formData.append("phone", phone);
        formData.append("dob", dob);
        formData.append("gender", gender);
        formData.append("linkedin", linkedin);
        formData.append("portfolio", portfolio);
        formData.append("skills", skills);
        formData.append("userType", status.toLowerCase().replace(" ", "-"));
        
        const address = { line: addressLine, city, state: addressState, zipCode, country };
        formData.append("address", JSON.stringify(address));

        if (status === "Student") {
            formData.append("collegeName", college);
            formData.append("degree", degree);
            formData.append("major", major);
            formData.append("gradYear", gradYear);
            formData.append("semester", semester);
            formData.append("gpa", gpa);
        } else if (status === "Working Professional") {
            formData.append("institutionName", company);
            formData.append("title", title);
            formData.append("industry", industry);
            formData.append("yoe", yoe);
            formData.append("current", current);
            formData.append("notice", notice);
            formData.append("ctc", ctc);
        } else if (status === "Not Working") {
            formData.append("lastAffiliation", lastAffiliation);
            formData.append("highestEdu", highestEdu);
            formData.append("targetRole", targetRole);
            formData.append("availability", availability);
            formData.append("preferredLocation", preferredLocation);
        }

        const res = await fetch("http://localhost:5001/api/me/profile", {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`
            },
            body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to update profile.");

        localStorage.setItem("user", JSON.stringify(data.user));
        setFormSuccess("Profile updated successfully! 🎉");
        setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
        console.error(err);
        setFormError(err?.message || "Failed to update your account. Try again.");
    } finally {
        setLoading(false);
    }
  };

  // The Stepper component and navigation functions remain unchanged
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
        
        <ProgressBar percentage={completionPercentage} />
        
        {formError && <div role="alert" className="auth-alert error-text">{formError}</div>}
        {formSuccess && <div role="alert" className="auth-alert success-text">{formSuccess}</div>}

        {/* *** MODIFIED: Profile picture section *** */}
        <div className="profile-pic-container">
            {/* This wrapper handles the click event for the hidden file input */}
            <div className="profile-pic-wrapper" onClick={() => fileInputRef.current.click()} title="Change profile picture">
                <img src={profilePicUrl} alt="Profile Preview" className="profile-pic-img" />
                <div className="profile-pic-edit-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </div>
            </div>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleProfilePicChange} 
                accept="image/png, image/jpeg" 
                style={{ display: 'none' }} 
            />
        </div>

        <form onSubmit={handleSubmit} className="auth-form compact-form" noValidate>
          {/* All form steps (step 1, 2, 3) remain unchanged... */}
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
              <h3 className="section-title">Address Information</h3>
              <div className="field">
                <label htmlFor="addressLine">Address Line (optional)</label>
                <input id="addressLine" type="text" placeholder="e.g., 123 Main St" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
              </div>
              <div className="field two-col">
                  <div>
                      <label htmlFor="city">City</label>
                      <input id="city" type="text" required placeholder="Enter city" value={city} onChange={(e) => setCity(e.target.value)} aria-invalid={!!fieldErrors.city} />
                      {fieldErrors.city && <p className="field-help error-text">{fieldErrors.city}</p>}
                  </div>
                  <div>
                      <label htmlFor="addressState">State / Province (optional)</label>
                      <input id="addressState" type="text" placeholder="Enter state" value={addressState} onChange={(e) => setAddressState(e.target.value)} />
                  </div>
              </div>
              <div className="field two-col">
                  <div>
                      <label htmlFor="zipCode">ZIP / Postal Code (optional)</label>
                      <input id="zipCode" type="text" placeholder="Enter postal code" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
                  </div>
                  <div>
                      <label htmlFor="country">Country</label>
                      <input id="country" type="text" required placeholder="Enter country" value={country} onChange={(e) => setCountry(e.target.value)} aria-invalid={!!fieldErrors.country} />
                      {fieldErrors.country && <p className="field-help error-text">{fieldErrors.country}</p>}
                  </div>
              </div>
              <hr className="divider"/>
              <h3 className="section-title">Additional Information</h3>
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
        /* --- NEW STYLES for Progress Bar --- */
        .progress-bar-container {
            margin-bottom: 1.5rem;
        }
        .progress-bar-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }
        .progress-label {
            font-size: 0.9rem;
            color: #4b5563; /* var(--text-secondary) */
            font-weight: 500;
        }
        .progress-percentage {
            font-size: 0.9rem;
            font-weight: 600;
            color: var(--accent, #6c5ce7);
        }
        .progress-bar-track {
            height: 8px;
            width: 100%;
            background-color: #e5e7eb; /* var(--surface-3) */
            border-radius: 4px;
            overflow: hidden;
        }
        .progress-bar-fill {
            height: 100%;
            background-color: var(--accent, #6c5ce7);
            border-radius: 4px;
            transition: width 0.4s ease-in-out;
        }
        
        /* --- MODIFIED & NEW STYLES for Profile Picture --- */
        .profile-pic-container {
            display: flex;
            justify-content: center; /* Center the wrapper */
            align-items: center;
            margin-top: 1rem;
        }
        .profile-pic-wrapper {
            position: relative;
            cursor: pointer;
            width: 100px; /* Must match image width */
            height: 100px; /* Must match image height */
        }
        .profile-pic-img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
            border: 3px solid var(--surface-3, #e5e7eb);
            display: block;
        }
        .profile-pic-edit-icon {
            position: absolute;
            bottom: 4px;
            right: 4px;
            background-color: var(--accent, #6c5ce7);
            color: #fff;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            transition: transform 0.2s ease-in-out;
        }
        .profile-pic-wrapper:hover .profile-pic-edit-icon {
            transform: scale(1.1);
        }
        
        /* --- OTHER EXISTING STYLES --- */
        .section-title {
            font-size: 1rem;
            font-weight: 500;
            margin-top: 1rem;
            color: #374151;
        }
        .divider {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 1.5rem 0;
        }
        .compact-root { padding-top: 2rem; }
        .compact-card { padding: 1.25rem 1.25rem 1rem; max-width: 760px; }
        .compact-form .field { margin-bottom: .75rem; }
        .compact-panel { padding: .75rem; }
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