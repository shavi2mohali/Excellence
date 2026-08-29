import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { organisationRoleOptions } from "../constants/organisationRoles";
import { punjabDistricts } from "../constants/punjabDistricts";
import { architectureZones, type ArchitectureZone } from "../constants/architectureZones";
import { registerPendingUser } from "../services/registrationService";
import type { OrganisationRole } from "../types";

const initialStepOne = {
  organisationRole: "" as OrganisationRole | "",
  districtId: "",
  architectureZone: "" as ArchitectureZone | "",
};

const initialDetails = {
  organisationName: "",
  contactPersonName: "",
  designation: "",
  mobile: "",
  email: "",
  officeAddress: "",
  password: "",
  confirmPassword: "",
  officeTelephone: "",
  divisionName: "",
  officialWebsite: "",
};

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [stepOne, setStepOne] = useState(initialStepOne);
  const [details, setDetails] = useState(initialDetails);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedRole = useMemo(
    () => organisationRoleOptions.find((option) => option.value === stepOne.organisationRole),
    [stepOne.organisationRole],
  );
  const selectedDistrict = useMemo(
    () => punjabDistricts.find((district) => district.id === stepOne.districtId),
    [stepOne.districtId],
  );
  const isArchitecture = stepOne.organisationRole === "architecture_department";
  const selectedZone = architectureZones.find((zone) => zone.value === stepOne.architectureZone);

  function validateStepOne() {
    const nextErrors: Record<string, string> = {};
    if (!stepOne.organisationRole) nextErrors.organisationRole = "Organisation / role is required.";
    if (stepOne.organisationRole === "architecture_department") {
      if (!stepOne.architectureZone) nextErrors.architectureZone = "Architecture Zone is required.";
    } else if (!stepOne.districtId) nextErrors.districtId = "District is required.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateDetails() {
    const nextErrors: Record<string, string> = {};
    if (!details.organisationName.trim()) nextErrors.organisationName = "Organisation or DIET name is required.";
    if (!details.contactPersonName.trim()) nextErrors.contactPersonName = "Contact person name is required.";
    if (!details.designation.trim()) nextErrors.designation = "Designation is required.";
    if (isArchitecture ? !stepOne.architectureZone : !stepOne.districtId) nextErrors[isArchitecture ? "architectureZone" : "districtId"] = `${isArchitecture ? "Architecture Zone" : "District"} is required.`;
    if (!/^\d{10}$/.test(details.mobile.trim())) nextErrors.mobile = "Mobile number must contain exactly 10 digits.";
    if (!validEmail(details.email.trim())) nextErrors.email = "Enter a valid email address.";
    if (details.password.length < 8) nextErrors.password = "Password must contain at least 8 characters.";
    if (details.confirmPassword !== details.password) nextErrors.confirmPassword = "Confirm password must match.";
    if (!details.officeAddress.trim()) nextErrors.officeAddress = "Office address is required.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validateStepOne()) {
      setErrors({});
      setStep(2);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    if (!validateDetails() || !stepOne.organisationRole) return;

    setSubmitting(true);
    try {
      const pendingSummary = await registerPendingUser({
        organisationRole: stepOne.organisationRole,
        districtId: stepOne.districtId,
        architectureZone: stepOne.architectureZone || undefined,
        organisationName: details.organisationName.trim(),
        contactPersonName: details.contactPersonName.trim(),
        designation: details.designation.trim(),
        mobile: details.mobile.trim(),
        email: details.email.trim().toLowerCase(),
        officeAddress: details.officeAddress.trim(),
        password: details.password,
        officeTelephone: details.officeTelephone.trim(),
        divisionName: details.divisionName.trim(),
        officialWebsite: details.officialWebsite.trim(),
      });
      sessionStorage.setItem("coeRegistrationPending", JSON.stringify(pendingSummary));
      navigate("/registration-pending", { replace: true, state: pendingSummary });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Registration could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  const nameLabel = isArchitecture ? "Architecture Office / Zone Office Name" : stepOne.organisationRole === "diet" ? "DIET Name" : "Agency / Division Name";

  return (
    <main className="login-screen">
      <section className="login-panel registration-panel">
        <div className="brand-lockup large">
          <div className="emblem">
            <ShieldCheck size={28} />
          </div>
          <div>
            <span className="department">SCERT Punjab</span>
            <strong>Register for Centre of Excellence PMIS</strong>
          </div>
        </div>
        <p className="muted-text">Registration requests are reviewed and approved by SCERT Punjab before portal access is activated.</p>
        <div className="step-indicator">Step {step} of 2</div>

        {step === 1 ? (
          <form className="login-form" onSubmit={handleContinue} noValidate>
            <label>
              Select Organisation / Role *
              <select value={stepOne.organisationRole} onChange={(event) => setStepOne({ ...stepOne, organisationRole: event.target.value as OrganisationRole, districtId: "", architectureZone: "" })}>
                <option value="">Select organisation / role</option>
                {organisationRoleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.organisationRole ? <span className="field-error">{errors.organisationRole}</span> : null}
            </label>
            {isArchitecture ? <label>
              Architecture Zone *
              <select value={stepOne.architectureZone} onChange={(event) => setStepOne({ ...stepOne, architectureZone: event.target.value as ArchitectureZone })}>
                <option value="">Select architecture zone</option>{architectureZones.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}
              </select>{errors.architectureZone ? <span className="field-error">{errors.architectureZone}</span> : null}
            </label> : <label>
              District *
              <select value={stepOne.districtId} onChange={(event) => setStepOne({ ...stepOne, districtId: event.target.value })}>
                <option value="">Select district</option>
                {punjabDistricts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
              {errors.districtId ? <span className="field-error">{errors.districtId}</span> : null}
            </label>}
            <button className="primary-button" type="submit">Continue</button>
            <Link to="/login" className="text-link">Already registered? Return to login</Link>
          </form>
        ) : (
          <form className="agency-form" onSubmit={handleSubmit} noValidate>
            <label>
              {nameLabel} *
              <input value={details.organisationName} onChange={(event) => setDetails({ ...details, organisationName: event.target.value })} />
              {errors.organisationName ? <span className="field-error">{errors.organisationName}</span> : null}
            </label>
            <label>
              Organisation Type
              <input value={selectedRole?.label || ""} readOnly />
            </label>
            {isArchitecture ? <label>Architecture Zone *<select value={stepOne.architectureZone} onChange={(event) => setStepOne({ ...stepOne, architectureZone: event.target.value as ArchitectureZone })}>{architectureZones.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}</select>{errors.architectureZone ? <span className="field-error">{errors.architectureZone}</span> : null}</label> : <label>
              District *
              <select value={stepOne.districtId} onChange={(event) => setStepOne({ ...stepOne, districtId: event.target.value })}>
                {punjabDistricts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
              </select>
              {errors.districtId ? <span className="field-error">{errors.districtId}</span> : null}
            </label>}
            <label>
              Contact Person Name *
              <input value={details.contactPersonName} onChange={(event) => setDetails({ ...details, contactPersonName: event.target.value })} />
              {errors.contactPersonName ? <span className="field-error">{errors.contactPersonName}</span> : null}
            </label>
            <label>
              Designation *
              <input value={details.designation} onChange={(event) => setDetails({ ...details, designation: event.target.value })} />
              {errors.designation ? <span className="field-error">{errors.designation}</span> : null}
            </label>
            <label>
              Mobile Number *
              <input inputMode="numeric" maxLength={10} value={details.mobile} onChange={(event) => setDetails({ ...details, mobile: event.target.value })} />
              {errors.mobile ? <span className="field-error">{errors.mobile}</span> : null}
            </label>
            <label>
              Email Address *
              <input type="email" value={details.email} onChange={(event) => setDetails({ ...details, email: event.target.value })} />
              {errors.email ? <span className="field-error">{errors.email}</span> : null}
            </label>
            <label>
              Office Telephone
              <input value={details.officeTelephone} onChange={(event) => setDetails({ ...details, officeTelephone: event.target.value })} />
            </label>
            <label>
              Subdivision / Division
              <input value={details.divisionName} onChange={(event) => setDetails({ ...details, divisionName: event.target.value })} />
            </label>
            <label>
              Official Website
              <input value={details.officialWebsite} onChange={(event) => setDetails({ ...details, officialWebsite: event.target.value })} />
            </label>
            <label>
              Password *
              <input type="password" value={details.password} onChange={(event) => setDetails({ ...details, password: event.target.value })} />
              {errors.password ? <span className="field-error">{errors.password}</span> : null}
            </label>
            <label>
              Confirm Password *
              <input type="password" value={details.confirmPassword} onChange={(event) => setDetails({ ...details, confirmPassword: event.target.value })} />
              {errors.confirmPassword ? <span className="field-error">{errors.confirmPassword}</span> : null}
            </label>
            <label className="agency-form-wide">
              Office Address *
              <textarea rows={3} value={details.officeAddress} onChange={(event) => setDetails({ ...details, officeAddress: event.target.value })} />
              {errors.officeAddress ? <span className="field-error">{errors.officeAddress}</span> : null}
            </label>
            {submitError ? <div className="error-banner agency-form-wide">{submitError}</div> : null}
            <div className="form-actions split-actions">
              <button className="secondary-button" type="button" onClick={() => setStep(1)}>Back</button>
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Registration"}
              </button>
            </div>
            <div className="agency-form-wide muted-text">Selected {isArchitecture ? "architecture zone" : "district"}: {isArchitecture ? selectedZone?.label : selectedDistrict?.name}</div>
          </form>
        )}
      </section>
    </main>
  );
}
