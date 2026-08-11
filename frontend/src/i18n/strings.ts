// Flat key -> string dictionaries for the EN/中 toggle. `en` is the source
// of truth for the key set; `zh` is typed against it so a missing
// translation is a compile error, not a silent runtime fallback.
// Dynamic values (numbers, domain names, backend-provided text) are NOT
// part of this dictionary -- components interpolate those with template
// literals around the static fragments returned by t(), same as they
// already interpolate backend numbers today.

export const en = {
  'app.title': 'IDG Data Quality Dashboard',

  'nav.overview': 'Overview',
  'nav.trends': 'Trends',
  'nav.kpi': 'KPI Breakdown',
  'nav.governance': 'Governance Health',

  // HeadlineIndexCard
  'overview.dqi.title': 'Data Quality Index',
  'overview.dqi.tooltip':
    "A single company-wide score for data governance maturity, so external readers (e.g. leadership) can see the state at a glance without needing the L1-L5 ladder explained first. See each Domain's Maturity Level below for the internal breakdown.",
  'overview.dqi.avgScore': 'Avg score',
  'overview.dqi.formula': 'Formula: avg Maturity Level ÷',

  // DomainRankingChart
  'overview.domainRanking.title': 'Domain Maturity Ranking',
  'overview.domainRanking.tooltip':
    "Each Domain's average Maturity Level across all its data subjects, sorted highest to lowest. Click a Domain to filter the list below to just that Domain.",

  // MaturityDistributionChart
  'overview.maturityDist.title': 'Maturity Level Distribution',
  'overview.maturityDist.tooltip':
    "Each data subject is bucketed into a bar by its current Maturity Level (L1-L5) -- a taller bar means more datasets are stuck at that level. Click a bar to filter the list below to just that level.",
  'overview.maturityDist.countSuffix': ' subjects',

  // SubjectTable
  'subjects.searchPlaceholder': 'Search subject name…',

  // LeaderboardSection
  'leaderboard.title': 'Leaderboard',
  'leaderboard.tooltip':
    "Champion cards and Spotlights only ever show improvement, never a decline ranking -- deliberately designed to encourage, not call anyone out. The public board aggregates by Owner Team; individual names only ever appear in that dataset's own detail page.",
  'leaderboard.goalLine': 'The goal is for every Domain and data subject to gradually reach L{max} -- badges show current tier, not ranking.',
  'leaderboard.weeklyDomainChampion': 'Weekly Champion · Most WoW-improved Domain',
  'leaderboard.monthlyDomainChampion': 'Monthly Champion · Most MoM-improved Domain',
  'leaderboard.weeklyTeamChampion': 'Weekly Champion Owner Team · WoW',
  'leaderboard.monthlyTeamChampion': 'Monthly Champion Owner Team · MoM',
  'leaderboard.emptyFlatWeek': "Everyone held flat this week -- keep it up!",
  'leaderboard.emptyFlatMonth': 'No Domain has improved notably this month yet -- let\'s go!',
  'leaderboard.emptyFlatWeekTeam': 'All owner teams held flat this week -- keep it up!',
  'leaderboard.emptyFlatMonthTeam': "No owner team has improved notably this month yet -- let's go!",
  'leaderboard.emptyFlatWeekSubject': 'No subject has improved notably this week yet -- keep it up!',
  'leaderboard.emptyFlatMonthSubject': "No subject has improved notably this month yet -- let's go!",
  'leaderboard.domainBadges': 'Domain badges',
  'leaderboard.teamBadges': 'Owner Team badges (by Data Owner\'s team)',
  'leaderboard.collapse': 'Collapse',
  'leaderboard.showAll': 'Show all',
  'leaderboard.subjectWall': 'Data Subject badge wall ({n})',
  'leaderboard.top3WeeklyDomain': 'Top 3 most-improved Domains this week',
  'leaderboard.top3MonthlyDomain': 'Top 3 most-improved Domains this month',
  'leaderboard.top3WeeklySubject': 'Top 3 most-improved Data Subjects this week',
  'leaderboard.top3MonthlySubject': 'Top 3 most-improved Data Subjects this month',
  'leaderboard.toGo': 'to go to L{max}',
  'leaderboard.subjectsCount': ' subjects',

  // OverviewPage
  'overview.domains': 'Domains',
  'overview.dataSubjects': 'Data Subjects',
  'overview.newInWindow': ' · last {days}d +{count}',
  'overview.filtering': 'Filtering:',
  'overview.aiHighlighted': 'AI highlighted: {list}',
  'overview.clearAll': 'Clear all',

  // TrendsPage
  'trends.periodWeek': 'Week',
  'trends.periodMonth': 'Month',
  'trends.periodYear': 'Year',
  'trends.scopeByDomain': 'By Domain',
  'trends.scopeBySubject': 'By Data Subject',
  'trends.viewingAllDomains': 'Level Distribution — All Domains',
  'trends.viewingAllSubjects': 'Level Distribution — All Data Subjects',
  'trends.stackedTooltip':
    "The stacked bar's own baseline keeps shifting, making it hard to read a single color's rise/fall in the middle -- so each Level also gets a bold line drawn on top, showing just that Level's own count trend over time, making it easy to track whether a single Level is growing or shrinking.",
  'trends.viewOnlyDomain': 'View a single Domain',
  'trends.viewOnlySubject': 'View a single Data Subject',
  'trends.weekAxisLabel': "Week (each point is that week's Monday)",
  'trends.unitDomainCount': ' Domains',
  'trends.unitSubjectCount': ' Data Subjects',
  'trends.focusedTrend': 'Maturity Level trend over the past {n} weeks{compare}',
  'trends.periodCompareSuffix': ' (~{period} comparison)',
  'trends.stackedCaption':
    "Light stacked bars = this week's total {scope} split across the 5 Levels; bold lines = each Level's own count trend over time",
  'trends.currentScore': 'Current score',
  'trends.currentLevel': 'Current Level',
  'trends.headerPrefix': 'Trends — ',
  'trends.domainFilterAll': 'All',
  'trends.sortHint':
    'Click a column header to sort by {delta} to quickly see who improved or declined the most among {scope}. Click a row to focus the trend chart above and open its detail view.',

  // KpiBreakdownPage
  'kpi.orgAverage.title': 'Company-wide Average by KPI',
  'kpi.orgAverage.tooltip':
    "Complements the Overview page's Level -- Level is a step-ladder score of \"did it hit the bar,\" this is each dimension's actual continuous score (0-1), for seeing \"how far to go\" rather than just pass/fail.",
  'kpi.orgAverage.subtitle': 'These {n} dimensions are the underlying KPIs that make up Maturity Level (L1-L5)',
  'kpi.breakdown.title': 'KPI Breakdown — ',
  'kpi.breakdown.tooltip':
    "Color depth can only be compared within the same column (the same KPI) across rows -- depth isn't comparable across different KPI columns, since each dimension is calculated differently.",
  'kpi.breakdown.caption': 'Darker color means a higher score; click a row to see the detail',

  // GovernancePage
  'governance.intro':
    "Maturity Level answers \"are we ready\"; this page answers \"how healthy is governance\" and \"who should we prioritize\" -- every chart maps directly to an actionable list.",

  // Detail drawers (shared)
  'drawer.currentScore': 'Current',
  'drawer.past8Weeks': 'Trend over the past 8 weeks',
  'drawer.kpiTooltip':
    "Continuous scores (0-1) here, a complementary view to the Maturity Level ladder above -- when Level is stuck at a rung, this shows which dimension is holding it back.",
  'domainDrawer.kpiTitle': "Domain Average KPI Breakdown (the underlying metrics behind Maturity Level)",
  'domainDrawer.subjectsTitle': 'Data Subjects in this Domain ({n})',
  'teamDrawer.subtitle':
    "Aggregated by the Data Owner's team (individual Data Steward / IT Owner names only appear in a single subject's own detail)",
  'teamDrawer.kpiTitle': "Average KPI Breakdown of Owned Subjects (the underlying metrics behind Maturity Level)",
  'teamDrawer.subjectsTitle': 'Data Subjects Owned ({n})',

  // SubjectDetailDrawer
  'subjectDrawer.noDescription': '(no description)',
  'subjectDrawer.kpiTitle': 'KPI Breakdown (the underlying metrics behind Maturity Level)',
  'subjectDrawer.ownersTitle': 'Owners',
  'subjectDrawer.unassigned': 'Unassigned',
  'subjectDrawer.assertionsTitle': 'Assertions ({n})',
  'subjectDrawer.noAssertions': 'No assertions configured yet',
  'subjectDrawer.incidentsTitle': 'Incidents ({n})',
  'subjectDrawer.noIncidents': 'No incident records',

  // AgentPanel
  'agent.title': 'Data Quality Agent',
  'agent.tryAsking': 'Try asking:',
  'agent.suggestion1': 'The top 3 Domains by current data maturity?',
  'agent.suggestion2': 'Which Domain ranks last?',
  'agent.suggestion3': "The whole company's maturity trend over time?",
  'agent.thinking': 'Thinking…',
  'agent.queryFailed': 'Query failed, please try again later.',
  'agent.inputPlaceholder': 'Ask about the data…',

  // OwnershipCoverageCard
  'gov.ownership.title': 'Ownership Coverage: Who Owns This Data?',
  'gov.ownership.tooltip':
    "The most fundamental governance gap -- a dataset with no assigned Owner has no one driving its quality. Backfilling ownership is always the fastest available action.",
  'gov.ownership.subtitle': 'Missing any of Owner/Steward/IT Owner = no one responsible',
  'gov.ownership.chartTooltip': '{domain}: {covered}/{total} fully assigned ({pct}%)',
  'gov.ownership.coverageDetail': '{covered} / {total} data subjects have all three roles assigned',
  'gov.ownership.roleChip': '{role} {pct}% (missing {missing})',
  'gov.ownership.pendingTitle': 'Pending assignment ({n}{plus})',
  'gov.ownership.missingPrefix': 'missing ',

  // StewardshipCard
  'gov.steward.title': 'Stewardship Responsiveness: Is Anyone Following Up on Issues?',
  'gov.steward.tooltip':
    "Maturity Level's L4 only checks \"is a quality check in place\" -- this looks at \"once flagged, how long until someone acts\" -- complementary, not a duplicate.",
  'gov.steward.subtitle': 'Overdue = incident open for more than 7 days, still unresolved',
  'gov.steward.chartTooltip':
    '{team}<br/>Overdue 7+ days: {overdue}<br/>Currently open: {open}<br/>Avg resolution time: {avg} hrs',
  'gov.steward.mostResponsive': 'Fastest responder this week: {team}',
  'gov.steward.rowDetail': 'Open {open} · Avg resolution {avg} hrs · Resolved this week {resolved}',

  // LineageCoverageCard
  'gov.lineage.title': 'Lineage Coverage: Can You See the Blast Radius When Something Breaks?',
  'gov.lineage.tooltip':
    "Datasets with zero lineage are blind spots -- when they break, no one knows who's affected. Datasets with many downstream dependents but a low Level pose the widest blast radius and should be prioritized.",
  'gov.lineage.subtitle': 'Share of datasets with a lineage record',
  'gov.lineage.detail': '{covered} / {total} data subjects have a lineage record',
  'gov.lineage.islandsTitle': 'Islands with zero lineage ({n})',
  'gov.lineage.hubsTitle': 'High-impact hubs (many downstream dependents, low Level)',
  'gov.lineage.hubDetail': '{fanOut} downstream dependents · L{level}',

  // RiskPriorityChart
  'gov.risk.title': 'Risk Priority: Who Needs Attention First?',
  'gov.risk.tooltip':
    "High-usage, low-Level datasets (bottom-right on the chart, bigger bubble) have the widest blast radius if something breaks, and should be prioritized -- not just whoever has the lowest Level alone.\n\nUsage accumulates one real day at a time from DataHub, not all 30 days at once -- a newly-onboarded dataset only appears in the ranking once it has accumulated {days} days of history.",
  'gov.risk.subtitle': 'Risk score = accumulated usage × gap from L5',
  'gov.risk.chartTooltip': '{name}({domain})<br/>Level L{level} · Usage {usage}<br/>Risk score {score}',
  'gov.risk.quadrantLabel': 'High usage × low Level\nPriority zone',
  'gov.risk.colName': 'Dataset',
  'gov.risk.colLevel': 'Current Level',
  'gov.risk.colUsage': 'Accumulated usage',
  'gov.risk.colScore': 'Risk score',
  'gov.risk.xAxisName': 'Accumulated query count (usage, up to the last 30 days)',
  'gov.risk.zombiesTitle': 'Well-governed but barely used (candidates for deprecation/consolidation)',
  'gov.risk.zombieChip': '{name} · L{level} · {usage}x',
  'gov.risk.accumulatingTitle': 'Still accumulating data (usage history under {days} days, not yet ranked)',
  'gov.risk.accumulatingChip': '{name} · {accumulated}/{min} days',

  // SubjectGrowthCard
  'gov.growth.title': 'Data Subject Growth: A Mis-classification Signal?',
  'gov.growth.tooltip':
    "A single data subject doesn't \"grow\" on its own -- what changes is the count under a given Domain. A sudden surge could be normal onboarding, but could also mean one dataset got split into several, or was mis-classified into the wrong Domain -- thresholded on an absolute count (not a percentage), since most Domains only have single-to-double-digit counts to begin with, where percentages would be too noisy.",
  'gov.growth.thresholdLine': 'Threshold: flagged when {threshold}+ added within {days} days',
  'gov.growth.totalDetail': 'data subjects company-wide, +{n} added in the last {days} days',
  'gov.growth.domainDetail': 'Now {current} · +{n} in the last {days}d',
  'gov.growth.noneFlagged': 'No Domain has surged recently -- nothing needs a second look right now.',

  // ReportsPage (AG Charts / AG Grid page, modeled on the Figma reference)
  'nav.reports': 'Reports',
  'reports.breadcrumb': 'Reports / Biz Data Platform / Global Reports',
  'reports.title': 'Biz Data Platform Dashboard',
  'reports.domainFilterLabel': 'Domain',
  'reports.domainFilterAll': 'All',
  'reports.kpi.domain': 'Domain',
  'reports.kpi.subject': 'Data Subject',
  'reports.kpi.maturity': 'Maturity Level',
  'reports.donut.title': 'Data Subject Count by Domain',
  'reports.grid.title': 'Data Subject Governance KPI',
  'reports.grid.ownership': 'Ownership Coverage',
  'reports.grid.lineage': 'Lineage Coverage',
  'reports.grid.dataQuality': 'Data Quality Index',
  'reports.grid.stewardship': 'Stewardship On-time',
  'reports.grid.chipAbove': 'Val. >4: {pct}%',
  'reports.grid.chipBelow': 'Val. <2: {pct}%',
  'reports.grid.colName': 'Data Subject',
  'reports.grid.colDomain': 'Domain',
  'reports.grid.colMaturity': 'Maturity Level',
  'reports.dimChart.title': 'Maturity Level by Domain (dimension breakdown)',
  'reports.dimChart.maturityLine': 'Maturity Level',
} as const

