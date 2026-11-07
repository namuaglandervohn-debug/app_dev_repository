import { useState } from 'react';
import { ArchiveOutlined, Edit } from '@mui/icons-material';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { supabase } from '../lib/supabaseClient';
import { readableErrorMessage } from '../lib/apiError';

export interface LeaveType { id: string; name: string; description: string; is_active: boolean }

const rowActionSx = { borderRadius: '10px', textTransform: 'none', fontWeight: 700, px: 1.5 } as const;

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
  const archive = async (type: LeaveType) => {
    if (saving || !type.is_active) return;
    setSaving(true);
    setError('');
    try {
      const { error } = await supabase.from('leave_types')
        .update({ is_active: false })
        .eq('id', type.id)
        .select('id')
        .single();
      if (error) throw error;
      if (editing?.id === type.id) setActive(false);
      await onSaved();
    } catch (error) {
      setError(readableErrorMessage(error, 'Could not archive the leave type.'));
    } finally {
      setSaving(false);
    }
  };
  return <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
    <DialogTitle>Leave types - Super Admin utility</DialogTitle>
    <DialogContent><Typography variant="body2" sx={{ mb: 2 }}>Add, edit, or archive leave types. Archived types remain in past requests but cannot be selected for new requests.</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack spacing={2}>
        <TextField label="Leave type name" value={name} onChange={e => setName(e.target.value)} inputProps={{ maxLength: 100 }} disabled={saving} />
        <TextField label="Description" value={description} onChange={e => setDescription(e.target.value)} inputProps={{ maxLength: 1000 }} disabled={saving} multiline />
        <FormControlLabel control={<Checkbox checked={active} onChange={e => setActive(e.target.checked)} disabled={saving} />} label="Available for new requests" />
        <Box><Button variant="contained" disabled={saving} onClick={() => void save()}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Add leave type'}</Button>{editing && <Button disabled={saving} onClick={reset}>Cancel edit</Button>}</Box>
        {types.map(type => <Box key={type.id} sx={{ borderTop: '1px solid #dcefe0', pt: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box><Typography fontWeight={600}>{type.name}</Typography><Typography variant="caption">{type.is_active ? 'Active' : 'Archived'}</Typography></Box>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button
              variant="outlined"
              startIcon={<Edit />}
              sx={{ ...rowActionSx, borderColor: '#b9dfc6', bgcolor: '#fbfefb' }}
              disabled={saving}
              onClick={() => { setEditing(type); setName(type.name); setDescription(type.description); setActive(type.is_active); setError(''); }}
            >
              Edit
            </Button>
            <Button
              variant="outlined"
              startIcon={<ArchiveOutlined />}
              sx={{
                ...rowActionSx,
                color: '#98630b',
                borderColor: '#edcd98',
                bgcolor: '#fffbf2',
                '&:hover': { bgcolor: '#fff3dc', borderColor: '#d9a14a' },
              }}
              disabled={saving || !type.is_active}
              aria-label={`Archive ${type.name}`}
              onClick={() => void archive(type)}
            >
              Archive
            </Button>
          </Stack>
        </Box>)}
      </Stack>
    </DialogContent><DialogActions><Button disabled={saving} onClick={onClose}>Close</Button></DialogActions>
  </Dialog>;
}
