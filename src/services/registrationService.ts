import { createUserWithEmailAndPassword, deleteUser, fetchSignInMethodsForEmail, getAuth, inMemoryPersistence, setPersistence } from "firebase/auth";
import { deleteApp, initializeApp } from "firebase/app";
import { doc, getFirestore, serverTimestamp, writeBatch } from "firebase/firestore";
import { getOrganisationRoleLabel, getRequestedSystemRole } from "../constants/organisationRoles";
import { getDistrictName } from "../constants/punjabDistricts";
import { getArchitectureZoneLabel, type ArchitectureZone } from "../constants/architectureZones";
import { auth, db, getFirebaseConfigurationMessage, isFirebaseConfigured } from "../lib/firebase";
import { diets as registrationDiets } from "../data/masterData";
import type { OrganisationRole } from "../types";

export type RegistrationFormInput = {
  organisationRole: OrganisationRole;
  organisationName: string;
  registeredDietId?: string;
  engineeringDiscipline?: string;
  districtId?: string;
  architectureZone?: ArchitectureZone;
  contactPersonName: string;
  designation: string;
  mobile: string;
  email: string;
  officeAddress: string;
  password: string;
  officeTelephone?: string;
  divisionName?: string;
  officialWebsite?: string;
};

function requireFirebase() {
  if (!isFirebaseConfigured || !auth || !db) {
    throw new Error(getFirebaseConfigurationMessage() || "Firebase Authentication or Cloud Firestore is not configured.");
  }

  return { configuredAuth: auth, configuredDb: db };
}

function firebaseErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
}

function isInvalidApiKeyError(error: unknown) {
  const code = firebaseErrorCode(error);
  const message = error instanceof Error ? error.message : "";
  return code === "auth/invalid-api-key"
    || code.includes("api-key-not-valid")
    || message.includes("api-key-not-valid")
    || message.includes("valid-api-key");
}

function readableRegistrationError(error: unknown) {
  const code = firebaseErrorCode(error);
  if (code === "auth/email-already-in-use") return "A registration or user account with this email already exists. Please sign in or contact SCERT if registration is incomplete.";
  if (code === "auth/invalid-email") return "Enter a valid email address.";
  if (code === "auth/weak-password") return "Choose a stronger password containing at least 8 characters.";
  if (code === "auth/network-request-failed" || code === "unavailable" || code === "firestore/unavailable") return "Registration service is temporarily unavailable. Check your connection and try again.";
  return "Registration could not be completed. Please try again.";
}