export type TKey = keyof typeof en

export const zh: Record<TKey, string> = {
  'app.title': 'IDG Data Quality Dashboard',

  'nav.overview': '總覽',
  'nav.trends': '週 / 月 / 年變化',
  'nav.kpi': 'KPI 拆解',
  'nav.governance': '治理健康',

  // HeadlineIndexCard
  'overview.dqi.title': 'Data Quality Index',
  'overview.dqi.tooltip':
    '全公司資料治理成熟度的單一總分,方便對外(例如管理層)一眼看懂現況,不用先解釋 L1-L5 的階梯規則。內部盤點細節請看下方各 Domain 的 Maturity Level。',
  'overview.dqi.avgScore': '平均分數',
  'overview.dqi.formula': '計算方式:平均 Maturity Level ÷',

  // DomainRankingChart
  'overview.domainRanking.title': 'Domain Maturity 排名',
  'overview.domainRanking.tooltip':
    '每個 Domain 底下所有 data subject 的 Maturity Level 平均值,由高到低排序。點一個 Domain 可以篩選下面的清單只看那個 Domain。',

  // MaturityDistributionChart
  'overview.maturityDist.title': 'Maturity Level 分佈',
  'overview.maturityDist.tooltip':
    '每個 data subject 依目前的 Maturity Level(L1-L5)分到對應的長條——柱子越高代表卡在那個等級的資料集越多。點一根柱子可以篩選下面的清單只看那個等級。',
  'overview.maturityDist.countSuffix': ' 個 subjects',

  // SubjectTable
  'subjects.searchPlaceholder': '搜尋 subject 名稱…',

  // LeaderboardSection
  'leaderboard.title': 'Leaderboard',
  'leaderboard.tooltip':
    '冠軍卡跟 Spotlight 只顯示「進步」,不會顯示退步排名,故意設計成只鼓勵、不點名——公開榜是依 Owner Team 彙總,個人名字只會出現在該資料集自己的詳情頁裡。',
  'leaderboard.goalLine': '目標是每個 Domain 跟 data subject 都逐步邁向 L{max},徽章代表目前的等級,不代表名次高低。',
  'leaderboard.weeklyDomainChampion': '本週冠軍 · WoW 進步最多的 Domain',
  'leaderboard.monthlyDomainChampion': '本月冠軍 · MoM 進步最多的 Domain',
  'leaderboard.weeklyTeamChampion': '本週最佳 Owner Team · WoW',
  'leaderboard.monthlyTeamChampion': '本月最佳 Owner Team · MoM',
  'leaderboard.emptyFlatWeek': '這週大家都持平,繼續加油!',
  'leaderboard.emptyFlatMonth': '這個月還沒有明顯進步的 Domain,一起加油!',
  'leaderboard.emptyFlatWeekTeam': '這週各 owner team 都持平,繼續加油!',
  'leaderboard.emptyFlatMonthTeam': '這個月還沒有 owner team 明顯進步,一起加油!',
  'leaderboard.emptyFlatWeekSubject': '這週還沒有明顯進步的 subject,一起加油!',
  'leaderboard.emptyFlatMonthSubject': '這個月還沒有明顯進步的 subject,一起加油!',
  'leaderboard.domainBadges': 'Domain 徽章',
  'leaderboard.teamBadges': 'Owner Team 徽章(依 Data Owner 所屬單位)',
  'leaderboard.collapse': '收合',
  'leaderboard.showAll': '顯示全部',
  'leaderboard.subjectWall': 'Data Subject 徽章牆 ({n})',
  'leaderboard.top3WeeklyDomain': '本週最進步 Domain Top 3',
  'leaderboard.top3MonthlyDomain': '本月最進步 Domain Top 3',
  'leaderboard.top3WeeklySubject': '本週最進步 Data Subjects Top 3',
  'leaderboard.top3MonthlySubject': '本月最進步 Data Subjects Top 3',
  'leaderboard.toGo': '距離 L{max} 還差',
  'leaderboard.subjectsCount': ' 個 subjects',

  // OverviewPage
  'overview.domains': 'Domains',
  'overview.dataSubjects': 'Data Subjects',
  'overview.newInWindow': ' · 近 {days} 天 +{count}',
  'overview.filtering': '篩選中:',
  'overview.aiHighlighted': 'AI 標示: {list}',
  'overview.clearAll': '清除全部',

  // TrendsPage
  'trends.periodWeek': '週',
  'trends.periodMonth': '月',
  'trends.periodYear': '年',
  'trends.scopeByDomain': '依 Domain',
  'trends.scopeBySubject': '依 Data Subject',
  'trends.viewingAllDomains': '全部 Domain 的 Level 分佈',
  'trends.viewingAllSubjects': '全部 Data Subject 的 Level 分佈',
  'trends.stackedTooltip':
    '堆疊長條本身因為底線一直在跳動,不容易單獨看中間某個顏色的漲跌,所以每個 Level 又疊了一條粗線,單獨畫出「這個 Level 的數量」自己隨週次的走勢,方便追蹤單一 Level 是變多還是變少。',
  'trends.viewOnlyDomain': '只看某個 Domain',
  'trends.viewOnlySubject': '只看某個 Data Subject',
  'trends.weekAxisLabel': '週次(每個點代表一週的週一)',
  'trends.unitDomainCount': '個 Domain 數',
  'trends.unitSubjectCount': '個 Data Subject 數',
  'trends.focusedTrend': '過去 {n} 週{compare}的 Maturity Level 趨勢',
  'trends.periodCompareSuffix': '(約{period}對比)',
  'trends.stackedCaption': '淺色堆疊長條 = 這週{scope}總數在 5 個 Level 間的組成比例;粗線 = 各 Level 數量隨週次的走勢',
  'trends.currentScore': '目前分數',
  'trends.currentLevel': '目前 Level',
  'trends.headerPrefix': '週 / 月 / 年變化 — ',
  'trends.domainFilterAll': '全部',
  'trends.sortHint': '點欄位標題可依 {delta} 排序,快速看出進步最多或退步最多的{scope}。點一列可以聚焦上方趨勢圖,也會開詳細成長狀況。',

  // KpiBreakdownPage
  'kpi.orgAverage.title': '各 KPI 全公司平均',
  'kpi.orgAverage.tooltip':
    '跟總覽頁的 Level 是兩個互補的視角:Level 是「有沒有達標」的階梯型分數,這裡是每個面向實際算出來的連續分數(0-1),用來看「還差多少」而不只是「過了沒」。',
  'kpi.orgAverage.subtitle': '這 {n} 個面向是構成 Maturity Level(L1-L5)的底層 KPI',
  'kpi.breakdown.title': 'KPI 拆解 — ',
  'kpi.breakdown.tooltip': '顏色深淺只能拿來比較「同一欄」(同一個 KPI)在不同列之間的高低,不同 KPI 欄位之間的深淺不能直接比,因為每個面向的計算方式不一樣。',
  'kpi.breakdown.caption': '顏色越深代表分數越高;點一列可以看詳細狀況',

  // GovernancePage
  'governance.intro': 'Maturity Level 回答「準備好了沒」;這頁回答「治理健康度」跟「該優先救誰」——每張圖都直接對應一份可以馬上去做的清單。',

  // Detail drawers (shared)
  'drawer.currentScore': '目前',
  'drawer.past8Weeks': '過去 8 週趨勢',
  'drawer.kpiTooltip': '這裡是連續分數(0-1),跟上面的 Maturity Level 階梯是互補視角——Level 卡在某一級時,這裡可以看出是哪個面向拖累的。',
  'domainDrawer.kpiTitle': 'Domain 平均 KPI 拆解(構成 Maturity Level 的底層指標)',
  'domainDrawer.subjectsTitle': 'Domain 內 Data Subjects ({n})',
  'teamDrawer.subtitle': '依 Data Owner 所屬單位聚合(Data Steward / IT Owner 個別姓名只會出現在單一 subject 的詳情裡)',
  'teamDrawer.kpiTitle': '旗下 subjects 平均 KPI 拆解(構成 Maturity Level 的底層指標)',
  'teamDrawer.subjectsTitle': '名下 Data Subjects ({n})',

  // SubjectDetailDrawer
  'subjectDrawer.noDescription': '（無 description）',
  'subjectDrawer.kpiTitle': 'KPI 拆解(構成 Maturity Level 的底層指標)',
  'subjectDrawer.ownersTitle': '負責人',
  'subjectDrawer.unassigned': '未指派',
  'subjectDrawer.assertionsTitle': 'Assertions ({n})',
  'subjectDrawer.noAssertions': '尚未設置任何 assertion',
  'subjectDrawer.incidentsTitle': 'Incidents ({n})',
  'subjectDrawer.noIncidents': '沒有 incident 紀錄',

  // AgentPanel
  'agent.title': 'Data Quality Agent',
  'agent.tryAsking': '試著問我:',
  'agent.suggestion1': '目前 data maturity 最高的三個 Domain?',
  'agent.suggestion2': '哪個 Domain 排名最後?',
  'agent.suggestion3': '全公司過去的 maturity 趨勢?',
  'agent.thinking': '思考中…',
  'agent.queryFailed': '查詢失敗,請稍後再試。',
  'agent.inputPlaceholder': '問問資料狀況…',

  // OwnershipCoverageCard
  'gov.ownership.title': 'Ownership 覆蓋率:誰在管這份資料?',
  'gov.ownership.tooltip': '這是最根本的治理缺口——沒有指派 Owner 的資料集等於沒人負責推動品質,補指派永遠是最快能做的 action。',
  'gov.ownership.subtitle': '缺 Owner/Steward/IT Owner 任一角色 = 沒人負責',
  'gov.ownership.chartTooltip': '{domain}: {covered}/{total} 完整指派({pct}%)',
  'gov.ownership.coverageDetail': '{covered} / {total} 個 data subject 三個角色都已指派',
  'gov.ownership.roleChip': '{role} {pct}%(缺 {missing})',
  'gov.ownership.pendingTitle': '待補指派({n}{plus})',
  'gov.ownership.missingPrefix': '缺 ',

  // StewardshipCard
  'gov.steward.title': 'Stewardship 回應力:出問題之後有沒有人管?',
  'gov.steward.tooltip': 'Maturity Level 的 L4 只看「有沒有裝品質檢查」,這裡看「檢查出問題之後,多久有人處理」——兩者互補,不是重複。',
  'gov.steward.subtitle': '逾期 = incident 開啟超過 7 天還沒解決',
  'gov.steward.chartTooltip': '{team}<br/>逾期 7 天未解決:{overdue}<br/>目前開啟中:{open}<br/>平均解決時間:{avg} 小時',
  'gov.steward.mostResponsive': '本週回應最快:{team}',
  'gov.steward.rowDetail': '開啟中 {open} · 平均解決 {avg} 小時 · 本週解決 {resolved}',

  // LineageCoverageCard
  'gov.lineage.title': 'Lineage 覆蓋率:出事時看不看得到影響範圍?',
  'gov.lineage.tooltip':
    '完全沒有 lineage 的資料集是「盲點」——壞掉的時候沒人知道會影響誰。下游依賴多但 Level 又低的資料集,一旦出問題影響會擴散最廣,應該優先補強。',
  'gov.lineage.subtitle': '有 lineage 記錄的資料集佔比',
  'gov.lineage.detail': '{covered} / {total} 個 data subject 有 lineage 記錄',
  'gov.lineage.islandsTitle': '完全沒有 lineage 的孤島({n})',
  'gov.lineage.hubsTitle': '高影響力樞紐(下游依賴多、Level 卻偏低)',
  'gov.lineage.hubDetail': '{fanOut} 個下游依賴 · L{level}',

  // RiskPriorityChart
  'gov.risk.title': '風險優先排序:誰該先救?',
  'gov.risk.tooltip':
    '使用量高但 Level 低的資料集(圖上偏右下、泡泡越大)代表一旦出問題影響範圍最廣,應該優先處理,而不是單純看誰的 Level 最低。\n\n使用量是每天從 DataHub 同步一筆、自己累積起來的,不是一次拿到 30 天——新收錄的資料集要等累積滿 {days} 天才會出現在排名裡。',
  'gov.risk.subtitle': '風險分數 = 累積使用量 × 距離 L5 的差距',
  'gov.risk.chartTooltip': '{name}({domain})<br/>Level L{level} · 累積查詢 {usage}<br/>風險分數 {score}',
  'gov.risk.quadrantLabel': '高使用量 × 低 Level\n優先處理區',
  'gov.risk.colName': '資料集',
  'gov.risk.colLevel': '目前 Level',
  'gov.risk.colUsage': '累積查詢量',
  'gov.risk.colScore': '風險分數',
  'gov.risk.xAxisName': '累積查詢次數(usage,最多近 30 天)',
  'gov.risk.zombiesTitle': '治理做得不錯但幾乎沒人用(可評估下架/整併)',
  'gov.risk.zombieChip': '{name} · L{level} · {usage} 次',
  'gov.risk.accumulatingTitle': '資料累積中(使用量歷史還不足 {days} 天,尚未列入排序)',
  'gov.risk.accumulatingChip': '{name} · {accumulated}/{min} 天',

  // SubjectGrowthCard
  'gov.growth.title': 'Data Subject 成長:是不是分類出了問題?',
  'gov.growth.tooltip':
    '單一 data subject 不會自己「成長」,會變的是某個 Domain 底下的數量。短時間內暴增,可能是正常的新資料上架,但也可能是同一份資料被拆成好幾筆、或分類分錯 Domain——用絕對數量(不是百分比)當門檻,因為多數 Domain 本來就只有個位數到幾十筆,百分比在這個量級會太吵。',
  'gov.growth.thresholdLine': '門檻:{days} 天內新增 ≥ {threshold} 筆才標記',
  'gov.growth.totalDetail': '全公司 data subjects,近 {days} 天新增 {n} 筆',
  'gov.growth.domainDetail': '目前 {current} 筆 · 近 {days} 天 +{n}',
  'gov.growth.noneFlagged': '目前沒有 Domain 短時間內大量新增,沒有需要特別確認的地方。',

  // ReportsPage
  'nav.reports': '報表',
  'reports.breadcrumb': '報表 / Biz Data Platform / 全公司報表',
  'reports.title': 'Biz Data Platform Dashboard',
  'reports.domainFilterLabel': 'Domain',
  'reports.domainFilterAll': '全部',
  'reports.kpi.domain': 'Domain 數',
  'reports.kpi.subject': 'Data Subject 數',
  'reports.kpi.maturity': 'Maturity Level',
  'reports.donut.title': '各 Domain 的 Data Subject 數量',
  'reports.grid.title': 'Data Subject 治理 KPI',
  'reports.grid.ownership': 'Ownership 覆蓋率',
  'reports.grid.lineage': 'Lineage 覆蓋率',
  'reports.grid.dataQuality': 'Data Quality Index',
  'reports.grid.stewardship': 'Stewardship 準時率',
  'reports.grid.chipAbove': 'Val. >4:{pct}%',
  'reports.grid.chipBelow': 'Val. <2:{pct}%',
  'reports.grid.colName': '資料集',
  'reports.grid.colDomain': 'Domain',
  'reports.grid.colMaturity': 'Maturity Level',
  'reports.dimChart.title': '各 Domain 的 Maturity Level(維度拆解)',
  'reports.dimChart.maturityLine': 'Maturity Level',
}
