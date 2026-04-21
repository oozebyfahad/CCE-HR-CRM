import type {
  Employee, AttendanceRecord, LeaveRequest, PerformanceReview,
  JobVacancy, Applicant, TrainingCourse, TrainingEnrolment,
  DisciplinaryCase, Notification,
} from '../types'

// ── Employees ─────────────────────────────────────────────────────────
export const mockEmployees: Employee[] = [
  { id:'1', employeeId:'CCE001', name:'James Mitchell',  email:'j.mitchell@cabcallexperts.com', phone:'07700 900001', department:'Operations',      jobTitle:'Dispatch Coordinator',    employmentType:'full_time', status:'active',   startDate:'2022-03-15', salary:28000, manager:'Sarah Chen',    probationStatus:'passed',       contractType:'permanent' },
  { id:'2', employeeId:'CCE002', name:'Sarah Chen',      email:'s.chen@cabcallexperts.com',     phone:'07700 900002', department:'Management',      jobTitle:'Operations Manager',       employmentType:'full_time', status:'active',   startDate:'2020-06-01', salary:45000, manager:'HR Manager',    probationStatus:'passed',       contractType:'permanent' },
  { id:'3', employeeId:'CCE003', name:'Tom Baker',       email:'t.baker@cabcallexperts.com',    phone:'07700 900003', department:'Customer Service', jobTitle:'CS Agent',                 employmentType:'full_time', status:'active',   startDate:'2023-01-10', salary:23000, manager:'Emma Wilson',   probationStatus:'passed',       contractType:'permanent' },
  { id:'4', employeeId:'CCE004', name:'Emma Wilson',     email:'e.wilson@cabcallexperts.com',   phone:'07700 900004', department:'Customer Service', jobTitle:'Team Leader',              employmentType:'full_time', status:'active',   startDate:'2021-09-15', salary:32000, manager:'Sarah Chen',    probationStatus:'passed',       contractType:'permanent' },
  { id:'5', employeeId:'CCE005', name:'Amir Hussain',    email:'a.hussain@cabcallexperts.com',  phone:'07700 900005', department:'Dispatch',         jobTitle:'Senior Dispatcher',        employmentType:'full_time', status:'active',   startDate:'2021-04-20', salary:27000, manager:'Sarah Chen',    probationStatus:'passed',       contractType:'permanent' },
  { id:'6', employeeId:'CCE006', name:'Lisa Brown',      email:'l.brown@cabcallexperts.com',    phone:'07700 900006', department:'Admin',            jobTitle:'HR Officer',               employmentType:'full_time', status:'active',   startDate:'2022-07-11', salary:26000, manager:'HR Manager',    probationStatus:'passed',       contractType:'permanent' },
  { id:'7', employeeId:'CCE007', name:'David Okafor',    email:'d.okafor@cabcallexperts.com',   phone:'07700 900007', department:'Operations',      jobTitle:'Dispatcher',               employmentType:'full_time', status:'on_leave', startDate:'2023-03-01', salary:24000, manager:'Sarah Chen',    probationStatus:'passed',       contractType:'permanent' },
  { id:'8', employeeId:'CCE008', name:'Priya Patel',     email:'p.patel@cabcallexperts.com',    phone:'07700 900008', department:'Customer Service', jobTitle:'CS Agent',                 employmentType:'part_time', status:'active',   startDate:'2023-11-15', salary:14000, manager:'Emma Wilson',   probationStatus:'in_probation', probationEndDate:'2024-05-15', contractType:'permanent' },
  { id:'9', employeeId:'CCE009', name:'Ryan Foster',     email:'r.foster@cabcallexperts.com',   phone:'07700 900009', department:'Dispatch',         jobTitle:'Night Dispatcher',         employmentType:'full_time', status:'active',   startDate:'2022-10-03', salary:25000, manager:'Amir Hussain',  probationStatus:'passed',       contractType:'permanent' },
  { id:'10',employeeId:'CCE010', name:'Natasha Reeves',  email:'n.reeves@cabcallexperts.com',   phone:'07700 900010', department:'Operations',      jobTitle:'Operations Assistant',     employmentType:'contract',  status:'active',   startDate:'2024-01-08', salary:22000, manager:'Sarah Chen',    probationStatus:'in_probation', probationEndDate:'2024-07-08', contractType:'fixed_term', contractEndDate:'2025-01-08' },
]

