import { Alert, Snackbar, type AlertColor } from "./bootstrap";

interface ActionSnackbarProps {
  open: boolean;
  message: string;
  severity?: AlertColor;
  onClose: () => void;
}

export default function ActionSnackbar({
  open,
  message,
  severity = "success",
  onClose,
}: ActionSnackbarProps) {
  return (
    <Snackbar
      open={open}
      autoHideDuration={4000}
      onClose={onClose}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
    >
      <Alert
        variant="filled"
        severity={severity}
        onClose={onClose}
        sx={{
          width: "100%",
          minWidth: { xs: 280, sm: 340 },
          maxWidth: 440,
          borderRadius: "12px",
          fontWeight: 700,
          boxShadow: "0 18px 44px rgba(15, 23, 42, 0.22)",
          "& .MuiAlert-message": {
            overflowWrap: "anywhere",
          },
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
