/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  Ambulance,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  CloudUpload,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  Printer,
  Eye,
  FileBarChart,
  Filter,
  Gauge,
  HeartPulse,
  Home,
  History,
  MapPin,
  Menu,
  LogOut,
  PlusCircle,
  Upload,
  Trash2,
  Pencil,
  RefreshCw,
  Route,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  UserCog,
  UserRound,
  UsersRound,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast, Toaster } from "sonner";
import MaintenanceView from "./maintenance-view";

type View =
  | "dashboard"
  | "new"
  | "records"
  | "capacity"
  | "coordination"
  | "fleet"
  | "maintenance"
  | "approvals"
  | "audit"
  | "backups"
  | "reports"
  | "users"
  | "settings";
type Incident = Record<string, string | number | null> & { id?: number };
type Dashboard = {
  summary: Record<string, number>;
  governorates: { name: string; value: number }[];
  categories: { name: string; value: number }[];
  timeline: { month: string; value: number }[];
  cases: { name: string; value: number }[];
  stations: {
    name: string;
    incidents: number;
    distance: number;
    response: number;
  }[];
  crew: { name: string; value: number }[];
  vehicleStatus: { name: string; value: number }[];
};

const governors = ["غزة", "شمال غزة", "الوسطى", "خانيونس", "رفح"];
const employmentStatuses: [string, string][] = [
  ["on_duty", "على رأس عمله"],
  ["leave", "إجازة"],
  ["retired", "متقاعد"],
  ["contract_ended", "انتهاء عقد"],
  ["dismissed", "فصل"],
  ["resigned", "استقالة"],
  ["suspended", "موقوف عن العمل"],
  ["abroad", "مسافر"],
  ["detained", "معتقل"],
];
const employmentStatusLabel = (value: unknown) =>
  employmentStatuses.find(([key]) => key === String(value || "on_duty"))?.[1] || String(value || "على رأس عمله");
const stations = [
  "محطة غزة",
  "محطة شمال غزة",
  "محطة دير البلح",
  "محطة خانيونس",
  "محطة رفح",
];
const categories = ["Medical", "Trauma", "Martyr", "Delivery", "Accident", "Other"];
const categoryArabic: Record<string, string> = {
  Medical: "حالات مرضية",
  Trauma: "إصابات",
  Martyr: "شهيد",
  Delivery: "ولادة",
  Accident: "حوادث",
  Other: "أخرى",
};
const urgencyArabic: Record<string, string> = {
  Red: "حمراء",
  Yellow: "صفراء",
  Green: "خضراء",
  Black: "سوداء",
  "N/A": "غير مصنفة",
};
const hospitals = [
  "مجمع الشفاء الطبي",
  "مستشفى الأهلي العربي",
  "مستشفى القدس",
  "مستشفى الأمل",
  "مستشفى شهداء الأقصى",
  "مستشفى ناصر الطبي",
  "مستشفى غزة الأوروبي",
  "مستشفى الكويت التخصصي",
  "مستشفى العودة",
  "المستشفى الإندونيسي",
  "مستشفى كمال عدوان",
  "المستشفى الميداني الأردني",
  "المستشفى الميداني الإماراتي",
];
const currentSystemTime = () => {
  const value = new Date();
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
};
const formatDateTime24 = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const meridiem = raw.match(/^(.*?)(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (meridiem) {
    let hour = Number(meridiem[2]) % 12;
    if (meridiem[4].toUpperCase() === "PM") hour += 12;
    return `${meridiem[1]}${String(hour).padStart(2, "0")}:${meridiem[3]}`;
  }
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : raw;
};
const timeTypingValue = (value: string) => {
  const clean = value.replace(/[^0-9:]/g, "").slice(0, 5);
  if (clean.includes(":")) {
    const [hour = "", minute = ""] = clean.split(":");
    return `${hour.slice(0, 2)}:${minute.slice(0, 2)}`;
  }
  return clean.length > 2 ? `${clean.slice(0, 2)}:${clean.slice(2)}` : clean;
};
const normalizedTime24 = (value: string) => {
  const match = value.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59
    ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    : value;
};
function Time24Input({value,onChange,required=false,readOnly=false,disabled=false}:{value:string;onChange:(value:string)=>void;required?:boolean;readOnly?:boolean;disabled?:boolean}) {
  return <input type="text" className="time-24-input latin-datetime" inputMode="numeric" autoComplete="off" placeholder="HH:mm" maxLength={5} pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" title="أدخل الوقت بنظام 24 ساعة، مثال: 14:30" value={value||""} required={required} readOnly={readOnly} disabled={disabled} onChange={event=>onChange(timeTypingValue(event.target.value))} onBlur={event=>onChange(normalizedTime24(event.target.value))}/>;
}
function DateTime24Input({value,onChange,required=false}:{value:string;onChange:(value:string)=>void;required?:boolean}) {
  const [date="",time=""] = String(value||"").split("T");
  return <span className="datetime-24-control"><input type="date" lang="en-GB" dir="ltr" value={date} required={required} onChange={event=>onChange(event.target.value||time?`${event.target.value}T${time}`:"")}/><Time24Input value={time} required={required} onChange={nextTime=>onChange(date||nextTime?`${date}T${nextTime}`:"")}/></span>;
}
const palette = ["#c4172c", "#ef6a78", "#9c1d2d", "#f4a3ac", "#6e1423"];
const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 7)}-01`;
const emptyForm: Record<string, string> = {
  incidentNumber: "",
  incidentCode: "",
  incidentStatus: "completed",
  coordinationType: "",
  companionCount: "",
  entryTime: "",
  beneficiaryName: "",
  gender: "",
  contact: "",
  age: "",
  urgency: "",
  category: "",
  caseType: "",
  pickupType: "",
  pickupLocation: "",
  pickupGovernorate: "",
  pickupMunicipality: "",
  pickupNeighborhood: "",
  dropoffType: "",
  dropoffLocation: "",
  shift: "",
  station: "",
  center: "",
  vehicle: "",
  kmStart: "",
  kmEnd: "",
  callDate: today,
  callTime: "",
  dispatchDate: today,
  dispatchTime: "",
  onSceneDate: today,
  arrivalTime: "",
  hospitalDate: today,
  hospitalTime: "",
  availableDate: today,
  clearTime: "",
  returnTime: "",
  returnLocation: "",
  crew: "",
  dispatcherPrimary: "",
  dispatcherSecondary: "",
  emtDriver: "",
  emtLead: "",
  emtAssist: "",
  interventions: "",
  chiefComplaint: "",
  chiefComplaintOther: "",
  additionalBeneficiaries: "[]",
  emergencyEventType: "",
  emergencyEventNotes: "",
  previousIncidentCode: "",
  cancelled: "", patientDeceased: "", conflictRelated: "",
  oxygen: "", bvm: "", airway: "", cpr: "", aed: "", drugs: "",
  woundCare: "", tourniquet: "", immobilization: "", cervicalCollar: "",
  glucoseCheck: "", splinting: "", delivery: "",
  fuelLiters: "",
  notes: "",
};

export default function HomePage() {
  const [view, setView] = useState<View>("dashboard"),
    [mobile, setMobile] = useState(false),
    [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<Dashboard>({
    summary: {},
    governorates: [],
    categories: [],
    timeline: [],
    cases: [],
    stations: [],
    crew: [],
    vehicleStatus: [],
  });
  const [incidents, setIncidents] = useState<Incident[]>([]),
    [filters, setFilters] = useState({
      from: monthStart,
      to: today,
      governorate: "all",
      category: "all",
    }),
    [form, setForm] = useState<Record<string, string>>(() => ({ ...emptyForm }));
  const [notifications, setNotifications] = useState<any[]>([]),
    [showNotifications, setShowNotifications] = useState(false),
    [pending, setPending] = useState<Incident[]>([]),
    [users, setUsers] = useState<any[]>([]),
    [currentRole, setCurrentRole] = useState("viewer"),
    [currentUser, setCurrentUser] = useState<any>(null),
    [currentPermissions, setCurrentPermissions] = useState<string[]>([]),
    [settingsData, setSettingsData] = useState<any>({
      centers: [],
      stations: [],
      vehicles: [],
      staff: [],
      settings: [],
    });
  const [maintenancePrefill, setMaintenancePrefill] = useState<any>(null);
  const [requestedIncidentId,setRequestedIncidentId]=useState<number|null>(null);
  const [passwordOpen,setPasswordOpen]=useState(false);
  const [passwordDraft,setPasswordDraft]=useState({currentPassword:"",newPassword:"",confirmPassword:""});
  const [passwordBusy,setPasswordBusy]=useState(false);
  const [userMenuOpen,setUserMenuOpen]=useState(false);
  const reminderStarted=useRef(false);
  const refreshRequestId=useRef(0);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") setView("new");
  }, []);
  const query = useMemo(
    () => new URLSearchParams(filters).toString(),
    [filters],
  );
  const refresh = useCallback(async () => {
    const requestId=++refreshRequestId.current;
    setLoading(true);
    const fetchWithRetry = async (url: string) => {
      let lastError: unknown;
      const retryDelays=[350,800,1600];
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const controller=new AbortController();
        const timeout=window.setTimeout(()=>controller.abort(),15000);
        try {
          const response = await fetch(url, { cache: "no-store",signal:controller.signal });
          if ((response.status < 500 && response.status !== 429) || attempt === 3) return response;
        } catch (error) {
          lastError = error;
        } finally {
          window.clearTimeout(timeout);
        }
        if(attempt<3)await new Promise((resolve) => window.setTimeout(resolve,retryDelays[attempt]));
      }
      throw lastError || new Error("network request failed");
    };
    try {
      const [dashboardResult, recordsResult] = await Promise.allSettled([
        fetchWithRetry(`/api/dashboard?${query}`),
        fetchWithRetry(`/api/incidents?${query}`),
      ]);
      if(requestId!==refreshRequestId.current)return;

      if (recordsResult.status === "fulfilled") {
        const response = recordsResult.value;
        if (response.ok) {
          const records = await response.json();
          setIncidents(records.incidents || []);
        } else {
          const recordsError = await response.json().catch(() => ({}));
          toast.error(
            recordsError.error || "تعذر تحميل سجل البلاغات. حاول مرة أخرى.",
          );
        }
      } else {
        toast.error("تعذر الاتصال بسجل البلاغات. حاول مرة أخرى.");
      }

      if (dashboardResult.status === "fulfilled") {
        const response = dashboardResult.value;
        if (response.ok) {
          setDashboard(await response.json());
        } else {
          const dashboardError = await response.json().catch(() => ({}));
          toast.error(
            dashboardError.error || "تعذر تحميل لوحة المؤشرات. حاول مرة أخرى.",
          );
        }
      } else {
        toast.error("تعذر الاتصال بلوحة المؤشرات. حاول مرة أخرى.");
      }
    } finally {
      if(requestId===refreshRequestId.current)setLoading(false);
    }
  }, [query]);
  const loadAux = useCallback(async () => {
    try {
      const [n, a, u, s] = await Promise.all([
        fetch("/api/notifications"),
        fetch("/api/approvals"),
        fetch("/api/users"),
        fetch("/api/settings"),
      ]);
      if (n.ok) setNotifications((await n.json()).notifications);
      if (a.ok) setPending((await a.json()).incidents);
      if (u.status===401) { window.location.href="/login"; return; }
      if (u.ok) { const userData = await u.json(); setUsers(userData.users); setCurrentRole(userData.currentUser?.role || "viewer"); setCurrentUser(userData.currentUser); setCurrentPermissions(userData.currentUser?.permissions || []); }
      if (s.ok) setSettingsData(await s.json());
    } catch {}
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAux();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [loadAux]);
  useEffect(()=>{
    if(!currentUser?.id||reminderStarted.current)return;
    reminderStarted.current=true;
    const remind=async()=>{
      const response=await fetch("/api/incidents?mode=incomplete",{cache:"no-store"}).catch(()=>null);
      if(!response?.ok)return;
      const drafts=((await response.json()).incidents||[]) as any[];
      if(!drafts.length)return;
      const numbers=drafts.map((item:any)=>String(item.incident_number)).join("، ");
      toast.warning(`بلاغات غير مكتملة: ${numbers}`,{duration:12000,description:"يرجى استكمال البلاغات أو اعتمادها"});
      if("Notification" in window&&Notification.permission==="granted")new Notification("بلاغات EMS غير مكتملة",{body:`يرجى استكمال البلاغات: ${numbers}`});
    };
    const first=window.setTimeout(remind,3000);
    const timer=window.setInterval(remind,30*60*1000);
    return()=>{window.clearTimeout(first);window.clearInterval(timer);reminderStarted.current=false};
  },[currentUser?.id]);
  const changeMyPassword=async(e:React.FormEvent)=>{e.preventDefault();if(passwordDraft.newPassword!==passwordDraft.confirmPassword)return toast.error("كلمتا المرور الجديدة غير متطابقتين");setPasswordBusy(true);try{const response=await fetch("/api/users",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"changeMyPassword",currentPassword:passwordDraft.currentPassword,newPassword:passwordDraft.newPassword})});const result=await response.json();if(!response.ok)throw Error(result.error||"تعذر تغيير كلمة المرور");toast.success("تم تغيير كلمة المرور بنجاح");setPasswordOpen(false);setPasswordDraft({currentPassword:"",newPassword:"",confirmPassword:""})}catch(error){toast.error(String(error).replace(/^Error: /,""))}finally{setPasswordBusy(false)}};
  useEffect(() => {
    if (view !== "new" || form.incidentCode) return;
    const controller = new AbortController();
    fetch("/api/incidents?mode=next-code", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "تعذر إنشاء كود البلاغ");
        setForm((current) => ({
          ...current,
          incidentCode: result.code,
          incidentNumber: result.code,
          entryTime: current.entryTime || currentSystemTime(),
        }));
      })
      .catch((error) => {
        if (
          !(error instanceof DOMException && error.name === "AbortError")
        )
          toast.error("تعذر إنشاء كود البلاغ تلقائيًا");
      });
    return () => controller.abort();
  }, [view, form.incidentCode]);
  const setField = (key: string, value: string) =>
    setForm((v) => ({ ...v, [key]: value }));
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const submissionAction = submitter?.value === "approve" ? "approve" : "draft";
    const response = await fetch("/api/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, submissionAction }),
    });
    const result = await response.json();
    if (!response.ok) {
      toast.error(result.error || "تعذر حفظ البلاغ");
      return;
    }
    const createdCount = Number(result.createdCount || 1);
    toast.success(submissionAction === "approve" ? `تم اعتماد ${createdCount > 1 ? `${createdCount} بلاغات مترابطة` : `البلاغ ${form.incidentNumber}`}` : `تم حفظ البلاغ ${form.incidentNumber} كمسودة`);
    if (submissionAction === "approve" && form.emergencyEventType === "new_incident") {
      setForm({ ...emptyForm, callDate: today, center:form.center, station:form.station, vehicle:form.vehicle, kmStart:form.kmEnd, shift:form.shift, crew:form.crew, emtDriver:form.emtDriver, emtLead:form.emtLead, emtAssist:form.emtAssist, entryTime:currentSystemTime(), previousIncidentCode:form.incidentCode });
      setView("new");
      toast.info("تم فتح بلاغ متابعة جديد مع بيانات المركبة والطاقم");
    } else if (submissionAction === "approve" && form.emergencyEventType === "maintenance") {
      const vehicle = settingsData.vehicles.find((v:any)=>v.plate_number===form.vehicle);
      setMaintenancePrefill({vehicleId:String(vehicle?.id||""),stationId:String(vehicle?.station_id||""),odometerKm:form.kmEnd||form.kmStart||"",driverName:form.emtDriver||"",failureCause:form.emergencyEventNotes||"",sourceIncidentCode:form.incidentCode});
      setForm({ ...emptyForm, callDate: today });
      setView("maintenance");
    } else {
      setForm({ ...emptyForm, callDate: today });
      setView("dashboard");
    }
    refresh();
    loadAux();
  };
  const exportCsv = () => {
    const columns = [
      "incident_number",
      "beneficiary_name",
      "gender",
      "age",
      "urgency",
      "category",
      "case_type",
      "pickup_governorate",
      "station",
      "vehicle",
      "call_date",
      "call_time",
      "response_minutes",
      "distance_km",
    ];
    const csv = [
      columns.join(","),
      ...incidents.map((row) =>
        columns
          .map((c) => `"${String(row[c] ?? "").replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `EMS-report-${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const can=(permission:string)=>currentRole==="admin"||currentPermissions.includes("*")||currentPermissions.includes(permission);
  const nav = [
    { id: "dashboard", label: "الرئيسية", icon: Home, permission:"dashboard.view" },
    { id: "new", label: "تسجيل بلاغ", icon: PlusCircle, permission:"incidents.create" },
    { id: "records", label: "سجل البلاغات", icon: ClipboardList, permission:"incidents.view" },
    { id: "capacity", label: "القدرة التشغيلية", icon: Gauge, permission:"capacity.view" },
    { id: "coordination", label: "إدخال التنسيقات", icon: Route, permission:"coordination.view" },
    { id: "fleet", label: "المركبات والوقود", icon: Ambulance, permission:"fleet.view" },
    { id: "maintenance", label: "صيانة المركبات", icon: Wrench, permission:"maintenance.view" },
    { id: "approvals", label: "اعتماد الإحصائيات", icon: ClipboardCheck, permission:"approvals.manage" },
    { id: "audit", label: "سجل التعديلات", icon: History, permission:"audit.view" },
    { id: "backups", label: "النسخ الاحتياطي", icon: Archive, permission:"backup.manage" },
    { id: "reports", label: "التقارير", icon: FileBarChart, permission:"reports.view" },
    { id: "settings", label: "الإعدادات", icon: Settings, permission:"settings.manage" },
    { id: "users", label: "المستخدمون", icon: UserCog, permission:"users.manage" },
  ].filter(item=>can(item.permission)) as any[];
  return (
    <div className="app-shell">
      <Toaster richColors position="top-center" />
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <HeartPulse size={29} />
          </div>
          <div>
            <strong>نظام EMS</strong>
            <span>الهلال الأحمر الفلسطيني</span>
          </div>
          <button className="close-side" onClick={() => setMobile(false)}>
            <X />
          </button>
        </div>
        <nav>
          {nav.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => {
                setView(item.id);
                setMobile(false);
              }}
            >
              <item.icon />
              <span>{item.label}</span>
              {view === item.id && <ChevronLeft className="nav-arrow" />}
            </button>
          ))}
        </nav>
        <div className="side-status">
          <span className="live-dot" />
          <div>
            <b>النظام متصل</b>
            <small>آخر مزامنة: الآن</small>
          </div>
        </div>
        <button type="button" className={`side-user user-menu-trigger ${userMenuOpen?"open":""}`} onClick={()=>setUserMenuOpen(open=>!open)} aria-expanded={userMenuOpen}>
          <div className="avatar">وو</div>
          <div>
            <b>{currentUser?.fullName || "المستخدم"}</b>
            <small>{currentRole === "admin" ? "مدير النظام" : "مستخدم النظام"}</small>
          </div>
          <ChevronLeft className="user-menu-arrow" />
        </button>
        {userMenuOpen&&<div className="side-user-menu">
          <button type="button" onClick={()=>{setUserMenuOpen(false);setPasswordOpen(true)}}><ShieldCheck size={18}/><span>تغيير كلمة المرور</span></button>
          <button type="button" onClick={async()=>{setUserMenuOpen(false);await fetch("/api/auth/logout",{method:"POST"});window.location.href="/login";}}><LogOut size={18}/><span>تسجيل الخروج</span></button>
        </div>}
      </aside>
      {passwordOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setPasswordOpen(false)}}><form className="password-change-modal" onSubmit={changeMyPassword} dir="rtl"><div className="modal-head"><div><h2>تغيير كلمة المرور</h2><p>يلزم تأكيد كلمة المرور الحالية قبل حفظ الجديدة</p></div><button type="button" className="icon-btn" onClick={()=>setPasswordOpen(false)}><X/></button></div><label>كلمة المرور الحالية<input required type="password" autoComplete="current-password" value={passwordDraft.currentPassword} onChange={e=>setPasswordDraft({...passwordDraft,currentPassword:e.target.value})}/></label><label>كلمة المرور الجديدة<input required minLength={8} type="password" autoComplete="new-password" value={passwordDraft.newPassword} onChange={e=>setPasswordDraft({...passwordDraft,newPassword:e.target.value})}/></label><label>تأكيد كلمة المرور الجديدة<input required minLength={8} type="password" autoComplete="new-password" value={passwordDraft.confirmPassword} onChange={e=>setPasswordDraft({...passwordDraft,confirmPassword:e.target.value})}/></label><div className="modal-actions"><button type="button" className="ghost" onClick={()=>setPasswordOpen(false)}>إلغاء</button><button className="primary" disabled={passwordBusy}><Save/>{passwordBusy?"جارٍ الحفظ…":"حفظ كلمة المرور"}</button></div></form></div>}
      {mobile && (
        <button
          className="overlay"
          onClick={() => setMobile(false)}
          aria-label="إغلاق القائمة"
        />
      )}
      <main className="main">
        <header>
          <button className="menu-btn" onClick={() => setMobile(true)}>
            <Menu />
          </button>
          <div>
            <h1>{nav.find((n) => n.id === view)?.label}</h1>
            <p>
              {view === "dashboard"
                ? "مؤشرات العمليات المعتمدة"
                : view === "new"
                  ? "إدخال بلاغ جديد وإرساله للاعتماد"
                  : view === "records"
                    ? "متابعة ومراجعة البلاغات المسجلة"
                    : view === "capacity"
                      ? "توزيع الموظفين والمركبات على المراكز والورديات"
                      : view === "coordination"
                        ? "تسجيل عمليات التنسيق وحركة المرضى والمركبات"
                        : view === "fleet"
                          ? "تعبئة الوقود وحركة الأسطول وربطها بالبلاغات"
                          : view === "maintenance"
                            ? "طلبات الصيانة والمرفقات وحالة المركبة"
                        : view === "approvals"
                          ? "مراجعة الإحصائيات قبل ظهورها في المؤشرات"
                        : view === "audit"
                          ? "تتبع إنشاء البلاغات وتعديلها واعتمادها"
                          : view === "reports"
                            ? "تقارير مستقلة قابلة للطباعة والتصدير"
                            : view === "backups"
                              ? "نسخ يومية تلقائية ونسخ فورية مع حفظ آمن خارج الخادم"
                            : view === "users"
                              ? "إدارة الحسابات والأدوار والصلاحيات"
                              : "إدارة القوائم الأساسية للنظام"}
            </p>
          </div>
          <div className="header-actions">
            <button
              className="icon-btn"
              onClick={() => setShowNotifications((v) => !v)}
            >
              <Bell />
              {notifications.filter((n) => !n.is_read).length > 0 && (
                <span className="notification">
                  {notifications.filter((n) => !n.is_read).length}
                </span>
              )}
            </button>
            <button className="primary compact" onClick={() => window.open("/?new=1", "_blank", "noopener,noreferrer")}>
              <PlusCircle /> بلاغ جديد
            </button>
          </div>
          {showNotifications && (
            <NotificationPanel
              items={notifications}
              close={() => setShowNotifications(false)}
              reload={loadAux}
            />
          )}
        </header>
        {view === "dashboard" && (
          <DashboardView
            dashboard={dashboard}
            staff={settingsData.staff}
            filters={filters}
            setFilters={setFilters}
            loading={loading}
            refresh={refresh}
            onGovernorate={(name) =>
              setFilters((f) => ({ ...f, governorate: name }))
            }
          />
        )}{" "}
        {view === "new" && (
          <IncidentForm form={form} setField={setField} submit={submit} centers={settingsData.centers} stationsData={settingsData.stations} vehicles={settingsData.vehicles} settings={settingsData.settings} />
        )}{" "}
        {view === "records" && (
          <Records
            incidents={incidents}
            loading={loading}
            onRefresh={() => { refresh(); loadAux(); }}
            filters={filters}
            setFilters={setFilters}
            centers={settingsData.centers}
            stationsData={settingsData.stations}
            vehicles={settingsData.vehicles}
            isAdmin={currentRole === "admin"}
            currentUser={currentUser}
            canEdit={can("incidents.edit")}
            canEditApproved={can("incidents.edit_approved")}
            initialIncidentId={requestedIncidentId}
            onInitialIncidentHandled={()=>setRequestedIncidentId(null)}
            modalOnly={false}
          />
        )}{" "}
        {view === "approvals" && (
          <Approvals
            items={pending}
            reload={() => {
              loadAux();
              refresh();
            }}
          />
        )}{" "}
        {view === "audit" && <AuditLogView />}{" "}
        {view === "backups" && <BackupsView />}{" "}
        {view === "reports" && (
          <ReportsV2
            dashboard={dashboard}
            incidents={incidents}
            filters={filters}
            setFilters={setFilters}
            exportCsv={exportCsv}
            settingsData={settingsData}
          />
        )}{" "}
        {view === "users" && <UsersView users={users} centers={settingsData.centers} reload={loadAux} />}{" "}
        {view === "settings" && (
          <SettingsView2 data={settingsData} reload={loadAux} />
        )}
        {view === "capacity" && <OperationalCapacity data={settingsData} />}
        {view === "coordination" && <CoordinationView />}
        {view === "fleet" && <><FleetView staff={settingsData.staff} centersData={settingsData.centers} onImported={loadAux} onOpenIncident={incidentId=>setRequestedIncidentId(incidentId)} /><Records incidents={incidents} loading={loading} onRefresh={()=>{refresh();loadAux();window.dispatchEvent(new Event("ems:fleet-refresh"))}} filters={filters} setFilters={setFilters} centers={settingsData.centers} stationsData={settingsData.stations} vehicles={settingsData.vehicles} isAdmin={currentRole==="admin"} currentUser={currentUser} canEdit={can("incidents.edit")} canEditApproved={can("incidents.edit_approved")} initialIncidentId={requestedIncidentId} onInitialIncidentHandled={()=>setRequestedIncidentId(null)} modalOnly /></>}
        {view === "maintenance" && <MaintenanceView onVehiclesChanged={loadAux} prefill={maintenancePrefill} />}
      </main>
    </div>
  );
}