// ── Attendance ────────────────────────────────────────────────────────
export const mockAttendance: AttendanceRecord[] = [
  { id:'1', employeeId:'CCE001', employeeName:'James Mitchell',  department:'Operations',      date:'2026-04-10', clockIn:'08:45', clockOut:'17:15', status:'late',     hoursWorked:8.5, overtime:0   },
  { id:'2', employeeId:'CCE002', employeeName:'Sarah Chen',      department:'Management',      date:'2026-04-10', clockIn:'08:00', clockOut:'17:00', status:'present',  hoursWorked:9.0, overtime:1.0 },
  { id:'3', employeeId:'CCE003', employeeName:'Tom Baker',       department:'Customer Service',date:'2026-04-10', clockIn:undefined,clockOut:undefined,status:'absent',  hoursWorked:0,   overtime:0   },
  { id:'4', employeeId:'CCE004', employeeName:'Emma Wilson',     department:'Customer Service',date:'2026-04-10', clockIn:'08:00', clockOut:'17:00', status:'present',  hoursWorked:9.0, overtime:1.0 },
  { id:'5', employeeId:'CCE005', employeeName:'Amir Hussain',    department:'Dispatch',        date:'2026-04-10', clockIn:'09:31', clockOut:'18:00', status:'late',     hoursWorked:8.5, overtime:0   },
  { id:'6', employeeId:'CCE006', employeeName:'Lisa Brown',      department:'Admin',           date:'2026-04-10', clockIn:'08:00', clockOut:'17:00', status:'present',  hoursWorked:9.0, overtime:1.0 },
  { id:'7', employeeId:'CCE007', employeeName:'David Okafor',    department:'Operations',      date:'2026-04-10', clockIn:undefined,clockOut:undefined,status:'on_leave',hoursWorked:0,   overtime:0   },
  { id:'8', employeeId:'CCE008', employeeName:'Priya Patel',     department:'Customer Service',date:'2026-04-10', clockIn:'09:00', clockOut:'14:00', status:'present',  hoursWorked:5.0, overtime:0   },
  { id:'9', employeeId:'CCE009', employeeName:'Ryan Foster',     department:'Dispatch',        date:'2026-04-10', clockIn:'21:00', clockOut:'06:00', status:'present',  hoursWorked:9.0, overtime:1.0 },
  { id:'10',employeeId:'CCE010', employeeName:'Natasha Reeves',  department:'Operations',      date:'2026-04-10', clockIn:'09:47', clockOut:'17:00', status:'late',     hoursWorked:7.5, overtime:0   },
]

// ── Leave Requests ────────────────────────────────────────────────────
export const mockLeaveRequests: LeaveRequest[] = [
  { id:'1', employeeId:'CCE002', employeeName:'Sarah Chen',     department:'Management',      type:'annual',  startDate:'2026-04-14', endDate:'2026-04-16', days:3, status:'pending',  reason:'Family holiday' },
  { id:'2', employeeId:'CCE003', employeeName:'Tom Baker',      department:'Customer Service',type:'sick',    startDate:'2026-04-10', endDate:'2026-04-10', days:1, status:'pending',  reason:'Illness' },
  { id:'3', employeeId:'CCE004', employeeName:'Emma Wilson',    department:'Customer Service',type:'annual',  startDate:'2026-04-21', endDate:'2026-04-25', days:5, status:'pending',  reason:'Personal holiday' },
  { id:'4', employeeId:'CCE005', employeeName:'Amir Hussain',   department:'Dispatch',        type:'toil',    startDate:'2026-04-17', endDate:'2026-04-18', days:2, status:'pending',  reason:'TOIL balance' },
  { id:'5', employeeId:'CCE006', employeeName:'Lisa Brown',     department:'Admin',           type:'annual',  startDate:'2026-05-01', endDate:'2026-05-05', days:5, status:'approved', reason:'Holiday', approvedBy:'HR Manager', approvedDate:'2026-04-05' },
  { id:'6', employeeId:'CCE009', employeeName:'Ryan Foster',    department:'Dispatch',        type:'annual',  startDate:'2026-04-28', endDate:'2026-04-30', days:3, status:'approved', reason:'Break',   approvedBy:'HR Manager', approvedDate:'2026-04-06' },
  { id:'7', employeeId:'CCE001', employeeName:'James Mitchell', department:'Operations',      type:'sick',    startDate:'2026-04-08', endDate:'2026-04-09', days:2, status:'approved', reason:'Flu',     approvedBy:'Sarah Chen', approvedDate:'2026-04-08' },
]

