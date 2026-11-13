import assert from 'node:assert/strict';
import { test } from 'node:test';
import { previousApplicationAnswers, previousApplicationFiles } from '../resources/ts/app/lib/applicationHistory.ts';

test('reuse restores the position, referral and declaration', () => {
  const { fields } = previousApplicationAnswers({
    position_applied: 'Service Crew',
    cover_letter: JSON.stringify({
      hearAbout: 'Other', hearAboutOther: 'Job fair',
      applicantSignature: 'TEST APPLICANT', declarationDate: '2026-11-13',
    }),
  }, []);
  assert.equal(fields.position, 'Service Crew');
  assert.equal(fields.hearAbout, 'Other');
  assert.equal(fields.hearAboutOther, 'Job fair');
  assert.equal(fields.applicantSignature, 'TEST APPLICANT');
  assert.equal(fields.declarationDate, '2026-11-13');
});

test('reuse restores document bytes and reports files with missing or invalid data', async () => {
  const data = 'data:application/pdf;base64,JVBERg==';
  const files = previousApplicationFiles({
    resume_file_name: 'resume.pdf',
    resume_file_data: data,
    cover_letter: { certifications: ['certificate.pdf'] },
    supporting_documents: ['record.pdf', 'missing.pdf'],
    supporting_document_files: [
      { name: 'record.pdf', data },
      { name: 'certificate.pdf', data },
      { name: 'invalid.pdf', data: 'data:application/pdf;base64,?' },
    ],
  });
  assert.equal(await files.resume[0].text(), '%PDF');
  assert.deepEqual(files.supporting.map(file => file.name), ['record.pdf']);
  assert.deepEqual(files.certificates.map(file => file.name), ['certificate.pdf']);
  assert.deepEqual(files.missing, ['missing.pdf', 'invalid.pdf']);
});