function Filters({
  filters,
  setFilters,
  refresh,
}: {
  filters: any;
  setFilters: any;
  refresh?: () => void;
}) {
  return (
    <section className="filters-panel">
      <div className="filter-title">
        <div className="round-icon">
          <SlidersHorizontal />
        </div>
        <div>
          <b>فلاتر العرض</b>
          <span>حدد نطاق البيانات المطلوبة</span>
        </div>
      </div>
      <div className="filters-grid">
        <label>
          من تاريخ
          <input
            type="date"
            value={filters.from}
            onChange={(e) =>
              setFilters((f: any) => ({ ...f, from: e.target.value }))
            }
          />
        </label>
        <label>
          إلى تاريخ
          <input
            type="date"
            value={filters.to}
            onChange={(e) =>
              setFilters((f: any) => ({ ...f, to: e.target.value }))
            }
          />
        </label>
        <label>
          المحافظة
          <select
            value={filters.governorate}
            onChange={(e) =>
              setFilters((f: any) => ({ ...f, governorate: e.target.value }))
            }
          >
            <option value="all">جميع المحافظات</option>
            {governors.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          تصنيف الحالة
          <select
            value={filters.category}
            onChange={(e) =>
              setFilters((f: any) => ({ ...f, category: e.target.value }))
            }
          >
            <option value="all">جميع التصنيفات</option>
            {categories.map((x) => (
              <option key={x} value={x}>
                {categoryArabic[x]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="filter-buttons">
        <button
          className="ghost"
          onClick={() =>
            setFilters({
              from: monthStart,
              to: today,
              governorate: "all",
              category: "all",
            })
          }
        >
          <RefreshCw /> إعادة ضبط
        </button>
        {refresh && (
          <button className="primary" onClick={refresh}>
            <Filter /> تطبيق
          </button>
        )}
      </div>
    </section>
  );
}

function DashboardView({
  dashboard,
  staff,
  filters,
  setFilters,
  loading,
  refresh,
  onGovernorate,
}: {
  dashboard: Dashboard;
  staff: any[];
  filters: any;
  setFilters: any;
  loading: boolean;
  refresh: () => void;
  onGovernorate: (n: string) => void;
}) {
  const s = dashboard.summary || {};
  const total = Number(s.total || 0);
  const workingVehicles = Number(s.workingVehicles || 0);
  const outVehicles = Number(s.outVehicles || 0);
  const fleetTotal = workingVehicles + outVehicles;
  const fleetReadiness = fleetTotal
    ? Math.round((workingVehicles / fleetTotal) * 100)
    : 0;
  const activeStaff = (staff || []).filter((person) => Number(person.active ?? 1) === 1);
  const staffGroup = (key: "center" | "cadre") => {
    const grouped = new Map<string, number>();
    activeStaff.forEach((person) => {
      let detail: any = {};
      try { detail = JSON.parse(person.detail || "{}"); } catch {}
      const label = key === "center"
        ? person.center_name || detail.station || "غير مرتبط بمركز"
        : person.cadre_type || detail.category || person.job_title || "غير مصنف";
      grouped.set(label, (grouped.get(label) || 0) + 1);
    });
    return [...grouped.entries()].map(([name,value]) => ({name,value})).sort((a,b) => b.value-a.value);
  };
  const workforceCenters = staffGroup("center");
  const workforceCadres = staffGroup("cadre");
  const licensedStaff = activeStaff.filter((person) => {
    try { return JSON.parse(person.detail || "{}").ambulanceLicence === "Yes"; } catch { return false; }
  }).length;
  const cards = [
    {
      label: "الحالات المنقولة",
      value: s.transferred || 0,
      sub: "حالة مسجلة ومنقولة",
      icon: Siren,
      tone: "red",
      progress: total ? Math.min(100,(Number(s.transferred||0)/total)*100) : 0,
    },
    {
      label: "الشهداء",
      value: s.martyrs || 0,
      sub: "وفق البلاغات المعتمدة",
      icon: HeartPulse,
      tone: "navy",
      progress: total ? Math.min(100,(Number(s.martyrs||0)/total)*100) : 0,
    },
    {
      label: "الإصابات",
      value: s.injuries || 0,
      sub: "حالات مصنفة كإصابات",
      icon: Activity,
      tone: "amber",
      progress: total ? Math.min(100,(Number(s.injuries||0)/total)*100) : 0,
    },
    {
      label: "السيارات العاملة",
      value: s.workingVehicles || 0,
      sub: "مركبة جاهزة للتشغيل",
      icon: Ambulance,
      tone: "green",
      progress: Number(s.workingVehicles||0)+Number(s.outVehicles||0) ? (Number(s.workingVehicles||0)/(Number(s.workingVehicles||0)+Number(s.outVehicles||0)))*100 : 0,
    },
    {
      label: "السيارات خارج الخدمة",
      value: s.outVehicles || 0,
      sub: "صيانة أو توقف تشغيلي",
      icon: Wrench,
      tone: "red",
      progress: Number(s.workingVehicles||0)+Number(s.outVehicles||0) ? (Number(s.outVehicles||0)/(Number(s.workingVehicles||0)+Number(s.outVehicles||0)))*100 : 0,
    },
    {
      label: "المراكز والمحطات",
      value: s.centers || 0,
      sub: "مركز ومحطة فعالة",
      icon: MapPin,
      tone: "blue",
      progress: Math.min(100,Number(s.centers||0)*10),
    },
    {
      label: "عمليات التنسيق",
      value: s.coordinations || 0,
      sub: "عملية خلال الفترة المحددة",
      icon: ClipboardCheck,
      tone: "purple",
      progress: Math.min(100,Number(s.coordinations||0)*2),
    },
    {
      label: "الطواقم العاملة",
      value: s.activeCrew || 0,
      sub: `${dashboard.crew.length} تصنيفات وظيفية`,
      icon: UsersRound,
      tone: "blue",
      progress: Math.min(100,Number(s.activeCrew||0)),
    },
    {
      label: "المسافة المقطوعة",
      value: s.distance || 0,
      unit: "كم",
      sub: "إجمالي الإنجاز الميداني",
      icon: Route,
      tone: "green",
      progress: Math.min(100,Number(s.distance||0)/100),
    },
    {
      label: "متوسط الاستجابة",
      value: s.avgResponse || 0,
      unit: "دقيقة",
      sub: "من التحريك حتى الوصول",
      icon: Clock3,
      tone: "amber",
      progress: Math.max(8,Math.min(100,100-Number(s.avgResponse||0)*3)),
    },
  ];
  return (
    <div className="page-stack">
      <Filters {...{ filters, setFilters, refresh }} />
      <section className="dashboard-overview panel">
        <div>
          <span className="dashboard-live"><i /> بيانات تشغيلية معتمدة</span>
          <h2>لوحة الإنجاز التشغيلي للإسعاف والطوارئ</h2>
          <p>قراءة مباشرة للحالات والطواقم والأسطول والمراكز وعمليات التنسيق.</p>
        </div>
        <div className="dashboard-period">
          <small>الفترة المعروضة</small>
          <b>{filters.from} — {filters.to}</b>
        </div>
      </section>
      <section className="kpi-grid">
        {cards.map((c, i) => (
          <article
            className={`kpi kpi-${c.tone} ${loading ? "loading" : ""}`}
            key={c.label}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="kpi-icon">
              <c.icon />
            </div>
            <div className="kpi-copy">
              <span>{c.label}</span>
              <div className="kpi-value"><strong>{c.value}</strong>{c.unit && <small>{c.unit}</small>}</div>
              <p>{c.sub}</p>
              <span className="kpi-progress" aria-hidden="true"><i style={{width: `${c.progress}%`}} /></span>
            </div>
          </article>
        ))}
      </section>
      <section className="achievement-ribbon">
        <div><b>{s.total||0}</b><span>بلاغًا معتمدًا</span></div>
        <div><b>{s.beneficiaries||0}</b><span>مستفيدًا</span></div>
        <div><b>{s.redCases||0}</b><span>حالة حرجة</span></div>
        <div><b>{dashboard.governorates.length}</b><span>محافظات مغطاة</span></div>
      </section>
      <section className="charts-grid">
        <article className="panel chart-wide workforce-panel">
          <PanelTitle
            icon={UsersRound}
            title="القوى العاملة في الدائرة"
            subtitle="بيانات مباشرة من دليل الموظفين"
          />
          <div className="workforce-highlights">
            <div className="workforce-total"><UsersRound/><span>إجمالي الموظفين الفعالين</span><b>{activeStaff.length}</b></div>
            <div><Building2/><span>المراكز المرتبطة</span><b>{workforceCenters.filter(x=>x.name!=="غير مرتبط بمركز").length}</b></div>
            <div><ShieldCheck/><span>حاملو رخصة إسعاف</span><b>{licensedStaff}</b></div>
          </div>
          <div className="workforce-breakdown">
            <div className="workforce-list">
              <h4><MapPin/> التوزيع حسب المركز</h4>
              {workforceCenters.slice(0,5).map((item,index)=><div key={item.name}><span><i style={{background:["#c4172c","#2477a8","#198754","#cf7b16","#8a4fa3"][index%5]}}/>{item.name}</span><b>{item.value}</b></div>)}
              {!workforceCenters.length && <small>لا يوجد موظفون مسجلون</small>}
            </div>
            <div className="workforce-list cadres">
              <h4><UserCog/> التوزيع حسب الكادر</h4>
              {workforceCadres.slice(0,5).map((item,index)=><div key={item.name}><span>{item.name}</span><b>{item.value}</b><em><i style={{width:`${Math.max(8,(item.value/(workforceCadres[0]?.value||1))*100)}%`}}/></em></div>)}
              {!workforceCadres.length && <small>لا توجد تصنيفات متاحة</small>}
            </div>
          </div>
        </article>
        <article className="panel fleet-pulse-panel">
          <PanelTitle
            icon={Gauge}
            title="مؤشر جاهزية الأسطول"
            subtitle="حالة المركبات الآن"
          />
          <div className="fleet-live-body">
            <div className="fleet-readiness-gauge" style={{"--readiness": `${fleetReadiness * 3.6}deg`} as React.CSSProperties}>
              <div>
                <span className="fleet-live-label"><i /> مباشر</span>
                <strong>{fleetReadiness}%</strong>
                <small>جاهزية تشغيلية</small>
              </div>
            </div>
            <div className="fleet-status-grid">
              <div className="fleet-status-card ready"><Ambulance/><span>عاملة الآن</span><b>{workingVehicles}</b></div>
              <div className="fleet-status-card stopped"><Wrench/><span>خارج الخدمة</span><b>{outVehicles}</b></div>
            </div>
            <div className="fleet-readiness-track"><i style={{width:`${fleetReadiness}%`}} /></div>
            <p className="fleet-summary">من أصل <b>{fleetTotal}</b> مركبة مسجلة في النظام</p>
          </div>
        </article>
        <article className="panel chart-half">
          <PanelTitle
            icon={MapPin}
            title="البلاغات حسب المحافظة"
            subtitle="اضغط على العمود لتصفية اللوحة"
          />
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={dashboard.governorates} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={75} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  fill="#c4172c"
                  radius={[8, 8, 8, 8]}
                  onClick={(x: any) => onGovernorate(x.name)}
                  cursor="pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="panel chart-half">
          <PanelTitle
            icon={BarChart3}
            title="تصنيف الطواقم العاملة"
            subtitle="التوزيع حسب المسمى أو الكادر"
          />
          <div className="ranking">
            {dashboard.crew.map((x, i) => (
              <div key={x.name}>
                <span className="rank">{i + 1}</span>
                <div>
                  <b>{x.name}</b>
                  <span>
                    <i
                      style={{
                        width: `${Math.max(8, (x.value / (dashboard.crew[0]?.value || 1)) * 100)}%`,
                      }}
                    />
                  </span>
                </div>
                <strong>{x.value}</strong>
              </div>
            ))}
            {!dashboard.crew.length && <Empty />}
          </div>
        </article>
      </section>
    </div>
  );
}

function IncidentForm({
  form,
  setField,
  submit,
  centers,
  stationsData,
  vehicles,
  settings,
}: {
  form: Record<string, string>;
  setField: (k: string, v: string) => void;
  submit: (e: React.FormEvent<HTMLFormElement>) => void;
  centers: any[];
  stationsData: any[];
  vehicles: any[];
  settings: any[];
}) {
  const [emergencyEventOpen, setEmergencyEventOpen] = useState(Boolean(form.emergencyEventType));
  const selectedCenterId = Number(form.center || 0);
  const availableStations = (stationsData || []).filter((s:any) => !selectedCenterId || Number(s.center_id) === selectedCenterId);
  const selectedStation = (stationsData || []).find((s:any) => s.name === form.station);
  const availableVehicles = selectedCenterId
    ? (vehicles || []).filter((v:any) => v.active !== 0 && Number(v.center_id) === selectedCenterId)
    : [];
  const selectableVehicles = availableVehicles.filter((v:any) => !v.odometer_blocking_incident);
  const selectedVehicle = (vehicles || []).find((v:any)=>v.plate_number===form.vehicle);
  const incidentStatus = form.incidentStatus || "completed";
  const isCancelled = incidentStatus === "cancelled_before_dispatch" || incidentStatus === "cancelled_after_dispatch";
  const isCoordination = incidentStatus === "coordination";
  const requiresBeneficiary = !(isCoordination && form.coordinationType === "returnees");
  const requiresMovement = incidentStatus !== "cancelled_before_dispatch";
  const requiresDelivery = incidentStatus === "completed";
  const settingValues = (category:string) => (settings||[]).filter((x:any)=>x.category===category && x.value).map((x:any)=>String(x.value));
  const hospitalCategory = form.dropoffType === "Hospital (Public)" ? "hospital_public" : form.dropoffType === "Hospital (Private)" ? "hospital_private" : "hospital_field";
  const hospitalOptions = settingValues(hospitalCategory);
  const complaintOptions = settingValues("chief_complaint");
  let additionalBeneficiaries:any[]=[]; try { additionalBeneficiaries=JSON.parse(form.additionalBeneficiaries||"[]"); } catch {}
  const setAdditional = (rows:any[]) => setField("additionalBeneficiaries",JSON.stringify(rows));
  const field = (
    name: string,
    label: string,
    type = "text",
    required = false,
  ) => (
    <label>
      {label}
      {required && <em>*</em>}
      {type === "time" ? <Time24Input value={form[name]} required={required} onChange={value=>setField(name,value)}/> : <input
        type={type}
        lang={type==="time"||type==="datetime-local"?"en-GB-u-hc-h23":type==="date"?"en-GB":undefined}
        dir={type==="time"||type==="datetime-local"||type==="date"||type==="number"||type==="tel"?"ltr":undefined}
        step={type==="time"?60:undefined}
        value={form[name]}
        required={required}
        onChange={(e) => {
          const value = e.target.value;
          setField(name, value);
          if (name === "caseType" && /وفاة|شهيد|جث/i.test(value))
            setField("urgency", "Black");
        }}
      />}
    </label>
  );
  const select = (
    name: string,
    label: string,
    options: string[],
    required = false,
    labels?: Record<string, string>,
  ) => (
    <label>
      {label}
      {required && <em>*</em>}
      <select
        value={form[name]}
        required={required}
        onChange={(e) => {
          const value = e.target.value;
          setField(name, value);
          if (name === "category" && value === "Martyr")
            setField("urgency", "Black");
        }}
      >
        <option value="">اختر...</option>
        {options.map((x) => (
          <option key={x} value={x}>
            {labels?.[x] || x}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <form className="incident-form" onSubmit={submit} noValidate>
      <section className="form-hero">
        <div className="round-icon large">
          <Ambulance />
        </div>
        <div>
          <h2>تسجيل بلاغ جديد</h2>
          <p>يُنشأ كود موحد تلقائيًا، وتتغير الحقول المطلوبة حسب حالة البلاغ</p>
        </div>
        <div className="auto-number">
          <span>كود البلاغ</span>
          <input
            placeholder="يُنشأ تلقائيًا"
            value={form.incidentCode}
            readOnly
            required
          />
        </div>
      </section>

      <FormSection icon={Clock3} title="حالة البلاغ والتوقيتات">
        <div className="form-grid cols-3">
          {select(
            "incidentStatus",
            "حالة البلاغ",
            ["completed", "coordination", "cancelled_before_dispatch", "cancelled_after_dispatch"],
            true,
            {
              completed: "عملية النقل مكتملة",
              coordination: "تنسيق",
              cancelled_before_dispatch: "ملغي قبل تحرك المركبة",
              cancelled_after_dispatch: "ملغي بعد تحرك المركبة",
            },
          )}
          {isCoordination && select("coordinationType", "نوع التنسيق", ["yellow_line", "evacuation", "returnees"], true, { yellow_line:"تنسيق الخط الأصفر", evacuation:"تنسيق إجلاء", returnees:"تنسيق عائدين" })}
          {field("callDate", "تاريخ البلاغ", "date", true)}
          <label>
            وقت إدخال البلاغ
            <Time24Input value={form.entryTime} onChange={()=>{}} readOnly />
          </label>
          {field("callTime", "وقت استلام البلاغ", "time", true)}
          {requiresMovement && field("dispatchTime", "وقت تحرك المركبة", "time")}
          {requiresMovement && field("arrivalTime", "وقت الوصول للموقع", "time")}
          {requiresDelivery && field("hospitalTime", "وقت الوصول للمستشفى", "time")}
          {requiresMovement && field("returnTime", "وقت العودة للمحطة", "time")}
          {incidentStatus === "cancelled_after_dispatch" && field("returnLocation", "مكان الرجوع", "text", true)}
          {requiresMovement && field("clearTime", "وقت الجاهزية", "time")}
        </div>
        <p className="form-section-note">
          {incidentStatus === "cancelled_before_dispatch"
            ? "لن يطلب النظام بيانات المركبة أو الحركة أو تسليم الحالة."
            : incidentStatus === "cancelled_after_dispatch"
              ? "سيتم تسجيل بيانات الحركة والمركبة دون طلب بيانات تسليم الحالة للمستشفى."
              : isCoordination
                ? form.coordinationType === "returnees" ? "يمكن تسجيل تنسيق العائدين دون مستفيد، مع حفظ حركة المركبة والطاقم." : "سيتم تسجيل بيانات التنسيق وحركة المركبة والمستفيدين."
                : "سيتم تسجيل مسار البلاغ كاملًا حتى تسليم الحالة وعودة المركبة."}
        </p>
      </FormSection>

      {requiresBeneficiary && <FormSection icon={Siren} title="تصنيف الحالة">
        <div className="form-grid cols-3">
          {select(
            "category",
            "التصنيف الرئيسي",
            categories,
            true,
            categoryArabic,
          )}
          {field("caseType", "نوع الحالة", "text", true)}
          {select(
            "urgency",
            "درجة الأولوية",
            ["Red", "Yellow", "Green", "Black", "N/A"],
            true,
            urgencyArabic,
          )}
        </div>
      </FormSection>}

      {!isCancelled && <FormSection icon={MapPin} title="استلام الحالة وتسليمها">
        <div className="form-grid cols-4">
          {select("pickupGovernorate", "المحافظة", governors, true)}
          {field("pickupMunicipality", "البلدية")}
          {field("pickupNeighborhood", "الحي")}
          {select("pickupType", "مكان استلام الحالة", [
            "House",
            "Shelter/tent",
            "Street",
            "Field",
            "Clinic (Public)",
            "Hospital",
          ], false, {
            House: "منزل",
            "Shelter/tent": "مأوى / خيمة",
            Street: "شارع",
            Field: "ميدان",
            "Clinic (Public)": "عيادة",
            Hospital: "مستشفى",
          })}
          {field("pickupLocation", "وصف مكان الاستلام")}
          {requiresDelivery &&
            select("dropoffType", "نوع جهة التسليم", [
              "Hospital (Public)",
              "Hospital (Private)",
              "Hospital (Field)",
              "No transport (no need)",
            ], false, {
              "Hospital (Public)": "مستشفى حكومي",
              "Hospital (Private)": "مستشفى خاص",
              "Hospital (Field)": "مستشفى ميداني",
              "No transport (no need)": "لا يحتاج إلى نقل",
            })}
          {requiresDelivery &&
            form.dropoffType.startsWith("Hospital") &&
            select("dropoffLocation", "المستشفى المستلم", hospitalOptions, true)}
        </div>
      </FormSection>}

      <FormSection icon={Ambulance} title="المركز والمحطة والمركبة">
        <div className="form-grid cols-4">
          <label>
            المركز <em>*</em>
            <select
              required
              value={form.center}
              onChange={(e) => {
                setField("center", e.target.value);
                setField("station", "");
                setField("vehicle", "");
                setField("kmStart", "");
                setField("kmEnd", "");
              }}
            >
              <option value="">اختر المركز...</option>
              {(centers || [])
                .filter((c: any) => c.active !== 0)
                .map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
          </label>
          <label>
            المحطة <em>*</em>
            <select
              required
              disabled={!form.center}
              value={form.station}
              onChange={(e) => {
                setField("station", e.target.value);
              }}
            >
              <option value="">
                {form.center ? "اختر المحطة..." : "اختر المركز أولًا"}
              </option>
              {availableStations
                .filter((s: any) => s.active !== 0)
                .map((s: any) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
            </select>
          </label>
          {select("shift", "الوردية", ["A", "B", "C"], true)}
          {requiresMovement && (
            <label>
              رقم المركبة <em>*</em>
              <select
                required
                disabled={!selectedCenterId}
                value={form.vehicle}
                onChange={(e) => {
                  const plate = e.target.value;
                  const vehicle = (vehicles || []).find(
                    (v: any) => v.plate_number === plate,
                  );
                  setField("vehicle", plate);
                  setField(
                    "kmStart",
                    plate ? String(Number(vehicle?.mileage_km || 0)) : "",
                  );
                  setField("kmEnd", "");
                }}
              >
                <option value="">
                  {!selectedCenterId
                    ? "اختر المركز أولًا"
                    : selectableVehicles.length
                      ? "اختر المركبة..."
                      : availableVehicles.length
                        ? "المركبات مرتبطة ببلاغات مفتوحة"
                        : "لا توجد مركبات مرتبطة بالمركز"}
                </option>
                {availableVehicles.map((v: any) => (
                  <option key={v.id} value={v.plate_number} disabled={Boolean(v.odometer_blocking_incident)}>
                    {v.plate_number} — {v.odometer_blocking_incident ? `محجوزة في البلاغ ${v.odometer_blocking_incident} (العداد غير مكتمل)` : v.fuel_type || "وقود غير محدد"}
                  </option>
                ))}
              </select>
            </label>
          )}
          {requiresMovement && (
            <label>
              عداد البداية
              <input
                type="number"
                readOnly
                value={form.kmStart}
                placeholder="يُقرأ من المركبة"
              />
            </label>
          )}
          {requiresMovement && (
            <label>
              عداد النهاية
              <input
                type="number"
                min={Number(selectedVehicle?.mileage_km || 0)}
                disabled={!form.vehicle}
                value={form.kmEnd}
                onChange={(e) => setField("kmEnd", e.target.value)}
              />
            </label>
          )}
          {requiresMovement && field("fuelLiters", "الوقود باللتر", "number")}
        </div>
      </FormSection>

      {requiresMovement && (
        <FormSection icon={UsersRound} title="طاقم البلاغ">
          <div className="form-grid cols-5">
            {field("dispatcherPrimary", "المستقبل الرئيسي")}
            {field("dispatcherSecondary", "المستقبل المساند")}
            {field("emtDriver", "المسعف السائق")}
            {field("emtLead", "مسعف قائد")}
            {field("emtAssist", "مسعف مساعد")}
            {field("crew", "أفراد الطاقم")}
          </div>
        </FormSection>
      )}

      <FormSection icon={UserRound} title={requiresBeneficiary ? "بيانات المستفيد" : "بيانات المستفيد (اختيارية)"}>
        <div className="form-grid cols-4">
          {field("beneficiaryName", "الاسم الكامل")}
          {select("gender", "الجنس", ["Male", "Female", "Unknown"], true, {
            Male: "ذكر",
            Female: "أنثى",
            Unknown: "غير معروف",
          })}
          {field("age", "العمر", "number")}
          {field("contact", "رقم التواصل", "tel")}
          {isCoordination && form.coordinationType === "evacuation" && field("companionCount", "عدد المرافقين", "number")}
        </div>
      </FormSection>

      <FormSection icon={UsersRound} title="مستفيدون إضافيون في نفس الحركة">
        <p className="form-section-note">أضف الحالات التي نُقلت بنفس المركبة. سيحصل كل مستفيد على كود بلاغ مستقل دون إعادة إدخال بيانات الحركة والمحطة والطاقم.</p>
        <div className="beneficiary-list">
          {additionalBeneficiaries.map((person:any,index:number)=><div className="beneficiary-card" key={person.localId||index}>
            <div className="beneficiary-card-head"><b>المستفيد {index+2}</b><button type="button" className="ghost" onClick={()=>setAdditional(additionalBeneficiaries.filter((_:any,i:number)=>i!==index))}><Trash2/> حذف</button></div>
            <div className="form-grid cols-4">
              <label>الاسم الكامل<input value={person.beneficiaryName||""} onChange={e=>setAdditional(additionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,beneficiaryName:e.target.value}:x))}/></label>
              <label>الجنس <em>*</em><select required value={person.gender||""} onChange={e=>setAdditional(additionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,gender:e.target.value}:x))}><option value="">اختر...</option><option value="Male">ذكر</option><option value="Female">أنثى</option><option value="Unknown">غير معروف</option></select></label>
              <label>العمر<input type="number" value={person.age||""} onChange={e=>setAdditional(additionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,age:e.target.value}:x))}/></label>
              <label>رقم التواصل<input value={person.contact||""} onChange={e=>setAdditional(additionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,contact:e.target.value}:x))}/></label>
              {isCoordination&&form.coordinationType==="evacuation"&&<label>عدد المرافقين<input type="number" min="0" value={person.companionCount||""} onChange={e=>setAdditional(additionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,companionCount:e.target.value}:x))}/></label>}
              <label>التصنيف <em>*</em><select required value={person.category||""} onChange={e=>setAdditional(additionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,category:e.target.value,urgency:e.target.value==="Martyr"?"Black":x.urgency}:x))}><option value="">اختر...</option>{categories.map(x=><option key={x} value={x}>{categoryArabic[x]}</option>)}</select></label>
              <label>نوع الحالة <em>*</em><input required value={person.caseType||""} onChange={e=>setAdditional(additionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,caseType:e.target.value}:x))}/></label>
              <label>درجة الأولوية <em>*</em><select required value={person.urgency||""} onChange={e=>setAdditional(additionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,urgency:e.target.value}:x))}><option value="">اختر...</option>{["Red","Yellow","Green","Black","N/A"].map(x=><option key={x} value={x}>{urgencyArabic[x]}</option>)}</select></label>
              <label>الشكوى الرئيسية<select value={person.chiefComplaint||""} onChange={e=>setAdditional(additionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,chiefComplaint:e.target.value}:x))}><option value="">اختر...</option>{complaintOptions.map(x=><option key={x}>{x}</option>)}<option value="__other">أخرى</option></select></label>
              {person.chiefComplaint==="__other"&&<label>اكتب الشكوى<input value={person.chiefComplaintOther||""} onChange={e=>setAdditional(additionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,chiefComplaintOther:e.target.value}:x))}/></label>}
            </div>
          </div>)}
        </div>
        <button type="button" className="ghost add-beneficiary" onClick={()=>setAdditional([...additionalBeneficiaries,{localId:crypto.randomUUID(),beneficiaryName:"",gender:"",age:"",contact:"",companionCount:"",category:"",caseType:"",urgency:"",chiefComplaint:"",chiefComplaintOther:""}])}><PlusCircle/> إضافة مستفيد آخر</button>
      </FormSection>

      {!isCancelled && <FormSection icon={Activity} title="التدخلات والملاحظات">
        <div className="form-grid cols-3">
          <label>الشكوى الرئيسية<select value={form.chiefComplaint} onChange={e=>{setField("chiefComplaint",e.target.value);if(e.target.value!=="__other")setField("chiefComplaintOther","")}}><option value="">اختر...</option>{complaintOptions.map(x=><option key={x}>{x}</option>)}<option value="__other">أخرى</option></select></label>
          {form.chiefComplaint==="__other"&&field("chiefComplaintOther","اكتب الشكوى الرئيسية")}
          <label>
            التدخلات الطبية
            <textarea
              value={form.interventions}
              onChange={(e) => setField("interventions", e.target.value)}
              placeholder="الإسعافات أو الإجراءات التي تم تنفيذها"
            />
          </label>
          <label>
            ملاحظات
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="أي تفاصيل إضافية عن البلاغ"
            />
          </label>
        </div>
        <div className="check-grid">
          {[
            ["patientDeceased", "وفاة المستفيد"],
            ["conflictRelated", "مرتبط بالنزاع"],
            ["oxygen", "أكسجين"],
            ["bvm", "BVM"],
            ["airway", "مجرى هوائي"],
            ["cpr", "إنعاش CPR"],
            ["aed", "جهاز AED"],
            ["drugs", "أدوية"],
            ["woundCare", "عناية بالجروح"],
            ["tourniquet", "عاصبة"],
            ["immobilization", "تثبيت"],
            ["cervicalCollar", "طوق رقبة"],
            ["glucoseCheck", "فحص سكر"],
            ["splinting", "جبيرة"],
            ["delivery", "ولادة"],
          ].map(([key, label]) => (
            <label className="check-card" key={key}>
              <input
                type="checkbox"
                checked={form[key] === "1"}
                onChange={(e) => {
                  setField(key, e.target.checked ? "1" : "");
                  if (key === "patientDeceased" && e.target.checked)
                    setField("urgency", "Black");
                }}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </FormSection>}

      {isCancelled && (
        <FormSection icon={ClipboardList} title="ملاحظات البلاغ الملغي">
          <label className="cancelled-notes">
            ملاحظات
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="اكتب سبب الإلغاء وأي تفاصيل مهمة"
            />
          </label>
        </FormSection>
      )}

      {requiresMovement && <FormSection icon={AlertTriangle} title="حدث طارئ بعد انتهاء الحركة">
        <div className="emergency-event-actions">
          <button
            type="button"
            className={`emergency-event-trigger ${emergencyEventOpen || form.emergencyEventType ? "active" : ""}`}
            onClick={() => setEmergencyEventOpen((open) => !open)}
            aria-expanded={emergencyEventOpen}
          >
            <PlusCircle />
            {form.emergencyEventType ? "تعديل الحدث الطارئ" : "إضافة حدث طارئ"}
          </button>
          {(emergencyEventOpen || form.emergencyEventType) && <div className="emergency-event-panel">
            <p>اختاري الإجراء الذي انتقلت إليه المركبة بعد هذا البلاغ:</p>
            <div className="emergency-event-options">
              <button
                type="button"
                className={form.emergencyEventType === "maintenance" ? "selected" : ""}
                onClick={() => setField("emergencyEventType", "maintenance")}
              >
                <Wrench /><b>صيانة</b><span>فتح طلب صيانة للمركبة بعد اعتماد البلاغ</span>
              </button>
              <button
                type="button"
                className={form.emergencyEventType === "new_incident" ? "selected" : ""}
                onClick={() => setField("emergencyEventType", "new_incident")}
              >
                <Siren /><b>بلاغ جديد</b><span>فتح بلاغ متابعة بنفس المركبة والطاقم</span>
              </button>
            </div>
            {form.emergencyEventType && <div className="emergency-event-details">
              {field("emergencyEventNotes",form.emergencyEventType==="maintenance"?"وصف العطل الأولي":"ملاحظات البلاغ الجديد")}
              <button type="button" className="ghost" onClick={() => { setField("emergencyEventType", ""); setField("emergencyEventNotes", ""); setEmergencyEventOpen(false); }}>
                <X /> إلغاء الحدث الطارئ
              </button>
            </div>}
          </div>}
        </div>
      </FormSection>}

      <div className="form-actions">
        <button type="button" className="ghost" onClick={() => location.reload()}>
          <X /> إلغاء
        </button>
        <button className="ghost save-draft" type="submit" value="draft" disabled={!form.incidentCode}>
          <Save /> حفظ كمسودة
        </button>
        <button className="primary" type="submit" value="approve" disabled={!form.incidentCode}>
          <ClipboardCheck /> اعتماد البلاغ
        </button>
      </div>
    </form>
  );
}

function Records({
  incidents,
  loading,
  onRefresh,
  filters,
  setFilters,
  centers,
  stationsData,
  vehicles,
  isAdmin,
  currentUser,
  canEdit,
  canEditApproved,
  initialIncidentId,
  onInitialIncidentHandled,
  modalOnly=false,
}: {
  incidents: Incident[];
  loading: boolean;
  onRefresh: () => void;
  filters: {from:string;to:string;governorate:string;category:string};
  setFilters: React.Dispatch<React.SetStateAction<{from:string;to:string;governorate:string;category:string}>>;
  centers: any[];
  stationsData: any[];
  vehicles: any[];
  isAdmin: boolean;
  currentUser: any;
  canEdit: boolean;
  canEditApproved: boolean;
  initialIncidentId: number | null;
  onInitialIncidentHandled: () => void;
  modalOnly?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [recordFilters, setRecordFilters] = useState({ station:"all", shift:"all", urgency:"all", approval:"all" });
  const [recordPage, setRecordPage] = useState(1);
  const [recordPageSize, setRecordPageSize] = useState(10);
  const [selected, setSelected] = useState<any>(null);
  const [incidentDraft, setIncidentDraft] = useState<any>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const rows = incidents.filter((x) =>
    JSON.stringify(x).toLowerCase().includes(search.toLowerCase()) &&
    (recordFilters.station === "all" || x.station === recordFilters.station) &&
    (recordFilters.shift === "all" || x.shift === recordFilters.shift) &&
    (recordFilters.urgency === "all" || x.urgency === recordFilters.urgency) &&
    (recordFilters.approval === "all" || x.approval_status === recordFilters.approval)
  );
  const recordPageCount = Math.max(1, Math.ceil(rows.length / recordPageSize));
  const activeRecordPage = Math.min(recordPage, recordPageCount);
  const paginatedRows = rows.slice((activeRecordPage - 1) * recordPageSize, activeRecordPage * recordPageSize);
  const editCenterId = String(incidentDraft.center || "");
  const editStations = (stationsData || []).filter((station:any) => String(station.center_id) === editCenterId);
  const editVehicles = (vehicles || []).filter((vehicle:any) =>
    String(vehicle.center_id) === editCenterId &&
    (vehicle.active !== 0 || vehicle.plate_number === incidentDraft.vehicle)
  );
  let editAdditionalBeneficiaries: any[] = [];
  try { editAdditionalBeneficiaries = JSON.parse(incidentDraft.additionalBeneficiaries || "[]"); } catch { editAdditionalBeneficiaries = []; }
  const setEditAdditionalBeneficiaries = (rows:any[]) => setIncidentDraft((draft:any)=>({...draft,additionalBeneficiaries:JSON.stringify(rows)}));
  const openIncident = (x: any) => {
    const incidentStation = (stationsData || []).find((station:any) => station.name === x.station);
    const incidentVehicle = (vehicles || []).find((vehicle:any) => vehicle.plate_number === x.vehicle);
    setSelected(x);
    setIncidentDraft({
      id: x.id,
      incidentStatus: x.incident_status || "completed",
      coordinationType: x.coordination_type || "",
      companionCount: x.companion_count || "",
      additionalBeneficiaries: "[]",
      entryTime: x.entry_time || "",
      beneficiaryName: x.beneficiary_name || "",
      contact: x.contact || "",
      gender: x.gender || "Male",
      age: x.age || "",
      urgency: x.urgency || "Green",
      category: x.category || "Medical",
      caseType: x.case_type || "",
      pickupType: x.pickup_type || "",
      pickupLocation: x.pickup_location || "",
      pickupGovernorate: x.pickup_governorate || "غزة",
      pickupMunicipality: x.pickup_municipality || "",
      pickupNeighborhood: x.pickup_neighborhood || "",
      dropoffType: x.dropoff_type || "",
      dropoffLocation: x.dropoff_location || "",
      center: String(incidentStation?.center_id || incidentVehicle?.center_id || ""),
      station: x.station || "",
      shift: x.shift || "A",
      vehicle: x.vehicle || "",
      callDate: x.call_date || today,
      callTime: x.call_time || "",
      dispatchDate: x.dispatch_date || x.call_date || today,
      dispatchTime: x.dispatch_time || "",
      onSceneDate: x.on_scene_date || x.call_date || today,
      arrivalTime: x.arrival_time || "",
      hospitalDate: x.hospital_date || x.call_date || today,
      hospitalTime: x.hospital_time || "",
      availableDate: x.available_date || x.call_date || today,
      clearTime: x.clear_time || "",
      returnTime: x.return_time || "",
      returnLocation: x.return_location || "",
      kmStart: x.km_start || "",
      kmEnd: x.km_end || "",
      dispatcherPrimary: x.dispatcher_primary || "",
      dispatcherSecondary: x.dispatcher_secondary || "",
      emtDriver: x.emt_driver || "",
      emtLead: x.emt_lead || "",
      emtAssist: x.emt_assist || "",
      chiefComplaint: x.chief_complaint || "",
      interventions: x.interventions || "",
      fuelLiters: x.fuel_liters || "",
      cancelled: x.cancelled ? "1" : "",
      patientDeceased: x.patient_deceased ? "1" : "",
      conflictRelated: x.conflict_related ? "1" : "",
      oxygen: x.oxygen ? "1" : "", bvm: x.bvm ? "1" : "", airway: x.airway ? "1" : "", cpr: x.cpr ? "1" : "", aed: x.aed ? "1" : "", drugs: x.drugs ? "1" : "",
      woundCare: x.wound_care ? "1" : "", tourniquet: x.tourniquet ? "1" : "", immobilization: x.immobilization ? "1" : "", cervicalCollar: x.cervical_collar ? "1" : "",
      glucoseCheck: x.glucose_check ? "1" : "", splinting: x.splinting ? "1" : "", delivery: x.delivery ? "1" : "",
      notes: x.notes || "",
    });
  };
  useEffect(()=>{
    if(!initialIncidentId)return;
    const local=incidents.find(item=>Number(item.id)===Number(initialIncidentId));
    if(local){openIncident(local);onInitialIncidentHandled();return}
    const controller=new AbortController();
    fetch(`/api/incidents?id=${initialIncidentId}`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.error||"تعذر فتح البلاغ");openIncident(body.incident)})
      .catch(error=>{if(!(error instanceof DOMException&&error.name==="AbortError"))toast.error(String(error).replace(/^Error: /,""))})
      .finally(onInitialIncidentHandled);
    return()=>controller.abort();
  },[initialIncidentId]);
  const updateIncident = async (requestedAction?:"draft"|"approve") => { setSaving(true); try { const submissionAction=requestedAction||(selected?.approval_status==="approved"?"approve":"draft"); const r=await fetch("/api/incidents",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({...incidentDraft,submissionAction})}); const v=await r.json(); if(!r.ok) throw Error(v.error||"تعذر تعديل البلاغ"); const added=Number(v.createdCount||0); toast.success(`${submissionAction==="approve"?"تم اعتماد البلاغ وحفظ بياناته":"تم حفظ المسودة بالوضع الحالي"}${added?`، وإضافة ${added} مستفيد بكود مستقل`:""}`); setSelected(null); setEditing(false); onRefresh(); } catch(e) { toast.error(String(e).replace(/^Error: /,"")); } finally { setSaving(false); } };
  const deleteIncident = async () => { if(!isAdmin || !selected) return; if(!window.confirm(`هل تريدين حذف البلاغ ${selected.incident_number} نهائيًا؟`)) return; setSaving(true); try { const r=await fetch(`/api/incidents?id=${selected.id}`,{method:"DELETE"}); const v=await r.json(); if(!r.ok) throw Error(v.error||"تعذر حذف البلاغ"); toast.success("تم حذف البلاغ"); setSelected(null); onRefresh(); } catch(e) { toast.error(String(e).replace(/^Error: /,"")); } finally { setSaving(false); } };
  const mayEditSelected = !!selected && (selected.approval_status === "approved" ? canEditApproved : canEdit || (selected.approval_status === "draft" && Number(selected.created_by_user_id) === Number(currentUser?.id)));
  return (
    <div className={`page-stack ${modalOnly?"records-modal-only":""}`}>
      <section className="toolbar panel">
        <div className="search">
          <Search />
          <input
            placeholder="ابحث برقم البلاغ أو المستفيد أو المحطة"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setRecordPage(1); }}
          />
        </div>
        <button className="ghost" onClick={onRefresh}>
          <RefreshCw /> تحديث
        </button>
      </section>
      <section className="record-filter-bar panel" dir="rtl">
        <div className="filter-title"><span className="filter-mark"><SlidersHorizontal /></span><span><b>فلاتر سجل البلاغات</b><small>حدد الفترة والتصنيف ونطاق العمل</small></span><span className="filter-count">{rows.length} نتيجة</span></div>
        <div className="record-filter-fields">
          <label>من تاريخ<input type="date" value={filters.from} max={filters.to} onChange={e=>{setFilters(v=>({...v,from:e.target.value}));setRecordPage(1)}}/></label>
          <label>إلى تاريخ<input type="date" value={filters.to} min={filters.from} onChange={e=>{setFilters(v=>({...v,to:e.target.value}));setRecordPage(1)}}/></label>
          <label>المحافظة<select value={filters.governorate} onChange={e=>{setFilters(v=>({...v,governorate:e.target.value}));setRecordPage(1)}}><option value="all">كل المحافظات</option>{governors.map(x=><option key={x}>{x}</option>)}</select></label>
          <label>التصنيف<select value={filters.category} onChange={e=>{setFilters(v=>({...v,category:e.target.value}));setRecordPage(1)}}><option value="all">كل التصنيفات</option>{categories.map(x=><option key={x} value={x}>{categoryArabic[x]}</option>)}</select></label>
          <label>المحطة<select value={recordFilters.station} onChange={e=>{setRecordFilters({...recordFilters,station:e.target.value});setRecordPage(1)}}><option value="all">كل المحطات</option>{[...new Set(incidents.map(x=>String(x.station)))].filter(Boolean).map(x=><option key={x}>{x}</option>)}</select></label>
          <label>الوردية<select value={recordFilters.shift} onChange={e=>{setRecordFilters({...recordFilters,shift:e.target.value});setRecordPage(1)}}><option value="all">كل الورديات</option>{["A","B","C"].map(x=><option key={x}>{x}</option>)}</select></label>
          <label>الأولوية<select value={recordFilters.urgency} onChange={e=>{setRecordFilters({...recordFilters,urgency:e.target.value});setRecordPage(1)}}><option value="all">كل الأولويات</option>{["Red","Yellow","Green","N/A"].map(x=><option key={x} value={x}>{urgencyArabic[x]}</option>)}</select></label>
          <label>حالة البلاغ<select value={recordFilters.approval} onChange={e=>{setRecordFilters({...recordFilters,approval:e.target.value});setRecordPage(1)}}><option value="all">جميع الحالات</option><option value="approved">معتمد</option><option value="draft">مسودة</option></select></label>
        </div>
        <div className="record-filter-actions"><button className="ghost" onClick={()=>{setRecordFilters({station:"all",shift:"all",urgency:"all",approval:"all"});setFilters({from:monthStart,to:today,governorate:"all",category:"all"});setSearch("");setRecordPage(1)}}><RefreshCw /> إعادة ضبط الفلاتر</button></div>
      </section>
      <section className="panel table-panel">
        <PanelTitle
          icon={ClipboardList}
          title="البلاغات المسجلة"
          subtitle={`${rows.length} حالة ضمن الفلاتر الحالية — من أصل ${incidents.length} حالة`}
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>رقم البلاغ</th>
                <th>حالة البلاغ</th>
                <th>التاريخ</th>
                <th>المستفيد</th>
                <th>الحالة</th>
                <th>الأولوية</th>
                <th>المحافظة</th>
                <th>المحطة</th>
                <th>مدخل البلاغ</th>
                <th>الاستجابة</th>
                <th>التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((x) => (
                <tr key={String(x.id)}>
                  <td>
                    <b>{String(x.incident_number)}</b>
                  </td>
                  <td><span className={`approval-status-badge ${x.approval_status === "draft" ? "draft" : "approved"}`}>{x.approval_status === "draft" ? "مسودة" : "معتمد"}</span></td>
                  <td>{String(x.call_date)}</td>
                  <td>{String(x.beneficiary_name || "—")}</td>
                  <td>{String(x.case_type)}</td>
                  <td>
                    <span
                      className={`priority p-${String(x.urgency).toLowerCase()}`}
                    >
                      {urgencyArabic[String(x.urgency)] || String(x.urgency)}
                    </span>
                  </td>
                  <td>{String(x.pickup_governorate)}</td>
                  <td>{String(x.station)}</td>
                  <td>{String(x.created_by || "—")}</td>
                  <td>{String(x.response_minutes || 0)} دقيقة</td>
                  <td>
                    <button
                      className="table-icon-action"
                      onClick={() => openIncident(x)}
                    >
                      <Eye /> فتح
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && !loading && (
                <tr>
                  <td colSpan={11}>
                    <Empty />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {rows.length > 0 && <div className="staff-pagination record-pagination">
            <span>عرض {(activeRecordPage-1)*recordPageSize+1}–{Math.min(activeRecordPage*recordPageSize,rows.length)} من {rows.length} حالة</span>
            <strong>الصفحة {activeRecordPage} من {recordPageCount}</strong>
            <label>عدد الصفوف<select value={recordPageSize} onChange={event=>{setRecordPageSize(Number(event.target.value));setRecordPage(1)}}>{[10,25,50,100].map(size=><option key={size} value={size}>{size}</option>)}</select></label>
            <nav aria-label="صفحات سجل البلاغات"><button type="button" disabled={activeRecordPage===1} onClick={()=>setRecordPage(page=>Math.max(1,page-1))}>السابق</button>{Array.from({length:recordPageCount},(_,index)=>index+1).filter(page=>page===1||page===recordPageCount||Math.abs(page-activeRecordPage)<=2).map((page,index,pages)=><span key={page}>{index>0&&page-pages[index-1]>1&&<i>…</i>}<button type="button" className={page===activeRecordPage?"active":""} onClick={()=>setRecordPage(page)}>{page}</button></span>)}<button type="button" disabled={activeRecordPage===recordPageCount} onClick={()=>setRecordPage(page=>Math.min(recordPageCount,page+1))}>التالي</button></nav>
          </div>}
        </div>
      </section>
      {selected && (
        <div className="modal-backdrop" onMouseDown={() => setSelected(null)}>
          <section
            className="incident-detail-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h2>تفاصيل البلاغ {selected.incident_number}</h2>
                <p>أدخل البلاغ: {selected.created_by || "—"} · {selected.approval_status === "draft" ? "محفوظ كمسودة" : "معتمد"}</p>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)}>
                <X />
              </button>
            </div>
            <div className="incident-detail-grid">
              <label>
                المركز
                <select
                  disabled={!editing}
                  value={editCenterId}
                  onChange={(e) => setIncidentDraft({
                    ...incidentDraft,
                    center: e.target.value,
                    station: "",
                    vehicle: "",
                    kmStart: "",
                  })}
                >
                  <option value="">اختر المركز...</option>
                  {(centers || []).map((center:any) => <option key={center.id} value={center.id}>{center.name}</option>)}
                </select>
              </label>
              <label>
                المحطة
                <select
                  disabled={!editing || !editCenterId}
                  value={incidentDraft.station || ""}
                  onChange={(e) => setIncidentDraft({ ...incidentDraft, station: e.target.value })}
                >
                  <option value="">{editCenterId ? "اختر المحطة..." : "اختر المركز أولًا"}</option>
                  {editStations.map((station:any) => <option key={station.id} value={station.name}>{station.name}</option>)}
                </select>
              </label>
              <label>
                المركبة
                <select
                  disabled={!editing || !editCenterId}
                  value={incidentDraft.vehicle || ""}
                  onChange={(e) => {
                    const vehicle = editVehicles.find((item:any) => item.plate_number === e.target.value);
                    setIncidentDraft({
                      ...incidentDraft,
                      vehicle: e.target.value,
                      kmStart: vehicle ? String(Number(vehicle.mileage_km || 0)) : "",
                    });
                  }}
                >
                  <option value="">{editCenterId ? "اختر المركبة..." : "اختر المركز أولًا"}</option>
                  {editVehicles.map((vehicle:any) => {
                    const blockedByOther = vehicle.odometer_blocking_incident && vehicle.odometer_blocking_incident !== selected?.incident_number;
                    return <option key={vehicle.id} value={vehicle.plate_number} disabled={Boolean(blockedByOther)}>
                      {vehicle.plate_number}{vehicle.active === 0 ? " — خارج الخدمة" : blockedByOther ? ` — محجوزة في البلاغ ${vehicle.odometer_blocking_incident}` : ""}
                    </option>;
                  })}
                </select>
              </label>
              {[
                ["incidentStatus", "حالة البلاغ", "select", [["completed","عملية النقل مكتملة"],["coordination","تنسيق"],["cancelled_before_dispatch","ملغي قبل التحرك"],["cancelled_after_dispatch","ملغي بعد التحرك"]]],
                ...(incidentDraft.incidentStatus === "coordination" ? [["coordinationType", "نوع التنسيق", "select", [["yellow_line","تنسيق الخط الأصفر"],["evacuation","تنسيق إجلاء"],["returnees","تنسيق عائدين"]]]] : []),
                ["beneficiaryName", "اسم المستفيد", "text"],
                ...(incidentDraft.incidentStatus === "coordination" && incidentDraft.coordinationType === "evacuation" ? [["companionCount", "عدد المرافقين", "number"]] : []),
                ["contact", "رقم التواصل", "text"],
                [
                  "gender",
                  "الجنس",
                  "select",
                  [
                    ["Male", "ذكر"],
                    ["Female", "أنثى"],
                  ],
                ],
                ["age", "العمر", "number"],
                [
                  "urgency",
                  "الأولوية",
                  "select",
                  [
                    ["Red", "حمراء"],
                    ["Yellow", "صفراء"],
                    ["Green", "خضراء"],
                  ],
                ],
                [
                  "category",
                  "التصنيف",
                  "select",
                  categories.map((x) => [x, categoryArabic[x]]),
                ],
                ["caseType", "نوع الحالة", "text"],
                ["pickupLocation", "موقع الالتقاط", "text"],
                ["pickupMunicipality", "البلدية", "text"],
                ["pickupNeighborhood", "الحي", "text"],
                ["dropoffLocation", "جهة التسليم", "text"],
                [
                  "pickupGovernorate",
                  "المحافظة",
                  "select",
                  governors.map((x) => [x, x]),
                ],
                ["shift", "الوردية", "select", ["A","B","C"].map((x) => [x, x])],
                ["callDate", "التاريخ", "date"],
                ["entryTime", "وقت إدخال البلاغ", "time"],
                ["callTime", "وقت استلام البلاغ", "time"],
                ["dispatchTime", "الانطلاق", "time"],
                ["arrivalTime", "الوصول", "time"],
                ["hospitalTime", "وقت المستشفى", "time"],
                ["clearTime", "الجاهزية", "time"],
                ["returnTime", "العودة للمحطة", "time"],
                ["returnLocation", "مكان الرجوع", "text"],
                ["kmStart", "عداد البداية", "number"],
                ["kmEnd", "عداد النهاية", "number"],
                ["fuelLiters", "الوقود", "number"],
                ["dispatcherPrimary", "المستقبل الرئيسي", "text"],
                ["dispatcherSecondary", "المستقبل المساند", "text"],
                ["emtDriver", "المسعف السائق", "text"],
                ["emtLead", "مسعف قائد", "text"],
                ["emtAssist", "مسعف مساعد", "text"],
                ["chiefComplaint", "الشكوى الرئيسية", "text"],
                ["notes", "ملاحظات", "text"],
              ].map(([key, label, type, options]: any) => (
                <label key={key}>
                  {label}
                  {type === "select" ? (
                    <select
                      disabled={!editing}
                      value={incidentDraft[key]}
                      onChange={(e) =>
                        setIncidentDraft({ ...incidentDraft, [key]: e.target.value })
                      }
                    >
                      {options.map((o: any) => (
                        <option key={o[0]} value={o[0]}>
                          {o[1]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    type === "time" ? <Time24Input value={incidentDraft[key]||""} disabled={!editing} onChange={value=>setIncidentDraft({...incidentDraft,[key]:value})}/> : <input
                      disabled={!editing || (key==="kmStart" && selected.approval_status!=="approved")}
                      type={type}
                      lang={type==="date"?"en-GB":undefined}
                      dir={type==="date"||type==="number"?"ltr":undefined}
                      value={incidentDraft[key]}
                      onChange={(e) =>
                        setIncidentDraft({ ...incidentDraft, [key]: e.target.value })
                      }
                    />
                  )}
                </label>
              ))}
            </div>
            {editing && <section className="edit-beneficiaries">
              <div className="beneficiary-card-head"><div><h3>إضافة مستفيدين إلى نفس البلاغ</h3><p>يحصل كل مستفيد جديد على كود مستقل مع الاحتفاظ ببيانات الحركة والمركبة نفسها.</p></div></div>
              <div className="beneficiary-list">{editAdditionalBeneficiaries.map((person:any,index:number)=><div className="beneficiary-card" key={person.localId||index}>
                <div className="beneficiary-card-head"><b>مستفيد جديد {index+1}</b><button type="button" className="ghost" onClick={()=>setEditAdditionalBeneficiaries(editAdditionalBeneficiaries.filter((_:any,i:number)=>i!==index))}><Trash2/> حذف</button></div>
                <div className="form-grid cols-4">
                  <label>الاسم الكامل<input value={person.beneficiaryName||""} onChange={e=>setEditAdditionalBeneficiaries(editAdditionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,beneficiaryName:e.target.value}:x))}/></label>
                  <label>الجنس<select value={person.gender||""} onChange={e=>setEditAdditionalBeneficiaries(editAdditionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,gender:e.target.value}:x))}><option value="">اختر...</option><option value="Male">ذكر</option><option value="Female">أنثى</option><option value="Unknown">غير معروف</option></select></label>
                  <label>العمر<input type="number" value={person.age||""} onChange={e=>setEditAdditionalBeneficiaries(editAdditionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,age:e.target.value}:x))}/></label>
                  <label>رقم التواصل<input value={person.contact||""} onChange={e=>setEditAdditionalBeneficiaries(editAdditionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,contact:e.target.value}:x))}/></label>
                  {incidentDraft.incidentStatus==="coordination"&&incidentDraft.coordinationType==="evacuation"&&<label>عدد المرافقين<input type="number" min="0" value={person.companionCount||""} onChange={e=>setEditAdditionalBeneficiaries(editAdditionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,companionCount:e.target.value}:x))}/></label>}
                  <label>التصنيف<select value={person.category||""} onChange={e=>setEditAdditionalBeneficiaries(editAdditionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,category:e.target.value,urgency:e.target.value==="Martyr"?"Black":x.urgency}:x))}><option value="">اختر...</option>{categories.map(x=><option key={x} value={x}>{categoryArabic[x]}</option>)}</select></label>
                  <label>نوع الحالة<input value={person.caseType||""} onChange={e=>setEditAdditionalBeneficiaries(editAdditionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,caseType:e.target.value}:x))}/></label>
                  <label>الأولوية<select value={person.urgency||""} onChange={e=>setEditAdditionalBeneficiaries(editAdditionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,urgency:e.target.value}:x))}><option value="">اختر...</option>{["Red","Yellow","Green","Black","N/A"].map(x=><option key={x} value={x}>{urgencyArabic[x]}</option>)}</select></label>
                  <label>الشكوى الرئيسية<input value={person.chiefComplaint||""} onChange={e=>setEditAdditionalBeneficiaries(editAdditionalBeneficiaries.map((x:any,i:number)=>i===index?{...x,chiefComplaint:e.target.value}:x))}/></label>
                </div>
              </div>)}</div>
              <button type="button" className="ghost add-beneficiary" onClick={()=>setEditAdditionalBeneficiaries([...editAdditionalBeneficiaries,{localId:crypto.randomUUID(),beneficiaryName:"",gender:"",age:"",contact:"",companionCount:"",category:"",caseType:"",urgency:"",chiefComplaint:""}])}><PlusCircle/> إضافة مستفيد آخر</button>
            </section>}
            <div className="check-grid modal-checks">
              {[["cancelled","بلاغ ملغي"],["patientDeceased","وفاة المستفيد"],["conflictRelated","مرتبط بالنزاع"],["oxygen","أكسجين"],["bvm","BVM"],["airway","مجرى هوائي"],["cpr","إنعاش CPR"],["aed","AED"],["drugs","أدوية"],["woundCare","عناية بالجروح"],["tourniquet","عاصبة"],["immobilization","تثبيت"],["cervicalCollar","طوق رقبة"],["glucoseCheck","فحص سكر"],["splinting","جبيرة"],["delivery","ولادة"]].map(([key,label])=>(
                <label className="check-card" key={key}><input disabled={!editing} type="checkbox" checked={incidentDraft[key]==="1"} onChange={e=>setIncidentDraft({...incidentDraft,[key]:e.target.checked?"1":""})}/><span>{label}</span></label>
              ))}
            </div>
            {selected.data_quality_status === "review" && <div className="quality-warning"><AlertTriangle /> <span><b>هذا السجل يحتاج مراجعة</b>{selected.data_quality_notes && <small>{selected.data_quality_notes}</small>}</span></div>}
            <div className="modal-actions">
              <button className="ghost" onClick={() => setSelected(null)}>
                إغلاق
              </button>
              {isAdmin && <button className="danger-button" onClick={deleteIncident} disabled={saving}><Trash2/> حذف البلاغ</button>}
              {editing ? <><button className="ghost save-draft" onClick={()=>void updateIncident("draft")} disabled={saving}><Save/> حفظ كمسودة</button>{selected.approval_status==="draft"&&<button className="primary" onClick={()=>void updateIncident("approve")} disabled={saving}><ClipboardCheck/> اعتماد البلاغ</button>}{selected.approval_status==="approved"&&<button className="primary" onClick={()=>void updateIncident("approve")} disabled={saving}><Save/> حفظ التعديل المعتمد</button>}</> : mayEditSelected ? <button className="primary" onClick={() => setEditing(true)}><Pencil/> تعديل البلاغ</button> : <span className="locked-record"><ShieldCheck/> البلاغ المعتمد مقفل</span>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function AuditLogView() {
  const [logs,setLogs]=useState<any[]>([]),[loading,setLoading]=useState(true),[search,setSearch]=useState(""),[action,setAction]=useState("all"),[selectedLog,setSelectedLog]=useState<any|null>(null);
  const load=useCallback(async()=>{setLoading(true);try{const q=new URLSearchParams({search,action});const response=await fetch(`/api/audit-logs?${q}`,{cache:"no-store"});const result=await response.json();if(!response.ok)throw Error(result.error||"تعذر تحميل سجل التعديلات");setLogs(result.logs||[])}catch(error){toast.error(String(error).replace(/^Error: /,""))}finally{setLoading(false)}},[search,action]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),250);return()=>window.clearTimeout(timer)},[load]);
  const labels:Record<string,string>={draft_create:"إنشاء مسودة",approve_create:"إنشاء واعتماد",update_draft:"تعديل مسودة",update_approved:"تعديل بلاغ معتمد",approved:"اعتماد",rejected:"رفض",delete:"حذف"};
  const fieldMeta:Record<string,[string,string]>={
    entry_time:["التوقيت","وقت إدخال البلاغ"],call_date:["التوقيت","تاريخ البلاغ"],call_time:["التوقيت","وقت استلام البلاغ"],dispatch_time:["التوقيت","وقت التحرك"],arrival_time:["التوقيت","وقت الوصول"],hospital_time:["التوقيت","وقت الوصول للمستشفى"],clear_time:["التوقيت","وقت الجاهزية"],return_time:["التوقيت","وقت العودة للمحطة"],
    beneficiary_name:["بيانات المستفيد","اسم المستفيد"],gender:["بيانات المستفيد","الجنس"],contact:["بيانات المستفيد","رقم التواصل"],age:["بيانات المستفيد","العمر"],urgency:["بيانات المستفيد","تصنيف الحالة"],category:["بيانات المستفيد","فئة الحالة"],
    station:["المركبة والطاقم","المحطة"],shift:["المركبة والطاقم","الوردية"],vehicle:["المركبة والطاقم","المركبة"],km_start:["المركبة والطاقم","عداد البداية"],km_end:["المركبة والطاقم","عداد النهاية"],dispatcher_primary:["المركبة والطاقم","المستلم الرئيسي"],dispatcher_secondary:["المركبة والطاقم","المستلم المساند"],emt_driver:["المركبة والطاقم","السائق"],emt_lead:["المركبة والطاقم","المسعف الرئيسي"],emt_assist:["المركبة والطاقم","المسعف المساند"],
    chief_complaint:["التشخيص والتدخلات","الشكوى الرئيسية"],case_type:["التشخيص والتدخلات","نوع الحالة"],interventions:["التشخيص والتدخلات","التدخلات"],patient_deceased:["التشخيص والتدخلات","وفاة المستفيد"],oxygen:["التشخيص والتدخلات","أكسجين"],bvm:["التشخيص والتدخلات","BVM"],airway:["التشخيص والتدخلات","مجرى هوائي"],cpr:["التشخيص والتدخلات","إنعاش CPR"],aed:["التشخيص والتدخلات","AED"],drugs:["التشخيص والتدخلات","أدوية"],wound_care:["التشخيص والتدخلات","عناية بالجروح"],tourniquet:["التشخيص والتدخلات","عاصبة"],immobilization:["التشخيص والتدخلات","تثبيت"],cervical_collar:["التشخيص والتدخلات","طوق رقبة"],glucose_check:["التشخيص والتدخلات","فحص سكر"],splinting:["التشخيص والتدخلات","جبيرة"],delivery:["التشخيص والتدخلات","ولادة"],
    pickup_type:["الاستلام والتسليم","نوع مكان الاستلام"],pickup_location:["الاستلام والتسليم","مكان الاستلام"],pickup_governorate:["الاستلام والتسليم","المحافظة"],pickup_municipality:["الاستلام والتسليم","البلدية"],pickup_neighborhood:["الاستلام والتسليم","الحي"],dropoff_type:["الاستلام والتسليم","نوع جهة التسليم"],dropoff_location:["الاستلام والتسليم","جهة التسليم"],
    incident_status:["حالة البلاغ","حالة البلاغ"],cancelled:["حالة البلاغ","ملغي"],notes:["الملاحظات","الملاحظات"],return_location:["الحركة","مكان الرجوع"],fuel_liters:["الحركة","الوقود باللتر"],distance_km:["الحركة","المسافة المقطوعة"]
  };
  const parseDetails=(details:string)=>{try{return JSON.parse(details||"{}")}catch{return {text:details||"—"}}};
  const changedRows=(log:any)=>{const value=parseDetails(log?.details);return Object.entries(value.changes||{}).map(([key,change]:any)=>({key,section:fieldMeta[key]?.[0]||"بيانات أخرى",label:fieldMeta[key]?.[1]||key,before:change?.before,after:change?.after}))};
  const sectionsFor=(log:any)=>Array.from(new Set(changedRows(log).map(row=>row.section)));
  const showValue=(value:any)=>value===null||value===undefined||value===""?"—":String(value)==="1"?"نعم":String(value)==="0"?"لا":String(value);
  const formatLogDate=(value:string)=>{const date=new Date(value);return {date:date.toLocaleDateString("en-GB",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Hebron"}),time:date.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false,timeZone:"Asia/Hebron"})}};
  return <div className="page-stack audit-page">
    <section className="panel audit-hero"><PanelTitle icon={History} title="سجل تعديلات البلاغات" subtitle="سجل رقابي لا يمكن لمستخدم الإدخال حذفه أو تعديله"/><button className="ghost" onClick={()=>void load()}><RefreshCw/> تحديث</button></section>
    <section className="panel audit-filters"><label><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث برقم البلاغ أو اسم المستخدم"/></label><select value={action} onChange={e=>setAction(e.target.value)}><option value="all">كل العمليات</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></section>
    <section className="panel table-panel"><div className="table-wrap"><table className="audit-table"><thead><tr><th>التاريخ والوقت</th><th>المستخدم</th><th>العملية</th><th>رقم البلاغ</th><th>القسم المتأثر</th><th>التفاصيل</th></tr></thead><tbody>{logs.map(log=>{const stamp=formatLogDate(log.created_at),sections=sectionsFor(log),rows=changedRows(log);return <tr key={log.id}><td><div className="audit-stamp latin-datetime"><b>{stamp.date}</b><span>{stamp.time}</span></div></td><td><b>{log.actor||"النظام"}</b></td><td>{rows.length?<button type="button" className="audit-action audit-action-link" onClick={()=>setSelectedLog(log)}>{labels[log.action]||log.action}</button>:<span className="audit-action">{labels[log.action]||log.action}</span>}</td><td>{log.incident_number||log.entity_id||"—"}</td><td><div className="audit-sections">{sections.length?sections.map(section=><span key={section}>{section}</span>):<span>{log.action?.includes("create")?"إنشاء البلاغ":"بيانات البلاغ"}</span>}</div></td><td>{rows.length?<span className="audit-change-count">{rows.length} حقول معدّلة</span>:<span className="audit-summary">{parseDetails(log.details).text||`البلاغ ${parseDetails(log.details).incidentNumber||""}`}</span>}</td></tr>})}{!logs.length&&!loading&&<tr><td colSpan={6}><Empty/></td></tr>}</tbody></table></div>{loading&&<div className="loading-row">جاري تحميل السجل...</div>}</section>
    {selectedLog&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setSelectedLog(null)}}><section className="incident-detail-modal audit-details-modal" dir="rtl"><div className="modal-head"><div><h2>تفاصيل تعديل البلاغ {selectedLog.incident_number||selectedLog.entity_id}</h2><p>{selectedLog.actor||"النظام"} — {labels[selectedLog.action]||selectedLog.action}</p></div><button type="button" className="ghost" onClick={()=>setSelectedLog(null)}>إغلاق</button></div><div className="audit-change-groups">{sectionsFor(selectedLog).map(section=><section key={section} className="audit-change-group"><h3>{section}</h3><div className="audit-change-list">{changedRows(selectedLog).filter(row=>row.section===section).map(row=><div className="audit-change-row" key={row.key}><b>{row.label}</b><div><span><small>قبل التعديل</small>{showValue(row.before)}</span><i>←</i><span className="after"><small>بعد التعديل</small>{showValue(row.after)}</span></div></div>)}</div></section>)}</div></section></div>}
  </div>;
}

