import { Flag } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../core/theme/colors';
import { useMyIssueReportsForTask } from '../hooks/useIssueReports';

/**
 * Sits at the bottom of a task's own page so staff can see, at a
 * glance, which issues they've already raised for *this specific*
 * task instance (via taskRef — see activeTaskContextStore) rather than
 * every issue they've ever raised for this task type. Renders nothing
 * when there's no task open or nothing's been raised yet.
 */
export function RaisedIssuesList({ taskRef }: { taskRef: string | null }) {
  const { t } = useTranslation();
  const { data } = useMyIssueReportsForTask(taskRef);

  if (!taskRef || !data || data.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('issueReports.raisedList.header', { count: data.length })}</Text>
      {data.map((report) => (
        <View key={report.id} style={styles.row}>
          <Flag size={14} color={colors.alert} style={styles.rowIcon} />
          <View style={styles.rowText}>
            <Text style={styles.rowComment} numberOfLines={2}>
              {report.comment}
            </Text>
            <Text style={styles.rowTime}>{new Date(report.createdAt).toLocaleString()}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  header: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  rowIcon: {
    marginTop: 2,
  },
  rowText: {
    flex: 1,
  },
  rowComment: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  rowTime: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
