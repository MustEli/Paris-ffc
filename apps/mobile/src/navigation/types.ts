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

export type StaffStackParamList = ReceptionStackParamList &
  SellerStockStackParamList & {
    StaffHome: undefined;
    Attendance: undefined;
  };

export type AdminStackParamList = Omit<ReceptionStackParamList, 'NewDelivery'> &
  Omit<SellerStockStackParamList, 'NewPallet'> & {
    AdminHome: undefined;
  };