function BackupsView() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/backups", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر تحميل حالة النسخ الاحتياطي");
      setStatus(result);
    } catch (error) { setStatus({ status: "unavailable", error: String(error).replace(/^Error: /, "") }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 15000); return () => window.clearInterval(timer); }, [load]);
  const createBackup = async () => {
    setRunning(true);
    try {
      const response = await fetch("/api/backups", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر بدء النسخ الاحتياطي");
      toast.success("بدأ إنشاء النسخة الاحتياطية. ستظهر حالتها تلقائيًا هنا.");
      await load();
    } catch (error) { toast.error(String(error).replace(/^Error: /, "")); }
    finally { setRunning(false); }
  };
  const dateTime = (value?: string) => value ? new Date(value).toLocaleString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Hebron" }) : "—";
  const statusLabel: Record<string, string> = { never: "لم تُنشأ نسخة بعد", running: "جارٍ إنشاء النسخة", success: "تم النسخ ورفعه إلى OneDrive", local_only: "تم الحفظ محليًا — ربط OneDrive غير مكتمل", failed: "فشل إنشاء النسخة", unavailable: "خدمة النسخ غير مهيأة بعد" };
  const statusClass = status?.status === "running" ? "running" : status?.status === "success" ? "success" : status?.status === "failed" ? "failed" : "pending";
  return <div className="page-stack backup-page">
    <section className="panel backup-hero"><div className="backup-icon"><Archive/></div><div><h2>النسخ الاحتياطي لنظام EMS</h2><p>نسخة يومية تلقائية الساعة 02:00 بتوقيت فلسطين، مع إمكانية الإنشاء عند الطلب.</p></div><button className="primary" onClick={()=>void createBackup()} disabled={running||status?.status==="running"}><Archive/>{running||status?.status==="running"?"جارٍ التنفيذ…":"إنشاء نسخة الآن"}</button></section>
    <section className="backup-cards"><article className="panel"><small>حالة آخر نسخة</small><strong className={`backup-status ${statusClass}`}><i/>{loading?"جارٍ الفحص…":statusLabel[status?.status]||"الحالة غير معروفة"}</strong></article><article className="panel"><small>آخر تشغيل</small><strong className="latin-datetime">{dateTime(status?.finished_at||status?.started_at)}</strong></article><article className="panel"><small>وجهة التخزين</small><strong>{status?.cloud_uploaded?"OneDrive for Business + نسخة محلية":status?.cloud_configured?"OneDrive مهيأ — بانتظار النسخة القادمة":"OneDrive يحتاج إعدادًا لمرة واحدة"}</strong></article></section>
    <section className="panel backup-details"><div><h3>محتوى النسخة</h3><p>قاعدة بيانات PostgreSQL ومجلد المرفقات. تُحفظ نسخة محلية على volume مستقل، وتُرفع إلى OneDrive عند إعداد الربط.</p><div className="backup-retention"><span>النسخ المحلية: آخر 7 أيام</span><span>OneDrive: آخر 30 يومًا</span><span>تُنفذ تلقائيًا يوميًا دون تدخل</span></div>{status?.filename&&<small className="backup-file latin-datetime">آخر ملف: {status.filename} · الحجم: {Math.max(1,Math.round(Number(status.size_bytes||0)/1024/1024))} MB</small>}{status?.cloud_message&&<small className="backup-cloud-note">{status.cloud_message}</small>}{status?.error&&<div className="backup-error">{status.error}</div>}</div><div className="backup-actions"><button className="ghost" onClick={()=>void load()}><RefreshCw/> تحديث الحالة</button><a className={`ghost ${status?.filename?"":"disabled"}`} href={status?.filename?"/api/backups?download=latest":undefined} aria-disabled={!status?.filename}><Download/> تنزيل آخر نسخة</a></div></section>
    {!status?.cloud_configured&&<section className="backup-setup-note"><CloudUpload/><div><b>يلزم إعداد OneDrive مرة واحدة على الخادم</b><p>أضيفي في إعدادات Coolify المتغيرات BACKUP_API_TOKEN وONEDRIVE_TOKEN_JSON وONEDRIVE_DRIVE_ID وعبارة BACKUP_ENCRYPTION_PASSWORD. بعد ذلك تُرفع النسخ مشفّرة تلقائيًا إلى OneDrive.</p></div></section>}
  </div>;
}

