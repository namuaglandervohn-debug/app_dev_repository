import test from 'node:test';
import assert from 'node:assert/strict';
import { filterEmployeeRecords, emptyEmployeeFilters } from '../resources/ts/app/lib/employeeFilters.ts';
import { reusableApplicantProfile } from '../resources/ts/app/lib/applicantProfile.ts';
import { submitApplicant } from '../resources/ts/app/lib/submitApplicant.ts';
import { completeApplicantAddress } from '../resources/ts/app/lib/applicantAddress.ts';

const employees = [
  { id: 'EMP-1', name: 'Jane Smith', position: 'Cashier', outlet: 'Main', status: 'Active', contact: '09123456789' },
  { id: 'EMP-2', name: 'John Smith', position: 'Cook', outlet: 'Main', status: 'Resigned', contact: '09999999999' },
  { id: 'EMP-3', name: 'Jane Doe', position: 'Cashier', outlet: 'Annex', status: 'Active', contact: '09876543210' },
];
test('employee search field and independent column filters compose with AND', () => {
  assert.deepEqual(filterEmployeeRecords(employees, 'jane', 'name', { ...emptyEmployeeFilters, outlet: 'Main', position: 'Cashier', status: 'Active' }).map(e => e.id), ['EMP-1']);
  assert.equal(filterEmployeeRecords(employees, 'main', 'name', emptyEmployeeFilters).length, 0);
  assert.equal(filterEmployeeRecords(employees, 'MAIN', 'all', emptyEmployeeFilters).length, 2);
  assert.deepEqual(filterEmployeeRecords(employees, '', 'all', { ...emptyEmployeeFilters, id: 'emp-3', contact: '5432' }).map(e => e.id), ['EMP-3']);
  assert.equal(filterEmployeeRecords(employees, '', 'all', emptyEmployeeFilters).length, 3);
});

test('registered applications use the server-returned tracking ID without reading other applicants', async () => {
  const result = await submitApplicant({
    from: () => assert.fail('Private applicants must not read other applicants to allocate IDs'),
    rpc: async (name, args) => { assert.equal(name, 'submit_profile_application'); assert.equal(args.p_application.auth_user_id, 'candidate'); return { data: 'APP-2026-0042', error: null }; },
  }, { auth_user_id: 'candidate', first_name: 'Jane' });
  assert.equal(result, 'APP-2026-0042');
});
test('profile reuse retains general details and excludes job-specific and signed declaration values', () => {
  const saved = { firstName: 'Jane', birthdate: '1998-01-02', position: 'Cook', applicantSignature: 'Jane', declarationDate: '2026-11-01', submittedDocuments: ['ID'], privateUnknown: 'ignore' };
  const result = reusableApplicantProfile(saved, ['firstName', 'birthdate', 'position', 'applicantSignature', 'declarationDate', 'submittedDocuments']);
  assert.deepEqual(result, { firstName: 'Jane', birthdate: '1998-01-02' });
  assert.equal(saved.position, 'Cook');
});

test('saved cities restore compatible province, region and postal defaults without replacing user-entered values', () => {
  const profile = completeApplicantAddress({ currentCountry: 'Philippines', currentCity: 'Panabo City' });
  assert.equal(profile.currentProvince, 'Davao del Norte');
  assert.equal(profile.currentRegion, 'Region XI - Davao Region');
  assert.equal(profile.currentZipCode, '8105');
  assert.equal(completeApplicantAddress({ ...profile, currentZipCode: 'CUSTOM' }).currentZipCode, 'CUSTOM');
});
