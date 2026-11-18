import { useSearchParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import AttendanceMonitoring from "./AttendanceMonitoring";
import EmployeeDTR from "./EmployeeDTR";

/** Single attendance module entry point for employee DTR and staff attendance workflows. */
export default function AttendanceManagement() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isEmployee = String((user as any)?.role ?? "").toLowerCase() === "employee";
  const showDtr = searchParams.get("view") === "dtr";

  return isEmployee || showDtr ? <EmployeeDTR /> : <AttendanceMonitoring />;
}
