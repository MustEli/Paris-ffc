import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { StaffAppShell } from '../features/attendance/components/StaffAppShell';
import { useShiftLifecycle } from '../features/attendance/hooks/useShiftLifecycle';
import { SelfieCaptureScreen } from '../features/attendance/screens/SelfieCaptureScreen';
import { FloorTaskDetailScreen } from '../features/floorTasks/screens/FloorTaskDetailScreen';
import { FloorTasksScreen } from '../features/floorTasks/screens/FloorTasksScreen';
import { IssueReportFormScreen } from '../features/issueReports/screens/IssueReportFormScreen';
import { IssueReportingMenuScreen } from '../features/issueReports/screens/IssueReportingMenuScreen';
import { OpenPoolScreen } from '../features/openPool/screens/OpenPoolScreen';
import { OrderPrepTaskDetailScreen } from '../features/orderPrep/screens/OrderPrepTaskDetailScreen';
import { useTaskAssignmentAlerts } from '../features/putAway/hooks/useTaskAssignmentAlerts';
import { PutAwayTaskDetailScreen } from '../features/putAway/screens/PutAwayTaskDetailScreen';
import { PutawayUnifiedScreen } from '../features/putAway/screens/PutawayUnifiedScreen';
import { NewDeliveryScreen } from '../features/reception/screens/NewDeliveryScreen';
import { ReceptionDetailScreen } from '../features/reception/screens/ReceptionDetailScreen';
import { ReceptionListScreen } from '../features/reception/screens/ReceptionListScreen';
import { ReceptionMenuScreen } from '../features/reception/screens/ReceptionMenuScreen';
import { NewPalletScreen } from '../features/sellerStock/screens/NewPalletScreen';
import { SellerStockDetailScreen } from '../features/sellerStock/screens/SellerStockDetailScreen';
import { SellerStockListScreen } from '../features/sellerStock/screens/SellerStockListScreen';
import { colors } from '../core/theme/colors';
import { StaffHomeScreen } from './screens/StaffHomeScreen';
import { type StaffStackParamList } from './types';

const Stack = createNativeStackNavigator<StaffStackParamList>();

/**
 * Staff-view redesign: no native header anywhere in this stack
 * (ShiftStatusBar, rendered once by StaffAppShell around the whole
 * thing, replaces it) — each screen carries its own in-content title
 * instead. Attendance and My Tasks are gone as routes entirely: the
 * former lives in the shift-status bar now, the latter's Put-Away half
 * moved into PutawayUnified and its Order-Prep half is reachable via
 * FloorTasks' banner (see that screen's doc comment).
 */
export function StaffNavigator() {
  // Polls for new task assignments and fires a local audible alert —
  // mounted here (not inside a specific screen) so it keeps running
  // for the whole staff session, regardless of which screen is active.
  useTaskAssignmentAlerts();
  // Heartbeat + best-effort auto-end-on-background — same reasoning,
  // needs to run regardless of which screen staff is on.
  useShiftLifecycle();

  return (
    <StaffAppShell>
      <Stack.Navigator
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Screen name="StaffHome" component={StaffHomeScreen} />
        <Stack.Screen name="SelfieCapture" component={SelfieCaptureScreen} />

        <Stack.Screen name="ReceptionMenu" component={ReceptionMenuScreen} />
        <Stack.Screen name="ReceptionList" component={ReceptionListScreen} />
        <Stack.Screen name="NewDelivery" component={NewDeliveryScreen} />
        <Stack.Screen name="ReceptionDetail" component={ReceptionDetailScreen} />

        <Stack.Screen name="SellerStockList" component={SellerStockListScreen} />
        <Stack.Screen name="NewPallet" component={NewPalletScreen} />
        <Stack.Screen name="SellerStockDetail" component={SellerStockDetailScreen} />

        <Stack.Screen name="FloorTasks" component={FloorTasksScreen} />
        <Stack.Screen name="FloorTaskDetail" component={FloorTaskDetailScreen} />
        <Stack.Screen name="PutawayUnified" component={PutawayUnifiedScreen} />
        <Stack.Screen name="PutAwayTaskDetail" component={PutAwayTaskDetailScreen} />
        <Stack.Screen name="OrderPrepTaskDetail" component={OrderPrepTaskDetailScreen} />

        <Stack.Screen name="OpenPool" component={OpenPoolScreen} />

        <Stack.Screen name="IssueReportingMenu" component={IssueReportingMenuScreen} />
        <Stack.Screen name="IssueReportForm" component={IssueReportFormScreen} />
      </Stack.Navigator>
    </StaffAppShell>
  );
}
