/**
 * Shared route param lists, kept separate from the navigator files to
 * avoid circular imports (screens used by multiple stacks need these
 * types without importing a specific navigator).
 */
export type ReceptionStackParamList = {
  /** `categoryFilter` scopes the list (and its "+ New Delivery" button) to one of Reception's 4 categories — set when arriving from the new Reception menu's boxes. Omitted shows everything (unused now that each category has its own box, kept for flexibility). */
  ReceptionList: { categoryFilter?: import('../features/reception/types').ReceptionCategory } | undefined;
  NewDelivery: { presetCategory?: import('../features/reception/types').ReceptionCategory } | undefined;
  ReceptionDetail: { id: string };
};

export type SellerStockStackParamList = {
  SellerStockList: undefined;
  NewPallet: undefined;
  SellerStockDetail: { id: string };
};

export type PutAwayStackParamList = {
  PutAwayTaskList: undefined;
  AssignTask: { palletId: string };
  PutAwayTaskDetail: { id: string };
};

export type OrderPrepStackParamList = {
  OrderPrepSessionList: undefined;
  NewOrderPrepSession: undefined;
  OrderPrepSessionDetail: { id: string };
  OrderPrepTaskDetail: { id: string };
};

export type UserManagementStackParamList = {
  UserList: undefined;
  NewUser: undefined;
  UserDetail: { id: string };
};

export type StaffStackParamList = ReceptionStackParamList &
  SellerStockStackParamList &
  Omit<PutAwayStackParamList, 'AssignTask' | 'PutAwayTaskList'> &
  Omit<OrderPrepStackParamList, 'OrderPrepSessionList' | 'NewOrderPrepSession' | 'OrderPrepSessionDetail'> & {
    /** Main menu — 4 boxes (Reception, Floor Tasks, Open Pool Tasks, Issue Reporting). The one screen the Home icon is hidden on. */
    StaffHome: undefined;
    /** Once-ever selfie capture, triggered right after the first-ever Start Shift — see StaffAppShell. */
    SelfieCapture: undefined;
    /** Reception's 4-category split — see features/reception/screens/ReceptionMenuScreen.tsx. */
    ReceptionMenu: undefined;
    /** Self-serve Pick/Pack/Return/Warehousing/Backup, plus the Putaway and assigned-Order-Prep entry points — see features/floorTasks/screens/FloorTasksScreen.tsx. */
    FloorTasks: undefined;
    /** Preview for one category before it's actually started — see features/floorTasks/screens/FloorTaskDetailScreen.tsx. Nothing is created on the backend until its Start button is pressed. */
    FloorTaskDetail: { category: import('../features/floorTasks/types').FloorTaskCategory };
    /** Unifies Admin-assigned Put-Away Tasks with self-serve ready pallets — see features/putAway/screens/PutawayUnifiedScreen.tsx. */
    PutawayUnified: undefined;
    /** Open Pool Tasks — see features/openPool/screens/OpenPoolScreen.tsx. */
    OpenPool: undefined;
    /** Issue Reporting's 9-category list — see features/issueReports/screens/IssueReportingMenuScreen.tsx. */
    IssueReportingMenu: undefined;
    IssueReportForm: { category: import('../features/issueReports/types').IssueReportCategory };
  };

export type AdminStackParamList = Omit<ReceptionStackParamList, 'NewDelivery'> &
  Omit<SellerStockStackParamList, 'NewPallet'> &
  PutAwayStackParamList &
  OrderPrepStackParamList &
  UserManagementStackParamList & {
    AdminHome: undefined;
  };

/**
 * Read-only reach into the other features' data (no create/assign
 * screens — those stay Admin-only) plus the reporting Dashboard. The
 * shared detail screens (ReceptionDetail, SellerStockDetail,
 * PutAwayTaskDetail, OrderPrepSessionDetail, OrderPrepTaskDetail)
 * already gate every action by role, so Management sees the same
 * screens as Admin with none of the action buttons.
 */
export type ManagementStackParamList = Omit<ReceptionStackParamList, 'NewDelivery'> &
  Omit<SellerStockStackParamList, 'NewPallet'> &
  Omit<PutAwayStackParamList, 'AssignTask'> &
  Omit<OrderPrepStackParamList, 'NewOrderPrepSession'> & {
    ManagementHome: undefined;
    Dashboard: undefined;
  };
