import { supabase } from './supabaseClient';

export async function saveEmployeeProfilePhoto(employeeId: string, photo: string) {
  const { error } = await supabase.from('employees').update({ profile_photo: photo })
    .eq('employee_id', employeeId).select('employee_id').single();
  if (error) throw new Error('Could not save the profile picture. Check access to this employee profile and try again.');
}