function Reports({
  dashboard,
  incidents,
  filters,
  setFilters,
  exportCsv,
}: {
  dashboard: Dashboard;
  incidents: Incident[];
  filters: any;
  setFilters: any;
  exportCsv: () => void;
}) {
  return (
    <div className="page-stack">
      <section className="reports-hero">
        <div>
          <div className="round-icon large">
            <FileBarChart />
          </div>
          <div>
            <h2>مركز التقارير</h2>
            <p>تقارير يومية وشهرية وموحّدة مبنية مباشرة على البلاغات</p>
          </div>
        </div>
        <button className="primary" onClick={exportCsv}>
          <Download /> تصدير Excel
        </button>
      </section>
      <Filters {...{ filters, setFilters }} />
      <section className="report-cards">
        {[
          {
            t: "التقرير التشغيلي",
            d: "البلاغات والاستجابة والحالات",
            i: Activity,
          },
          {
            t: "تقرير المستفيدين",
            d: "العمر والجنس ودرجة الأولوية",
            i: UsersRound,
          },
          { t: "تقرير المحطات", d: "مقارنة الأداء بين المحطات", i: MapPin },
          { t: "تقرير الأسطول", d: "المسافات والوقود والمركبات", i: Ambulance },
        ].map((r) => (
          <article key={r.t}>
            <div className="report-icon">
              <r.i />
            </div>
            <div>
              <b>{r.t}</b>
              <p>{r.d}</p>
            </div>
            <button onClick={() => window.print()}>
              <Download />
            </button>
          </article>
        ))}
      </section>
      <section className="panel table-panel">
        <PanelTitle
          icon={FileBarChart}
          title="ملخص المحطات"
          subtitle="قراءة تشغيلية للفترة المحددة"
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>المحطة</th>
                <th>عدد البلاغات</th>
                <th>المسافة (كم)</th>
                <th>متوسط الاستجابة</th>
                <th>النسبة من الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.stations.map((x) => (
                <tr key={x.name}>
                  <td>
                    <b>{x.name}</b>
                  </td>
                  <td>{x.incidents}</td>
                  <td>{x.distance || 0}</td>
                  <td>{x.response || 0} دقيقة</td>
                  <td>
                    <div className="progress">
                      <i
                        style={{
                          width: `${(x.incidents / (dashboard.summary.total || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {!dashboard.stations.length && (
                <tr>
                  <td colSpan={5}>
                    <Empty />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
function SettingsView() {
  return (
    <div className="settings-grid">
      {[
        { t: "المحطات", d: "إضافة المحطات وربطها بالمحافظات", i: MapPin },
        { t: "المركبات", d: "بيانات سيارات الإسعاف وحالتها", i: Ambulance },
        { t: "الطاقم", d: "المسعفون والمؤهلات والمحطات", i: UsersRound },
        {
          t: "المستخدمون والصلاحيات",
          d: "مدير النظام، موظف مركزي، ومدخل محطة",
          i: ShieldCheck,
        },
      ].map((x) => (
        <article className="panel setting-card" key={x.t}>
          <div className="round-icon">
            <x.i />
          </div>
          <div>
            <b>{x.t}</b>
            <p>{x.d}</p>
          </div>
          <button className="ghost">
            إدارة <ChevronLeft />
          </button>
        </article>
      ))}
    </div>
  );
}
function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="form-section">
      <div className="section-heading">
        <div>
          <Icon />
        </div>
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}
function PanelTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: any;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="panel-title">
      <div className="mini-icon">
        <Icon />
      </div>
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
function Empty() {
  return (
    <div className="empty">
      <ClipboardList />
      <b>لا توجد بيانات ضمن النطاق الحالي</b>
      <span>أضف بلاغًا جديدًا أو غيّر الفلاتر</span>
    </div>
  );
}

function NotificationPanel({
  items,
  close,
  reload,
}: {
  items: any[];
  close: () => void;
  reload: () => void;
}) {
  const mark = async (id?: number, all = false) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(all ? { all: true } : { id }),
    });
    reload();
  };
  return (
    <aside className="notifications-panel">
      <div className="notice-head">
        <div>
          <b>الإشعارات</b>
          <span>{items.filter((x) => !x.is_read).length} غير مقروء</span>
        </div>
        <button onClick={close}>
          <X />
        </button>
      </div>
      <button className="mark-all" onClick={() => mark(undefined, true)}>
        تحديد الكل كمقروء
      </button>
      <div className="notice-list">
        {items.map((n) => (
          <button
            key={n.id}
            className={n.is_read ? "read" : ""}
            onClick={() => mark(n.id)}
          >
            <span className={`notice-icon ${n.type}`}>
              <Bell />
            </span>
            <div>
              <b>{n.title}</b>
              <p>{n.message}</p>
              <small>{String(n.created_at || "").slice(0, 16)}</small>
            </div>
          </button>
        ))}
        {!items.length && <Empty />}
      </div>
    </aside>
  );
}

function Approvals({
  items,
  reload,
}: {
  items: Incident[];
  reload: () => void;
}) {
  const decide = async (id: number, decision: "approved" | "rejected") => {
    let reason = "";
    if (decision === "rejected") {
      reason = prompt("اكتب سبب الرفض أو الملاحظة المطلوبة") || "";
      if (!reason) return;
    }
    const r = await fetch("/api/approvals", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, decision, reason }),
    });
    const data = await r.json();
    if (!r.ok) {
      toast.error(data.error);
      return;
    }
    toast.success(
      decision === "approved"
        ? "تم اعتماد الإحصائية"
        : "تمت إعادة الإحصائية للتصحيح",
    );
    reload();
  };
  return (
    <div className="page-stack">
      <section className="approval-summary">
        <div className="round-icon large">
          <ClipboardCheck />
        </div>
        <div>
          <h2>قائمة الاعتماد</h2>
          <p>لن تظهر البلاغات في الرئيسية والتقارير قبل اعتمادها</p>
        </div>
        <strong>
          {items.length}
          <small>بانتظار المراجعة</small>
        </strong>
      </section>
      <section className="approval-list">
        {items.map((x) => (
          <article className="panel approval-card" key={String(x.id)}>
            <div className="approval-main">
              <span className={`priority p-${String(x.urgency).toLowerCase()}`}>
                {urgencyArabic[String(x.urgency)] || String(x.urgency)}
              </span>
              <div>
                <b>{String(x.incident_number)}</b>
                <p>
                  {String(x.case_type)} · {String(x.pickup_governorate)} ·{" "}
                  {String(x.station)}
                </p>
              </div>
            </div>
            <dl>
              <div>
                <dt>التاريخ</dt>
                <dd>
                  {String(x.call_date)} — {String(x.call_time)}
                </dd>
              </div>
              <div>
                <dt>المستفيد</dt>
                <dd>{String(x.beneficiary_name || "غير مسجل")}</dd>
              </div>
              <div>
                <dt>مدخل البيانات</dt>
                <dd>{String(x.created_by || "—")}</dd>
              </div>
            </dl>
            <div className="approval-actions">
              <button
                className="reject"
                onClick={() => decide(Number(x.id), "rejected")}
              >
                <XCircle /> رفض وإعادة
              </button>
              <button
                className="approve"
                onClick={() => decide(Number(x.id), "approved")}
              >
                <CheckCircle2 /> اعتماد
              </button>
            </div>
          </article>
        ))}
        {!items.length && (
          <section className="panel">
            <Empty />
          </section>
        )}
      </section>
    </div>
  );
}

function UsersView({ users, centers, reload }: { users: any[]; centers: any[]; reload: () => void }) {
  const permissionGroups = [
    {title:"الرئيسية والتقارير",icon:BarChart3,items:[["dashboard.view","عرض لوحة المؤشرات والقوى العاملة"],["reports.view","عرض التقارير الدورية والمخصصة وتصدير Excel وPDF"]]},
    {title:"سجل البلاغات",icon:ClipboardList,items:[["incidents.view","عرض سجل بلاغات نطاق العمل"],["incidents.create","تسجيل بلاغ وحفظه كمسودة أو اعتماده وإضافة مستفيدين"],["incidents.edit","تعديل المسودات والبلاغات غير المعتمدة"],["incidents.edit_approved","تعديل البلاغات المعتمدة والمقفلة"],["incidents.delete","حذف البلاغات نهائيًا"]]},
    {title:"الرقابة والاعتماد",icon:ShieldCheck,items:[["approvals.manage","اعتماد الإحصائيات وإعادتها للتصحيح"],["audit.view","عرض سجل التعديلات وتفاصيل القيم قبل وبعد"]]},
    {title:"القدرة التشغيلية والتنسيقات",icon:Gauge,items:[["capacity.view","عرض جدول القدرة التشغيلية والشفتات"],["capacity.manage","إضافة وتعديل تكليفات الموظفين والشفتات"],["coordination.view","عرض سجل التنسيقات"],["coordination.manage","إضافة وتعديل عمليات التنسيق"]]},
    {title:"الأسطول والحركة والصيانة",icon:Ambulance,items:[["fleet.view","عرض المركبات والوقود وسجل الحركة"],["fleet.manage","إدارة المركبات وتسجيل الوقود والحركات والعدادات"],["maintenance.view","عرض طلبات صيانة المركبات"],["maintenance.manage","إضافة ومتابعة وإغلاق طلبات الصيانة"]]},
    {title:"إدارة النظام والمراجع",icon:Settings,items:[["settings.manage","إدارة المراكز والمحطات والموظفين والمركبات والمستشفيات والشكاوى"],["users.manage","إدارة المستخدمين والأدوار والصلاحيات"],["backup.manage","إنشاء وإدارة النسخ الاحتياطية وتنزيلها"]]},
  ];
  const allPermissions=permissionGroups.flatMap(group=>group.items.map(([code])=>code));
  const rolePresets:Record<string,string[]>={
    admin:["*"],
    central_user:allPermissions.filter(code=>!["users.manage","settings.manage","incidents.delete","backup.manage"].includes(code)),
    station_user:["dashboard.view","incidents.view","incidents.create","capacity.view","fleet.view","maintenance.view"],
    viewer:["dashboard.view","incidents.view","reports.view"],
    custom:[],
  };
  const [open, setOpen] = useState(false),
    [editingId, setEditingId] = useState<number | null>(null),
    [draft, setDraft] = useState<any>({
      fullName: "",
      username: "",
      email: "",
      password: "",
      role: "custom",
      station: "",
      permissions: ["dashboard.view","incidents.view"],
    });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch("/api/users", {
      method: editingId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(editingId ? { id: editingId, ...draft } : draft),
    });
    const d = await r.json();
    if (!r.ok) {
      toast.error(d.error);
      return;
    }
    toast.success(
      editingId ? "تم تحديث المستخدم والصلاحيات" : "تم إنشاء المستخدم",
    );
    setOpen(false);
    setEditingId(null);
    setDraft({ fullName: "", username:"", email: "", password:"", role: "custom", station: "", permissions:[] });
    reload();
  };
  const edit = (u: any) => {
    setDraft({
      fullName: u.full_name || "",
      username: u.username || "",
      email: u.email || "",
      password: "",
      role: u.role || "viewer",
      station: u.station || "",
      permissions: u.permissions || [],
    });
    setEditingId(Number(u.id));
    setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toggle = async (u: any) => {
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: u.id, active: !u.active }),
    });
    reload();
  };
  const roleLabel: Record<string, string> = {
    admin: "مدير النظام",
    central_user: "موظف مركزي",
    station_user: "موظف مركز",
    viewer: "مشاهد تقارير",
  };
  return (
    <div className="page-stack">
      <section className="toolbar panel">
        <div>
          <h2>المستخدمون والصلاحيات</h2>
          <p>يُنشئ مدير النظام الحساب ويحدد نطاق الوصول</p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setEditingId(null);
            setDraft({
              fullName: "",
              username: "",
              email: "",
              password: "",
              role: "custom",
              station: "",
              permissions: [],
            });
            setOpen((v) => !v);
          }}
        >
          <PlusCircle /> إضافة مستخدم
        </button>
      </section>
      {open && (
        <form className="panel user-form user-editor" onSubmit={save}>
          <div className="user-form-heading">
            <div className="user-heading-icon"><UserCog/></div><div><b>{editingId ? "تعديل المستخدم" : "إضافة مستخدم جديد"}</b><span>{editingId ? "عدّل بيانات الحساب ونطاق الوصول والصلاحيات" : "أنشئ الحساب وحدد صلاحياته بحسب طبيعة العمل"}</span></div>
            <button type="button" className="user-close" onClick={()=>{setOpen(false);setEditingId(null)}}><X/></button>
          </div>
          <section className="user-editor-section"><div className="user-section-title"><span>1</span><div><b>بيانات الحساب</b><small>البيانات الأساسية المستخدمة لتسجيل الدخول</small></div></div><div className="user-fields-grid">
            <label>الاسم الكامل<input required placeholder="الاسم الرباعي" value={draft.fullName} onChange={(e)=>setDraft({...draft,fullName:e.target.value})}/></label>
            <label>اسم المستخدم<input required placeholder="مثال: ahmad.ali" value={draft.username} onChange={(e)=>setDraft({...draft,username:e.target.value})}/></label>
            <label>البريد الإلكتروني <em>اختياري</em><input type="email" placeholder="name@example.com" value={draft.email} onChange={(e)=>setDraft({...draft,email:e.target.value})}/></label>
            <label>{editingId?"كلمة مرور جديدة":"كلمة المرور"} <em>{editingId?"اختياري":"8 أحرف على الأقل"}</em><input required={!editingId} minLength={8} type="password" placeholder={editingId?"اتركها فارغة دون تغيير":"••••••••"} value={draft.password} onChange={(e)=>setDraft({...draft,password:e.target.value})}/></label>
          </div></section>
          <section className="user-editor-section"><div className="user-section-title"><span>2</span><div><b>الدور ونطاق الوصول</b><small>اختيار الدور يطبق مجموعة صلاحيات مقترحة ويمكن تعديلها</small></div></div><div className="user-fields-grid access-grid">
            <label>الدور الوظيفي<select value={draft.role} onChange={(e)=>{const role=e.target.value;setDraft({...draft,role,permissions:rolePresets[role]||[]})}}><option value="custom">صلاحيات مخصصة</option><option value="station_user">موظف مركز</option><option value="central_user">موظف مركزي</option><option value="viewer">مشاهد تقارير</option><option value="admin">مدير النظام</option></select></label>
            <label>نطاق المركز<select value={draft.station} onChange={(e)=>setDraft({...draft,station:e.target.value})}><option value="">كل المراكز</option>{draft.station && !(centers||[]).some((x:any)=>x.name===draft.station) && <option value={draft.station}>{draft.station} — نطاق سابق</option>}{(centers||[]).map((x:any)=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label>
            <div className="access-summary"><ShieldCheck/><div><b>{draft.role==="admin"?"صلاحية كاملة":`${draft.permissions.filter((p:string)=>p!=="*").length} صلاحيات محددة`}</b><span>{draft.station||"الوصول إلى جميع المراكز"}</span></div></div>
          </div></section>
          <section className="user-editor-section permission-section"><div className="permission-head"><div className="user-section-title"><span>3</span><div><b>صلاحيات الواجهات والإجراءات</b><small>حدد ما يمكن للمستخدم مشاهدته أو إدارته</small></div></div><div className="permission-actions"><button type="button" onClick={()=>setDraft({...draft,role:"custom",permissions:allPermissions})}>تحديد الكل</button><button type="button" onClick={()=>setDraft({...draft,role:"custom",permissions:[]})}>إلغاء الكل</button></div></div>
            <div className="permission-groups">{permissionGroups.map(group=><fieldset className="permission-group" key={group.title}><legend><group.icon/>{group.title}</legend>{group.items.map(([code,label])=><label key={code} className={draft.permissions.includes("*")||draft.permissions.includes(code)?"selected":""}><input type="checkbox" disabled={draft.permissions.includes("*")} checked={draft.permissions.includes("*")||draft.permissions.includes(code)} onChange={(e)=>setDraft({...draft,role:"custom",permissions:e.target.checked?[...draft.permissions.filter((p:string)=>p!=="*"),code]:draft.permissions.filter((p:string)=>p!==code&&p!=="*")})}/><span>{label}</span><i/></label>)}</fieldset>)}</div>
          </section>
          <footer className="user-form-actions"><div><ShieldCheck/><span>سيتم تطبيق الصلاحيات فور حفظ الحساب</span></div><button type="button" className="ghost" onClick={()=>{setOpen(false);setEditingId(null)}}><X/> إلغاء</button><button className="primary"><Save/>{editingId?"حفظ التعديلات":"إنشاء المستخدم"}</button></footer>
        </form>
      )}
      <section className="panel table-panel">
        <PanelTitle
          icon={UserCog}
          title="الحسابات المسجلة"
          subtitle={`${users.length} مستخدمًا`}
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>البريد</th>
                <th>الصلاحية</th>
                <th>نطاق العمل</th>
                <th>الحالة</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.full_name}</b>
                  </td>
                  <td>{u.username}<small style={{display:"block"}}>{u.email}</small></td>
                  <td>
                    <span className="role-badge">
                      {roleLabel[u.role] || u.role}
                    </span>
                  </td>
                  <td>{u.station || "جميع المراكز"}</td>
                  <td>
                    <span className={u.active ? "state active" : "state"}>
                      {u.active ? "نشط" : "موقوف"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="table-action edit"
                        onClick={() => edit(u)}
                      >
                        <UserCog /> تعديل
                      </button>
                      <button
                        className="table-action"
                        onClick={() => toggle(u)}
                      >
                        {u.active ? "إيقاف" : "تفعيل"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="permissions panel">
        <h3>مصفوفة الصلاحيات</h3>
        <div className="permission-grid">
          <b>الدور</b>
          <b>إدخال</b>
          <b>اعتماد</b>
          <b>تقارير</b>
          <b>إعدادات</b>
          {[
            ["مدير النظام", "✓", "✓", "✓", "✓"],
            ["موظف مركزي", "✓", "—", "✓", "—"],
            ["موظف مركز", "✓", "—", "مركزه", "—"],
            ["مشاهد تقارير", "—", "—", "✓", "—"],
          ].flatMap((r, i) =>
            r.map((c, j) => (
              <span key={`${i}-${j}`} className={c === "✓" ? "yes" : ""}>
                {c}
              </span>
            )),
          )}
        </div>
      </section>
    </div>
  );
}

function OperationalCapacity({ data }: { data: any }) {
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState(monthStart),
    [to, setTo] = useState(today);
  const [items, setItems] = useState<any[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [centerFilter, setCenterFilter] = useState("");
  const [stationFilter, setStationFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<any>({
    centerId: "",
    staffId: "",
    stationId: "",
    shift: "A",
    dutyType: "دوام مركز",
    vehicleId: "",
    workLocation: "",
    attendanceStatus: "حاضر",
    notes: "",
  });
  const load = useCallback(async () => {
    const r = await fetch(`/api/operational-capacity?from=${from}&to=${to}`);
    if (r.ok) setItems((await r.json()).assignments);
  }, [from, to]);
  useEffect(() => {
    load();
  }, [load]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch("/api/operational-capacity", {
      method: editingId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft, id: editingId, workDate: date }),
    });
    const result = await r.json();
    if (!r.ok) return toast.error(result.error || "تعذر حفظ التوزيع");
    toast.success(
      editingId ? "تم تعديل التكليف" : "تمت إضافة الموظف إلى القدرة التشغيلية",
    );
    setEditingId(null);
    setDraft({
      centerId: "",
      staffId: "",
      stationId: "",
      shift: "A",
      dutyType: "دوام مركز",
      vehicleId: "",
      workLocation: "",
      attendanceStatus: "حاضر",
      notes: "",
    });
    load();
  };
  const editAssignment = (x: any) => {
    setEditingId(x.id);
    setDate(x.work_date);
    setDraft({
      centerId: String(x.center_id || ""),
      staffId: String(x.staff_id),
      stationId: String(x.station_id),
      shift: x.shift,
      dutyType: x.duty_type,
      vehicleId: x.vehicle_id ? String(x.vehicle_id) : "",
      workLocation: x.work_location || "",
      attendanceStatus: x.attendance_status,
      notes: x.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const deleteAssignment = async (id: number) => {
    if (!confirm("هل تريد حذف هذا التكليف؟")) return;
    const r = await fetch(`/api/operational-capacity?id=${id}`, {
      method: "DELETE",
    });
    const result = await r.json();
    if (!r.ok) return toast.error(result.error || "تعذر الحذف");
    toast.success("تم حذف التكليف");
    load();
  };
  const visibleItems = items.filter(
    (x) =>
      (!employeeFilter || String(x.staff_id) === employeeFilter) &&
      (!centerFilter || String(x.center_id) === centerFilter) &&
      (!stationFilter || String(x.station_id) === stationFilter) &&
      (!shiftFilter || x.shift === shiftFilter),
  );
  const shiftCountByStaff = visibleItems.reduce((counts: Record<string, number>, item: any) => {
    const key = String(item.staff_id);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const present = visibleItems.filter((x) => x.attendance_status === "حاضر");
  const filterStations = (data.stations || []).filter((x:any)=>!centerFilter || String(x.center_id)===centerFilter);
  const filterEmployees = (data.staff || []).filter((x:any)=>!centerFilter || String(x.center_id)===centerFilter);
  const draftStations = (data.stations || []).filter((x:any)=>String(x.center_id)===String(draft.centerId));
  const draftEmployees = (data.staff || []).filter((x:any)=>String(x.center_id)===String(draft.centerId));
  const draftVehicles = (data.vehicles || []).filter((x:any)=>x.active!==0 && String(x.center_id)===String(draft.centerId));
  return (
    <div className="page-stack capacity-page">
      <section className="form-hero">
        <div className="round-icon large">
          <Gauge />
        </div>
        <div>
          <h2>القدرة التشغيلية اليومية</h2>
          <p>اختر الموظف من الدليل وحدد مكان دوامه وورديته لذلك اليوم</p>
        </div>
        <label className="capacity-date">
          التاريخ
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </section>
      <section className="report-metrics capacity-metrics">
        <article>
          <UsersRound />
          <b>{new Set(present.map((x) => x.staff_id)).size}</b>
          <span>العاملون الفعليون</span>
        </article>
        <article>
          <Clock3 />
          <b>{visibleItems.filter((x) => x.shift === "A").length}</b>
          <span>وردية A</span>
        </article>
        <article>
          <Clock3 />
          <b>{visibleItems.filter((x) => x.shift === "B").length}</b>
          <span>وردية B</span>
        </article>
        <article>
          <Clock3 />
          <b>{visibleItems.filter((x) => x.shift === "C").length}</b>
          <span>وردية C</span>
        </article>
        <article>
          <Ambulance />
          <b>{new Set(visibleItems.map((x) => x.vehicle_id).filter(Boolean)).size}</b>
          <span>المركبات العاملة</span>
        </article>
      </section>
      <section className="panel capacity-range">
        <PanelTitle
          icon={Clock3}
          title="عرض جدول الدوام خلال فترة"
          subtitle="حدد الفترة والموظف والمركز والوردية لعرض التكليفات المطابقة"
        />
        <div className="capacity-range-fields">
          <label>
            من تاريخ
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            إلى تاريخ
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label>
            المركز
            <select value={centerFilter} onChange={(e) => {setCenterFilter(e.target.value);setStationFilter("");setEmployeeFilter("");}}>
              <option value="">جميع المراكز</option>
              {(data.centers || []).map((x: any) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </label>
          <label>
            المحطة
            <select value={stationFilter} onChange={(e) => setStationFilter(e.target.value)} disabled={!centerFilter}>
              <option value="">جميع المحطات</option>
              {filterStations.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <label>
            الموظف
            <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} disabled={!centerFilter}>
              <option value="">جميع موظفي المركز</option>
              {filterEmployees.map((x: any) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
            </select>
          </label>
          <label>
            الوردية
            <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
              <option value="">كل الورديات</option>
              {["A", "B", "C"].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <button type="button" className="ghost capacity-clear" onClick={() => {
            setEmployeeFilter("");
            setCenterFilter("");
            setStationFilter("");
            setShiftFilter("");
          }} disabled={!employeeFilter && !centerFilter && !stationFilter && !shiftFilter}>
            <RefreshCw /> مسح الفلاتر
          </button>
        </div>
      </section>
      <form className="panel capacity-form" onSubmit={save}>
        <PanelTitle
          icon={UserRound}
          title={editingId ? "تعديل تكليف الموظف" : "إضافة موظف إلى جدول اليوم"}
          subtitle="بيانات الموظف الأساسية محفوظة مسبقًا في دليل الموظفين"
        />
        <div className="capacity-fields">
          <label>
            المركز
            <select required value={draft.centerId} onChange={(e)=>setDraft({...draft,centerId:e.target.value,stationId:"",staffId:"",vehicleId:""})}>
              <option value="">اختر المركز</option>
              {(data.centers||[]).filter((x:any)=>x.active!==0).map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <label>
            المحطة
            <select required disabled={!draft.centerId} value={draft.stationId} onChange={(e)=>setDraft({...draft,stationId:e.target.value,vehicleId:""})}>
              <option value="">{draft.centerId?"اختر المحطة":"اختر المركز أولًا"}</option>
              {draftStations.filter((x:any)=>x.active!==0).map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <label>
            الموظف
            <select
              required
              disabled={!draft.centerId}
              value={draft.staffId}
              onChange={(e) => setDraft({ ...draft, staffId: e.target.value })}
            >
              <option value="">{draft.centerId?"اختر موظفًا من المركز":"اختر المركز أولًا"}</option>
              {draftEmployees.filter((x:any)=>x.active!==0).map((x: any) => (
                <option key={x.id} value={x.id}>
                  {x.full_name} — {x.cadre_type} — {x.job_title || "بدون وظيفة"}
                </option>
              ))}
            </select>
          </label>
          <label>
            الوردية
            <select
              value={draft.shift}
              onChange={(e) => setDraft({ ...draft, shift: e.target.value })}
            >
              {["A", "B", "C"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            نوع المهمة
            <select
              value={draft.dutyType}
              onChange={(e) => setDraft({ ...draft, dutyType: e.target.value })}
            >
              {[
                "دوام مركز",
                "نقطة ميدانية",
                "تنسيق",
                "معبر رفح",
                "مهمة خاصة",
                "مساندة",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            المركبة
            <select
              disabled={!draft.centerId}
              value={draft.vehicleId}
              onChange={(e) =>
                setDraft({ ...draft, vehicleId: e.target.value })
              }
            >
              <option value="">دون مركبة</option>
              {draftVehicles.map((x: any) => (
                <option key={x.id} value={x.id}>
                  {x.plate_number}
                </option>
              ))}
            </select>
          </label>
          <label>
            مكان العمل
            <input
              value={draft.workLocation}
              onChange={(e) =>
                setDraft({ ...draft, workLocation: e.target.value })
              }
              placeholder="مثال: البريج أو السرايا"
            />
          </label>
          <label>
            الحالة
            <select
              value={draft.attendanceStatus}
              onChange={(e) =>
                setDraft({ ...draft, attendanceStatus: e.target.value })
              }
            >
              {["حاضر", "استدعاء", "غائب", "إجازة"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            ملاحظات
            <input
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </label>
        </div>
        <div className="capacity-actions">
          <button className="primary">
            {editingId ? <Save /> : <PlusCircle />}{" "}
            {editingId ? "حفظ التعديل" : "إضافة للجدول"}
          </button>
          {editingId && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setEditingId(null);
                setDraft({
                  centerId: "",
                  staffId: "",
                  stationId: "",
                  shift: "A",
                  dutyType: "دوام مركز",
                  vehicleId: "",
                  workLocation: "",
                  attendanceStatus: "حاضر",
                  notes: "",
                });
              }}
            >
              <X /> إلغاء
            </button>
          )}
        </div>
      </form>
      <section className="panel table-panel">
        <div className="capacity-table-heading">
          <PanelTitle
            icon={ClipboardList}
            title="جدول القدرة التشغيلية"
            subtitle={`${visibleItems.length} تكليفًا مطابقًا من أصل ${items.length} خلال الفترة المحددة`}
          />
          <button
            type="button"
            className="ghost capacity-print no-print"
            onClick={() => window.print()}
            title="طباعة جدول القدرة التشغيلية حسب الفلاتر الحالية"
          >
            <Printer />
            طباعة PDF
          </button>
        </div>
        <div className="capacity-table-wrap table-wrap">
          <table className="capacity-table">
            <thead>
              <tr>
                <th>الموظف</th>
                <th>التاريخ</th>
                <th>المركز</th>
                <th>الوردية</th>
                <th>عدد الشفتات</th>
                <th>المهمة</th>
                <th>المركبة</th>
                <th>الحالة</th>
                <th>ملاحظات</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((x) => (
                <tr key={x.id}>
                  <td>
                    <div className="capacity-person"><span>{String(x.full_name||"").trim().charAt(0)||"م"}</span><div><b>{x.full_name}</b><small>{x.job_title||x.cadre_type||"غير مصنف"}{x.job_title&&x.cadre_type?` · ${x.cadre_type}`:""}</small></div></div>
                  </td>
                  <td><time className="capacity-day">{x.work_date}</time></td>
                  <td>
                    <div className="capacity-station"><b>{x.station_name}</b><small>{x.work_location||"المركز الرئيسي"}</small></div>
                  </td>
                  <td>
                    <span className={`shift-badge shift-${String(x.shift).toLowerCase()}`}>{x.shift}</span>
                  </td>
                  <td><span className="shift-count"><b>{shiftCountByStaff[String(x.staff_id)]||0}</b><small>شفت</small></span></td>
                  <td><span className="capacity-duty">{x.duty_type}</span></td>
                  <td>{x.vehicle_number?<span className="capacity-vehicle"><Ambulance/>{x.vehicle_number}</span>:<span className="capacity-empty">دون مركبة</span>}</td>
                  <td>
                    <span
                      className={
                        x.attendance_status === "حاضر"
                          ? "state active"
                          : "state"
                      }
                    >
                      {x.attendance_status}
                    </span>
                  </td>
                  <td><span className="capacity-notes" title={x.notes||""}>{x.notes||"—"}</span></td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="table-icon-action"
                        onClick={() => editAssignment(x)}
                      >
                        <Pencil /> تعديل
                      </button>
                      <button
                        className="table-icon-action danger"
                        onClick={() => deleteAssignment(x.id)}
                      >
                        <Trash2 /> حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!visibleItems.length&&<tr><td colSpan={10}><Empty/></td></tr>}
            </tbody>
          </table>
          {!items.length && <Empty />}
        </div>
      </section>
    </div>
  );
}

function CoordinationView() {
  const [from, setFrom] = useState("2026-08-01"),
    [to, setTo] = useState(today),
    [agency, setAgency] = useState("all"),
    [data, setData] = useState<any>({
      records: [],
      summary: {},
      agencies: [],
      types: [],
      timeline: [],
    });
  const empty = {
    coordinationDate: today,
    coordinatingAgency: "WHO",
    vehicleCount: "",
    coordinationType: "نقل مرضى الى معبر رفح",
    resultDescription: "",
    ambulancePatients: "",
    ambulanceCompanions: "",
    busPatients: "",
    coordinationStatus: "نجح",
    participatingVehicles: "",
    notesPatients: "",
    notesCompanions: "",
    notesTotal: "",
    notes: "",
  };
  const [draft, setDraft] = useState<any>(empty);
  const load = useCallback(async () => {
    const r = await fetch(
      `/api/coordinations?from=${from}&to=${to}&agency=${encodeURIComponent(agency)}`,
    );
    if (r.ok) setData(await r.json());
  }, [from, to, agency]);
  useEffect(() => {
    load();
  }, [load]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch("/api/coordinations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const result = await r.json();
    if (!r.ok) return toast.error(result.error || "تعذر حفظ التنسيق");
    toast.success("تم حفظ عملية التنسيق");
    setDraft({ ...empty, coordinationDate: today });
    load();
  };
  const s = data.summary || {};
  return (
    <div className="page-stack coordination-page">
      <section className="form-hero">
        <div className="round-icon large">
          <Route />
        </div>
        <div>
          <h2>تسجيل عمليات التنسيق</h2>
          <p>نموذج مطابق لحقول تقرير التنسيقات ويحدّث التقرير مباشرة</p>
        </div>
      </section>
      <form className="panel coordination-form" onSubmit={save}>
        <PanelTitle
          icon={Route}
          title="بيانات عملية التنسيق"
          subtitle="التاريخ والجهة وحركة المرضى والمركبات"
        />
        <div className="coordination-fields">
          <label>
            التاريخ
            <input
              required
              type="date"
              value={draft.coordinationDate}
              onChange={(e) =>
                setDraft({ ...draft, coordinationDate: e.target.value })
              }
            />
          </label>
          <label>
            الجهة المنسقة
            <select
              value={draft.coordinatingAgency}
              onChange={(e) =>
                setDraft({ ...draft, coordinatingAgency: e.target.value })
              }
            >
              {["WHO", "OCHA", "الصليب الأحمر", "وزارة الصحة", "جهة أخرى"].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </label>
          <label>
            عدد السيارات
            <input
              type="number"
              min="0"
              value={draft.vehicleCount}
              onChange={(e) =>
                setDraft({ ...draft, vehicleCount: e.target.value })
              }
            />
          </label>
          <label>
            حالة التنسيق
            <select
              value={draft.coordinationStatus}
              onChange={(e) =>
                setDraft({ ...draft, coordinationStatus: e.target.value })
              }
            >
              <option>نجح</option>
              <option>فشل</option>
              <option>قيد المتابعة</option>
            </select>
          </label>
          <label className="span-2">
            طبيعة التنسيق
            <input
              required
              value={draft.coordinationType}
              onChange={(e) =>
                setDraft({ ...draft, coordinationType: e.target.value })
              }
            />
          </label>
          <label className="span-2">
            نتيجة التنسيق
            <input
              value={draft.resultDescription}
              onChange={(e) =>
                setDraft({ ...draft, resultDescription: e.target.value })
              }
            />
          </label>
          <label>
            مرضى بالإسعاف
            <input
              type="number"
              min="0"
              value={draft.ambulancePatients}
              onChange={(e) =>
                setDraft({ ...draft, ambulancePatients: e.target.value })
              }
            />
          </label>
          <label>
            مرافقون بالإسعاف
            <input
              type="number"
              min="0"
              value={draft.ambulanceCompanions}
              onChange={(e) =>
                setDraft({ ...draft, ambulanceCompanions: e.target.value })
              }
            />
          </label>
          <label>
            مرضى بالحافلة
            <input
              type="number"
              min="0"
              value={draft.busPatients}
              onChange={(e) =>
                setDraft({ ...draft, busPatients: e.target.value })
              }
            />
          </label>
          <label>
            الإجمالي بالملاحظات
            <input
              type="number"
              min="0"
              value={draft.notesTotal}
              onChange={(e) =>
                setDraft({ ...draft, notesTotal: e.target.value })
              }
            />
          </label>
          <label className="span-2">
            أرقام المركبات المشاركة
            <input
              value={draft.participatingVehicles}
              onChange={(e) =>
                setDraft({ ...draft, participatingVehicles: e.target.value })
              }
              placeholder="مثال: 260-261-2001"
            />
          </label>
          <label className="span-2">
            ملاحظات
            <input
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </label>
        </div>
        <div className="capacity-actions">
          <button className="primary">
            <Save /> حفظ التنسيق
          </button>
        </div>
      </form>
      <section className="panel coordination-filter">
        <PanelTitle
          icon={Filter}
          title="عرض التنسيقات"
          subtitle="فلترة السجل حسب الفترة والجهة"
        />
        <div>
          <label>
            من
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            إلى
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label>
            الجهة
            <select value={agency} onChange={(e) => setAgency(e.target.value)}>
              <option value="all">جميع الجهات</option>
              {data.agencies.map((x: any) => (
                <option key={x.name}>{x.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <section className="report-metrics">
        <article>
          <Route />
          <b>{s.total || 0}</b>
          <span>عمليات التنسيق</span>
        </article>
        <article>
          <Ambulance />
          <b>{s.vehicles || 0}</b>
          <span>مشاركة مركبات</span>
        </article>
        <article>
          <UsersRound />
          <b>{s.patients || 0}</b>
          <span>مرضى بالإسعاف</span>
        </article>
        <article>
          <UserRound />
          <b>{s.companions || 0}</b>
          <span>مرافقون بالإسعاف</span>
        </article>
      </section>
      <section className="panel table-panel">
        <PanelTitle
          icon={ClipboardList}
          title="سجل التنسيقات"
          subtitle={`${data.records.length} سجلًا ضمن الفترة`}
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الجهة</th>
                <th>طبيعة التنسيق</th>
                <th>السيارات</th>
                <th>المرضى</th>
                <th>المرافقون</th>
                <th>الحالة</th>
                <th>أرقام المركبات</th>
              </tr>
            </thead>
            <tbody>
              {data.records.map((x: any) => (
                <tr key={x.id}>
                  <td>{x.coordination_date}</td>
                  <td>
                    <b>{x.coordinating_agency}</b>
                  </td>
                  <td>{x.coordination_type}</td>
                  <td>{x.vehicle_count}</td>
                  <td>{x.ambulance_patients}</td>
                  <td>{x.ambulance_companions}</td>
                  <td>
                    <span
                      className={
                        x.coordination_status === "نجح"
                          ? "state active"
                          : "state"
                      }
                    >
                      {x.coordination_status}
                    </span>
                  </td>
                  <td>{x.participating_vehicles || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.records.length && <Empty />}
        </div>
      </section>
    </div>
  );
}

function SettingsView2({ data, reload }: { data: any; reload: () => void }) {
  const [tab, setTab] = useState("station"),
    [draft, setDraft] = useState<Record<string, string>>({}),
    [editingId, setEditingId] = useState<number | string | null>(null);
  const [staffFilters, setStaffFilters] = useState({search:"",station:"all",category:"all",level:"all"});
  const [staffPage, setStaffPage] = useState(1);
  const [staffPageSize, setStaffPageSize] = useState(10);
  const [settingsVehiclePage, setSettingsVehiclePage] = useState(1);
  const [settingsVehiclePageSize, setSettingsVehiclePageSize] = useState(10);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [cleaningStaff, setCleaningStaff] = useState(false);
  const [importingStaff, setImportingStaff] = useState(false);
  const staffImportRef = useRef<HTMLInputElement>(null);
  const cleanDuplicateStaff = async () => {
    setCleaningStaff(true);
    try {
      const preview = await fetch("/api/settings", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity: "deduplicateStaff", dryRun: true }),
      });
      const result = await preview.json();
      if (!preview.ok) return toast.error(result.error || "تعذر فحص التكرار");
      if (!result.duplicates) return toast.success("لا توجد سجلات موظفين متطابقة");
      if (!confirm(`وجدنا ${result.duplicates} سجلًا مكررًا مطابقًا بالكامل. ستُنقل التكليفات وسجلات المركبات إلى السجل الأصلي ثم تُحذف النسخ المكررة. هل تريدين المتابعة؟`)) return;
      const response = await fetch("/api/settings", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity: "deduplicateStaff" }),
      });
      const cleaned = await response.json();
      if (!response.ok) return toast.error(cleaned.error || "تعذر تنظيف التكرار");
      toast.success(`تم حذف ${cleaned.removed} سجلًا مكررًا مع الحفاظ على الروابط`);
      reload();
    } catch {
      toast.error("تعذر إكمال فحص الموظفين");
    } finally {
      setCleaningStaff(false);
    }
  };
  const importStaffSpreadsheet = async (file: File) => {
    setImportingStaff(true);
    try {
      const requestImport = async (dryRun:boolean) => {
        const body=new FormData(); body.set("entity","importStaffSpreadsheet"); body.set("file",file); body.set("dryRun",String(dryRun));
        return fetch("/api/settings",{method:"POST",body});
      };
      const preview = await requestImport(true);
      const summary = await preview.json();
      if (!preview.ok) return toast.error(summary.error || "تعذر فحص ملف الموظفين");
      const message = `سيتم استيراد ${summary.unique} موظفًا من ملف ${file.name}: إضافة ${summary.added} وتحديث ${summary.updated}${summary.skippedDeleted ? `، مع تجاهل ${summary.skippedDeleted} موظفًا محذوفًا سابقًا` : ""}. هل تريدين المتابعة؟`;
      if (!confirm(message)) return;
      const response = await requestImport(false);
      const result = await response.json();
      if (!response.ok) return toast.error(result.error || "تعذر استيراد الموظفين");
      toast.success(`تمت إضافة ${result.added} وتحديث ${result.updated} موظفًا`);
      reload();
    } catch {
      toast.error("تعذر استيراد ملف الموظفين");
    } finally {
      setImportingStaff(false);
      if (staffImportRef.current) staffImportRef.current.value="";
    }
  };
  const configs: any = {
    center: {
      title: "المراكز",
      icon: Building2,
      fields: [["code", "الرمز"], ["name", "اسم المركز"], ["governorate", "المحافظة"]],
      rows: data.centers,
    },
    station: {
      title: "المحطات",
      icon: MapPin,
      fields: [
        ["code", "الرمز"],
        ["name", "اسم المحطة"],
        ["governorate", "المحافظة"],
        ["centerId", "المركز التابع له"],
      ],
      rows: data.stations,
    },
    vehicle: {
      title: "المركبات",
      icon: Ambulance,
      fields: [
        ["plateNumber", "رقم المركبة"],
        ["manufacturer", "الشركة المصنعة"],
        ["model", "الموديل"],
        ["ambulanceType", "نوع الإسعاف"],
        ["fuelType", "نوع الوقود"],
        ["centerId", "المركز التابعة له"],
        ["mileageKm", "عداد المركبة الحالي"],
        ["workLocation", "مكان العمل"],
        ["serviceStatus", "حالة الخدمة"],
        ["outOfServiceReason", "سبب الخروج عن الخدمة"],
      ],
      rows: data.vehicles,
    },
    staff: {
      title: "دليل الموظفين",
      icon: UsersRound,
      fields: [
        ["fullName", "الاسم الكامل"],
        ["employeeNumber", "الرقم الوظيفي"],
        ["nationalId", "رقم الهوية"],
        ["mobile", "رقم الجوال"],
        ["cadreType", "الكادر"],
        ["jobTitle", "الوظيفة"],
        ["centerId", "المركز"],
        ["employmentStatus", "الحالة الوظيفية"],
        ["startYear", "سنة الالتحاق"],
        ["gender", "الجنس"],
        ["birthYear", "سنة الميلاد"],
        ["category", "الفئة"],
        ["emtLevel", "مستوى المسعف"],
        ["medicalQualification", "المؤهل الطبي"],
        ["ambulanceLicence", "رخصة الإسعاف"],
      ],
      rows: data.staff,
    },
    hospital_public: {
      title: "المستشفيات الحكومية", icon: Building2, simpleSetting: true,
      fields: [["value", "اسم المستشفى"]], rows: (data.settings||[]).filter((x:any)=>x.category==="hospital_public"),
    },
    hospital_private: {
      title: "المستشفيات الخاصة", icon: Building2, simpleSetting: true,
      fields: [["value", "اسم المستشفى"]], rows: (data.settings||[]).filter((x:any)=>x.category==="hospital_private"),
    },
    hospital_field: {
      title: "المستشفيات الميدانية", icon: Ambulance, simpleSetting: true,
      fields: [["value", "اسم المستشفى"]], rows: (data.settings||[]).filter((x:any)=>x.category==="hospital_field"),
    },
    chief_complaint: {
      title: "الشكاوى الرئيسية", icon: ClipboardList, simpleSetting: true,
      fields: [["value", "اسم الشكوى"]], rows: (data.settings||[]).filter((x:any)=>x.category==="chief_complaint"),
    },
  };
  const c = configs[tab];
  const staffRows = (data.staff || []).filter((r:any) => { let d:any={}; try { d=JSON.parse(r.detail||"{}"); } catch {} return (!staffFilters.search || `${r.full_name} ${r.center_name||""} ${r.job_title||""} ${d.employeeNumber||""} ${d.nationalId||""} ${d.mobile||""}`.toLowerCase().includes(staffFilters.search.toLowerCase())) && (staffFilters.station==="all" || String(r.center_id)===staffFilters.station) && (staffFilters.category==="all" || (d.category||r.cadre_type)===staffFilters.category) && (staffFilters.level==="all" || (d.emtLevel||r.job_title)===staffFilters.level); });
  const staffPageCount = Math.max(1, Math.ceil(staffRows.length / staffPageSize));
  const activeStaffPage = Math.min(staffPage, staffPageCount);
  const paginatedStaffRows = staffRows.slice((activeStaffPage - 1) * staffPageSize, activeStaffPage * staffPageSize);
  const settingsVehicleRows = data.vehicles || [];
  const settingsVehiclePageCount = Math.max(1, Math.ceil(settingsVehicleRows.length / settingsVehiclePageSize));
  const activeSettingsVehiclePage = Math.min(settingsVehiclePage, settingsVehiclePageCount);
  const paginatedSettingsVehicleRows = settingsVehicleRows.slice((activeSettingsVehiclePage - 1) * settingsVehiclePageSize, activeSettingsVehiclePage * settingsVehiclePageSize);
  const parseStaffDetail = (raw: any) => { try { return JSON.parse(raw || "{}"); } catch { return {}; } };
  const beginStaffEdit = (r:any) => {
    const d=parseStaffDetail(r.detail);
    setSelectedStaff(null);
    setEditingId(r.id);
    setDraft({
      centerId:String(r.center_id||""), employeeNumber:d.employeeNumber||"", nationalId:d.nationalId||"", mobile:d.mobile||"",
      startYear:d.startYear||"", gender:d.gender||"", birthYear:d.birthYear||"", category:d.category||r.cadre_type||"",
      emtLevel:d.emtLevel||r.job_title||"", medicalQualification:d.medicalQualification||"", ambulanceLicence:d.ambulanceLicence||"",
      fullName:r.full_name||"", cadreType:r.cadre_type||"", jobTitle:r.job_title||"", employmentStatus:r.employment_status||"on_duty", detail:r.detail||"",
    });
    requestAnimationFrame(()=>document.querySelector(".settings-form")?.scrollIntoView({behavior:"smooth",block:"center"}));
  };
  const selectedStaffDetail = selectedStaff ? parseStaffDetail(selectedStaff.detail) : {};
  const selectedStaffFields = selectedStaff ? [
    ["الاسم الكامل", selectedStaff.full_name], ["الاسم بالإنجليزية", selectedStaffDetail.englishName],
    ["الرقم الوظيفي", selectedStaffDetail.employeeNumber], ["رقم الهوية", selectedStaffDetail.nationalId],
    ["رقم الجوال", selectedStaffDetail.mobile], ["المركز", selectedStaff.center_name || selectedStaffDetail.station],
    ["مكان العمل الأصلي", selectedStaffDetail.workLocation], ["نوع الكادر", selectedStaff.cadre_type],
    ["الوظيفة", selectedStaff.job_title], ["الحالة الوظيفية", employmentStatusLabel(selectedStaff.employment_status)],
    ["الجنس", selectedStaffDetail.gender === "Male" ? "ذكر" : selectedStaffDetail.gender === "Female" ? "أنثى" : selectedStaffDetail.gender],
    ["سنة الالتحاق", selectedStaffDetail.startYear], ["تاريخ الميلاد", selectedStaffDetail.birthDate || selectedStaffDetail.birthYear],
    ["عدد أفراد العائلة", selectedStaffDetail.familyCount], ["الفئة", selectedStaffDetail.category || selectedStaff.cadre_type],
    ["مستوى المسعف", selectedStaffDetail.emtLevel || selectedStaff.job_title],
    ["المؤهل الطبي", selectedStaffDetail.medicalQualification === "None" ? "لا يوجد" : selectedStaffDetail.medicalQualification],
    ["رخصة الإسعاف", selectedStaffDetail.ambulanceLicence === "Yes" ? "نعم" : selectedStaffDetail.ambulanceLicence === "No" ? "لا" : selectedStaffDetail.ambulanceLicence],
    ["ملاحظات", selectedStaffDetail.notes],
  ] : [];
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const simpleSetting = Boolean(c.simpleSetting);
    let existingDetail:any={}; try { existingDetail=JSON.parse(draft.detail||"{}"); } catch {}
    const payload = tab === "staff" ? { ...draft, detail: JSON.stringify({...existingDetail,station:(data.centers||[]).find((c:any)=>String(c.id)===String(draft.centerId))?.name||existingDetail.station||"",employeeNumber:draft.employeeNumber||"",nationalId:draft.nationalId||"",mobile:draft.mobile||"",startYear:draft.startYear||"",gender:draft.gender||"",birthYear:draft.birthYear||"",category:draft.category||draft.cadreType||"",emtLevel:draft.emtLevel||draft.jobTitle||"",medicalQualification:draft.medicalQualification||"",ambulanceLicence:draft.ambulanceLicence||""}) } : draft;
    const r = await fetch("/api/settings", {
      method: simpleSetting ? "POST" : editingId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(simpleSetting ? { entity:"setting", key: editingId || `${tab}_${crypto.randomUUID()}`, value:payload.value, label:payload.value, category:tab } : { entity: tab, id: editingId, ...payload }),
    });
    if (!r.ok) {
      toast.error("تعذر حفظ الإعداد");
      return;
    }
    toast.success(editingId ? "تم تعديل المدخل" : "تم حفظ الإعداد");
    setDraft({});
    setEditingId(null);
    reload();
  };
  const remove = async (row: any) => {
    const name = row.full_name || row.plate_number || row.name || row.value || row.label || "هذا العنصر";
    if (!confirm(`حذف «${name}» نهائيًا؟ لن يمكن التراجع عن هذه العملية.`)) return;
    const response = await fetch("/api/settings", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(c.simpleSetting ? { entity: "setting", key: row.key } : { entity: tab, id: row.id }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(result.error || "تعذر حذف العنصر");
    if (editingId === (row.id ?? row.key)) { setEditingId(null); setDraft({}); }
    toast.success("تم حذف العنصر");
    reload();
  };
  return (
    <div className="settings-page">
      <section className="settings-tabs">
        {Object.entries(configs).map(([k, v]: any) => {
          const I = v.icon;
          return (
            <button
              key={k}
              className={tab === k ? "active" : ""}
              onClick={() => {
                setTab(k);
                setDraft({});
                setEditingId(null);
                setSettingsVehiclePage(1);
              }}
            >
              <I />
              {v.title}
              <span>{v.rows?.length || 0}</span>
            </button>
          );
        })}
        <button
          className={tab === "general" ? "active" : ""}
          onClick={() => setTab("general")}
        >
          <Settings />
          إعدادات عامة
        </button>
      </section>
      {tab === "general" ? (
        <section className="panel general-settings">
          <PanelTitle
            icon={Settings}
            title="الإعدادات العامة"
            subtitle="خيارات العمل والاعتماد"
          />
          <div className="setting-switches">
            <label>
              <div>
                <b>إلزام اعتماد البلاغات</b>
                <span>لا تظهر الإحصائيات قبل مراجعة المدير</span>
              </div>
              <input type="checkbox" defaultChecked />
            </label>
            <label>
              <div>
                <b>إشعارات البلاغات الجديدة</b>
                <span>تنبيه المدير عند وجود إحصائية جديدة</span>
              </div>
              <input type="checkbox" defaultChecked />
            </label>
            <label>
              <div>
                <b>السماح بالتصدير</b>
                <span>إتاحة Excel والطباعة لمشاهدي التقارير</span>
              </div>
              <input type="checkbox" defaultChecked />
            </label>
          </div>
        </section>
      ) : (
        <>
          <form className={`panel settings-form ${tab === "staff" && editingId ? "staff-edit-modal" : ""}`} onSubmit={save}>
            <PanelTitle
              icon={c.icon}
              title={editingId ? `تعديل ${c.title}` : `إضافة إلى ${c.title}`}
              subtitle="تُستخدم هذه القائمة في نموذج البلاغ"
            />
            <div>
              {c.fields.map(([key, label]: string[]) => (
                <label key={key}>
                  {label}
                  {key === "centerId" ? (
                    <select required value={draft.centerId||""} onChange={e=>setDraft({...draft,centerId:e.target.value})}><option value="">اختر المركز</option>{(data.centers||[]).map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
                  ) : key === "stationId" ? (
                    <select value={draft.stationId||""} onChange={e=>setDraft({...draft,stationId:e.target.value})}><option value="">غير محددة / مركزي</option>{(data.stations||[]).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  ) : key === "mileageKm" ? (
                    <input required type="number" min="0" step="0.1" value={draft.mileageKm||""} onChange={e=>setDraft({...draft,mileageKm:e.target.value})}/>
                  ) : key === "fuelType" || key === "serviceStatus" ? (
                    <select value={draft[key] || ""} required={key==="serviceStatus"} onChange={e=>setDraft({...draft,[key]:e.target.value})}>
                      <option value="">اختر...</option>
                      {(key === "fuelType" ? [["بنزين","بنزين"],["سولار","سولار"]] : [["active","داخل الخدمة"],["out_of_service","خارج الخدمة"]]).map(([value,label])=><option key={value} value={value}>{label}</option>)}
                    </select>
                  ) : key === "employmentStatus" ? (
                    <select required value={draft.employmentStatus || "on_duty"} onChange={e=>setDraft({...draft,employmentStatus:e.target.value})}>
                      {employmentStatuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}
                    </select>
                  ) : key === "governorate" ? (
                    <select
                      required
                      value={draft[key] || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                    >
                      <option value="">اختر المحافظة</option>
                      {governors.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  ) : key === "cadreType" ? (
                    <select
                      required
                      value={draft[key] || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                    >
                      <option value="">اختر نوع الكادر</option>
                      {["كادر", "عقد", "متطوع", "مستجيب", "مستجيب أول"].map(
                        (name) => (
                          <option key={name}>{name}</option>
                        ),
                      )}
                    </select>
                  ) : (
                    <input
                      required={["plateNumber","code","name","fullName"].includes(key)}
                      value={draft[key] || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                    />
                  )}
                </label>
              ))}
              <button className="primary">
                {editingId ? <Save /> : <PlusCircle />}{" "}
                {editingId ? "حفظ التعديل" : "إضافة"}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setDraft({});
                  }}
                >
                  <X /> إلغاء
                </button>
              )}
            </div>
            {tab === "staff" && !editingId && <><button type="button" className="ghost archive-staff-button" disabled={importingStaff} onClick={()=>staffImportRef.current?.click()}><Upload/> {importingStaff ? "جارٍ استيراد الموظفين…" : "استيراد الموظفين من Excel"}</button><input ref={staffImportRef} hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event=>{const file=event.target.files?.[0];if(file)importStaffSpreadsheet(file)}}/></>}
          </form>
          {tab === "staff" && <div className="staff-maintenance"><button type="button" className="ghost" disabled={cleaningStaff} onClick={cleanDuplicateStaff}><UsersRound/> {cleaningStaff ? "جارٍ فحص التكرار…" : "فحص وتنظيف تكرار الموظفين"}</button><span>يحذف السجلات المتطابقة بالكامل فقط ويحافظ على التكليفات وسجلات المركبات.</span></div>}
          <section className="panel table-panel">
            <PanelTitle
              icon={c.icon}
              title={c.title}
              subtitle={tab === "vehicle" ? `جميع المركبات المسجلة بكل الحالات — ${settingsVehicleRows.length} مركبة` : "القائمة المعتمدة في النظام"}
            />
            {tab === "staff" && <div className="staff-directory-filters"><label className="staff-search"><Search/><input placeholder="بحث بالاسم أو المركز أو الوظيفة" value={staffFilters.search} onChange={e=>{setStaffFilters({...staffFilters,search:e.target.value});setStaffPage(1)}}/></label><label>المركز<select value={staffFilters.station} onChange={e=>{setStaffFilters({...staffFilters,station:e.target.value});setStaffPage(1)}}><option value="all">كل المراكز</option>{(data.centers||[]).map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>الفئة<select value={staffFilters.category} onChange={e=>{setStaffFilters({...staffFilters,category:e.target.value});setStaffPage(1)}}><option value="all">كل الفئات</option>{[...new Set((data.staff||[]).map((r:any)=>{try{const d=JSON.parse(r.detail||"{}");return d.category||r.cadre_type}catch{return r.cadre_type}}).filter(Boolean))].map((x:any)=><option key={x}>{x}</option>)}</select></label><label>مستوى المسعف<select value={staffFilters.level} onChange={e=>{setStaffFilters({...staffFilters,level:e.target.value});setStaffPage(1)}}><option value="all">كل المستويات</option>{[...new Set((data.staff||[]).map((r:any)=>{try{const d=JSON.parse(r.detail||"{}");return d.emtLevel||r.job_title}catch{return r.job_title}}).filter(Boolean))].map((x:any)=><option key={x}>{x}</option>)}</select></label><button className="ghost" onClick={()=>{setStaffFilters({search:"",station:"all",category:"all",level:"all"});setStaffPage(1)}}><RefreshCw/> مسح</button></div>}
            <div className="table-wrap employee-directory">
              <table>
                <thead>
                  <tr>
                    {(c.simpleSetting ? ["الاسم"] : tab === "staff"
                      ? ["الاسم", "الرقم الوظيفي", "رقم الهوية", "الجوال", "المركز", "الحالة الوظيفية", "الجنس", "الفئة", "مستوى المسعف"]
                      : tab === "center"
                        ? ["الرمز", "اسم المركز", "المحافظة"]
                      : tab === "station"
                        ? ["الرمز", "اسم المحطة", "المحافظة", "المركز"]
                        : [
                            "رقم المركبة",
                            "الشركة المصنعة",
                            "الموديل",
                            "نوع الإسعاف",
                            "الوقود",
                            "المركز",
                            "العداد الحالي",
                            "مكان العمل",
                            "سبب التوقف",
                          ]
                    ).map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                    {!c.simpleSetting && tab !== "staff" && <th>الحالة</th>}
                    <th>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {(tab === "staff" ? paginatedStaffRows : tab === "vehicle" ? paginatedSettingsVehicleRows : (c.rows || [])).map((r: any) => (
                    <tr key={r.id ?? r.key}>
                      {(c.simpleSetting ? [r.value] : tab === "staff"
                        ? (()=>{const d=parseStaffDetail(r.detail); return [r.full_name,d.employeeNumber,d.nationalId,d.mobile,r.center_name||d.station,employmentStatusLabel(r.employment_status),d.gender==="Male"?"ذكر":d.gender==="Female"?"أنثى":d.gender,d.category||r.cadre_type,d.emtLevel||r.job_title]})()
                        : tab === "center"
                          ? [r.code, r.name, r.governorate]
                        : tab === "station"
                          ? [r.code, r.name, r.governorate, r.center_name]
                          : [
                              r.plate_number,
                              r.manufacturer,
                              r.model,
                              r.ambulance_type,
                              r.fuel_type,
                              r.center_name || data.centers?.find((center:any)=>center.id===r.center_id)?.name,
                              r.mileage_km,
                              r.work_location,
                              r.out_of_service_reason,
                            ]
                      ).map((v: any, i: number) => (
                        <td key={i}>
                          {tab === "staff" && i === 0 ? <button type="button" className="staff-name-link" onClick={()=>setSelectedStaff(r)}>{v || "—"}</button> : i === 0 ? <b>{v || "—"}</b> : v || "—"}
                        </td>
                      ))}
                      {!c.simpleSetting && tab !== "staff" && <td>
                        <span
                          className={`state ${r.active === 0 ? "" : "active"}`}
                        >
                          {tab === "staff" ? employmentStatusLabel(r.employment_status) : tab === "vehicle" && r.service_status === "maintenance" ? "قيد الصيانة" : r.active === 0 ? "موقوف" : "نشط"}
                        </span>
                      </td>}
                      <td>
                        <button
                          className="employee-edit"
                          onClick={() => {
                            if (tab === "staff") { beginStaffEdit(r); return; }
                            setEditingId(r.id);
                            if (c.simpleSetting) setEditingId(r.key);
                            setDraft(
                              c.simpleSetting ? {value:r.value||""} : tab === "staff"
                              ? {
                                    ...(()=>{let d:any={};try{d=JSON.parse(r.detail||"{}")}catch{} return {centerId:String(r.center_id||""),employeeNumber:d.employeeNumber||"",nationalId:d.nationalId||"",mobile:d.mobile||"",startYear:d.startYear||"",gender:d.gender||"",birthYear:d.birthYear||"",category:d.category||r.cadre_type||"",emtLevel:d.emtLevel||r.job_title||"",medicalQualification:d.medicalQualification||"",ambulanceLicence:d.ambulanceLicence||""}})(),
                                    fullName: r.full_name || "",
                                    cadreType: r.cadre_type || "",
                                    jobTitle: r.job_title || "",
                                    employmentStatus: r.employment_status || "on_duty",
                                    detail: r.detail || "",
                                  }
                                : tab === "center"
                                  ? { code:r.code||"", name:r.name||"", governorate:r.governorate||"" }
                                : tab === "station"
                                  ? {
                                      code: r.code || "",
                                      name: r.name || "",
                                      governorate: r.governorate || "",
                                      centerId: String(r.center_id || ""),
                                    }
                                  : {
                                      plateNumber: r.plate_number || "",
                                      manufacturer: r.manufacturer || "",
                                      model: r.model || "",
                                      ambulanceType: r.ambulance_type || "",
                                      fuelType: r.fuel_type || "",
                                      centerId: String(r.center_id||""),
                                      mileageKm: String(r.mileage_km||0),
                                      workLocation: r.work_location || "",
                                      serviceStatus: r.service_status || (r.active ? "active" : "out_of_service"),
                                      outOfServiceReason: r.out_of_service_reason || "",
                                    },
                            );
                            requestAnimationFrame(()=>document.querySelector(".settings-form")?.scrollIntoView({behavior:"smooth",block:"center"}));
                          }}
                        >
                          <Pencil /> تعديل
                        </button>
                        <button type="button" className="employee-delete" onClick={() => remove(r)}>
                          <Trash2 /> حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!(tab === "staff" ? staffRows : c.rows)?.length && <Empty />}
              {tab === "staff" && staffRows.length > 0 && <div className="staff-pagination">
                <span>عرض {(activeStaffPage-1)*staffPageSize+1}–{Math.min(activeStaffPage*staffPageSize,staffRows.length)} من {staffRows.length} موظفًا</span>
                <label>عدد الموظفين في الصفحة<select value={staffPageSize} onChange={event=>{setStaffPageSize(Number(event.target.value));setStaffPage(1)}}>{[10,25,50,100].map(size=><option key={size} value={size}>{size}</option>)}</select></label>
                <nav aria-label="صفحات دليل الموظفين">
                  <button type="button" disabled={activeStaffPage===1} onClick={()=>setStaffPage(page=>Math.max(1,page-1))}>السابق</button>
                  {Array.from({length:staffPageCount},(_,index)=>index+1).filter(page=>page===1||page===staffPageCount||Math.abs(page-activeStaffPage)<=2).map((page,index,pages)=><span key={page}>{index>0&&page-pages[index-1]>1&&<i>…</i>}<button type="button" className={page===activeStaffPage?"active":""} onClick={()=>setStaffPage(page)}>{page}</button></span>)}
                  <button type="button" disabled={activeStaffPage===staffPageCount} onClick={()=>setStaffPage(page=>Math.min(staffPageCount,page+1))}>التالي</button>
                </nav>
              </div>}
              {tab === "vehicle" && settingsVehicleRows.length > 0 && <div className="staff-pagination">
                <span>عرض {(activeSettingsVehiclePage-1)*settingsVehiclePageSize+1}–{Math.min(activeSettingsVehiclePage*settingsVehiclePageSize,settingsVehicleRows.length)} من {settingsVehicleRows.length} مركبة</span>
                <strong>الصفحة {activeSettingsVehiclePage} من {settingsVehiclePageCount}</strong>
                <label>عدد الصفوف<select value={settingsVehiclePageSize} onChange={event=>{setSettingsVehiclePageSize(Number(event.target.value));setSettingsVehiclePage(1)}}>{[10,25,50,100].map(size=><option key={size} value={size}>{size}</option>)}</select></label>
                <nav aria-label="صفحات مركبات الإعدادات">
                  <button type="button" disabled={activeSettingsVehiclePage===1} onClick={()=>setSettingsVehiclePage(page=>Math.max(1,page-1))}>السابق</button>
                  {Array.from({length:settingsVehiclePageCount},(_,index)=>index+1).filter(page=>page===1||page===settingsVehiclePageCount||Math.abs(page-activeSettingsVehiclePage)<=2).map((page,index,pages)=><span key={page}>{index>0&&page-pages[index-1]>1&&<i>…</i>}<button type="button" className={page===activeSettingsVehiclePage?"active":""} onClick={()=>setSettingsVehiclePage(page)}>{page}</button></span>)}
                  <button type="button" disabled={activeSettingsVehiclePage===settingsVehiclePageCount} onClick={()=>setSettingsVehiclePage(page=>Math.min(settingsVehiclePageCount,page+1))}>التالي</button>
                </nav>
              </div>}
            </div>
          </section>
          {selectedStaff && <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setSelectedStaff(null)}}>
            <section className="incident-detail-modal staff-detail-modal" dir="rtl">
              <div className="modal-head"><div><h2>{selectedStaff.full_name}</h2><p>الملف الكامل للموظف</p></div><button type="button" className="icon-btn" onClick={()=>setSelectedStaff(null)}><X/></button></div>
              <div className="staff-detail-grid">{selectedStaffFields.map(([label,value])=><article key={String(label)} className={label==="ملاحظات"?"wide":""}><span>{label}</span><b>{value || "—"}</b></article>)}</div>
              <div className="modal-actions"><button type="button" className="ghost" onClick={()=>setSelectedStaff(null)}>إغلاق</button><button type="button" className="primary" onClick={()=>beginStaffEdit(selectedStaff)}><Pencil/> تعديل بيانات الموظف</button></div>
            </section>
          </div>}
        </>
      )}
    </div>
  );
}

function ReportsV2({
  dashboard,
  incidents,
  filters,
  setFilters,
  exportCsv,
  settingsData,
}: {
  dashboard: Dashboard;
  incidents: Incident[];
  filters: any;
  setFilters: any;
  exportCsv: () => void;
  settingsData: any;
}) {
  const [periodType,setPeriodType]=useState("monthly");
  const applyReportPeriod=(type:string)=>{
    setPeriodType(type);
    if(type==="custom")return;
    const end=new Date();
    const start=new Date(end);
    if(type==="daily"){}
    if(type==="weekly"){const day=(start.getDay()+6)%7;start.setDate(start.getDate()-day)}
    if(type==="monthly")start.setDate(1);
    if(type==="quarterly"){start.setMonth(Math.floor(start.getMonth()/3)*3,1)}
    if(type==="half_yearly")start.setMonth(start.getMonth()<6?0:6,1);
    if(type==="yearly")start.setMonth(0,1);
    const iso=(value:Date)=>`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
    setFilters((current:any)=>({...current,from:iso(start),to:iso(end)}));
  };
  const reportIncidents = incidents.filter(
    (x) => x.approval_status === "approved",
  );
  const exportStructuredReport=(kind:"periodic"|"field_response")=>{
    const centers=(settingsData.centers||[]).filter((center:any)=>center.active!==0);
    const stations=settingsData.stations||[];
    const rows=centers.map((center:any)=>{
      const centerStations=stations.filter((station:any)=>Number(station.center_id)===Number(center.id));
      const names=new Set(centerStations.map((station:any)=>String(station.name)));
      const ids=new Set(centerStations.map((station:any)=>Number(station.id)));
      const records=reportIncidents.filter((incident:any)=>names.has(String(incident.station||"")));
      const shift=(value:string)=>records.filter((incident:any)=>String(incident.shift||"").toUpperCase()===value).length;
      return {center:center.name,a:shift("A"),b:shift("B"),c:shift("C"),total:records.length,staff:(settingsData.staff||[]).filter((person:any)=>Number(person.center_id)===Number(center.id)&&person.active!==0).length,vehicles:(settingsData.vehicles||[]).filter((vehicle:any)=>Number(vehicle.center_id)===Number(center.id)&&vehicle.active!==0&&vehicle.service_status!=="maintenance").length,male:records.filter((x:any)=>x.gender==="Male").length,female:records.filter((x:any)=>x.gender==="Female").length,children:records.filter((x:any)=>Number(x.age||0)>0&&Number(x.age)<18).length,adults:records.filter((x:any)=>Number(x.age||0)>=18&&Number(x.age)<60).length,elderly:records.filter((x:any)=>Number(x.age||0)>=60).length,martyrs:records.filter((x:any)=>x.category==="Martyr"||Boolean(x.patient_deceased)).length,injuries:records.filter((x:any)=>x.category==="Trauma"||x.category==="Accident").length,medical:records.filter((x:any)=>x.category==="Medical").length,cancelled:records.filter((x:any)=>Boolean(x.cancelled)||String(x.incident_status||"").startsWith("cancelled")).length};
    });
    const keys=kind==="periodic"?["center","a","b","c","total","staff","vehicles"]:["center","total","male","female","children","adults","elderly","martyrs","injuries","medical","cancelled"];
    const labels:Record<string,string>={center:"المركز",a:"الوردية A",b:"الوردية B",c:"الوردية C",total:"إجمالي المستفيدين",staff:"العاملون المسجلون",vehicles:"المركبات العاملة",male:"ذكور",female:"إناث",children:"أطفال",adults:"بالغون",elderly:"كبار السن",martyrs:"شهداء/وفاة",injuries:"إصابات وحوادث",medical:"حالات مرضية",cancelled:"بلاغات ملغاة"};
    const totals:any={center:"الإجمالي"};keys.slice(1).forEach(key=>totals[key]=rows.reduce((sum:number,row:any)=>sum+Number(row[key]||0),0));
    const csv=[[`الفترة: ${filters.from} إلى ${filters.to}`],[...keys.map(key=>labels[key])],...rows.map((row:any)=>keys.map(key=>row[key])),keys.map(key=>totals[key])].map((line:any[])=>line.map((value:any)=>`"${String(value??"").replaceAll('"','""')}"`).join(",")).join("\n");
    const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${kind}-${filters.from}-${filters.to}.csv`;a.click();URL.revokeObjectURL(a.href);
  };
  const exportCoordination = async () => {
    const r = await fetch(
      `/api/coordinations?from=${filters.from}&to=${filters.to}`,
    );
    if (!r.ok) return toast.error("تعذر تجهيز ملف التنسيقات");
    const rows = (await r.json()).records;
    const columns = [
      "coordination_date",
      "coordinating_agency",
      "vehicle_count",
      "coordination_type",
      "result_description",
      "ambulance_patients",
      "ambulance_companions",
      "bus_patients",
      "coordination_status",
      "participating_vehicles",
    ];
    const csv = [
      columns.join(","),
      ...rows.map((x: any) =>
        columns
          .map((c) => `"${String(x[c] ?? "").replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `coordination-report-${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const [selected, setSelected] = useState<
    | "summary"
    | "cases"
    | "beneficiaries"
    | "missions"
    | "resources"
    | "interventions"
    | "fuel"
    | "movement"
    | "coordination"
    | "periodic"
    | "field_response"
    | null
  >(null);
  const reports = [
    {
      id: "periodic",
      t: "التقرير الدوري للموارد",
      d: "المستفيدون حسب المركز والوردية والعاملون والمركبات العاملة",
      i: Gauge,
    },
    {
      id: "field_response",
      t: "تقرير الاستجابة الميدانية",
      d: "تفاصيل الحالات والمستفيدين والتنسيقات ونتائج الاستجابة حسب المركز",
      i: Siren,
    },
    {
      id: "summary",
      t: "ملخص الحالات",
      d: "الحالات المسجلة والمنقولة وغير المنقولة حسب المنطقة",
      i: Activity,
    },
    {
      id: "cases",
      t: "تفاصيل الحالات",
      d: "الفئة ونوع الحالة والمركز والوردية",
      i: Siren,
    },
    {
      id: "beneficiaries",
      t: "خصائص المستفيدين",
      d: "الإناث والذكور والأطفال والبالغون وكبار السن",
      i: UsersRound,
    },
    {
      id: "missions",
      t: "مهام المركبات",
      d: "المهام حسب المركبة والمركز والوردية",
      i: Ambulance,
    },
    {
      id: "resources",
      t: "تقرير الموارد",
      d: "المستفيدون والعاملون وسيارات الإسعاف حسب المنطقة",
      i: Gauge,
    },
    {
      id: "interventions",
      t: "التدخلات الطبية",
      d: "الإجراءات الطبية والبلاغات الملغاة والوفيات والارتباط بالنزاع",
      i: HeartPulse,
    },
    {
      id: "fuel",
      t: "تقرير وقود المركبات",
      d: "التعبئة والحركة والبلاغات حسب السيارة والفترة",
      i: Ambulance,
    },
    { id: "movement", t: "تقرير حركة السيارات", d: "سجل الحركة حسب المركبة والمحطة والسائق والفترة", i: Route },
    {
      id: "coordination",
      t: "عمليات التنسيق",
      d: "الجهة ونوع التنسيق والمرضى والمرافقون والنتيجة",
      i: Route,
    },
  ] as const;
  const current = reports.find((x) => x.id === selected);
  if (selected && current) {
    const Icon = current.i;
    return (
      <div className="page-stack">
        <section className="report-detail-head">
          <button className="ghost" onClick={() => setSelected(null)}>
            <ChevronLeft /> عودة للتقارير
          </button>
          <div>
            <div className="report-icon">
              <Icon />
            </div>
            <div>
              <h2>{current.t}</h2>
              <p>{current.d}</p>
            </div>
          </div>
          <div className="report-export">
            <button className="ghost" onClick={() => window.print()}>
              <FileBarChart /> تصدير PDF
            </button>
            <button
              className="primary"
              onClick={
                selected === "coordination" ? exportCoordination : selected === "fuel" ? () => document.getElementById("fuel-report-export")?.click() : selected === "movement" ? () => document.getElementById("movement-report-export")?.click() : selected === "periodic" || selected === "field_response" ? ()=>exportStructuredReport(selected) : exportCsv
              }
            >
              <Download /> تصدير Excel
            </button>
          </div>
        </section>
        <ReportPeriodPicker periodType={periodType} applyPeriod={applyReportPeriod} filters={filters} setFilters={setFilters}/>
        <Filters {...{ filters, setFilters }} />
        <ReportContent
          type={selected}
          dashboard={dashboard}
          incidents={reportIncidents}
          settingsData={settingsData}
          filters={filters}
        />
      </div>
    );
  }
  return (
    <div className="page-stack">
      <section className="reports-hero">
        <div>
          <div className="round-icon large">
            <FileBarChart />
          </div>
          <div>
            <h2>مركز التقارير</h2>
            <p>اختر التقرير لعرضه داخل النظام ثم صدّره عند الحاجة</p>
          </div>
        </div>
      </section>
      <ReportPeriodPicker periodType={periodType} applyPeriod={applyReportPeriod} filters={filters} setFilters={setFilters}/>
      <Filters {...{ filters, setFilters }} />
      <section className="report-cards interactive">
        {reports.map((r) => (
          <button
            className="report-card-button"
            key={r.id}
            onClick={() => setSelected(r.id)}
          >
            <div className="report-icon">
              <r.i />
            </div>
            <div>
              <b>{r.t}</b>
              <p>{r.d}</p>
            </div>
            <span>
              عرض التقرير <ChevronLeft />
            </span>
          </button>
        ))}
      </section>
    </div>
  );
}

function ReportPeriodPicker({periodType,applyPeriod,filters,setFilters}:{periodType:string;applyPeriod:(type:string)=>void;filters:any;setFilters:any}){
  const periods=[["daily","يومي"],["weekly","أسبوعي"],["monthly","شهري"],["quarterly","ربعي"],["half_yearly","نصف سنوي"],["yearly","سنوي"],["custom","فترة مخصصة"]];
  return <section className="panel report-period-picker">
    <div className="report-period-heading"><span><Clock3/></span><div><b>دورية التقرير</b><small>اختر الفترة وسيتم تحديث التقرير مباشرة</small></div></div>
    <div className="report-period-buttons">{periods.map(([value,label])=><button type="button" key={value} className={periodType===value?"active":""} onClick={()=>applyPeriod(value)}>{label}</button>)}</div>
    {periodType==="custom"&&<div className="report-custom-range"><label>من تاريخ<input type="date" value={filters.from} onChange={e=>setFilters((current:any)=>({...current,from:e.target.value}))}/></label><label>إلى تاريخ<input type="date" min={filters.from} value={filters.to} onChange={e=>setFilters((current:any)=>({...current,to:e.target.value}))}/></label></div>}
  </section>;
}

function ReportContent({
  type,
  dashboard,
  incidents,
  settingsData,
  filters,
}: {
  type: string;
  dashboard: Dashboard;
  incidents: Incident[];
  settingsData: any;
  filters: any;
}) {
  const [coordination, setCoordination] = useState<any>({
    records: [],
    summary: {},
    agencies: [],
    types: [],
    timeline: [],
  });
  useEffect(() => {
    fetch(`/api/coordinations?from=${filters.from}&to=${filters.to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => v && setCoordination(v))
      .catch(() => {});
  }, [filters.from, filters.to]);
  if(type==="periodic"||type==="field_response"){
    const centers=(settingsData.centers||[]).filter((center:any)=>center.active!==0);
    const stations=settingsData.stations||[];
    const vehicles=settingsData.vehicles||[];
    const staff=settingsData.staff||[];
    const centerRows=centers.map((center:any)=>{
      const centerStations=stations.filter((station:any)=>Number(station.center_id)===Number(center.id));
      const stationNames=new Set(centerStations.map((station:any)=>String(station.name)));
      const stationIds=new Set(centerStations.map((station:any)=>Number(station.id)));
      const rows=incidents.filter((incident:any)=>stationNames.has(String(incident.station||"")));
      const shift=(name:string)=>rows.filter((incident:any)=>String(incident.shift||"").toUpperCase()===name).length;
      const male=rows.filter((incident:any)=>incident.gender==="Male").length;
      const female=rows.filter((incident:any)=>incident.gender==="Female").length;
      return {id:center.id,name:center.name,rows,total:rows.length,a:shift("A"),b:shift("B"),c:shift("C"),staff:staff.filter((person:any)=>Number(person.center_id)===Number(center.id)&&person.active!==0).length,vehicles:vehicles.filter((vehicle:any)=>Number(vehicle.center_id)===Number(center.id)&&vehicle.active!==0&&vehicle.service_status!=="maintenance").length,male,female,children:rows.filter((incident:any)=>Number(incident.age||0)>0&&Number(incident.age)<18).length,adults:rows.filter((incident:any)=>Number(incident.age||0)>=18&&Number(incident.age)<60).length,elderly:rows.filter((incident:any)=>Number(incident.age||0)>=60).length,martyrs:rows.filter((incident:any)=>incident.category==="Martyr"||Boolean(incident.patient_deceased)).length,injuries:rows.filter((incident:any)=>incident.category==="Trauma"||incident.category==="Accident").length,medical:rows.filter((incident:any)=>incident.category==="Medical").length,cancelled:rows.filter((incident:any)=>Boolean(incident.cancelled)||String(incident.incident_status||"").startsWith("cancelled")).length};
    });
    const total=(key:string)=>centerRows.reduce((sum:number,row:any)=>sum+Number(row[key]||0),0);
    if(type==="periodic")return <section className="panel table-panel report-sheet periodic-report" dir="rtl">
      <div className="formal-report-head"><HeartPulse/><div><b>جمعية الهلال الأحمر الفلسطيني</b><span>دائرة الإسعاف والطوارئ</span><h2>التقرير الدوري للموارد والتشغيل</h2><p>للفترة من {filters.from} حتى {filters.to}</p></div></div>
      <div className="table-wrap"><table><thead><tr><th rowSpan={2}>المركز</th><th colSpan={4}>عدد المستفيدين</th><th rowSpan={2}>العاملون المسجلون</th><th rowSpan={2}>المركبات العاملة</th></tr><tr><th>A</th><th>B</th><th>C</th><th>المجموع</th></tr></thead><tbody>{centerRows.map((row:any)=><tr key={row.id}><td><b>{row.name}</b></td><td>{row.a}</td><td>{row.b}</td><td>{row.c}</td><td><b>{row.total}</b></td><td>{row.staff}</td><td>{row.vehicles}</td></tr>)}<tr className="report-total-row"><td>الإجمالي</td><td>{total("a")}</td><td>{total("b")}</td><td>{total("c")}</td><td>{total("total")}</td><td>{total("staff")}</td><td>{total("vehicles")}</td></tr></tbody></table></div>
    </section>;
    return <section className="panel table-panel report-sheet field-response-report" dir="rtl">
      <div className="formal-report-head"><HeartPulse/><div><b>جمعية الهلال الأحمر الفلسطيني</b><span>دائرة الإسعاف والطوارئ</span><h2>تفصيل الاستجابة الميدانية لمراكز الإسعاف</h2><p>من {filters.from} حتى {filters.to}</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>المركز</th><th>المستفيدون</th><th>ذكور</th><th>إناث</th><th>أطفال</th><th>بالغون</th><th>كبار السن</th><th>شهداء/وفاة</th><th>إصابات وحوادث</th><th>حالات مرضية</th><th>بلاغات ملغاة</th></tr></thead><tbody>{centerRows.map((row:any)=><tr key={row.id}><td><b>{row.name}</b></td><td>{row.total}</td><td>{row.male}</td><td>{row.female}</td><td>{row.children}</td><td>{row.adults}</td><td>{row.elderly}</td><td>{row.martyrs}</td><td>{row.injuries}</td><td>{row.medical}</td><td>{row.cancelled}</td></tr>)}<tr className="report-total-row"><td>المجموع الكلي</td>{["total","male","female","children","adults","elderly","martyrs","injuries","medical","cancelled"].map(key=><td key={key}>{total(key)}</td>)}</tr></tbody></table></div>
    </section>;
  }
  if (type === "fuel") return <FuelReport from={filters.from} to={filters.to}/>;
  if (type === "movement") return <MovementReport from={filters.from} to={filters.to}/>;
  if (type === "interventions") {
    const interventionData = [["oxygen","أكسجين"],["bvm","BVM"],["airway","مجرى هوائي"],["cpr","إنعاش CPR"],["aed","AED"],["drugs","أدوية"],["wound_care","عناية بالجروح"],["tourniquet","عاصبة"],["immobilization","تثبيت"],["cervical_collar","طوق رقبة"],["glucose_check","فحص سكر"],["splinting","جبيرة"],["delivery","ولادة"]]
      .map(([key,name])=>({name,value:incidents.filter(x=>Boolean(x[key])).length}));
    return <div className="page-stack">
      <section className="report-metrics">
        {[["بلاغات ملغاة",incidents.filter(x=>Boolean(x.cancelled)).length],["حالات وفاة",incidents.filter(x=>Boolean(x.patient_deceased)).length],["مرتبطة بالنزاع",incidents.filter(x=>Boolean(x.conflict_related)).length],["إجمالي التدخلات",interventionData.reduce((s,x)=>s+x.value,0)]].map(([label,value])=><article key={label} className="panel"><b>{value}</b><span>{label}</span></article>)}
      </section>
      <section className="panel chart-report"><PanelTitle icon={HeartPulse} title="التدخلات الطبية المنفذة" subtitle="مستخرج مباشرة من حقول Data Sheet" />
        <ResponsiveContainer width="100%" height={380}><BarChart data={interventionData} layout="vertical" margin={{right:30,left:30}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number"/><YAxis type="category" dataKey="name" width={100}/><Tooltip/><Bar dataKey="value" name="عدد التدخلات" fill="#c4172c" radius={[0,8,8,0]}/></BarChart></ResponsiveContainer>
      </section>
    </div>;
  }
  if (type === "resources")
    return (
      <section className="panel table-panel report-sheet">
        <PanelTitle
          icon={Gauge}
          title="الموارد حسب المنطقة"
          subtitle="مطابق لبنية Fact_Resources في ملف الإكسل"
        />
        <div className="inline-report-chart">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dashboard.stations}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar
                dataKey="incidents"
                name="المستفيدون"
                fill="#c4172c"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>المنطقة / المحطة</th>
                <th>المستفيدون</th>
                <th>عدد العاملين</th>
                <th>عدد سيارات الإسعاف</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.stations.map((x) => (
                <tr key={x.name}>
                  <td>
                    <b>{x.name}</b>
                  </td>
                  <td>{x.incidents}</td>
                  <td>
                    {(settingsData.staff || []).filter(
                      (s: any) =>
                        Number(s.center_id) ===
                        Number(
                          (settingsData.stations || []).find(
                            (q: any) => q.name === x.name,
                          )?.center_id,
                        ),
                    ).length || "—"}
                  </td>
                  <td>
                    {(settingsData.vehicles || []).filter(
                      (v: any) =>
                        Number(v.center_id) ===
                        Number(
                          (settingsData.stations || []).find(
                            (q: any) => q.name === x.name,
                          )?.center_id,
                        ),
                    ).length || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  if (type === "missions") {
    const fleet = Object.values(
      incidents.reduce((a: any, x: any) => {
        const k = String(x.vehicle || "غير محدد");
        a[k] ??= { name: k, incidents: 0, distance: 0, fuel: 0 };
        a[k].incidents++;
        a[k].distance += Number(x.distance_km || 0);
        a[k].fuel += Number(x.fuel_liters || 0);
        return a;
      }, {}),
    ) as any[];
    return (
      <section className="panel table-panel report-sheet">
        <PanelTitle
          icon={Ambulance}
          title="مهام المركبات"
          subtitle="مطابق لبنية Fact_VehicleMissions في ملف الإكسل"
        />
        <div className="inline-report-chart">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={fleet}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar
                dataKey="incidents"
                name="عدد المهام"
                fill="#c4172c"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>المركبة</th>
                <th>عدد المهام</th>
                <th>الوردية</th>
                <th>المسافة</th>
                <th>الوقود</th>
              </tr>
            </thead>
            <tbody>
              {fleet.map((x) => (
                <tr key={x.name}>
                  <td>
                    <b>{x.name}</b>
                  </td>
                  <td>{x.incidents}</td>
                  <td>جميع الورديات</td>
                  <td>{x.distance.toFixed(1)} كم</td>
                  <td>{x.fuel.toFixed(1)} لتر</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }
  if (type === "beneficiaries") {
    const male = incidents.filter((x) => x.gender === "Male").length,
      female = incidents.filter((x) => x.gender === "Female").length,
      children = incidents.filter((x) => Number(x.age || 0) < 18).length,
      adults = incidents.filter(
        (x) => Number(x.age || 0) >= 18 && Number(x.age || 0) < 60,
      ).length,
      elderly = incidents.filter((x) => Number(x.age || 0) >= 60).length;
    return (
      <>
        <section className="report-metrics">
          <article>
            <UsersRound />
            <b>{incidents.length}</b>
            <span>إجمالي المستفيدين</span>
          </article>
          <article>
            <UserRound />
            <b>{male}</b>
            <span>ذكور</span>
          </article>
          <article>
            <UserRound />
            <b>{female}</b>
            <span>إناث</span>
          </article>
          <article>
            <HeartPulse />
            <b>{children}</b>
            <span>أقل من 18 عامًا</span>
          </article>
          <article>
            <UsersRound />
            <b>{adults}</b>
            <span>بالغون</span>
          </article>
          <article>
            <UserRound />
            <b>{elderly}</b>
            <span>كبار السن</span>
          </article>
        </section>
        <section className="panel chart-report">
          <PanelTitle
            icon={BarChart3}
            title="توزيع المستفيدين"
            subtitle="حسب المحافظة"
          />
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={dashboard.governorates}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#c4172c" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </>
    );
  }
  if (type === "cases")
    return (
      <section className="panel table-panel report-sheet">
        <PanelTitle
          icon={Siren}
          title="تفاصيل الحالات المصنفة"
          subtitle="الفئة ونوع الحالة وعدد الحالات ضمن الفترة"
        />
        <div className="inline-report-chart">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dashboard.cases}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar
                dataKey="value"
                name="عدد الحالات"
                fill="#c4172c"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>نوع الحالة</th>
                <th>الفئة</th>
                <th>العدد</th>
                <th>النسبة</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.cases.map((x) => (
                <tr key={x.name}>
                  <td>
                    <b>{x.name}</b>
                  </td>
                  <td>حسب التصنيف المسجل</td>
                  <td>{x.value}</td>
                  <td>
                    {Math.round(
                      (x.value / (dashboard.summary.total || 1)) * 100,
                    )}
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  if (type === "coordination")
    return (
      <>
        <section className="report-metrics">
          <article>
            <Route />
            <b>{coordination.summary.total || 0}</b>
            <span>إجمالي التنسيقات</span>
          </article>
          <article>
            <Ambulance />
            <b>{coordination.summary.vehicles || 0}</b>
            <span>مشاركة مركبات</span>
          </article>
          <article>
            <UsersRound />
            <b>{coordination.summary.patients || 0}</b>
            <span>المرضى بالإسعاف</span>
          </article>
          <article>
            <CheckCircle2 />
            <b>{coordination.summary.successful || 0}</b>
            <span>تنسيقات ناجحة</span>
          </article>
        </section>
        <section className="report-chart-grid">
          <article className="panel chart-report">
            <PanelTitle
              icon={BarChart3}
              title="التنسيقات حسب الجهة"
              subtitle="عدد العمليات لكل جهة منسقة"
            />
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={coordination.agencies}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#c4172c" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </article>
          <article className="panel chart-report">
            <PanelTitle
              icon={Activity}
              title="اتجاه التنسيقات"
              subtitle="التوزيع اليومي خلال الفترة"
            />
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={coordination.timeline}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#c4172c"
                  fill="#fff0f2"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </article>
        </section>
        <section className="panel table-panel">
          <PanelTitle
            icon={Route}
            title="تفاصيل عمليات التنسيق"
            subtitle="الجهة ونوع التنسيق والمرضى والمرافقون والنتيجة"
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الجهة</th>
                  <th>النوع</th>
                  <th>المركبات</th>
                  <th>المرضى</th>
                  <th>المرافقون</th>
                  <th>النتيجة</th>
                </tr>
              </thead>
              <tbody>
                {coordination.records.map((x: any) => (
                  <tr key={x.id}>
                    <td>{x.coordination_date}</td>
                    <td>
                      <b>{x.coordinating_agency}</b>
                    </td>
                    <td>{x.coordination_type}</td>
                    <td>{x.vehicle_count}</td>
                    <td>{x.ambulance_patients}</td>
                    <td>{x.ambulance_companions}</td>
                    <td>{x.result_description || x.coordination_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!coordination.records.length && <Empty />}
          </div>
        </section>
      </>
    );
  const notTransported = incidents.filter(
    (x) => !x.dropoff_location && !x.dropoff_type,
  ).length;
  const served = Math.max(0, incidents.length - notTransported);
  const incidentTimeline = dashboard.timeline?.length
    ? dashboard.timeline
    : Number(dashboard.summary.total || 0) > 0
      ? [
          {
            month: "الفترة المحددة",
            value: Number(dashboard.summary.total || 0),
          },
        ]
      : [];
  const timelineTotal = incidentTimeline.reduce(
    (sum, item) => sum + Number(item.value || 0),
    0,
  );
  const timelineAverage = incidentTimeline.length
    ? Math.round(timelineTotal / incidentTimeline.length)
    : 0;
  const timelinePeak = incidentTimeline.reduce<
    { month: string; value: number } | undefined
  >(
    (peak, item) =>
      !peak || Number(item.value || 0) > Number(peak.value || 0) ? item : peak,
    undefined,
  );
  return (
    <>
      <section className="report-metrics">
        <article>
          <Siren />
          <b>{dashboard.summary.total || 0}</b>
          <span>إجمالي الحالات المسجلة</span>
        </article>
        <article>
          <CheckCircle2 />
          <b>{served}</b>
          <span>الحالات المنقولة أو المخدومة</span>
        </article>
        <article>
          <XCircle />
          <b>{notTransported}</b>
          <span>الحالات التي لم تُنقل</span>
        </article>
        <article>
          <Ambulance />
          <b>{new Set(incidents.map((x) => x.vehicle).filter(Boolean)).size}</b>
          <span>عدد المركبات الفريدة</span>
        </article>
      </section>
      <section className="panel chart-report incident-trend-report">
        <PanelTitle
          icon={Activity}
          title="نبض البلاغات"
          subtitle="تغيّر حجم البلاغات شهرياً خلال الفترة المحددة"
        />
        <div className="trend-report-summary">
          <article>
            <span>إجمالي الفترة</span>
            <b>{timelineTotal}</b>
            <small>بلاغ</small>
          </article>
          <article>
            <span>المتوسط الشهري</span>
            <b>{timelineAverage}</b>
            <small>بلاغ</small>
          </article>
          <article>
            <span>أعلى شهر</span>
            <b>{timelinePeak?.value || 0}</b>
            <small>{timelinePeak?.month || "—"}</small>
          </article>
        </div>
        <div className="report-trend-chart">
          <ResponsiveContainer width="100%" height={330}>
            <LineChart
              data={incidentTimeline}
              margin={{ top: 18, right: 18, left: 0, bottom: 4 }}
            >
              <CartesianGrid stroke="#e7e9ee" strokeDasharray="4 6" vertical={false} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#667085", fontSize: 12 }}
                tickMargin={12}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#98a2b3", fontSize: 12 }}
                width={34}
              />
              <Tooltip
                cursor={{ stroke: "#f3b7bf", strokeWidth: 2, strokeDasharray: "5 5" }}
                contentStyle={{
                  border: "0",
                  borderRadius: 14,
                  boxShadow: "0 14px 34px rgba(16,24,40,.14)",
                  direction: "rtl",
                }}
                labelStyle={{ color: "#344054", fontWeight: 800 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name="عدد البلاغات"
                stroke="#c4172c"
                strokeWidth={4}
                dot={{ r: 5, fill: "#fff", stroke: "#c4172c", strokeWidth: 3 }}
                activeDot={{ r: 8, fill: "#c4172c", stroke: "#fff", strokeWidth: 4 }}
                connectNulls
                animationDuration={1100}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
          {!incidentTimeline.length && (
            <div className="report-trend-empty">
              <Activity />
              <b>لا توجد بلاغات ضمن الفترة المحددة</b>
              <span>غيّري نطاق التاريخ لعرض الحركة الشهرية.</span>
            </div>
          )}
        </div>
      </section>
      <section className="panel chart-report">
        <PanelTitle
          icon={BarChart3}
          title="ملخص الحالات"
          subtitle="توزيع الحالات حسب النوع ضمن الفترة المحددة"
        />
        <ResponsiveContainer width="100%" height={330}>
          <BarChart data={dashboard.cases}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar
              dataKey="value"
              name="عدد الحالات"
              fill="#c4172c"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </>
  );
}

function FuelReport({from,to}:{from:string;to:string}) {
  const [data,setData]=useState<any>({vehicles:[],fuel:[],movements:[],incidents:[]});
  useEffect(()=>{fetch(`/api/fleet?${new URLSearchParams({from,to})}`).then(r=>r.ok?r.json():null).then(x=>x&&setData(x)).catch(()=>toast.error("تعذر تحميل تقرير الوقود"))},[from,to]);
  const rows=data.vehicles.map((v:any)=>{const fills=data.fuel.filter((x:any)=>x.vehicle_id===v.id),moves=data.movements.filter((x:any)=>x.vehicle_id===v.id),cases=data.incidents.filter((x:any)=>x.approval_status==="approved" && (x.vehicle_id===v.id || x.vehicle?.replace(/\s/g,"")===v.plate_number.replace(/\s/g,"")));return {plate:v.plate_number,location:v.station_name||v.work_location||"—",fuel:v.fuel_type||"—",fillCount:fills.length,liters:fills.reduce((s:number,x:any)=>s+Number(x.liters),0),moveKm:moves.reduce((s:number,x:any)=>s+(x.km_end==null?0:Number(x.km_end)-Number(x.km_start)),0),cases:cases.length,caseKm:cases.reduce((s:number,x:any)=>s+Number(x.distance_km||0),0)}}).filter((x:any)=>x.fillCount||x.moveKm||x.cases);
  const exportCsv=()=>{const csv=[["المركبة","المحطة","الوقود","مرات التعبئة","لتر معبأ","كم حركة","عدد البلاغات","كم بلاغات"],...rows.map((x:any)=>[x.plate,x.location,x.fuel,x.fillCount,x.liters,x.moveKm,x.cases,x.caseKm])].map(line=>line.map((v:any)=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"}));a.download=`fleet-report-${from}-${to}.csv`;a.click();URL.revokeObjectURL(a.href)};
  return <div className="page-stack"><button id="fuel-report-export" hidden onClick={exportCsv}/><section className="panel"><PanelTitle icon={BarChart3} title="لترات التعبئة حسب السيارة" subtitle="الكميات المُعبّأة، وليست قياسًا دقيقًا للاستهلاك"/><ResponsiveContainer width="100%" height={320}><BarChart data={rows.filter((x:any)=>x.liters).sort((a:any,b:any)=>b.liters-a.liters).slice(0,12)}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="plate"/><YAxis/><Tooltip/><Bar dataKey="liters" name="لتر معبأ" fill="#c4172c" radius={[8,8,0,0]}/></BarChart></ResponsiveContainer></section><section className="panel table-panel"><PanelTitle icon={Ambulance} title="تقرير المركبات والبلاغات" subtitle={`${from} إلى ${to} — قارني مسافة الحركة مع مسافات البلاغات ولا تجمعيهما كمسافتين مستقلتين`}/><div className="table-wrap"><table><thead><tr><th>السيارة</th><th>المحطة</th><th>الوقود</th><th>التعبئات</th><th>لتر مُعبّأ</th><th>الحركة (كم)</th><th>البلاغات</th><th>البلاغات (كم)</th></tr></thead><tbody>{rows.map((x:any)=><tr key={x.plate}><td>{x.plate}</td><td>{x.location}</td><td>{x.fuel}</td><td>{x.fillCount}</td><td>{x.liters.toFixed(1)}</td><td>{x.moveKm.toFixed(1)}</td><td>{x.cases}</td><td>{x.caseKm.toFixed(1)}</td></tr>)}</tbody></table>{rows.length===0&&<Empty/>}</div></section></div>;
}

function MovementReport({from,to}:{from:string;to:string}) {
  const [data,setData]=useState<any>({vehicles:[],movements:[]});
  const [options,setOptions]=useState({vehicle:"all",station:"all",driver:"all",linked:"all"});
  useEffect(()=>{fetch(`/api/fleet?${new URLSearchParams({from,to})}`).then(r=>r.ok?r.json():Promise.reject()).then(setData).catch(()=>toast.error("تعذر تحميل سجل الحركة"))},[from,to]);
  const vehicles=data.vehicles||[];
  const rows=(data.movements||[]).filter((m:any)=>{const v=vehicles.find((x:any)=>x.id===m.vehicle_id);return (options.vehicle==="all"||String(m.vehicle_id)===options.vehicle)&&(options.station==="all"||String(v?.station_id||"")===options.station)&&(options.driver==="all"||m.driver_name===options.driver)&&(options.linked==="all"||(options.linked==="yes"?Boolean(m.incident_number):!m.incident_number))});
  const distance=(m:any):any=>m.km_end==null?null:Number(m.km_end)-Number(m.km_start);
  const total=rows.reduce((sum:number,m:any)=>sum+Math.max(0,distance(m)||0),0);
  const exportRows=()=>{const table=[["م","التاريخ","السائق","المركبة","المحطة","وقت الخروج","وقت العودة","الوجهة","عداد البداية","عداد النهاية","المسافة كم","رقم البلاغ","ملاحظات"],...rows.map((m:any,i:number)=>[i+1,String(m.departed_at||"").slice(0,10),m.driver_name,m.plate_number,vehicles.find((v:any)=>v.id===m.vehicle_id)?.station_name||"",formatDateTime24(m.departed_at),m.returned_at?formatDateTime24(m.returned_at):"",m.destination,m.km_start,m.km_end,distance(m),m.incident_number,m.notes])];const csv=table.map((line:any[])=>line.map((value:any)=>{let s=String(value??"");if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return `"${s.replaceAll('"','""')}"`}).join(",")).join("\r\n");const url=URL.createObjectURL(new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=`movement-report-${from}-${to}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  return <div className="page-stack movement-report" dir="rtl"><button hidden id="movement-report-export" onClick={exportRows}/><section className="panel movement-options"><div className="filter-title"><span className="filter-mark"><SlidersHorizontal/></span><span><b>فلاتر سجل الحركة</b><small>{rows.length} حركة ضمن الفترة المختارة</small></span></div><div className="movement-option-fields"><label>المركبة<select value={options.vehicle} onChange={e=>setOptions({...options,vehicle:e.target.value})}><option value="all">جميع المركبات</option>{vehicles.map((v:any)=><option key={v.id} value={v.id}>{v.plate_number}</option>)}</select></label><label>المحطة<select value={options.station} onChange={e=>setOptions({...options,station:e.target.value})}><option value="all">كل المحطات</option>{[...new Map(vehicles.filter((v:any)=>v.station_id).map((v:any)=>[v.station_id,v.station_name])).entries()].map(([id,name]:any)=><option key={id} value={id}>{name}</option>)}</select></label><label>السائق<select value={options.driver} onChange={e=>setOptions({...options,driver:e.target.value})}><option value="all">كل السائقين</option>{[...new Set((data.movements||[]).map((m:any)=>m.driver_name).filter(Boolean))].map((name:any)=><option key={name}>{name}</option>)}</select></label><label>ربط البلاغ<select value={options.linked} onChange={e=>setOptions({...options,linked:e.target.value})}><option value="all">الكل</option><option value="yes">مرتبطة ببلاغ</option><option value="no">دون بلاغ</option></select></label><button className="ghost" onClick={()=>setOptions({vehicle:"all",station:"all",driver:"all",linked:"all"})}><RefreshCw/> مسح</button></div></section><section className="panel movement-sheet"><div className="movement-letterhead"><b>جمعية الهلال الأحمر الفلسطيني</b><span>دائرة الإسعاف والطوارئ</span><h2>تقرير حركة سيارات الإسعاف</h2><p>من {from} إلى {to} · المركبة: {options.vehicle==="all"?"جميع المركبات":vehicles.find((v:any)=>String(v.id)===options.vehicle)?.plate_number} · عدد الحركات: {rows.length} · مجموع المسافة المسجلة: {total.toFixed(1)} كم</p></div><div className="table-wrap"><table><thead><tr>{["م","التاريخ","السائق","المركبة","المحطة","الخروج","العودة","الوجهة","عداد البداية","عداد النهاية","المسافة كم","البلاغ","ملاحظات"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((m:any,i:number)=><tr key={m.id}><td>{i+1}</td><td>{String(m.departed_at||"").slice(0,10)}</td><td>{m.driver_name||"—"}</td><td>{m.plate_number||"—"}</td><td>{vehicles.find((v:any)=>v.id===m.vehicle_id)?.station_name||"—"}</td><td>{formatDateTime24(m.departed_at)}</td><td>{m.returned_at?formatDateTime24(m.returned_at):"قيد الحركة"}</td><td>{m.destination||"—"}</td><td>{m.km_start??"—"}</td><td>{m.km_end??"—"}</td><td>{distance(m)==null?"—":distance(m).toFixed(1)}</td><td>{m.incident_number||"—"}</td><td>{m.notes||"—"}</td></tr>)}</tbody></table>{!rows.length&&<Empty/>}</div></section></div>;
}

function FleetView({staff,centersData,onImported,onOpenIncident}:{staff:any[];centersData:any[];onImported:()=>void;onOpenIncident:(incidentId:number)=>void}) {
  // Kept as a local alias while the fleet view transitions from station ownership
  // to center ownership; values and identifiers below are centers.
  const stationsData = centersData;
  const [period,setPeriod]=useState({from:monthStart,to:today});
  const [data,setData]=useState<any>({vehicles:[],fuel:[],movements:[],incidents:[],importReview:[]});
  const [tab,setTab]=useState<"fill"|"movement">("fill");
  const [fleetSection,setFleetSection]=useState<"vehicles"|"fuel"|"movements">("vehicles");
  const [vehicleId,setVehicleId]=useState("");
  const [draft,setDraft]=useState<Record<string,string>>({filledAt:`${today}T09:00`,departedAt:`${today}T09:00`});
  const [busy,setBusy]=useState(false);
  const [importAttempted,setImportAttempted]=useState(false);
  const [vehicleFilters,setVehicleFilters]=useState({search:"",station:"all",fuel:"all",status:"all"});
  const [editVehicle,setEditVehicle]=useState<any>(null);
  const [newVehicle,setNewVehicle]=useState<any>(null);
  const [vehicleProfile,setVehicleProfile]=useState<any>(null);
  const [vehicleProfileData,setVehicleProfileData]=useState<any>(null);
  const [vehicleProfileTab,setVehicleProfileTab]=useState<"incidents"|"maintenance"|"fuel"|"movements">("incidents");
  const [vehicleProfileLoading,setVehicleProfileLoading]=useState(false);
  const [deletingVehicleId,setDeletingVehicleId]=useState<number|null>(null);
  const [fleetPage,setFleetPage]=useState(1);
  const [fleetPageSize,setFleetPageSize]=useState(10);
  const [fuelPage,setFuelPage]=useState(1);
  const [fuelPageSize,setFuelPageSize]=useState(10);
  const [movementPage,setMovementPage]=useState(1);
  const [movementPageSize,setMovementPageSize]=useState(10);
  const operationalVehicles=(data.vehicles||[]).filter((v:any)=>v.service_status==="maintenance" || (v.service_status!=="out_of_service" && v.active!==0));
  const fleetRows=operationalVehicles.filter((v:any)=>(!vehicleFilters.search || `${v.plate_number} ${v.manufacturer||""} ${v.work_location||""}`.toLowerCase().includes(vehicleFilters.search.toLowerCase())) && (vehicleFilters.station==="all" || (vehicleFilters.station==="unassigned" ? !v.center_id : String(v.center_id||"")===vehicleFilters.station)) && (vehicleFilters.fuel==="all" || v.fuel_type===vehicleFilters.fuel) && (vehicleFilters.status==="all" || (v.service_status==="maintenance"?"maintenance":"active")===vehicleFilters.status));
  const fleetPageCount=Math.max(1,Math.ceil(fleetRows.length/fleetPageSize));
  const activeFleetPage=Math.min(fleetPage,fleetPageCount);
  const paginatedFleetRows=fleetRows.slice((activeFleetPage-1)*fleetPageSize,activeFleetPage*fleetPageSize);
  const fuelRows=data.fuel||[];
  const fuelPageCount=Math.max(1,Math.ceil(fuelRows.length/fuelPageSize));
  const activeFuelPage=Math.min(fuelPage,fuelPageCount);
  const paginatedFuelRows=fuelRows.slice((activeFuelPage-1)*fuelPageSize,activeFuelPage*fuelPageSize);
  const movementRows=data.movements||[];
  const movementPageCount=Math.max(1,Math.ceil(movementRows.length/movementPageSize));
  const activeMovementPage=Math.min(movementPage,movementPageCount);
  const paginatedMovementRows=movementRows.slice((activeMovementPage-1)*movementPageSize,activeMovementPage*movementPageSize);
  const saveVehicle=async(e:React.FormEvent)=>{e.preventDefault();if(!editVehicle)return;setBusy(true);try{const r=await fetch("/api/settings",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({entity:"vehicle",id:editVehicle.id,plateNumber:editVehicle.plate_number,manufacturer:editVehicle.manufacturer,model:editVehicle.model,ambulanceType:editVehicle.ambulance_type,fuelType:editVehicle.fuel_type,centerId:editVehicle.center_id,mileageKm:editVehicle.mileage_km,workLocation:editVehicle.work_location,serviceStatus:editVehicle.service_status,outOfServiceReason:editVehicle.out_of_service_reason})});const v=await r.json();if(!r.ok)throw Error(v.error||"تعذر تعديل المركبة");toast.success("تم حفظ بيانات المركبة");setEditVehicle(null);await load();onImported()}catch(err){toast.error(String(err).replace(/^Error: /,""))}finally{setBusy(false)}};
  const addVehicle=async(e:React.FormEvent)=>{e.preventDefault();if(!newVehicle)return;setBusy(true);try{const r=await fetch("/api/settings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({entity:"vehicle",...newVehicle})});const v=await r.json();if(!r.ok)throw Error(v.error||"تعذر إضافة المركبة");toast.success("تمت إضافة المركبة");setNewVehicle(null);await load();onImported()}catch(err){toast.error(String(err).replace(/^Error: /,""))}finally{setBusy(false)}};
  const importArchiveFile=async(e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;try{const text=await file.text();const lines=text.split(/\r?\n/).filter(Boolean);const rows=lines.slice(1).map(line=>line.split(",")).filter(x=>x[0]).map(x=>({plate:x[0],manufacturer:x[1],model:x[2],fuelType:x[3],location:x[4],status:x[5]||"داخل الخدمة"}));const r=await fetch("/api/fleet",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"importArchive",rows})});const v=await r.json();if(!r.ok)throw Error(v.error||"تعذر استيراد الأرشيف");toast.success(`تم استيراد ${v.added||0} مركبة من الأرشيف`);await load();onImported()}catch(err){toast.error(String(err).replace(/^Error: /,""))}e.target.value=""};
  const selected=data.vehicles.find((v:any)=>String(v.id)===vehicleId);
  const linked=(data.incidents||[]).filter((i:any)=>i.vehicle_id===selected?.id || i.vehicle?.replace(/\s/g,"")===selected?.plate_number?.replace(/\s/g,""));
  const load=useCallback(async()=>{const q=new URLSearchParams(period).toString();const r=await fetch(`/api/fleet?${q}`);if(r.ok)setData(await r.json());else toast.error((await r.json()).error||"تعذر تحميل الأسطول");},[period]);
  const openVehicleProfile=async(vehicle:any)=>{setVehicleProfile(vehicle);setVehicleProfileData(null);setVehicleProfileTab("incidents");setVehicleProfileLoading(true);try{const r=await fetch(`/api/fleet?vehicleId=${vehicle.id}`);const body=await r.json();if(!r.ok)throw Error(body.error||"تعذر تحميل ملف المركبة");setVehicleProfileData(body)}catch(err){toast.error(String(err).replace(/^Error: /,""));setVehicleProfile(null)}finally{setVehicleProfileLoading(false)}};
  const deleteVehicle=async(vehicle:any)=>{if(!window.confirm(`هل تريدين حذف المركبة ${vehicle.plate_number} نهائيًا؟\n\nلن يسمح النظام بالحذف إذا كانت مرتبطة ببلاغ أو وقود أو حركة أو صيانة.`))return;setDeletingVehicleId(Number(vehicle.id));try{const r=await fetch("/api/settings",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({entity:"vehicle",id:vehicle.id})});const body=await r.json();if(!r.ok)throw Error(body.error||"تعذر حذف المركبة");if(String(vehicleId)===String(vehicle.id))setVehicleId("");if(Number(vehicleProfile?.id)===Number(vehicle.id))setVehicleProfile(null);toast.success(`تم حذف المركبة ${vehicle.plate_number}`);await load();onImported()}catch(err){toast.error(String(err).replace(/^Error: /,""))}finally{setDeletingVehicleId(null)}};
  useEffect(()=>{load()},[load]);
  useEffect(()=>{const refreshFleet=()=>{void load();if(!vehicleProfile?.id)return;setVehicleProfileLoading(true);fetch(`/api/fleet?vehicleId=${vehicleProfile.id}`,{cache:"no-store"}).then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.error||"تعذر تحديث ملف المركبة");setVehicleProfileData(body)}).catch(error=>toast.error(String(error).replace(/^Error: /,""))).finally(()=>setVehicleProfileLoading(false))};window.addEventListener("ems:fleet-refresh",refreshFleet);return()=>window.removeEventListener("ems:fleet-refresh",refreshFleet)},[load,vehicleProfile?.id]);
  const set=(k:string,v:string)=>setDraft(p=>({...p,[k]:v}));
  const save=async(e:React.FormEvent)=>{e.preventDefault();if(!vehicleId)return toast.error("اختر المركبة");setBusy(true);
    try {const r=await fetch("/api/fleet",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:tab,vehicleId:Number(vehicleId),...draft,fuelType:selected?.fuel_type})});const v=await r.json();if(!r.ok)throw Error(v.error);toast.success(tab==="fill"?"تم تسجيل التعبئة":"تم تسجيل الحركة");const reading=tab==="movement"&&draft.kmEnd?draft.kmEnd:String(Number(selected?.mileage_km||0));setDraft({filledAt:`${today}T09:00`,departedAt:`${today}T09:00`,kmStart:reading,odometerKm:reading});await load();}catch(err){toast.error(String(err).replace(/^Error: /,""))}finally{setBusy(false)}};
  const importFleet=async()=>{setBusy(true);try {const r=await fetch("/api/fleet",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"import"})});const v=await r.json();if(!r.ok)throw Error(v.error);toast.success(`أضيفت ${v.added} مركبة؛ ${v.review} للمراجعة`);await load();onImported()}catch(err){toast.error(String(err).replace(/^Error: /,""))}finally{setBusy(false)}};
  useEffect(()=>{if(data.pendingImportCount>0 && !importAttempted && !busy){setImportAttempted(true);importFleet()}},[data.pendingImportCount,importAttempted,busy]);
  const fuelLiters=data.fuel.reduce((s:number,r:any)=>s+Number(r.liters||0),0);
  const kmTotal=data.movements.reduce((s:number,r:any)=>s+(r.km_end==null?0:Number(r.km_end)-Number(r.km_start)),0);
  const chart=data.vehicles.map((v:any)=>({name:v.plate_number,liters:data.fuel.filter((f:any)=>f.vehicle_id===v.id).reduce((s:number,f:any)=>s+Number(f.liters),0)})).filter((x:any)=>x.liters>0).sort((a:any,b:any)=>b.liters-a.liters).slice(0,10);
  const profileIncidents=vehicleProfileData?.incidents||[];
  const profileMaintenance=vehicleProfileData?.maintenance||[];
  const profileFuel=vehicleProfileData?.fuel||[];
  const profileMovements=vehicleProfileData?.movements||[];
  const profileVehicle=vehicleProfileData?.vehicle||vehicleProfile;
  const profileLiters=profileFuel.reduce((sum:number,row:any)=>sum+Number(row.liters||0),0);
  const profileDistance=profileMovements.reduce((sum:number,row:any)=>sum+(row.km_end==null?0:Math.max(0,Number(row.km_end)-Number(row.km_start))),0);
  const exportRows=()=>{const heads=["التاريخ","المركبة","نوع الوقود","الكمية (لتر)","عداد الكيلومترات","السائق","من عبأ","رقم البلاغ","رقم القسيمة"];
    const csv=[heads,...data.fuel.map((x:any)=>[formatDateTime24(x.filled_at),x.plate_number,x.fuel_type,x.liters,x.odometer_km,x.driver_name,x.filled_by_name,x.incident_number,x.voucher_number])].map(row=>row.map((v:any)=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"}));a.download=`fleet-fuel-${period.from}-${period.to}.csv`;a.click();URL.revokeObjectURL(a.href)};
  return <div className="page-stack fleet-page">
    <section className="panel fleet-head"><div><h2><Ambulance/> المركبات والوقود</h2><p>إدارة موحدة للمركبات والتعبئة والحركة، مع فصل السجلات في تبويبات واضحة.</p></div>{fleetSection==="vehicles"&&<div className="fleet-head-actions"><button className="primary" onClick={()=>setNewVehicle({plateNumber:"",manufacturer:"",model:"",ambulanceType:"",fuelType:"",centerId:"",mileageKm:"0",workLocation:"",serviceStatus:"active"})}><PlusCircle/> إضافة مركبة</button><label className="archive-import ghost"><Upload/> استيراد الأرشيف<input type="file" accept=".csv,text/csv" onChange={importArchiveFile}/></label><button className="ghost" onClick={importFleet} disabled={busy}><PlusCircle/> استيراد سيارات سبتمبر</button></div>}</section>
    <section className="fleet-tabs fleet-main-tabs" role="tablist">
      <button className={fleetSection==="vehicles"?"active":""} onClick={()=>setFleetSection("vehicles")}><Ambulance/> المركبات <span>{operationalVehicles.length}</span></button>
      <button className={fleetSection==="fuel"?"active":""} onClick={()=>{setFleetSection("fuel");setTab("fill");setDraft({filledAt:`${today}T09:00`,odometerKm:selected?String(Number(selected.mileage_km||0)):""})}}><Gauge/> تعبئة الوقود <span>{fuelRows.length}</span></button>
      <button className={fleetSection==="movements"?"active":""} onClick={()=>{setFleetSection("movements");setTab("movement");setDraft({departedAt:`${today}T09:00`,kmStart:selected?String(Number(selected.mileage_km||0)):""})}}><Route/> حركة المركبات <span>{movementRows.length}</span></button>
    </section>
    <section className="panel fleet-filters"><label>من تاريخ<input type="date" value={period.from} onChange={e=>{setPeriod({...period,from:e.target.value});setFuelPage(1);setMovementPage(1)}}/></label><label>إلى تاريخ<input type="date" value={period.to} onChange={e=>{setPeriod({...period,to:e.target.value});setFuelPage(1);setMovementPage(1)}}/></label><span>إجمالي الأسطول: {data.vehicles.length} مركبة</span><button className="ghost" onClick={load}><RefreshCw/> تحديث</button></section>
    {fleetSection==="vehicles"&&<section className="fleet-metrics fleet-section-metrics"><article><b>{operationalVehicles.filter((v:any)=>v.service_status!=="maintenance").length}</b><span>داخل الخدمة</span></article><article><b>{operationalVehicles.filter((v:any)=>v.service_status==="maintenance").length}</b><span>قيد الصيانة</span></article></section>}
    {fleetSection==="fuel"&&<section className="fleet-metrics fleet-section-metrics"><article><b>{fuelRows.length}</b><span>عمليات التعبئة</span></article><article><b>{fuelLiters.toFixed(1)}</b><span>لتر مُعبّأ</span></article></section>}
    {fleetSection==="movements"&&<section className="fleet-metrics fleet-section-metrics"><article><b>{movementRows.length}</b><span>حركات مسجلة</span></article><article><b>{kmTotal.toFixed(1)}</b><span>كم من سجلات الحركة</span></article></section>}
    {fleetSection!=="vehicles"&&<section className="panel"><PanelTitle icon={PlusCircle} title={fleetSection==="fuel"?"تسجيل تعبئة وقود":"تسجيل حركة مركبة"} subtitle="يرتبط السجل بمركبة من الإعدادات، ويمكن إسناده لبلاغ موجود"/>
      <form className="fleet-form" onSubmit={save}>
        <label>المركبة *<select value={vehicleId} required onChange={e=>{const id=e.target.value;const vehicle=data.vehicles.find((v:any)=>String(v.id)===id);const reading=id?String(Number(vehicle?.mileage_km||0)):"";setVehicleId(id);setDraft(p=>({...p,incidentId:"",kmStart:reading,kmEnd:"",odometerKm:reading}))}}><option value="">اختر المركبة</option>{data.vehicles.filter((v:any)=>v.active!==0).map((v:any)=><option key={v.id} value={v.id}>{v.plate_number} — {v.fuel_type||"وقود غير محدد"}</option>)}</select></label>
        <label>البلاغ المرتبط (اختياري)<select value={draft.incidentId||""} onChange={e=>set("incidentId",e.target.value)}><option value="">لا يوجد</option>{linked.map((i:any)=><option key={i.id} value={i.id}>{i.incident_number} — {i.call_date}</option>)}</select></label>
        {tab==="fill"?<><label>تاريخ ووقت التعبئة *<DateTime24Input required value={draft.filledAt||""} onChange={value=>set("filledAt",value)}/></label><label>الكمية (لتر) *<input required type="number" step="0.01" min="0.01" value={draft.liters||""} onChange={e=>set("liters",e.target.value)}/></label><label>عداد المركبة الحالي<input readOnly type="number" step="0.1" value={draft.odometerKm||""}/></label><label>المُعبّئ من دليل الموظفين (اختياري)<select value={draft.filledByStaffId||""} onChange={e=>set("filledByStaffId",e.target.value)}><option value="">المستخدم الحالي</option>{staff.map((s:any)=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label><label>مصدر الوقود<input value={draft.sourceName||""} onChange={e=>set("sourceName",e.target.value)}/></label><label>رقم القسيمة<input value={draft.voucherNumber||""} onChange={e=>set("voucherNumber",e.target.value)}/></label></>:<><label>تاريخ ووقت الخروج *<DateTime24Input required value={draft.departedAt||""} onChange={value=>set("departedAt",value)}/></label><label>تاريخ ووقت العودة<DateTime24Input value={draft.returnedAt||""} onChange={value=>set("returnedAt",value)}/></label><label>عداد البداية (كم) *<input readOnly required type="number" step="0.1" value={draft.kmStart||""}/></label><label>عداد النهاية (كم)<input type="number" step="0.1" min={Number(selected?.mileage_km||0)} value={draft.kmEnd||""} onChange={e=>set("kmEnd",e.target.value)}/></label><label>الوجهة<input value={draft.destination||""} onChange={e=>set("destination",e.target.value)}/></label></>}
        <label>السائق من دليل الموظفين<select value={draft.driverStaffId||""} onChange={e=>{const v=staff.find((x:any)=>String(x.id)===e.target.value);setDraft({...draft,driverStaffId:e.target.value,driverName:v?.full_name||draft.driverName||""})}}><option value="">غير موجود بالدليل</option>{staff.map((s:any)=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label><label>اسم السائق<input value={draft.driverName||""} onChange={e=>set("driverName",e.target.value)}/></label><label>ملاحظات<input value={draft.notes||""} onChange={e=>set("notes",e.target.value)}/></label><button className="primary" disabled={busy}><Save/> حفظ {tab==="fill"?"التعبئة":"الحركة"}</button>
      </form></section>}
    {fleetSection==="vehicles"&&data.importReview?.length>0&&<section className="panel fleet-review"><PanelTitle icon={AlertTriangle} title="سجلات ملف الأسطول التي تحتاج مراجعة" subtitle="لا تُستورد تلقائيًا بسبب تعارض في البيانات"/>{data.importReview.map((x:any)=><p key={x.plate}><b>{x.plate}</b> — {x.reason}</p>)}</section>}
    {fleetSection==="vehicles"&&<section className="panel table-panel fleet-directory" dir="rtl">
      <div className="fleet-section-head"><PanelTitle icon={Ambulance} title="دليل المركبات" subtitle={`${fleetRows.length} نتيجة من أصل ${operationalVehicles.length} مركبة داخل الخدمة أو قيد الصيانة`}/></div>
      <div className="fleet-table-filters">
        <label className="fleet-search-label"><Search/> <input aria-label="بحث برقم اللوحة أو النوع أو مكان العمل" placeholder="رقم اللوحة أو النوع أو مكان العمل" value={vehicleFilters.search} onChange={e=>{setVehicleFilters({...vehicleFilters,search:e.target.value});setFleetPage(1)}}/></label>
        <label>المركز<select value={vehicleFilters.station} onChange={e=>{setVehicleFilters({...vehicleFilters,station:e.target.value});setFleetPage(1)}}><option value="all">كل المراكز</option>{centersData.map((center:any)=><option key={center.id} value={center.id}>{center.name}</option>)}<option value="unassigned">غير محدد</option></select></label>
        <label>نوع الوقود<select value={vehicleFilters.fuel} onChange={e=>{setVehicleFilters({...vehicleFilters,fuel:e.target.value});setFleetPage(1)}}><option value="all">جميع الأنواع</option><option value="بنزين">بنزين</option><option value="سولار">سولار</option></select></label>
        <label>حالة الخدمة<select value={vehicleFilters.status} onChange={e=>{setVehicleFilters({...vehicleFilters,status:e.target.value});setFleetPage(1)}}><option value="all">داخل الخدمة والصيانة</option><option value="active">داخل الخدمة</option><option value="maintenance">قيد الصيانة</option></select></label>
        <button className="ghost" onClick={()=>{setVehicleFilters({search:"",station:"all",fuel:"all",status:"all"});setFleetPage(1)}}><RefreshCw/> مسح</button>
      </div>
      <div className="table-wrap"><table><thead><tr><th>المركبة</th><th>الوقود</th><th>المركز / مكان العمل</th><th>الحالة</th><th>بلاغات الفترة</th><th>التعبئة (لتر)</th><th>الحركة (كم)</th>{(data.canEditVehicles||data.canDeleteVehicles)&&<th>إجراء</th>}</tr></thead><tbody>{paginatedFleetRows.map((v:any)=><tr key={v.id}><td><button type="button" className="vehicle-profile-link" onClick={()=>openVehicleProfile(v)}>{v.plate_number}</button></td><td>{v.fuel_type||"—"}</td><td>{v.center_name||v.work_location||"—"}</td><td><span className={`fleet-state ${v.active?"active":"inactive"}`}>{v.service_status==="maintenance"?"قيد الصيانة":"داخل الخدمة"}</span></td><td>{data.incidents.filter((i:any)=>i.vehicle_id===v.id || i.vehicle?.replace(/\s/g,"")===v.plate_number.replace(/\s/g,"")).length}</td><td>{data.fuel.filter((f:any)=>f.vehicle_id===v.id).reduce((s:number,f:any)=>s+Number(f.liters),0).toFixed(1)}</td><td>{data.movements.filter((m:any)=>m.vehicle_id===v.id).reduce((s:number,m:any)=>s+(m.km_end==null?0:Number(m.km_end)-Number(m.km_start)),0).toFixed(1)}</td>{(data.canEditVehicles||data.canDeleteVehicles)&&<td><div className="fleet-row-actions">{data.canEditVehicles&&<button className="employee-edit fleet-edit" aria-label={`تعديل المركبة ${v.plate_number}`} onClick={()=>setEditVehicle({...v,service_status:v.service_status|| (v.active?"active":"out_of_service")})}><Pencil/> تعديل</button>}{data.canDeleteVehicles&&<button type="button" className="employee-delete" disabled={deletingVehicleId===Number(v.id)} aria-label={`حذف المركبة ${v.plate_number}`} onClick={()=>deleteVehicle(v)}><Trash2/> {deletingVehicleId===Number(v.id)?"جاري الحذف":"حذف"}</button>}</div></td>}</tr>)}</tbody></table>{!fleetRows.length&&<Empty/>}{fleetRows.length>0&&<div className="staff-pagination"><span>عرض {(activeFleetPage-1)*fleetPageSize+1}–{Math.min(activeFleetPage*fleetPageSize,fleetRows.length)} من {fleetRows.length} مركبة</span><strong>الصفحة {activeFleetPage} من {fleetPageCount}</strong><label>عدد الصفوف<select value={fleetPageSize} onChange={event=>{setFleetPageSize(Number(event.target.value));setFleetPage(1)}}>{[10,25,50,100].map(size=><option key={size} value={size}>{size}</option>)}</select></label><nav aria-label="صفحات دليل المركبات"><button type="button" disabled={activeFleetPage===1} onClick={()=>setFleetPage(page=>Math.max(1,page-1))}>السابق</button>{Array.from({length:fleetPageCount},(_,index)=>index+1).filter(page=>page===1||page===fleetPageCount||Math.abs(page-activeFleetPage)<=2).map((page,index,pages)=><span key={page}>{index>0&&page-pages[index-1]>1&&<i>…</i>}<button type="button" className={page===activeFleetPage?"active":""} onClick={()=>setFleetPage(page)}>{page}</button></span>)}<button type="button" disabled={activeFleetPage===fleetPageCount} onClick={()=>setFleetPage(page=>Math.min(fleetPageCount,page+1))}>التالي</button></nav></div>}</div>
    </section>}
    {vehicleProfile&&<div className="modal-backdrop vehicle-profile-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setVehicleProfile(null)}}><section className="vehicle-profile-modal" dir="rtl">
      <div className="vehicle-profile-head"><div className="vehicle-profile-title"><span><Ambulance/></span><div><small>ملف المركبة</small><h2>{profileVehicle?.plate_number}</h2><p>{profileVehicle?.manufacturer||"—"} {profileVehicle?.model||""} · {profileVehicle?.center_name||profileVehicle?.work_location||"مركز غير محدد"}</p></div></div><button type="button" className="ghost" onClick={()=>setVehicleProfile(null)}><X/> إغلاق</button></div>
      {vehicleProfileLoading?<div className="vehicle-profile-loading"><RefreshCw/><b>جاري تحميل سجل المركبة…</b></div>:vehicleProfileData&&<>
        <div className="vehicle-profile-summary">
          <article><span>عداد المركبة</span><b>{Number(profileVehicle?.mileage_km||0).toFixed(1)} كم</b></article>
          <article><span>إجمالي البلاغات</span><b>{profileIncidents.length}</b></article>
          <article><span>الوقود المسجل</span><b>{profileLiters.toFixed(1)} لتر</b></article>
          <article><span>طلبات الصيانة</span><b>{profileMaintenance.length}</b></article>
          <article><span>الحركة المسجلة</span><b>{profileDistance.toFixed(1)} كم</b></article>
        </div>
        <div className="vehicle-profile-facts"><span><b>نوع الوقود:</b> {profileVehicle?.fuel_type||"غير محدد"}</span><span><b>نوع المركبة:</b> {profileVehicle?.ambulance_type||"—"}</span><span><b>حالة الخدمة:</b> {profileVehicle?.service_status==="maintenance"?"قيد الصيانة":profileVehicle?.active?"داخل الخدمة":"خارج الخدمة"}</span><span><b>مكان العمل:</b> {profileVehicle?.work_location||profileVehicle?.center_name||"—"}</span></div>
        <div className="vehicle-profile-tabs" role="tablist">
          <button className={vehicleProfileTab==="incidents"?"active":""} onClick={()=>setVehicleProfileTab("incidents")}><ClipboardList/> البلاغات <i>{profileIncidents.length}</i></button>
          <button className={vehicleProfileTab==="maintenance"?"active":""} onClick={()=>setVehicleProfileTab("maintenance")}><Wrench/> الصيانة <i>{profileMaintenance.length}</i></button>
          <button className={vehicleProfileTab==="fuel"?"active":""} onClick={()=>setVehicleProfileTab("fuel")}><Gauge/> الوقود <i>{profileFuel.length}</i></button>
          <button className={vehicleProfileTab==="movements"?"active":""} onClick={()=>setVehicleProfileTab("movements")}><Route/> الحركة والعداد <i>{profileMovements.length}</i></button>
        </div>
        <div className="vehicle-profile-content table-wrap">
          {vehicleProfileTab==="incidents"&&<table><thead><tr><th>رقم البلاغ</th><th>التاريخ والوقت</th><th>المستفيد</th><th>الحالة</th><th>الأولوية</th><th>المركز/المحطة</th><th>حالة البلاغ</th><th>المسافة</th></tr></thead><tbody>{profileIncidents.map((row:any)=><tr key={row.id}><td><button type="button" className="vehicle-profile-link" onClick={()=>onOpenIncident(Number(row.id))}>{row.incident_number}</button></td><td>{row.call_date}<small>{row.call_time||""}</small></td><td>{row.beneficiary_name||"—"}</td><td>{row.case_type||"—"}</td><td>{urgencyArabic[row.urgency]||row.urgency||"—"}</td><td>{row.station||"—"}</td><td><span className={`approval-status-badge ${row.approval_status==="draft"?"draft":"approved"}`}>{row.approval_status==="draft"?"مسودة":"معتمد"}</span></td><td>{Number(row.distance_km||0).toFixed(1)} كم</td></tr>)}</tbody></table>}
          {vehicleProfileTab==="maintenance"&&<table><thead><tr><th>التاريخ</th><th>القسم</th><th>العداد</th><th>العطل/الإصلاح المطلوب</th><th>الحالة</th><th>الإصلاح المنفذ</th><th>الاستلام</th></tr></thead><tbody>{profileMaintenance.map((row:any)=><tr key={row.id}><td>{row.request_date}</td><td>{row.department||"—"}</td><td>{Number(row.odometer_km||0).toFixed(1)}</td><td>{row.requested_repair||"—"}{row.failure_cause&&<small>{row.failure_cause}</small>}</td><td><span className={`fleet-state ${row.status==="closed"?"active":"inactive"}`}>{row.status==="closed"?"مغلق":"مفتوح"}</span></td><td>{row.performed_work||"—"}</td><td>{row.received_at||"—"}{row.received_by&&<small>{row.received_by}</small>}</td></tr>)}</tbody></table>}
          {vehicleProfileTab==="fuel"&&<table><thead><tr><th>التاريخ والوقت</th><th>الكمية</th><th>العداد</th><th>السائق</th><th>من عبّأ</th><th>البلاغ</th><th>القسيمة</th><th>المصدر</th></tr></thead><tbody>{profileFuel.map((row:any)=><tr key={row.id}><td>{formatDateTime24(row.filled_at)}</td><td><b>{Number(row.liters||0).toFixed(1)} لتر</b></td><td>{Number(row.odometer_km||0).toFixed(1)}</td><td>{row.driver_name||"—"}</td><td>{row.filled_by_name||"—"}</td><td>{row.incident_number||"—"}</td><td>{row.voucher_number||"—"}</td><td>{row.source_name||"—"}</td></tr>)}</tbody></table>}
          {vehicleProfileTab==="movements"&&<table><thead><tr><th>الخروج</th><th>العودة</th><th>السائق</th><th>الوجهة</th><th>عداد البداية</th><th>عداد النهاية</th><th>المسافة</th><th>البلاغ</th></tr></thead><tbody>{profileMovements.map((row:any)=><tr key={row.id}><td>{formatDateTime24(row.departed_at)}</td><td>{row.returned_at?formatDateTime24(row.returned_at):"قيد الحركة"}</td><td>{row.driver_name||"—"}</td><td>{row.destination||"—"}</td><td>{Number(row.km_start||0).toFixed(1)}</td><td>{row.km_end==null?"—":Number(row.km_end).toFixed(1)}</td><td>{row.km_end==null?"—":`${Math.max(0,Number(row.km_end)-Number(row.km_start)).toFixed(1)} كم`}</td><td>{row.incident_number||"—"}</td></tr>)}</tbody></table>}
          {((vehicleProfileTab==="incidents"&&!profileIncidents.length)||(vehicleProfileTab==="maintenance"&&!profileMaintenance.length)||(vehicleProfileTab==="fuel"&&!profileFuel.length)||(vehicleProfileTab==="movements"&&!profileMovements.length))&&<Empty/>}
        </div>
      </>}
    </section></div>}
    {fleetSection==="fuel"&&<section className="panel chart-report"><PanelTitle icon={BarChart3} title="التعبئة حسب المركبة" subtitle="أعلى عشر مركبات خلال الفترة، باللتر"/><ResponsiveContainer width="100%" height={290}><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip/><Bar dataKey="liters" name="لتر مُعبّأ" fill="#c4172c" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer></section>}
    {fleetSection==="fuel"&&<section className="panel table-panel"><div className="fleet-section-head"><PanelTitle icon={Activity} title="سجل التعبئة" subtitle={`${fuelRows.length} عملية ضمن الفترة المحددة`}/><button className="ghost" onClick={exportRows}><Download/> Excel (CSV)</button></div><div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>المركبة</th><th>لتر</th><th>السائق</th><th>من عبّأ</th><th>البلاغ</th><th>القسيمة</th></tr></thead><tbody>{paginatedFuelRows.map((f:any)=><tr key={f.id}><td>{formatDateTime24(f.filled_at)}</td><td>{f.plate_number}</td><td>{f.liters}</td><td>{f.driver_name||"—"}</td><td>{f.filled_by_name}</td><td>{f.incident_number||"—"}</td><td>{f.voucher_number||"—"}</td></tr>)}</tbody></table>{!fuelRows.length&&<Empty/>}{fuelRows.length>0&&<div className="staff-pagination"><span>عرض {(activeFuelPage-1)*fuelPageSize+1}–{Math.min(activeFuelPage*fuelPageSize,fuelRows.length)} من {fuelRows.length} عملية</span><strong>الصفحة {activeFuelPage} من {fuelPageCount}</strong><label>عدد الصفوف<select value={fuelPageSize} onChange={event=>{setFuelPageSize(Number(event.target.value));setFuelPage(1)}}>{[10,25,50,100].map(size=><option key={size} value={size}>{size}</option>)}</select></label><nav aria-label="صفحات سجل التعبئة"><button type="button" disabled={activeFuelPage===1} onClick={()=>setFuelPage(page=>Math.max(1,page-1))}>السابق</button>{Array.from({length:fuelPageCount},(_,index)=>index+1).filter(page=>page===1||page===fuelPageCount||Math.abs(page-activeFuelPage)<=2).map((page,index,pages)=><span key={page}>{index>0&&page-pages[index-1]>1&&<i>…</i>}<button type="button" className={page===activeFuelPage?"active":""} onClick={()=>setFuelPage(page)}>{page}</button></span>)}<button type="button" disabled={activeFuelPage===fuelPageCount} onClick={()=>setFuelPage(page=>Math.min(fuelPageCount,page+1))}>التالي</button></nav></div>}</div></section>}
    {fleetSection==="movements"&&<section className="panel table-panel"><PanelTitle icon={Route} title="سجل الحركة" subtitle={`${movementRows.length} حركة ضمن الفترة المحددة — التقرير الكامل في مركز التقارير`}/><div className="table-wrap"><table><thead><tr><th>المركبة</th><th>السائق</th><th>الخروج</th><th>العودة</th><th>عداد البداية</th><th>عداد النهاية</th><th>المسافة</th><th>البلاغ</th></tr></thead><tbody>{paginatedMovementRows.map((m:any)=><tr key={m.id}><td>{m.plate_number}</td><td>{m.driver_name||"—"}</td><td>{formatDateTime24(m.departed_at)}</td><td>{m.returned_at?formatDateTime24(m.returned_at):"—"}</td><td>{m.km_start}</td><td>{m.km_end??"—"}</td><td>{m.km_end==null?"—":(m.km_end-m.km_start).toFixed(1)}</td><td>{m.incident_number||"—"}</td></tr>)}</tbody></table>{!movementRows.length&&<Empty/>}{movementRows.length>0&&<div className="staff-pagination"><span>عرض {(activeMovementPage-1)*movementPageSize+1}–{Math.min(activeMovementPage*movementPageSize,movementRows.length)} من {movementRows.length} حركة</span><strong>الصفحة {activeMovementPage} من {movementPageCount}</strong><label>عدد الصفوف<select value={movementPageSize} onChange={event=>{setMovementPageSize(Number(event.target.value));setMovementPage(1)}}>{[10,25,50,100].map(size=><option key={size} value={size}>{size}</option>)}</select></label><nav aria-label="صفحات سجل الحركة"><button type="button" disabled={activeMovementPage===1} onClick={()=>setMovementPage(page=>Math.max(1,page-1))}>السابق</button>{Array.from({length:movementPageCount},(_,index)=>index+1).filter(page=>page===1||page===movementPageCount||Math.abs(page-activeMovementPage)<=2).map((page,index,pages)=><span key={page}>{index>0&&page-pages[index-1]>1&&<i>…</i>}<button type="button" className={page===activeMovementPage?"active":""} onClick={()=>setMovementPage(page)}>{page}</button></span>)}<button type="button" disabled={activeMovementPage===movementPageCount} onClick={()=>setMovementPage(page=>Math.min(movementPageCount,page+1))}>التالي</button></nav></div>}</div></section>}
    {editVehicle&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditVehicle(null)}}><form className="incident-detail-modal fleet-edit-modal" dir="rtl" onSubmit={saveVehicle}><div className="modal-head"><div><h2>تعديل المركبة {editVehicle.plate_number}</h2><p>تنعكس التغييرات في دليل المركبات والتقارير المرتبطة بها</p></div><button type="button" className="ghost" onClick={()=>setEditVehicle(null)}>إغلاق</button></div><div className="incident-detail-grid">{[["رقم اللوحة","plate_number"],["الشركة المصنعة","manufacturer"],["الطراز","model"],["نوع المركبة","ambulance_type"],["مكان العمل","work_location"]].map(([title,key])=><label key={key}>{title}<input required={key==="plate_number"} value={editVehicle[key]||""} onChange={e=>setEditVehicle({...editVehicle,[key]:e.target.value})}/></label>)}<label>عداد المركبة الحالي<input required type="number" min={Number(editVehicle.mileage_km||0)} step="0.1" value={editVehicle.mileage_km||0} onChange={e=>setEditVehicle({...editVehicle,mileage_km:e.target.value})}/></label><label>المركز<select value={editVehicle.center_id||""} onChange={e=>setEditVehicle({...editVehicle,center_id:e.target.value})}><option value="">غير محدد</option>{stationsData.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>نوع الوقود<select value={editVehicle.fuel_type||""} onChange={e=>setEditVehicle({...editVehicle,fuel_type:e.target.value})}><option value="">غير محدد</option><option value="بنزين">بنزين</option><option value="سولار">سولار</option></select></label><label>حالة الخدمة<select disabled={editVehicle.service_status==="maintenance"} value={editVehicle.service_status||"active"} onChange={e=>setEditVehicle({...editVehicle,service_status:e.target.value})}><option value="active">داخل الخدمة</option><option value="out_of_service">خارج الخدمة</option>{editVehicle.service_status==="maintenance"&&<option value="maintenance">قيد الصيانة — تُغلق من طلب الصيانة</option>}</select></label><label>سبب الخروج من الخدمة<input value={editVehicle.out_of_service_reason||""} onChange={e=>setEditVehicle({...editVehicle,out_of_service_reason:e.target.value})}/></label></div><div className="modal-actions"><button type="button" className="ghost" onClick={()=>setEditVehicle(null)}>إلغاء</button><button className="primary" disabled={busy}><Save/> حفظ التعديلات</button></div></form></div>}
    {newVehicle&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setNewVehicle(null)}}><form className="incident-detail-modal fleet-edit-modal" dir="rtl" onSubmit={addVehicle}><div className="modal-head"><div><h2>إضافة مركبة جديدة</h2><p>أضف بيانات المركبة لتظهر في التعبئة والحركة والبلاغات</p></div><button type="button" className="ghost" onClick={()=>setNewVehicle(null)}>إغلاق</button></div><div className="incident-detail-grid">{[["رقم اللوحة","plateNumber"],["الشركة المصنعة","manufacturer"],["الطراز","model"],["نوع المركبة","ambulanceType"],["مكان العمل","workLocation"]].map(([title,key])=><label key={key}>{title}<input required={key==="plateNumber"} value={newVehicle[key]||""} onChange={e=>setNewVehicle({...newVehicle,[key]:e.target.value})}/></label>)}<label>عداد المركبة الابتدائي<input required type="number" min="0" step="0.1" value={newVehicle.mileageKm||""} onChange={e=>setNewVehicle({...newVehicle,mileageKm:e.target.value})}/></label><label>المركز<select value={newVehicle.centerId||""} onChange={e=>setNewVehicle({...newVehicle,centerId:e.target.value})}><option value="">غير محدد</option>{stationsData.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>نوع الوقود<select value={newVehicle.fuelType||""} onChange={e=>setNewVehicle({...newVehicle,fuelType:e.target.value})}><option value="">غير محدد</option><option value="بنزين">بنزين</option><option value="سولار">سولار</option></select></label></div><div className="modal-actions"><button type="button" className="ghost" onClick={()=>setNewVehicle(null)}>إلغاء</button><button className="primary" disabled={busy}><Save/> حفظ المركبة</button></div></form></div>}
  </div>;
}