// ── Performance Reviews ───────────────────────────────────────────────
export const mockReviews: PerformanceReview[] = [
  {
    id:'1', employeeId:'CCE001', employeeName:'James Mitchell', reviewPeriod:'Q1 2026',
    reviewDate:'2026-04-15', score:8.2, status:'scheduled', reviewerId:'CCE002', reviewerName:'Sarah Chen',
    goals:[
      { id:'g1', title:'Improve dispatch accuracy to 98%', description:'Reduce mis-dispatches', dueDate:'2026-03-31', progress:85, status:'in_progress' },
      { id:'g2', title:'Complete advanced dispatch training', description:'', dueDate:'2026-03-15', progress:100, status:'completed' },
    ],
  },
  {
    id:'2', employeeId:'CCE003', employeeName:'Tom Baker', reviewPeriod:'Q1 2026',
    reviewDate:'2026-03-31', score:5.5, status:'overdue', reviewerId:'CCE004', reviewerName:'Emma Wilson',
    goals:[
      { id:'g3', title:'Reduce average call handling time', description:'Target: under 4 mins', dueDate:'2026-03-31', progress:40, status:'overdue' },
    ],
  },
  {
    id:'3', employeeId:'CCE002', employeeName:'Sarah Chen', reviewPeriod:'Q1 2026',
    reviewDate:'2026-04-10', score:9.1, status:'completed', reviewerId:'1', reviewerName:'HR Manager',
    goals:[
      { id:'g4', title:'Reduce team overtime by 15%', description:'', dueDate:'2026-03-31', progress:100, status:'completed' },
      { id:'g5', title:'Implement new shift rota system', description:'', dueDate:'2026-02-28', progress:100, status:'completed' },
    ],
  },
]

// ── Vacancies ─────────────────────────────────────────────────────────
export const mockVacancies: JobVacancy[] = [
  { id:'1', title:'Dispatcher',          department:'Dispatch',        type:'full_time', salary:'Rs 60,000–Rs 70,000',  postedDate:'2026-03-20', closingDate:'2026-04-20', applications:18, stage:'open' },
  { id:'2', title:'Customer Service Agent', department:'Customer Service',type:'full_time', salary:'Rs 50,000–Rs 60,000',  postedDate:'2026-03-28', closingDate:'2026-04-28', applications:31, stage:'open' },
  { id:'3', title:'Night Operations Lead',  department:'Operations',   type:'full_time', salary:'Rs 80,000–Rs 100,000', postedDate:'2026-04-01', closingDate:'2026-05-01', applications:9,  stage:'open' },
  { id:'4', title:'HR Assistant',           department:'Admin',        type:'part_time', salary:'Rs 30,000–Rs 40,000',  postedDate:'2026-04-05', closingDate:'2026-05-05', applications:22, stage:'open' },
  { id:'5', title:'Senior Dispatcher',      department:'Dispatch',     type:'full_time', salary:'Rs 70,000–Rs 90,000',  postedDate:'2026-02-01', closingDate:'2026-03-01', applications:14, stage:'closed' },
]

export const mockApplicants: Applicant[] = [
  { id:'1', vacancyId:'1', name:'Michael Green',   email:'m.green@email.com',   phone:'07800 111001', appliedDate:'2026-03-22', stage:'interview', score:78 },
  { id:'2', vacancyId:'1', name:'Chloe Adams',     email:'c.adams@email.com',   phone:'07800 111002', appliedDate:'2026-03-25', stage:'screening', score:65 },
  { id:'3', vacancyId:'2', name:'Daniel Wright',   email:'d.wright@email.com',  phone:'07800 111003', appliedDate:'2026-03-29', stage:'applied',   score:0  },
  { id:'4', vacancyId:'2', name:'Fatima Nour',     email:'f.nour@email.com',    phone:'07800 111004', appliedDate:'2026-03-30', stage:'offer',     score:88 },
]

// ── Training ──────────────────────────────────────────────────────────
export const mockCourses: TrainingCourse[] = [
  { id:'1', title:'Fire Safety & Evacuation',      category:'Health & Safety', mandatory:true,  duration:'2 hours',  provider:'Internal' },
  { id:'2', title:'GDPR Awareness',                category:'Compliance',      mandatory:true,  duration:'1.5 hours',provider:'Internal' },
  { id:'3', title:'Customer Service Excellence',   category:'Skills',          mandatory:false, duration:'4 hours',  provider:'External' },
  { id:'4', title:'Dispatch System (DispatchPro)', category:'Systems',         mandatory:true,  duration:'6 hours',  provider:'Internal' },
  { id:'5', title:'Mental Health First Aid',       category:'Wellbeing',       mandatory:false, duration:'8 hours',  provider:'External' },
]

