import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { type BalanceCardDensity, type Language, type Preferences, type ThemePreference, formatVnd, readPreferences, resolveTheme, savePreferences } from "@/lib/preferences";

const copy = {
  en: { home: "Home", friends: "Friends", activity: "Activity", groups: "Groups", settings: "Settings", theme: "Theme", light: "Light", dark: "Dark", device: "Device", language: "Language", english: "English", vietnamese: "Vietnamese", balanceLayout: "Balance cards", expanded: "Expanded", compact: "Compact", goBack: "Go back", owes: "owes", markPaid: "Mark paid", allSettled: "All settled up", noOutstanding: "No outstanding balances.", groupWorkspace: "Group workspace", sync: "Sync", settleUp: "Settle up", remove: "Remove", totalSpent: "Total spent", members: "Members", owed: "Owed", expenses: "Expenses", balances: "Balances", groupNotFound: "Group not found", groupMissing: "The group you're looking for doesn't exist.", dashboard: "Go to Dashboard", noMembersYet: "No members yet", noExpensesYet: "No expenses yet", addExpense: "Add expense", addFirstExpense: "Add first expense", addMembers: "Add members", sharedSpending: "Shared spending, clearly", yourGroups: "Your groups", joinSync: "Join sync", newGroup: "New group", totalSharedSpending: "Total shared spending", noGroupsYet: "No groups yet", createFirstGroup: "Create your first group", recentActivity: "Recent activity", viewAll: "View all" },
  vi: { home: "Trang chủ", friends: "Bạn bè", activity: "Hoạt động", groups: "Nhóm", settings: "Cài đặt", theme: "Giao diện", light: "Sáng", dark: "Tối", device: "Theo thiết bị", language: "Ngôn ngữ", english: "Tiếng Anh", vietnamese: "Tiếng Việt", balanceLayout: "Thẻ công nợ", expanded: "Đầy đủ", compact: "Thu gọn", goBack: "Quay lại", owes: "cần trả", markPaid: "Đã thanh toán", allSettled: "Đã thanh toán xong", noOutstanding: "Không còn khoản cần thanh toán.", groupWorkspace: "Không gian nhóm", sync: "Đồng bộ", settleUp: "Thanh toán", remove: "Xóa", totalSpent: "Tổng chi", members: "Thành viên", owed: "Cần trả", expenses: "Khoản chi", balances: "Công nợ", groupNotFound: "Không tìm thấy nhóm", groupMissing: "Nhóm này không còn tồn tại.", dashboard: "Về trang chủ", noMembersYet: "Chưa có thành viên", noExpensesYet: "Chưa có khoản chi", addExpense: "Thêm khoản chi", addFirstExpense: "Thêm khoản chi đầu tiên", addMembers: "Thêm thành viên", sharedSpending: "Chia sẻ chi tiêu, rõ ràng", yourGroups: "Nhóm của bạn", joinSync: "Tham gia đồng bộ", newGroup: "Nhóm mới", totalSharedSpending: "Tổng chi tiêu chung", noGroupsYet: "Chưa có nhóm", createFirstGroup: "Tạo nhóm đầu tiên", recentActivity: "Hoạt động gần đây", viewAll: "Xem tất cả" },
} as const;
type TranslationKey = keyof typeof copy.en;

interface PreferencesContextValue extends Preferences {
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: Language) => void;
  setBalanceCardDensity: (density: BalanceCardDensity) => void;
  t: (key: TranslationKey) => string;
  formatVnd: (amount: number) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const devicePrefersDark = () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(() => readPreferences(typeof window === "undefined" ? undefined : window.localStorage, typeof navigator === "undefined" ? undefined : navigator.language));
  const [isDeviceDark, setIsDeviceDark] = useState(devicePrefersDark);
  const resolvedTheme = resolveTheme(preferences.theme, isDeviceDark);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setIsDeviceDark(event.matches);
    setIsDeviceDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  useEffect(() => { document.documentElement.classList.toggle("dark", resolvedTheme === "dark"); document.documentElement.style.colorScheme = resolvedTheme; document.documentElement.lang = preferences.language; }, [preferences.language, resolvedTheme]);
  useEffect(() => { savePreferences(window.localStorage, preferences); }, [preferences]);

  const value = useMemo<PreferencesContextValue>(() => ({
    ...preferences, resolvedTheme,
    setTheme: theme => setPreferences(current => ({ ...current, theme })),
    setLanguage: language => setPreferences(current => ({ ...current, language })),
    setBalanceCardDensity: balanceCardDensity => setPreferences(current => ({ ...current, balanceCardDensity })),
    t: key => copy[preferences.language][key],
    formatVnd: amount => formatVnd(amount, preferences.language),
  }), [preferences, resolvedTheme]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const preferences = useContext(PreferencesContext);
  if (!preferences) throw new Error("usePreferences must be used within PreferencesProvider");
  return preferences;
}
