import { Box, Grid, Typography } from '@mui/material'
import RiskPriorityChart from '../components/governance/RiskPriorityChart'
import OwnershipCoverageCard from '../components/governance/OwnershipCoverageCard'
import StewardshipCard from '../components/governance/StewardshipCard'
import LineageCoverageCard from '../components/governance/LineageCoverageCard'
import SubjectGrowthCard from '../components/governance/SubjectGrowthCard'

export default function GovernancePage() {
  return (
    <Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Maturity Level 回答「準備好了沒」;這頁回答「治理健康度」跟「該優先救誰」——每張圖都直接對應一份可以馬上去做的清單。
      </Typography>

      <Grid container spacing={2}>
        <Grid size={12}>
          <RiskPriorityChart />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <OwnershipCoverageCard />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <StewardshipCard />
        </Grid>
        <Grid size={12}>
          <LineageCoverageCard />
        </Grid>
        <Grid size={12}>
          <SubjectGrowthCard />
        </Grid>
      </Grid>
    </Box>
  )
}
