/**
 * Shared route param lists, kept separate from the navigator files to
 * avoid circular imports (screens used by multiple stacks need these
 * types without importing a specific navigator).
 */
export type ReceptionStackParamList = {
  ReceptionList: undefined;
  NewDelivery: undefined;
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
  OrderPrepTaskList: undefined;
  OrderPrepTaskDetail: { id: string };
};

export type UserManagementStackParamList = {
  UserList: undefined;
  NewUser: undefined;
  UserDetail: { id: string };
};

export type StaffStackParamList = ReceptionStackParamList &
  SellerStockStackParamList &
  Omit<PutAwayStackParamList, 'AssignTask'> &
  Omit<OrderPrepStackParamList, 'OrderPrepSessionList' | 'NewOrderPrepSession' | 'OrderPrepSessionDetail'> & {
    StaffHome: undefined;
    Attendance: undefined;
  };

export type AdminStackParamList = Omit<ReceptionStackParamList, 'NewDelivery'> &
  Omit<SellerStockStackParamList, 'NewPallet'> &
  PutAwayStackParamList &
  Omit<OrderPrepStackParamList, 'OrderPrepTaskList'> &
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
  Omit<OrderPrepStackParamList, 'NewOrderPrepSession' | 'OrderPrepTaskList'> & {
    ManagementHome: undefined;
    Dashboard: undefined;
  };