export async function registerPendingUser(input: RegistrationFormInput) {
  const { configuredAuth } = requireFirebase();
  const registeredDiet = input.organisationRole === "diet" ? registrationDiets.find(d => d.id === input.registeredDietId && d.district === getDistrictName(input.districtId || "")) : undefined;
  if (input.organisationRole === "diet" && !registeredDiet) throw new Error("Select a valid DIET from the master data.");
  const registrationApp = initializeApp(configuredAuth.app.options, `registration-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const registrationAuth = getAuth(registrationApp);
  const registrationDb = getFirestore(registrationApp);
  const email = input.email.trim().toLowerCase();
  let stage = "initialising registration";
  let signInMethods: string[];
  try {
    await setPersistence(registrationAuth, inMemoryPersistence);
    stage = "checking the email address";
    signInMethods = await fetchSignInMethodsForEmail(registrationAuth, email);
  } catch (error) {
    await deleteApp(registrationApp);
    if (isInvalidApiKeyError(error)) {
      throw new Error("The Firebase API key loaded by the app is invalid. Recheck .env.local and restart Vite.");
    }
    throw new Error(readableRegistrationError(error));
  }

  if (signInMethods.length > 0) {
    await deleteApp(registrationApp);
    throw new Error("A registration or user account with this email already exists.");
  }

  const isArchitecture = input.organisationRole === "architecture_department";
  if (isArchitecture && !getArchitectureZoneLabel(input.architectureZone)) throw new Error("Select a valid Architecture Zone.");
  if (!isArchitecture && !input.districtId) throw new Error("District is required.");
  const districtName = isArchitecture ? "" : getDistrictName(input.districtId || "");
  const architectureZoneLabel = isArchitecture ? getArchitectureZoneLabel(input.architectureZone) : "";
  const organisationRoleLabel = getOrganisationRoleLabel(input.organisationRole);
  const requestedSystemRole = getRequestedSystemRole(input.organisationRole);
  let credential;
  try {
    stage = "creating the Firebase Authentication account";
    credential = await createUserWithEmailAndPassword(registrationAuth, email, input.password);
  } catch (error) {
    await deleteApp(registrationApp);
    const code = firebaseErrorCode(error);
    if (code === "auth/email-already-in-use") throw new Error(readableRegistrationError(error));
    if (isInvalidApiKeyError(error)) {
      throw new Error("The Firebase API key loaded by the app is invalid. Recheck .env.local and restart Vite.");
    }
    throw new Error(readableRegistrationError(error));
  }
  const uid = credential.user.uid;

  const userProfile = {
    uid,
    email,
    displayName: input.contactPersonName,
    name: input.contactPersonName,
    mobile: input.mobile,
    designation: input.designation,
    organisationRole: input.organisationRole,
    organisationRoleLabel,
    organisationName: registeredDiet?.name || input.organisationName,
    registeredDietId: registeredDiet?.id || "",
    engineeringDiscipline: input.engineeringDiscipline || "",
    districtId: isArchitecture ? "" : input.districtId,
    districtName,
    architectureZone: isArchitecture ? input.architectureZone : null,
    architectureZoneLabel,
    officeAddress: input.officeAddress,
    officeTelephone: input.officeTelephone || "",
    divisionName: input.divisionName || "",
    officialWebsite: input.officialWebsite || "",
    systemRole: "pending_user",
    role: "pending_user",
    approvalStatus: "pending",
    approved: false,
    active: false,
    isActive: false,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: "",
    assignedDietIds: [],
    assignedAgencyIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const requestRecord = {
    userId: uid,
    email,
    organisationRole: input.organisationRole,
    organisationRoleLabel,
    organisationName: registeredDiet?.name || input.organisationName,
    registeredDietId: registeredDiet?.id || "",
    engineeringDiscipline: input.engineeringDiscipline || "",
    districtId: isArchitecture ? "" : input.districtId,
    districtName,
    architectureZone: isArchitecture ? input.architectureZone : null,
    architectureZoneLabel,
    contactPersonName: input.contactPersonName,
    designation: input.designation,
    mobile: input.mobile,
    officeAddress: input.officeAddress,
    divisionName: input.divisionName || "",
    officeTelephone: input.officeTelephone || "",
    officialWebsite: input.officialWebsite || "",
    requestedSystemRole,
    status: "pending",
    submittedAt: serverTimestamp(),
    reviewedBy: null,
    reviewedAt: null,
    reviewRemarks: "",
  };

  try {
    stage = "saving the pending user profile and registration request";
    const batch = writeBatch(registrationDb);
    batch.set(doc(registrationDb, "users", uid), userProfile);
    batch.set(doc(registrationDb, "registrationRequests", uid), requestRecord);
    await batch.commit();
    await deleteApp(registrationApp);
    return {
      userId: uid,
      email,
      organisationName: registeredDiet?.name || input.organisationName,
      registeredDietId: registeredDiet?.id || "",
      engineeringDiscipline: input.engineeringDiscipline || "",
      organisationRoleLabel,
      districtName,
      architectureZoneLabel,
      status: "pending",
    };
  } catch (error) {
    if (import.meta.env.DEV) console.error(`[register] Failed while ${stage}.`, firebaseErrorCode(error), error);
    try {
      await deleteUser(credential.user);
    } catch {
      // If cleanup fails, Firebase may require an administrator to disable the account.
    }
    await deleteApp(registrationApp).catch(() => undefined);
    const code = firebaseErrorCode(error);
    if (code === "permission-denied" || code === "firestore/permission-denied") {
      throw new Error("Your account was created, but the registration profile could not be submitted because of a permissions error. Please contact SCERT.");
    }
    if (code === "unavailable" || code === "firestore/unavailable" || code === "auth/network-request-failed") {
      throw new Error("Registration could not be completed because the service is temporarily unavailable. Please try again.");
    }
    throw new Error("Registration account was created but the pending profile could not be saved. Please contact SCERT.");
  }
}
