import { useEffect, useState } from 'react';
import { getJobTitleOptions } from './jobTitles';
import { supabase } from './supabaseClient';

export function useJobTitleOptions(enabled = true) {
  const [titles, setTitles] = useState(() => getJobTitleOptions([]));

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    async function loadTitles() {
      const { data, error } = await supabase.rpc('list_staff_job_titles');
      if (error) {
        console.error('Unable to load job titles', error.message);
      } else if (active) {
        setTitles(getJobTitleOptions(data ?? []));
      }
    }

    void loadTitles();
    window.addEventListener('focus', loadTitles);
    return () => {
      active = false;
      window.removeEventListener('focus', loadTitles);
    };
  }, [enabled]);

  return titles;
}
