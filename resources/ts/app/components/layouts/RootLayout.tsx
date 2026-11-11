import { Outlet, useNavigate, useLocation, Navigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import {
  AppBar, Toolbar, Typography, Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Box, IconButton, Avatar, Menu, MenuItem,
  useMediaQuery, useTheme, Divider, Chip, Tooltip, Badge, Popover, Paper, Button,
  CircularProgress,
} from '@mui/material';
import {
  SpaceDashboard, PersonAddAlt1, Groups, CalendarMonth, Schedule, Assignment,
  Payments, Insights, Analytics, Logout, Menu as MenuIcon,
  NotificationsNone, ManageAccounts, ReceiptLong, AccountCircle, BadgeOutlined, Work,
  KeyboardArrowDown,
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import BrandLogo from '../BrandLogo';

const drawerWidth = 244;
const toolbarHeight = 60;

const QUICK_ACTION_PATHS: Record<string, string[]> = {
  hr: ['/dashboard/recruitment', '/dashboard/employees', '/dashboard/requests', '/dashboard/attendance'],
  employee: ['/dashboard/schedule', '/dashboard/dtr', '/dashboard/requests', '/dashboard/payslips'],
  supervisor: ['/dashboard/schedule', '/dashboard/requests', '/dashboard/evaluation', '/dashboard/attendance'],
  gm: ['/dashboard/recruitment', '/dashboard/evaluation', '/dashboard/employees', '/dashboard/reports'],
  accounting: ['/dashboard/payroll', '/dashboard/reports'],
};

// Role-specific nav items — each includes which roles can see it
const ALL_MENU_ITEMS = [
  { text: 'Dashboard',         icon: <SpaceDashboard />,     path: '/dashboard',                  roles: ['hr','employee','supervisor','gm','accounting'] },
  { text: 'Recruitment',       icon: <PersonAddAlt1 />,      path: '/dashboard/recruitment',      roles: ['hr','gm'] },
  { text: 'Job Postings', icon: <Work />, path: '/dashboard/job-postings', roles: ['hr', 'gm'] },
  { text: 'User Accounts',     icon: <ManageAccounts />,     path: '/dashboard/users',            roles: ['hr'] },
  { text: 'Employees',         icon: <Groups />,             path: '/dashboard/employees',        roles: ['hr','supervisor','gm'] },
  { text: 'Schedule',          icon: <CalendarMonth />,      path: '/dashboard/schedule',         roles: ['hr','supervisor','employee'] },
  { text: 'DTR', icon: <BadgeOutlined />, path: '/dashboard/dtr', roles: ['hr','employee'] },
  { text: 'Attendance',        icon: <Schedule />,           path: '/dashboard/attendance',       roles: ['hr','supervisor'] },
  { text: 'Requests',          icon: <Assignment />,         path: '/dashboard/requests',         roles: ['hr','supervisor','employee'] },
  { text: 'Payroll',           icon: <Payments />,           path: '/dashboard/payroll',          roles: ['hr','accounting'] },
  { text: 'My Payslips',       icon: <ReceiptLong />,        path: '/dashboard/payslips',         roles: ['employee'] },
  { text: 'Evaluation',        icon: <Insights />,           path: '/dashboard/evaluation',       roles: ['hr','supervisor','gm','employee'] },
  { text: 'Reports',           icon: <Analytics />,          path: '/dashboard/reports',          roles: ['hr','gm','accounting'] },
  { text: 'My Profile',        icon: <AccountCircle />,      path: '/dashboard/profile',          roles: ['employee'] },
];

export default function RootLayout() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifAnchor, setNotifAnchor] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifCount, setNotifCount] = useState(0);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Fetch notifications based on role — must be before any early return
  useEffect(() => {
  if (!user) return;

  const fetchNotifications = async () => {
    try {
      let query = supabase
        .from("notifications")
        .select("*")
        .eq("is_read", false)
        .order("created_at", { ascending: false });

      // Employee notifications
      if (user.role === "employee") {
        query = query.eq("recipient_employee_id", user.employeeId);
      }

      // HR notifications
      else if (user.role === "hr") {
        query = query.eq("recipient_role", "hr");
      }

      // GM notifications
      else if (user.role === "gm") {
        query = query.eq("recipient_role", "gm");
      }

      // Supervisor notifications
      else if (user.role === "supervisor") {
        query = query.eq("recipient_role", "supervisor");
      }

      const { data, error } = await query;

      if (error) throw error;

      setNotifications(data ?? []);
      setNotifCount(data?.length ?? 0);

    } catch (error) {
      console.error("Notification fetch error:", error);
    }
  };

  fetchNotifications();
}, [user]);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#f2f7f3' }}>
        <CircularProgress sx={{ color: '#1F7A47' }} />
      </Box>
    );
  }

  // Early return AFTER all hooks
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'applicant') return <Navigate to="/applicant" replace />;

  const filteredMenuItems = ALL_MENU_ITEMS.filter(item => item.roles.includes(user.role));
  const quickActions = (QUICK_ACTION_PATHS[user.role] ?? []).flatMap(path => {
    const item = filteredMenuItems.find(entry => entry.path === path);
    return item ? [item] : [];
  });
  const handleLogout = () => { logout(); navigate('/login'); };
  const handleNavigate = (path: string) => { navigate(path); if (!isDesktop) setMobileOpen(false); };

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
  e.stopPropagation();

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);

  setNotifications(prev => prev.filter(n => n.id !== id));
};

  const handleMarkAllRead = async () => {
  const ids = notifications.map(n => n.id);

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .in("id", ids);

  setNotifications([]);
};

  const ROLE_LABELS: Record<string, string> = {
    hr: 'HR / Admin', employee: 'Employee', supervisor: 'Supervisor',
    gm: 'General Manager', accounting: 'Accounting & Finance',
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.paper', color: 'text.primary' }}>
      <ListItemButton
        component="button"
        onClick={() => handleNavigate('/dashboard')}
        sx={{ m: 1.5, px: 1, py: 1.25, gap: 1, borderRadius: 2, flexGrow: 0, textAlign: 'left' }}
      >
        <BrandLogo size={44} />
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={800} noWrap>Buenaventura</Typography>
          <Typography variant="caption" color="text.secondary">HRIS</Typography>
        </Box>
      </ListItemButton>

      <Divider sx={{ mx: 2 }} />

      <Box component="nav" aria-label="Account navigation" sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto' }}>
        <List sx={{ px: 1.5, py: 1.5 }}>
        {filteredMenuItems.map((item) => {
          const selected = location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'));
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={selected}
                aria-current={selected ? 'page' : undefined}
                onClick={() => handleNavigate(item.path)}
                sx={{
                  minHeight: 46, px: 1.25, gap: 1.25, m: 0, borderRadius: 1,
                  borderLeft: '3px solid transparent', color: 'text.secondary',
                  '&:hover': { bgcolor: 'background.default' },
                  '& .MuiListItemIcon-root': { minWidth: 32, color: 'primary.dark' },
                  '&.Mui-selected, &.Mui-selected:hover': {
                    bgcolor: 'rgba(31,122,71,0.10)', color: 'primary.dark', borderLeftColor: 'secondary.main',
                  },
                  '&.Mui-selected .MuiListItemIcon-root': { color: 'primary.main' },
                }}
              >
                <ListItemIcon sx={{
                  width: 32, height: 32, display: 'grid', placeItems: 'center',
                  bgcolor: selected ? 'rgba(31,122,71,0.12)' : 'background.default',
                  borderRadius: 1,
                  '& svg': { fontSize: 18 },
                }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.86rem', fontWeight: selected ? 750 : 600 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
        </List>
      </Box>

      <Divider sx={{ mx: 2 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.75 }}>
        <Avatar sx={{ bgcolor: 'primary.dark', color: 'primary.contrastText', width: 34, height: 34, fontSize: '0.9rem' }}>{user.name.charAt(0)}</Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" fontWeight={750} noWrap>{user.name}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap display="block">{ROLE_LABELS[user.role] ?? user.role}</Typography>
        </Box>
        <Tooltip title="Logout">
          <IconButton aria-label="Logout" size="small" onClick={handleLogout}><Logout fontSize="small" /></IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          backgroundImage: 'none',
          borderBottom: 1,
          borderColor: 'divider',
          boxShadow: 'none',
        }}
      >
        <Toolbar sx={{ gap: 1, minHeight: { xs: toolbarHeight, sm: toolbarHeight } }}>
          <IconButton aria-label="Open account navigation" edge="start" onClick={() => setMobileOpen(true)} sx={{ display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 750, fontSize: '0.95rem' }}>
            Buenaventura HRIS
          </Typography>
          <Tooltip title="Notifications">
            <IconButton
              aria-label="Notifications"
              onClick={e => setNotifAnchor(e.currentTarget)}
              sx={{ width: 38, height: 38, color: 'primary.dark', bgcolor: 'background.default', '&:hover': { bgcolor: 'action.selected' } }}
            >
              <Badge badgeContent={unreadCount} color="error"><NotificationsNone fontSize="small" /></Badge>
            </IconButton>
          </Tooltip>
          <Button
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={Boolean(anchorEl)}
            onClick={e => setAnchorEl(e.currentTarget)}
            sx={{ px: 0.75, minWidth: 0, minHeight: 38, gap: 0.75, color: 'text.primary', border: 1, borderColor: 'divider' }}
          >
            <Avatar sx={{ width: 27, height: 27, bgcolor: 'primary.dark', color: 'primary.contrastText', fontSize: '0.8rem' }}>{user.name.charAt(0)}</Avatar>
            <Typography noWrap sx={{ display: { xs: 'none', sm: 'block' }, maxWidth: 150, fontSize: '0.84rem', fontWeight: 750 }}>{user.name}</Typography>
            <KeyboardArrowDown sx={{ display: { xs: 'none', sm: 'block' }, color: 'text.secondary', fontSize: 17 }} />
          </Button>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { mt: 1, minWidth: 220, borderRadius: 2 } }}>
            <MenuItem disabled><Typography fontWeight={700}>{user.name}</Typography></MenuItem>
            <MenuItem disabled><Typography variant="body2" color="text.secondary">{ROLE_LABELS[user.role]}</Typography></MenuItem>
            <Divider />
            {user.role === 'employee' && (
              <MenuItem onClick={() => { setAnchorEl(null); navigate('/dashboard/profile'); }}>
                <ListItemIcon><AccountCircle fontSize="small" /></ListItemIcon>My Profile
              </MenuItem>
            )}
            <MenuItem onClick={() => { setAnchorEl(null); handleLogout(); }}>
              <ListItemIcon><Logout fontSize="small" /></ListItemIcon>Logout
            </MenuItem>
          </Menu>

          {/* Notifications Popover */}
          <Popover
            open={Boolean(notifAnchor)}
            anchorEl={notifAnchor}
            onClose={() => setNotifAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { mt: 1, borderRadius: 2, width: 'min(400px, calc(100vw - 32px))', maxHeight: 500 } }}
          >
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography fontWeight={700}>Notifications</Typography>
              {unreadCount > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={unreadCount} size="small" color="error" />
                  <Button size="small" variant="text" onClick={handleMarkAllRead} sx={{ fontSize: '0.72rem', textTransform: 'none', p: 0.5, minWidth: 0 }}>
                    Mark all read
                  </Button>
                </Box>
              )}
            </Box>
            {notifications.length === 0 ? (
              <Paper elevation={0} sx={{ p: 3, textAlign: 'center' }}>
                <NotificationsNone sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">No new notifications at this time.</Typography>
              </Paper>
            ) : (
              <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                {notifications.map((notif) => {
                  const isRead = readIds.has(notif.id);
                  return (
                    <Box
                      key={notif.id}
                      onClick={() => {
                        if (notif.type === "application") navigate("/dashboard/recruitment");
                        if (notif.type === "schedule") navigate("/dashboard/schedule");
                      }}
                      sx={{
                        p: 2,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        cursor: 'pointer',
                        opacity: isRead ? 0.55 : 1,
                        bgcolor: isRead ? 'transparent' : 'action.selected',
                        transition: 'background 0.2s, opacity 0.2s',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} color={isRead ? 'text.secondary' : 'primary'}>
                            {notif.title}
                          </Typography>
                          <Typography variant="body2" color="text.primary" sx={{ mt: 0.5 }}>
                            {notif.message}
                          </Typography>
                          {notif.created_at && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                              {new Date(notif.created_at).toLocaleString()}
                            </Typography>
                          )}
                        </Box>
                        {!isRead && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => handleMarkRead(notif.id, e)}
                            sx={{ fontSize: '0.68rem', textTransform: 'none', whiteSpace: 'nowrap', minWidth: 0, px: 1, py: 0.25, flexShrink: 0 }}
                          >
                            Mark read
                          </Button>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Popover>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' }, width: drawerWidth, flexShrink: 0,
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', borderRight: 1, borderColor: 'divider', backgroundImage: 'none' },
        }}
      >
        {drawerContent}
      </Drawer>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: drawerWidth, maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', backgroundImage: 'none' },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flex: 1, minWidth: 0, minHeight: '100vh', pt: `${toolbarHeight}px` }}>
        <Box sx={{ maxWidth: 1760, mx: 'auto', p: { xs: 1.5, sm: 2, md: 3 } }}>
          <Outlet context={quickActions} />
        </Box>
      </Box>
    </Box>
  );
}