export const mockEnrolments: TrainingEnrolment[] = [
  { id:'1', employeeId:'CCE001', employeeName:'James Mitchell', courseId:'1', courseTitle:'Fire Safety & Evacuation',   status:'completed',   enrolledDate:'2025-09-01', completedDate:'2025-09-15', expiryDate:'2026-09-15' },
  { id:'2', employeeId:'CCE001', employeeName:'James Mitchell', courseId:'2', courseTitle:'GDPR Awareness',             status:'overdue',     enrolledDate:'2025-12-01' },
  { id:'3', employeeId:'CCE003', employeeName:'Tom Baker',      courseId:'3', courseTitle:'Customer Service Excellence',status:'in_progress', enrolledDate:'2026-03-01' },
  { id:'4', employeeId:'CCE002', employeeName:'Sarah Chen',     courseId:'5', courseTitle:'Mental Health First Aid',    status:'completed',   enrolledDate:'2025-11-01', completedDate:'2025-11-20', score:92 },
]

// ── Disciplinary ──────────────────────────────────────────────────────
export const mockDisciplinary: DisciplinaryCase[] = [
  { id:'1', employeeId:'CCE003', employeeName:'Tom Baker',    department:'Customer Service', type:'verbal_warning',  date:'2026-02-14', reason:'Repeated lateness (3 incidents in 4 weeks)',              outcome:'Improvement expected within 4 weeks', status:'open',     issuedBy:'Emma Wilson' },
  { id:'2', employeeId:'CCE007', employeeName:'David Okafor', department:'Operations',       type:'written_warning', date:'2026-01-08', reason:'Unauthorised absence on 3 occasions in January',          outcome:'Final warning issued if repeated',    status:'open',     issuedBy:'Sarah Chen' },
  { id:'3', employeeId:'CCE008', employeeName:'Priya Patel',  department:'Customer Service', type:'verbal_warning',  date:'2025-12-01', reason:'Use of mobile phone on the floor during shift',           outcome:'No further incidents recorded',        status:'resolved', issuedBy:'Emma Wilson' },
]

// ── Notifications ─────────────────────────────────────────────────────
export const mockNotifications: Notification[] = [
  { id:'1', type:'warning', title:'Right-to-work expiring',   message:'3 employees have right-to-work documents expiring within 14 days.',          timestamp:'2026-04-10T08:00:00Z', read:false },
  { id:'2', type:'error',   title:'Overdue performance review',message:'Tom Baker\'s Q1 review is 10 days overdue.',                                timestamp:'2026-04-10T07:30:00Z', read:false },
  { id:'3', type:'info',    title:'Leave request pending',     message:'4 leave requests are awaiting your approval.',                              timestamp:'2026-04-10T07:00:00Z', read:false },
  { id:'4', type:'success', title:'New hire onboarded',        message:'James Mitchell has completed all onboarding tasks.',                        timestamp:'2026-04-09T16:00:00Z', read:true  },
  { id:'5', type:'warning', title:'Probation review due',      message:'Priya Patel\'s probation review is due in 35 days.',                       timestamp:'2026-04-09T09:00:00Z', read:true  },
]

// ── Chart data ────────────────────────────────────────────────────────
export const headcountTrend = [
  { month:'May',  count:215 }, { month:'Jun', count:220 }, { month:'Jul', count:222 },
  { month:'Aug',  count:226 }, { month:'Sep', count:228 }, { month:'Oct', count:231 },
  { month:'Nov',  count:234 }, { month:'Dec', count:237 }, { month:'Jan', count:239 },
  { month:'Feb',  count:242 }, { month:'Mar', count:244 }, { month:'Apr', count:247 },
]

export const departmentData = [
  { name:'Operations',       value:104, color:'#2E86C1' },
  { name:'Customer Service', value:62,  color:'#10B981' },
  { name:'Dispatch',         value:49,  color:'#F59E0B' },
  { name:'Admin/Mgmt',       value:32,  color:'#8B5CF6' },
]

export const employmentTypeData = [
  { type:'Full-Time', count:168, pct:0.68, color:'#2E86C1' },
  { type:'Part-Time', count:42,  pct:0.17, color:'#10B981' },
  { type:'Contract',  count:27,  pct:0.11, color:'#F59E0B' },
  { type:'Agency',    count:10,  pct:0.04, color:'#8B5CF6' },
]

export const weeklyAttendance = [
  { day:'Mon', present:215, absent:10, late:22 },
  { day:'Tue', present:218, absent:8,  late:21 },
  { day:'Wed', present:220, absent:6,  late:21 },
  { day:'Thu', present:198, absent:8,  late:29 }, // today
  { day:'Fri', present:0,   absent:0,  late:0  },
]
