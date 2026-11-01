// Job-specific answers and declarations never become defaults for a new application.
const EXCLUDED = new Set(['position', 'hearAbout', 'hearAboutOther', 'submittedDocuments', 'otherDocument', 'applicantSignature', 'declarationDate']);
export function reusableApplicantProfile(profile: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.filter(key => !EXCLUDED.has(key) && key in profile).map(key => [key, profile[key]]));
}

export function applicantDisplayName(profile: Record<string, unknown>) {
  return [profile.firstName, profile.middleName, profile.lastName, profile.suffix].filter(Boolean).join(' ');
}

export const APPLICANT_COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia',
  'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus',
  'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Brazil', 'Brunei',
  'Bulgaria', 'Cambodia', 'Cameroon', 'Canada', 'Chile', 'China', 'Colombia', 'Costa Rica',
  'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Dominican Republic', 'Ecuador',
  'Egypt', 'Estonia', 'Ethiopia', 'Finland', 'France', 'Georgia', 'Germany', 'Ghana', 'Greece',
  'Guatemala', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
  'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Laos', 'Latvia',
  'Lebanon', 'Libya', 'Lithuania', 'Malaysia', 'Mexico', 'Mongolia', 'Morocco', 'Myanmar', 'Nepal',
  'New Zealand', 'Nigeria', 'Norway', 'Oman', 'Pakistan', 'Palestine', 'Panama', 'Paraguay', 'Peru', 'Philippines',
  'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Singapore', 'South Africa',
  'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Taiwan', 'Thailand', 'Turkey',
  'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Venezuela', 'Vietnam',
];

export const APPLICANT_NATIONALITIES = [
  'Afghan', 'Albanian', 'Algerian', 'American', 'Andorran', 'Angolan', 'Argentinian',
  'Armenian', 'Australian', 'Austrian', 'Azerbaijani', 'Bahamian', 'Bahraini', 'Bangladeshi',
  'Barbadian', 'Belarusian', 'Belgian', 'Belizean', 'Beninese', 'Bhutanese', 'Bolivian', 'Bosnian',
  'Brazilian', 'British', 'Bruneian', 'Bulgarian', 'Cambodian', 'Cameroonian', 'Canadian', 'Chilean',
  'Chinese', 'Colombian', 'Congolese', 'Costa Rican', 'Croatian', 'Cuban', 'Cypriot', 'Czech',
  'Danish', 'Dominican', 'Dutch', 'Ecuadorian', 'Egyptian', 'Emirati', 'Estonian', 'Ethiopian', 'Filipino', 
  'Finnish', 'French', 'Georgian', 'German', 'Ghanaian', 'Greek', 'Guatemalan', 'Honduran',
  'Hungarian', 'Icelandic', 'Indian', 'Indonesian', 'Iranian', 'Iraqi', 'Irish', 'Israeli', 'Italian',
  'Jamaican', 'Japanese', 'Jordanian', 'Kazakh', 'Kenyan', 'Korean', 'Kuwaiti', 'Laotian', 'Latvian',
  'Lebanese', 'Libyan', 'Lithuanian', 'Malaysian', 'Mexican', 'Mongolian', 'Moroccan', 'Myanmar',
  'Nepalese', 'New Zealander', 'Nigerian', 'Norwegian', 'Omani', 'Pakistani', 'Palestinian',
  'Panamanian', 'Paraguayan', 'Peruvian', 'Polish', 'Portuguese', 'Qatari', 'Romanian', 'Russian',
  'Saudi', 'Singaporean', 'South African', 'Spanish', 'Sri Lankan', 'Swedish', 'Swiss', 'Taiwanese',
  'Thai', 'Turkish', 'Ukrainian', 'Uruguayan', 'Venezuelan', 'Vietnamese',
];
