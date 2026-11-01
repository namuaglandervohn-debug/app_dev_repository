import { useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { supabase } from '../lib/supabaseClient';

export interface LeaveType { id: string; name: string; description: string; is_active: boolean }

export default function LeaveTypeUtility({ open, onClose, types, onSaved }: { open: boolean; onClose: () => void; types: LeaveType[]; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const reset = () => { setEditing(null); setName(''); setDescription(''); setActive(true); setError(''); };
  const save = async () => {
    if (saving) return;
    if (!name.trim()) { setError('Enter a leave type name.'); return; }
    setSaving(true); setError('');
    try {
      const value = { name: name.trim(), description: description.trim(), is_active: active };
      const result = editing ? await supabase.from('leave_types').update(value).eq('id', editing.id).select('id').single() : await supabase.from('leave_types').insert(value).select('id').single();
      if (result.error) throw result.error;
      await onSaved(); reset();
    } catch (e: any) { setError(e.code === '23505' ? 'A leave type with this name already exists.' : e.message || 'Could not save the leave type.'); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
    <DialogTitle>Leave types - Super Admin utility</DialogTitle>
    <DialogContent><Typography variant="body2" sx={{ mb: 2 }}>Add or update leave types. Deactivated types remain in past requests but cannot be selected for new requests.</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack spacing={2}>
        <TextField label="Leave type name" value={name} onChange={e => setName(e.target.value)} inputProps={{ maxLength: 100 }} disabled={saving} />
        <TextField label="Description" value={description} onChange={e => setDescription(e.target.value)} inputProps={{ maxLength: 1000 }} disabled={saving} multiline />
        <FormControlLabel control={<Checkbox checked={active} onChange={e => setActive(e.target.checked)} disabled={saving} />} label="Available for new requests" />
        <Box><Button variant="contained" disabled={saving} onClick={() => void save()}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Add leave type'}</Button>{editing && <Button disabled={saving} onClick={reset}>Cancel edit</Button>}</Box>
        {types.map(type => <Box key={type.id} sx={{ borderTop: '1px solid #dcefe0', pt: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box><Typography fontWeight={600}>{type.name}</Typography><Typography variant="caption">{type.is_active ? 'Active' : 'Inactive'}</Typography></Box>
          <Button disabled={saving} onClick={() => { setEditing(type); setName(type.name); setDescription(type.description); setActive(type.is_active); setError(''); }}>Edit</Button>
        </Box>)}
      </Stack>
    </DialogContent><DialogActions><Button disabled={saving} onClick={onClose}>Close</Button></DialogActions>
  </Dialog>;
}
