export const applicationHistoryColumns = 'applicant_id,position_applied,created_at';

export type ApplicationHistoryItem = {
  applicant_id: string;
  position_applied: string | null;
  created_at: string | null;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const pick = <K extends string>(value: Record<string, unknown>, fields: K[]): Record<K, string> =>
  Object.fromEntries(fields.map(key => [key, text(value[key])])) as Record<K, string>;

function readDetails(value: unknown) {
  if (typeof value !== 'string') return record(value);
  try { return record(JSON.parse(value)); } catch { return {}; }
}

export function previousApplicationAnswers(row: Record<string, unknown>, relationships: string[]) {
  const details = readDetails(row.cover_letter);
  const education = record(details.educationBackground);
  const address = (prefix: string, keys: string[]) => {
    const parts = record(details[`${prefix}Parts`]);
    return Object.fromEntries(keys.filter(key => key in parts).map(key =>
      [prefix.replace(/Address$/, '') + key.charAt(0).toUpperCase() + key.slice(1), text(parts[key])]));
  };
  const addressKeys = ['country', 'region', 'province', 'city', 'barangay', 'street', 'zipCode'];
  const list = (value: unknown, legacy?: unknown) => {
    const entries = Array.isArray(value) ? value.map(record).filter(item => Object.keys(item).length) : [];
    const fallback = record(legacy);
    return entries.length ? entries : Object.keys(fallback).length ? [fallback] : [];
  };
  return {
    fields: {
      ...Object.fromEntries([
        ['firstName', 'first_name'], ['middleName', 'middle_name'], ['lastName', 'last_name'],
        ['suffix', 'suffix'], ['birthdate', 'birthdate'], ['gender', 'gender'],
        ['civilStatus', 'civil_status'], ['contactNumber', 'phone_number'],
      ].filter(([, column]) => row[column] != null).map(([key, column]) => [key, text(row[column])])),
      height: text(row.height ?? details.height), weight: text(row.weight ?? details.weight),
      age: text(details.age),
      position: text(row.position_applied),
      ...pick(details, ['hearAbout', 'hearAboutOther', 'otherDocument', 'applicantSignature']),
      declarationDate: text(details.declarationDate) || null,
      submittedDocuments: Array.isArray(details.submittedDocuments)
        ? details.submittedDocuments.filter((item): item is string => typeof item === 'string') : [],
      ...pick(row, ['tin', 'sss', 'philhealth', 'pagibig']),
      ...(details.nationality != null && { nationality: text(details.nationality) }),
      otherSkills: text(details.otherSkills),
      ...address('birthplace', addressKeys.slice(0, 4)),
      ...address('currentAddress', addressKeys),
      ...address('permanentAddress', addressKeys),
      education: text(education.level || row.education),
      ...pick(education, ['schoolName', 'courseProgram', 'yearGraduated']),
      skills: Array.isArray(details.skills) ? details.skills.filter((item): item is string => typeof item === 'string') : [],
    },
    workExperiences: list(details.workExperiences, details.workExperience).map(work => ({
      ...pick(work, ['companyOrganization', 'positionHeld', 'employmentStartDate', 'employmentEndDate', 'dutiesResponsibilities']),
      totalYearsExperience: text(work.totalYearsExperience),
    })),
    characterReferences: list(details.characterReferences).map(ref => pick(ref, ['name', 'position', 'company', 'contact'])),
    emergencyContacts: list(details.emergencyContacts, details.emergencyContact).map(contact => {
      const relation = text(contact.relation);
      const custom = relation && !relationships.includes(relation);
      return {
        ...pick(contact, ['name', 'phone', 'address']),
        relation: custom ? 'Other' : relation,
        relationOther: custom ? relation : text(contact.relationOther),
      };
    }),
  };
}

const documentTypes = new Map([
  ['pdf', 'application/pdf'], ['doc', 'application/msword'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['png', 'image/png'],
]);

function restoreFile(name: string, data: unknown): File | null {
  const type = documentTypes.get(name.split('.').pop()?.toLowerCase() ?? '');
  if (!type || typeof data !== 'string') return null;
  const encoded = /^data:[^,]*;base64,([A-Za-z0-9+/=\s]+)$/i.exec(data)?.[1];
  if (!encoded) return null;
  try {
    const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    return bytes.length ? new File([bytes], name, { type }) : null;
  } catch {
    return null;
  }
}

export function previousApplicationFiles(row: Record<string, unknown>) {
  const details = readDetails(row.cover_letter);
  const certificateNames = new Set(Array.isArray(details.certifications) ? details.certifications.map(text) : []);
  const savedDocuments = Array.isArray(row.supporting_document_files) ? row.supporting_document_files : [];
  const documentNames = Array.isArray(row.supporting_documents) ? row.supporting_documents.map(text) : [];
  const resumeName = text(row.resume_file_name);
  const resume = restoreFile(resumeName, row.resume_file_data);
  const supporting: File[] = [];
  const certificates: File[] = [];
  const missing = new Set([...documentNames, ...certificateNames].filter(Boolean));
  if (resumeName && !resume) missing.add(resumeName);
  for (const item of savedDocuments) {
    const document = record(item);
    const name = text(document.name ?? document.fileName);
    const file = restoreFile(name, document.data ?? document.dataUrl);
    if (file) {
      (certificateNames.has(name) ? certificates : supporting).push(file);
      missing.delete(name);
    } else if (name) {
      missing.add(name);
    }
  }
  return { resume: resume ? [resume] : [], supporting, certificates, missing: [...missing] };
}
