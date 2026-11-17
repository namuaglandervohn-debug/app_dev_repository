import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from './supabaseClient';

const BATCH_SIZE = 32;
const EMPTY_PHOTOS: ReadonlyMap<string, string> = new Map();

export function useProfilePhotoDirectory(kind: 'applicant' | 'employee', ids: (string | undefined | null)[]) {
  const { user } = useAuth();
  const scope = user ? `${user.id}:${user.role}:${kind}` : '';
  const requested = JSON.stringify([...new Set(ids.filter((id): id is string => Boolean(id)))].sort());
  const [directory, setDirectory] = useState<{ scope: string; photos: ReadonlyMap<string, string> }>({ scope: '', photos: EMPTY_PHOTOS });

  useEffect(() => {
    if (!scope) return;
    const visibleIds: string[] = JSON.parse(requested);
    let active = true;

    async function loadPhotos() {
      for (let start = 0; active && start < visibleIds.length; start += BATCH_SIZE) {
        const batch = visibleIds.slice(start, start + BATCH_SIZE);
        const { data, error }: { data: Array<{ applicant_id?: string; employee_id?: string; profile_photo?: string }> | null; error: unknown } = await (kind === 'applicant'
          ? supabase.rpc('list_recruitment_profile_photos', { p_application_ids: batch })
          : supabase.from('employees').select('employee_id,profile_photo').in('employee_id', batch).not('profile_photo', 'is', null).returns<Array<{ employee_id: string; profile_photo: string }>>());
        if (!active || error) continue;

        setDirectory(current => {
          const photos = new Map(current.scope === scope ? current.photos : EMPTY_PHOTOS);
          for (const id of batch) photos.delete(id);
          for (const row of data ?? []) {
            const id = kind === 'applicant' ? row.applicant_id : row.employee_id;
            if (id && row.profile_photo) photos.set(id, row.profile_photo);
          }
          return { scope, photos };
        });
      }
    }

    void loadPhotos().catch(() => { /* The surrounding records remain usable with initials. */ });
    return () => { active = false; };
  }, [kind, requested, scope]);

  return directory.scope === scope ? directory.photos : EMPTY_PHOTOS;
}
