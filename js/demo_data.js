/**
 * AI Data Analyst - Comprehensive Offline Demo Dataset
 * "global_tech_sales_2025.csv"
 */
const DEMO_DATASET = {
  id: 'demo',
  filename: 'global_tech_sales_2025.csv',
  file_size: '2.4 MB',
  uploaded_at: new Date().toISOString(),
  profile: {
    total_rows: 14850,
    total_columns: 10,
    quality_score: 96.8,
    missing_cells: 142,
    duplicate_rows: 0,
    memory_usage_mb: 2.14,
    shape: {
      rows: 14850,
      columns: 10
    },
    quality: {
      quality_score: 96.8,
      completeness: 99.04,
      uniqueness: 100,
      validity: 98.2,
      total_null_cells: 142,
      null_percentage: 0.96
    },
    kpis: {
      total_records: 14850,
      total_revenue: '$48.62M',
      avg_deal_size: '$3,274',
      conversion_rate: '23.4%',
      avg_margin: '41.8%',
      customer_satisfaction: '4.7 / 5.0'
    },
    columns: [
      {
        name: 'Transaction_ID',
        dtype: 'string',
        semantic_type: 'identifier',
        unique_count: 14850,
        null_count: 0,
        null_percentage: 0.0,
        sample_values: ['TX-10029', 'TX-10030', 'TX-10031', 'TX-10032']
      },
      {
        name: 'Region',
        dtype: 'string',
        semantic_type: 'categorical',
        unique_count: 5,
        null_count: 0,
        null_percentage: 0.0,
        distribution: {
          'North America': 5820,
          'Europe': 4130,
          'Asia Pacific': 3210,
          'Latin America': 1140,
          'Middle East & Africa': 550
        }
      },
      {
        name: 'Product_Category',
        dtype: 'string',
        semantic_type: 'categorical',
        unique_count: 4,
        null_count: 24,
        null_percentage: 0.16,
        distribution: {
          'Enterprise Cloud': 6420,
          'AI & ML Suites': 4110,
          'Cybersecurity': 2890,
          'Data Infrastructure': 1406
        }
      },
      {
        name: 'Sales_Channel',
        dtype: 'string',
        semantic_type: 'categorical',
        unique_count: 3,
        null_count: 0,
        null_percentage: 0.0,
        distribution: {
          'Direct Sales': 7890,
          'Partner Network': 4620,
          'Online Marketplace': 2340
        }
      },
      {
        name: 'Revenue_USD',
        dtype: 'float64',
        semantic_type: 'financial_metric',
        unique_count: 9420,
        null_count: 0,
        null_percentage: 0.0,
        min: 250,
        max: 85000,
        mean: 3274.07,
        median: 2850.00,
        std: 2140.50,
        q25: 1450.00,
        q75: 4800.00,
        histogram: {
          labels: ['$0-$1k', '$1k-$3k', '$3k-$5k', '$5k-$10k', '$10k-$25k', '$25k+'],
          values: [2100, 5450, 4320, 2100, 720, 160]
        }
      },
      {
        name: 'Units_Sold',
        dtype: 'int64',
        semantic_type: 'numeric',
        unique_count: 48,
        null_count: 0,
        null_percentage: 0.0,
        min: 1,
        max: 50,
        mean: 6.8,
        median: 5.0,
        std: 4.2
      },
      {
        name: 'Profit_Margin_Pct',
        dtype: 'float64',
        semantic_type: 'numeric_metric',
        unique_count: 620,
        null_count: 38,
        null_percentage: 0.25,
        min: 5.2,
        max: 78.4,
        mean: 41.8,
        median: 43.0,
        std: 11.4
      },
      {
        name: 'Customer_Rating',
        dtype: 'float64',
        semantic_type: 'numeric',
        unique_count: 25,
        null_count: 80,
        null_percentage: 0.54,
        min: 1.0,
        max: 5.0,
        mean: 4.71,
        median: 4.8,
        std: 0.38
      },
      {
        name: 'Discount_Applied_Pct',
        dtype: 'float64',
        semantic_type: 'numeric',
        unique_count: 15,
        null_count: 0,
        null_percentage: 0.0,
        min: 0.0,
        max: 35.0,
        mean: 8.4,
        median: 5.0,
        std: 6.2
      },
      {
        name: 'Transaction_Month',
        dtype: 'string',
        semantic_type: 'temporal',
        unique_count: 12,
        null_count: 0,
        null_percentage: 0.0,
        distribution: {
          'Jan 2025': 980, 'Feb 2025': 1050, 'Mar 2025': 1220,
          'Apr 2025': 1180, 'May 2025': 1290, 'Jun 2025': 1350,
          'Jul 2025': 1210, 'Aug 2025': 1280, 'Sep 2025': 1390,
          'Oct 2025': 1420, 'Nov 2025': 1610, 'Dec 2025': 1870
        }
      }
    ],
    correlations: [
      { col1: 'Revenue_USD', col2: 'Units_Sold', score: 0.78 },
      { col1: 'Revenue_USD', col2: 'Profit_Margin_Pct', score: 0.64 },
      { col1: 'Discount_Applied_Pct', col2: 'Profit_Margin_Pct', score: -0.52 },
      { col1: 'Customer_Rating', col2: 'Profit_Margin_Pct', score: 0.38 },
      { col1: 'Units_Sold', col2: 'Discount_Applied_Pct', score: 0.29 },
      { col1: 'Customer_Rating', col2: 'Discount_Applied_Pct', score: -0.18 }
    ],
    insights: [
      {
        id: 'ins-1',
        title: 'Accelerating Q4 Revenue Velocity',
        category: 'Trend',
        badge: 'High Impact',
        type: 'trend',
        score: 98,
        description: 'Revenue reached peak momentum in Q4 ($4.9M in Dec alone, +53% vs Jan baseline), driven by enterprise renewals and annual software licensing.',
        recommendation: 'Plan sales resource allocation and cloud infra capacity scaling ahead of Q3/Q4 peak cycles.'
      },
      {
        id: 'ins-2',
        title: 'Discount Erosion on Net Profit Margins',
        category: 'Correlation',
        badge: 'Warning',
        type: 'correlation',
        score: 92,
        description: 'Moderate inverse correlation (r = -0.52) detected between Discount_Applied_Pct and Profit_Margin_Pct. Deals discounted >20% yield disproportionately low net return.',
        recommendation: 'Enforce threshold approvals for partner and direct sales discounts exceeding 15%.'
      },
      {
        id: 'ins-3',
        title: 'AI & ML Suites Lead Profit Margins',
        category: 'Distribution',
        badge: 'Opportunity',
        type: 'distribution',
        score: 89,
        description: 'While Enterprise Cloud drives 43% of total revenue volume, AI & ML Suites deliver the highest average gross profit margin at 58.2%.',
        recommendation: 'Bundle AI & ML modules into Enterprise Cloud tier packages to lift blended deal value.'
      },
      {
        id: 'ins-4',
        title: 'Low Customer Rating Anomaly in Partner Channel',
        category: 'Anomaly',
        badge: 'Action Required',
        type: 'anomaly',
        score: 84,
        description: 'Transactions completed through third-party partners logged 72% of sub-3.0 customer satisfaction ratings despite representing only 31% of transactions.',
        recommendation: 'Initiate mandatory technical onboarding certification for Tier-2 partner implementation teams.'
      }
    ],
    sample_rows: [
      { Transaction_ID: 'TX-10029', Region: 'North America', Product_Category: 'Enterprise Cloud', Sales_Channel: 'Direct Sales', Revenue_USD: 14500.0, Units_Sold: 12, Profit_Margin_Pct: 48.5, Customer_Rating: 4.9, Discount_Applied_Pct: 5.0, Transaction_Month: 'Nov 2025' },
      { Transaction_ID: 'TX-10030', Region: 'Europe', Product_Category: 'AI & ML Suites', Sales_Channel: 'Partner Network', Revenue_USD: 8200.0, Units_Sold: 4, Profit_Margin_Pct: 62.1, Customer_Rating: 4.8, Discount_Applied_Pct: 0.0, Transaction_Month: 'Dec 2025' },
      { Transaction_ID: 'TX-10031', Region: 'Asia Pacific', Product_Category: 'Cybersecurity', Sales_Channel: 'Direct Sales', Revenue_USD: 5400.0, Units_Sold: 8, Profit_Margin_Pct: 39.0, Customer_Rating: 4.6, Discount_Applied_Pct: 10.0, Transaction_Month: 'Oct 2025' },
      { Transaction_ID: 'TX-10032', Region: 'North America', Product_Category: 'AI & ML Suites', Sales_Channel: 'Online Marketplace', Revenue_USD: 3100.0, Units_Sold: 2, Profit_Margin_Pct: 55.4, Customer_Rating: 5.0, Discount_Applied_Pct: 0.0, Transaction_Month: 'Nov 2025' },
      { Transaction_ID: 'TX-10033', Region: 'Latin America', Product_Category: 'Enterprise Cloud', Sales_Channel: 'Partner Network', Revenue_USD: 2400.0, Units_Sold: 3, Profit_Margin_Pct: 34.2, Customer_Rating: 4.2, Discount_Applied_Pct: 15.0, Transaction_Month: 'Aug 2025' },
      { Transaction_ID: 'TX-10034', Region: 'Europe', Product_Category: 'Data Infrastructure', Sales_Channel: 'Direct Sales', Revenue_USD: 12000.0, Units_Sold: 15, Profit_Margin_Pct: 42.0, Customer_Rating: 4.7, Discount_Applied_Pct: 8.0, Transaction_Month: 'Dec 2025' },
      { Transaction_ID: 'TX-10035', Region: 'Middle East & Africa', Product_Category: 'Cybersecurity', Sales_Channel: 'Direct Sales', Revenue_USD: 6700.0, Units_Sold: 6, Profit_Margin_Pct: 41.5, Customer_Rating: 4.5, Discount_Applied_Pct: 5.0, Transaction_Month: 'Sep 2025' },
      { Transaction_ID: 'TX-10036', Region: 'North America', Product_Category: 'Enterprise Cloud', Sales_Channel: 'Direct Sales', Revenue_USD: 24500.0, Units_Sold: 20, Profit_Margin_Pct: 51.0, Customer_Rating: 5.0, Discount_Applied_Pct: 10.0, Transaction_Month: 'Dec 2025' }
    ]
  }
};

window.DEMO_DATASET = DEMO_DATASET;
